"use strict";

const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");

const STREAK_REWARDS = [
  { day: 1, sukamajuCoins: 50, starFragments: 5, item: null },
  { day: 2, sukamajuCoins: 75, starFragments: 8, item: null },
  { day: 3, sukamajuCoins: 100, starFragments: 10, item: "herb_common" },
  { day: 4, sukamajuCoins: 125, starFragments: 12, item: null },
  { day: 5, sukamajuCoins: 150, starFragments: 15, item: null },
  { day: 6, sukamajuCoins: 175, starFragments: 18, item: "ore_iron" },
  { day: 7, sukamajuCoins: 300, starFragments: 30, item: "rare_chest" },
  { day: 14, sukamajuCoins: 750, starFragments: 75, item: "epic_chest" },
  { day: 30, sukamajuCoins: 2000, starFragments: 200, item: "legendary_chest" },
];

const DAY_MS = 86400000;

class DailyRewardService {
  /**
   * Mengambil status streak harian pemain
   * @param {string} userId
   * @returns {Promise<{ streak: number, lastClaim: number|null, canClaim: boolean, nextReward: object|null }>}
   */
  static async getStreakStatus(userId) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      if (!survival) {
        return { streak: 0, lastClaim: null, canClaim: true, nextReward: STREAK_REWARDS[0] };
      }

      const lastClaim = survival.dailyStreakLastClaim || null;
      const currentStreak = survival.dailyStreakCount || 0;
      const now = Date.now();

      let canClaim = false;
      let effectiveStreak = currentStreak;

      if (!lastClaim) {
        canClaim = true;
        effectiveStreak = 0;
      } else {
        const elapsed = now - lastClaim;
        const daysPassed = Math.floor(elapsed / DAY_MS);

        if (daysPassed >= 2) {
          effectiveStreak = 0;
          canClaim = true;
        } else if (daysPassed >= 1) {
          canClaim = true;
        } else {
          canClaim = false;
        }
      }

      const rewardIndex = STREAK_REWARDS.findIndex((r) => r.day === effectiveStreak + 1);
      const nextReward = rewardIndex !== -1 ? STREAK_REWARDS[rewardIndex] : STREAK_REWARDS[STREAK_REWARDS.length - 1];

      return {
        streak: effectiveStreak,
        lastClaim,
        canClaim,
        nextReward,
      };
    } catch (error) {
      logger.error(`[DailyReward] Error getting streak for ${userId}:`, error);
      return { streak: 0, lastClaim: null, canClaim: false, nextReward: null };
    }
  }

  /**
   * Klaim reward harian dan perbarui streak
   * @param {string} userId
   * @returns {Promise<{ ok: boolean, reason?: string, reward?: object, newStreak?: number }>}
   */
  static async claimDailyReward(userId) {
    try {
      const status = await this.getStreakStatus(userId);

      if (!status.canClaim) {
        return { ok: false, reason: "ALREADY_CLAIMED_TODAY" };
      }

      const reward = status.nextReward;
      if (!reward) {
        return { ok: false, reason: "NO_REWARD_AVAILABLE" };
      }

      const newStreak = status.streak + 1;
      const patch = {
        dailyStreakCount: newStreak,
        dailyStreakLastClaim: Date.now(),
      };

      await cacheManager.updateUserSurvival(userId, patch);

      if (reward.sukamajuCoins > 0) {
        await cacheManager.incrementUserSurvival(userId, { sukamajuCoins: reward.sukamajuCoins });
      }
      if (reward.starFragments > 0) {
        await cacheManager.incrementUserSurvival(userId, { starFragments: reward.starFragments });
      }

      logger.info(`[DailyReward] User ${userId} claimed day ${newStreak} reward`);

      return {
        ok: true,
        reward: { ...reward, actualDay: newStreak },
        newStreak,
      };
    } catch (error) {
      logger.error(`[DailyReward] Error claiming for ${userId}:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Reset streak (untuk VIP recovery atau admin action)
   * @param {string} userId
   * @param {number} resetTo - Nilai streak setelah reset (default 0)
   */
  static async resetStreak(userId, resetTo = 0) {
    try {
      await cacheManager.updateUserSurvival(userId, {
        dailyStreakCount: resetTo,
        dailyStreakLastClaim: resetTo > 0 ? Date.now() : null,
      });
      logger.info(`[DailyReward] Streak reset to ${resetTo} for user ${userId}`);
      return { ok: true, newStreak: resetTo };
    } catch (error) {
      logger.error(`[DailyReward] Error resetting streak for ${userId}:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static getRewardTable() {
    return [...STREAK_REWARDS];
  }
}

module.exports = { DailyRewardService, STREAK_REWARDS };
