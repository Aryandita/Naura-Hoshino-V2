"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

// In-memory fallback store, dipakai hanya bila Redis tidak tersedia.
// Catatan: fallback ini per-proses, jadi pada mode sharding batasnya berlaku
// per shard, bukan global. Redis tetap jalur yang disarankan di produksi.
const inMemoryStore = new Map();

// Cleanup otomatis: hapus entries yang sudah melewati window-nya
const cleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of inMemoryStore.entries()) {
      if (now >= record.resetAt) {
        inMemoryStore.delete(key);
      }
    }
  },
  10 * 60 * 1000,
); // Jalankan setiap 10 menit
if (cleanupTimer.unref) cleanupTimer.unref();

function reportSpike(commandName, userId) {
  try {
    require("../managers/trafficMonitor").recordRateLimitSpike(commandName, userId);
  } catch (_err) {
    // Intentional: Lingkungan atau modul opsional dilewati
  }
}

class RateLimiter {
  /**
   * Memeriksa sekaligus mencatat satu pemakaian kuota.
   *
   * @param {string} userId
   * @param {string} commandName
   * @param {number} limit - Jumlah maksimum request dalam satu window.
   * @param {number} windowInSeconds
   * @returns {Promise<{ limited: boolean, remaining: number, retryAfter: number }>}
   */
  static async consume(userId, commandName, limit, windowInSeconds) {
    const key = `ratelimit:${commandName}:${userId}`;

    if (redisManager.isReady) {
      const current = await redisManager.increment(key, windowInSeconds);
      if (current !== null) {
        const limited = current > limit;
        let retryAfter = 0;
        if (limited) {
          reportSpike(commandName, userId);
          const ttl = await redisManager.getTtl(key);
          retryAfter = ttl > 0 ? ttl : windowInSeconds;
        }
        return { limited, remaining: Math.max(0, limit - current), retryAfter };
      }
      // current === null berarti Redis gagal; lanjut ke fallback di bawah.
    }

    // In-memory fixed window fallback
    const now = Date.now();
    const record = inMemoryStore.get(key);

    if (!record || now >= record.resetAt) {
      inMemoryStore.set(key, {
        count: 1,
        resetAt: now + windowInSeconds * 1000,
      });
      return {
        limited: false,
        remaining: Math.max(0, limit - 1),
        retryAfter: 0,
      };
    }

    record.count++;
    const limited = record.count > limit;
    if (limited) {
      reportSpike(commandName, userId);
    }
    return {
      limited,
      remaining: Math.max(0, limit - record.count),
      retryAfter: limited ? Math.ceil((record.resetAt - now) / 1000) : 0,
    };
  }

  /**
   * Bentuk ringkas dari consume(). Dipertahankan agar seluruh pemanggil lama
   * tetap bekerja tanpa perubahan.
   *
   * @returns {Promise<boolean>} True bila user sedang kena limit.
   */
  static async isRateLimited(userId, commandName, limit, windowInSeconds) {
    const { limited } = await RateLimiter.consume(
      userId,
      commandName,
      limit,
      windowInSeconds,
    );
    return limited;
  }

  /**
   * Token bucket rate limiter per-user
   * @param {string} userId
   * @param {string} actionKey - Identifier aksi (misal: "command:survival")
   * @param {object} options - { maxTokens, refillRate, refillIntervalMs }
   * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterMs: number }>}
   */
  static async check(userId, actionKey, options = {}) {
    const maxTokens = options.maxTokens || 5;
    const refillRate = options.refillRate || 1;
    const refillIntervalMs = options.refillIntervalMs || 2000;

    const key = `ratelimit:${userId}:${actionKey}`;

    try {
      const raw = await redisManager.get(key);
      const now = Date.now();

      let tokens = maxTokens;
      let lastRefill = now;

      if (raw) {
        const data = JSON.parse(raw);
        const elapsed = now - data.lastRefill;
        const refilled = Math.floor(elapsed / refillIntervalMs) * refillRate;
        tokens = Math.min(maxTokens, data.tokens + refilled);
        lastRefill = data.lastRefill + Math.floor(elapsed / refillIntervalMs) * refillIntervalMs;
      }

      if (tokens >= 1) {
        tokens -= 1;
        await redisManager.set(key, JSON.stringify({ tokens, lastRefill }), "EX", 60);
        return { allowed: true, remaining: tokens, retryAfterMs: 0 };
      }

      const timeUntilRefill = refillIntervalMs - (now - lastRefill);
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, timeUntilRefill) };
    } catch (error) {
      logger.error(`[RateLimiter] Check error for ${userId}:${actionKey}:`, error);
      return { allowed: true, remaining: maxTokens, retryAfterMs: 0 };
    }
  }

  /**
   * Reset rate limit untuk user tertentu
   * @param {string} userId
   * @param {string} actionKey
   */
  static async reset(userId, actionKey) {
    try {
      await redisManager.del(`ratelimit:${userId}:${actionKey}`);
    } catch (error) {
      logger.error(`[RateLimiter] Reset error:`, error);
    }
  }

  /**
   * Build feedback message saat rate limited
   * @param {number} retryAfterMs
   * @returns {string}
   */
  static buildFeedbackMessage(retryAfterMs) {
    const seconds = Math.ceil(retryAfterMs / 1000);
    return `Terlalu cepat! Tunggu **${seconds} detik** sebelum mencoba lagi.`;
  }
}

RateLimiter.RateLimiter = RateLimiter;
module.exports = RateLimiter;
