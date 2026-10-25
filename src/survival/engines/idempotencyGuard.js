"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const IDEMPOTENCY_TTL_SECONDS = 30;

class IdempotencyGuard {
  /**
   * Memeriksa apakah aksi sudah pernah dieksekusi dalam jendela waktu
   * @param {string} userId
   * @param {string} actionKey - Identifier unik aksi (misal: "buy:item_sword_01")
   * @returns {Promise<{ isDuplicate: boolean, key: string }>}
   */
  static async check(userId, actionKey) {
    const key = `idempotency:${userId}:${actionKey}`;
    try {
      const exists = await redisManager.get(key);
      if (exists) {
        logger.warn(`[IdempotencyGuard] Duplicate blocked: ${key}`);
        return { isDuplicate: true, key };
      }
      return { isDuplicate: false, key };
    } catch (error) {
      logger.error(`[IdempotencyGuard] Check error for ${key}:`, error);
      return { isDuplicate: false, key };
    }
  }

  /**
   * Menandai aksi sebagai sudah dieksekusi
   * @param {string} userId
   * @param {string} actionKey
   * @param {number} ttlSeconds
   */
  static async mark(userId, actionKey, ttlSeconds = IDEMPOTENCY_TTL_SECONDS) {
    const key = `idempotency:${userId}:${actionKey}`;
    try {
      await redisManager.set(key, "1", "EX", ttlSeconds);
    } catch (error) {
      logger.error(`[IdempotencyGuard] Mark error for ${key}:`, error);
    }
  }

  /**
   * Wrapper eksekusi aman: cek duplikasi -> jalankan -> tandai
   * @param {string} userId
   * @param {string} actionKey
   * @param {Function} actionFn - Fungsi async yang dieksekusi
   * @param {object} options
   * @returns {Promise<{ ok: boolean, result?: any, reason?: string }>}
   */
  static async executeSafe(userId, actionKey, actionFn, options = {}) {
    const ttl = options.ttl || IDEMPOTENCY_TTL_SECONDS;
    const check = await this.check(userId, actionKey);

    if (check.isDuplicate) {
      return { ok: false, reason: "DUPLICATE_ACTION_BLOCKED" };
    }

    try {
      const result = await actionFn();
      await this.mark(userId, actionKey, ttl);
      return { ok: true, result };
    } catch (error) {
      logger.error(`[IdempotencyGuard] Action failed for ${actionKey}:`, error);
      return { ok: false, reason: "ACTION_FAILED" };
    }
  }
}

module.exports = { IdempotencyGuard, IDEMPOTENCY_TTL_SECONDS };
