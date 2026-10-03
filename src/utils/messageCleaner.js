"use strict";

/**
 * @file messageCleaner.js
 * @description Engine pengelolaan pembersihan pesan sampah otomatis & klaim upah kebersihan (5 NSF).
 * Mengatur timer penghapusan otomatis, mencegah eksploitasi spam reward (daily cap 50 NSF & cooldown 10s),
 * dan melakukan mutasi saldo secara atomik via cacheManager.
 */

const { logger } = require("../managers/logger");

const DAILY_LIMIT_NSF = 50;
const REWARD_PER_CLEANUP = 5;
const COOLDOWN_MS = 10000; // 10 detik

class MessageCleanerEngine {
  constructor() {
    // Map<messageId, TimeoutRef>
    this.activeTimers = new Map();
    // Map<userId, lastClaimTimestamp>
    this.cooldowns = new Map();
    // Map<`${userId}:${dateKey}`, currentDailyNsf>
    this.dailyClaims = new Map();
    // Set<messageId> yang sedang dalam proses penghapusan (mencegah klik ganda simultan)
    this.cleaningLocks = new Set();
  }

  /**
   * Dapatkan kunci tanggal hari ini (format YYYY-MM-DD UTC)
   * @returns {string}
   */
  getTodayDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Daftarkan timer auto-delete pada pesan Discord.
   *
   * @param {Object} message - Objek Message Discord.js
   * @param {number} [timeoutSeconds=90] - Durasi hidup pesan dalam detik
   * @returns {() => void} Fungsi pembatal timer
   */
  registerAutoDelete(message, timeoutSeconds = 90) {
    if (!message || !message.id || typeof message.delete !== "function") {
      return () => {};
    }

    // Batalkan timer sebelumnya jika ada untuk pesan yang sama
    this.cancelAutoDelete(message.id);

    const timeoutMs = Math.max(5000, timeoutSeconds * 1000);
    const timer = setTimeout(async () => {
      this.activeTimers.delete(message.id);
      try {
        await message.delete().catch(() => {});
      } catch (err) {
        logger.debug(`[MessageCleaner] Gagal auto-delete pesan ${message.id}: ${err.message}`);
      }
    }, timeoutMs);

    if (timer.unref) timer.unref();
    this.activeTimers.set(message.id, timer);

    return () => this.cancelAutoDelete(message.id);
  }

  /**
   * Batalkan timer auto-delete pesan.
   * @param {string} messageId
   */
  cancelAutoDelete(messageId) {
    if (!messageId) return;
    const timer = this.activeTimers.get(messageId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(messageId);
    }
  }

  /**
   * Kunci status pesan agar tidak diproses ganda.
   * @param {string} messageId
   * @returns {boolean} true jika berhasil mengunci, false jika sudah dikunci orang lain
   */
  acquireLock(messageId) {
    if (!messageId) return false;
    if (this.cleaningLocks.has(messageId)) return false;
    this.cleaningLocks.add(messageId);
    return true;
  }

  /**
   * Lepaskan kunci pesan.
   * @param {string} messageId
   */
  releaseLock(messageId) {
    if (messageId) {
      this.cleaningLocks.delete(messageId);
    }
  }

  /**
   * Proses klaim hadiah 5 NSF untuk pembersih pesan dengan proteksi anti-farming.
   *
   * @param {string} userId - ID pengguna yang membersihkan pesan
   * @param {Function} [incrementFn] - Fungsi mutasi saldo kustom (opsional/mock)
   * @returns {Promise<{ success: boolean, reward: number, reason?: string, currentDaily: number }>}
   */
  async claimCleanupReward(userId, incrementFn) {
    if (!userId) {
      return { success: false, reward: 0, reason: "INVALID_USER", currentDaily: 0 };
    }

    const now = Date.now();
    const lastClaim = this.cooldowns.get(userId) || 0;

    // 1. Cek Cooldown (10 detik)
    if (now - lastClaim < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - (now - lastClaim)) / 1000);
      return {
        success: false,
        reward: 0,
        reason: "COOLDOWN",
        waitSeconds,
        currentDaily: this.getDailyNsf(userId),
      };
    }

    // 2. Cek Batas Harian (Maksimal 50 NSF / 10 kali pembersihan per hari)
    const dateKey = this.getTodayDateKey();
    const claimKey = `${userId}:${dateKey}`;
    const currentDaily = this.dailyClaims.get(claimKey) || 0;

    if (currentDaily >= DAILY_LIMIT_NSF) {
      return {
        success: false,
        reward: 0,
        reason: "DAILY_LIMIT_REACHED",
        currentDaily,
      };
    }

    // 3. Catat cooldown dan update kuota harian
    this.cooldowns.set(userId, now);
    const newDaily = currentDaily + REWARD_PER_CLEANUP;
    this.dailyClaims.set(claimKey, newDaily);

    // 4. Mutasi saldo 5 NSF secara atomik via cacheManager (atau custom mock)
    try {
      if (typeof incrementFn === "function") {
        await incrementFn(userId, "starFragments", REWARD_PER_CLEANUP);
      } else {
        const cacheManager = require("../managers/cacheManager");
        await cacheManager.incrementUserSurvival(userId, "starFragments", REWARD_PER_CLEANUP);
      }
    } catch (err) {
      logger.error(`[MessageCleaner] Gagal mutasi reward NSF ke user ${userId}:`, err);
    }

    return {
      success: true,
      reward: REWARD_PER_CLEANUP,
      currentDaily: newDaily,
    };
  }

  /**
   * Ambil jumlah NSF kebersihan yang sudah didapat user hari ini.
   * @param {string} userId
   * @returns {number}
   */
  getDailyNsf(userId) {
    const dateKey = this.getTodayDateKey();
    return this.dailyClaims.get(`${userId}:${dateKey}`) || 0;
  }

  /**
   * Reset data internal (khusus keperluan testing).
   */
  resetForTesting() {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.cooldowns.clear();
    this.dailyClaims.clear();
    this.cleaningLocks.clear();
  }
}

module.exports = new MessageCleanerEngine();
