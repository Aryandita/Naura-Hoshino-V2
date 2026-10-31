"use strict";

const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const DAILY_CLAIM_KEY = "arcade:daily:claim:";
const DAILY_REWARD_MP = 50;
const GAME_FEE_MP = 5;
const WIN_REWARD_MP = 25;
const DRAW_REWARD_MP = 5;

class ArcadeContract {
  /**
   * Mendapatkan saldo Medali Permainan (MP) pengguna
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getBalance(userId) {
    if (!userId) return 0;
    const profile = await cacheManager.getUserProfile(userId);
    return Number(profile?.medaliPermainan) || 0;
  }

  /**
   * Memotong biaya bermain (5 MP atau custom amount) secara atomik
   * @param {string} userId
   * @param {number} [amount=5]
   * @returns {Promise<{ ok: boolean, balance: number, reason?: string }>}
   */
  async chargeGameFee(userId, amount = GAME_FEE_MP) {
    if (!userId) return { ok: false, balance: 0, reason: "INVALID_USER" };
    const fee = Number(amount) > 0 ? Number(amount) : GAME_FEE_MP;

    const result = await cacheManager.debitUserProfile(userId, "medaliPermainan", fee);
    if (!result.ok) {
      const current = await this.getBalance(userId);
      return { ok: false, balance: current, reason: result.reason || "INSUFFICIENT_MP" };
    }

    const balance = await this.getBalance(userId);
    return { ok: true, balance };
  }

  /**
   * Memberikan reward menang (25 MP)
   * @param {string} userId
   * @returns {Promise<number>} Saldo baru
   */
  async rewardWin(userId) {
    if (!userId) return 0;
    await cacheManager.incrementUserProfile(userId, { medaliPermainan: WIN_REWARD_MP });
    return await this.getBalance(userId);
  }

  /**
   * Memberikan reward seri (5 MP)
   * @param {string} userId
   * @returns {Promise<number>} Saldo baru
   */
  async rewardDraw(userId) {
    if (!userId) return 0;
    await cacheManager.incrementUserProfile(userId, { medaliPermainan: DRAW_REWARD_MP });
    return await this.getBalance(userId);
  }

  /**
   * Kalah - tidak ada reward tambahan (fee 5 MP sudah terpotong di awal)
   * @param {string} userId
   * @returns {Promise<number>} Saldo baru
   */
  async rewardLoss(userId) {
    return await this.getBalance(userId);
  }

  /**
   * Klaim hadiah harian (50 MP)
   * @param {string} userId
   * @returns {Promise<{ ok: boolean, amount: number, balance: number, reason?: string }>}
   */
  async claimDaily(userId) {
    if (!userId) return { ok: false, amount: 0, balance: 0, reason: "INVALID_USER" };

    const todayKey = new Date().toISOString().slice(0, 10);
    const claimKey = `${DAILY_CLAIM_KEY}${userId}:${todayKey}`;

    try {
      if (redisManager.client && redisManager.client.isReady) {
        const alreadyClaimed = await redisManager.client.get(claimKey);
        if (alreadyClaimed) {
          const balance = await this.getBalance(userId);
          return { ok: false, amount: 0, balance, reason: "ALREADY_CLAIMED" };
        }
      }
    } catch (err) {
      logger.warn("[ArcadeContract] Redis check gagal:", err.message);
    }

    await cacheManager.incrementUserProfile(userId, { medaliPermainan: DAILY_REWARD_MP });
    const balance = await this.getBalance(userId);

    try {
      if (redisManager.client && redisManager.client.isReady) {
        await redisManager.client.setEx(claimKey, 86400, "1"); // 24 jam TTL
      }
    } catch (err) {
      logger.warn("[ArcadeContract] Redis set gagal:", err.message);
    }

    logger.info(`[ArcadeContract] User ${userId} klaim daily ${DAILY_REWARD_MP} MP`);
    return { ok: true, amount: DAILY_REWARD_MP, balance };
  }

  /**
   * Mendapatkan leaderboard MP per guild
   * @param {string} guildId
   * @param {number} limit
   * @returns {Promise<Array<{ userId: string, mp: number }>>}
   */
  async getLeaderboard(guildId, limit = 10) {
    const UserProfile = require("../../models/UserProfile");

    try {
      const profiles = await UserProfile.findAll({
        attributes: ["userId", "medaliPermainan"],
        order: [["medaliPermainan", "DESC"]],
        limit,
        raw: true,
      });

      return profiles.map((p) => ({
        userId: p.userId,
        mp: Number(p.medaliPermainan) || 0,
      }));
    } catch (err) {
      logger.error("[ArcadeContract] getLeaderboard error:", err.message);
      return [];
    }
  }

  /**
   * Mendapatkan global leaderboard MP
   * @param {number} limit
   * @returns {Promise<Array<{ userId: string, mp: number }>>}
   */
  async getGlobalLeaderboard(limit = 50) {
    const UserProfile = require("../../models/UserProfile");

    try {
      const profiles = await UserProfile.findAll({
        attributes: ["userId", "medaliPermainan"],
        order: [["medaliPermainan", "DESC"]],
        limit,
        raw: true,
      });

      return profiles.map((p) => ({
        userId: p.userId,
        mp: Number(p.medaliPermainan) || 0,
      }));
    } catch (err) {
      logger.error("[ArcadeContract] getGlobalLeaderboard error:", err.message);
      return [];
    }
  }

  /**
   * Cek apakah user sudah klaim daily hari ini
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async hasClaimedDaily(userId) {
    if (!userId) return true;
    const todayKey = new Date().toISOString().slice(0, 10);
    const claimKey = `${DAILY_CLAIM_KEY}${userId}:${todayKey}`;

    try {
      if (redisManager.client && redisManager.client.isReady) {
        return !!(await redisManager.client.get(claimKey));
      }
    } catch (err) {
      logger.warn("[ArcadeContract] Redis check daily gagal:", err.message);
    }
    return false;
  }
}

module.exports = new ArcadeContract();