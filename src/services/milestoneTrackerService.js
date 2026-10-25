"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const MILESTONE_DEFINITIONS = [
  { id: "kills_1k", name: "Monster Slayer I", description: "Server mengalahkan 1.000 monster", metric: "totalKills", threshold: 1000, reward: { sukamajuCoins: 500 } },
  { id: "kills_10k", name: "Monster Slayer II", description: "Server mengalahkan 10.000 monster", metric: "totalKills", threshold: 10000, reward: { sukamajuCoins: 2000, starFragments: 100 } },
  { id: "crafts_500", name: "Crafting Hub", description: "Server melakukan 500 crafting", metric: "totalCrafts", threshold: 500, reward: { sukamajuCoins: 750 } },
  { id: "crafts_5k", name: "Industrial Revolution", description: "Server melakukan 5.000 crafting", metric: "totalCrafts", threshold: 5000, reward: { sukamajuCoins: 3000, scholarshipVouchers: 10 } },
  { id: "messages_100k", name: "Active Community", description: "Server mengirim 100.000 pesan", metric: "totalMessages", threshold: 100000, reward: { sukamajuCoins: 1000 } },
  { id: "members_50", name: "Growing Village", description: "Server mencapai 50 member", metric: "memberCount", threshold: 50, reward: { sukamajuCoins: 2000 } },
  { id: "members_200", name: "Thriving Town", description: "Server mencapai 200 member", metric: "memberCount", threshold: 200, reward: { sukamajuCoins: 5000, starFragments: 250 } },
  { id: "trades_1k", name: "Trade Center", description: "Server menyelesaikan 1.000 trade", metric: "totalTrades", threshold: 1000, reward: { sukamajuCoins: 1500 } },
];

class MilestoneTrackerService {
  /**
   * Memeriksa apakah ada milestone baru yang tercapai
   * @param {string} guildId
   * @param {object} currentStats - Statistik server saat ini
   * @returns {Promise<Array>} Milestone yang baru ter-unlock
   */
  static async checkMilestones(guildId, currentStats = {}) {
    try {
      const unlockedKey = `milestones_unlocked:${guildId}`;
      const unlockedRaw = await redisManager.get(unlockedKey);
      const unlockedSet = new Set(unlockedRaw ? JSON.parse(unlockedRaw) : []);

      const newlyUnlocked = [];

      for (const def of MILESTONE_DEFINITIONS) {
        if (unlockedSet.has(def.id)) continue;

        const currentValue = currentStats[def.metric] || 0;
        if (currentValue >= def.threshold) {
          newlyUnlocked.push({ ...def, achievedAt: Date.now(), actualValue: currentValue });
          unlockedSet.add(def.id);
        }
      }

      if (newlyUnlocked.length > 0) {
        await redisManager.set(unlockedKey, JSON.stringify([...unlockedSet]));
        logger.info(`[MilestoneTracker] Guild ${guildId} unlocked ${newlyUnlocked.length} milestones`);
      }

      return newlyUnlocked;
    } catch (error) {
      logger.error(`[MilestoneTracker] Error checking for guild ${guildId}:`, error);
      return [];
    }
  }

  /**
   * Mendapatkan progress semua milestone
   * @param {string} guildId
   * @param {object} currentStats
   * @returns {Promise<Array>}
   */
  static async getAllProgress(guildId, currentStats = {}) {
    try {
      const unlockedKey = `milestones_unlocked:${guildId}`;
      const unlockedRaw = await redisManager.get(unlockedKey);
      const unlockedSet = new Set(unlockedRaw ? JSON.parse(unlockedRaw) : []);

      return MILESTONE_DEFINITIONS.map((def) => ({
        ...def,
        currentValue: currentStats[def.metric] || 0,
        unlocked: unlockedSet.has(def.id),
        progress: Math.min(100, Math.round(((currentStats[def.metric] || 0) / def.threshold) * 100)),
      }));
    } catch (error) {
      logger.error(`[MilestoneTracker] Error getting progress for guild ${guildId}:`, error);
      return [];
    }
  }

  /**
   * Increment metrik server secara atomik
   * @param {string} guildId
   * @param {string} metric
   * @param {number} amount
   */
  static async incrementMetric(guildId, metric, amount = 1) {
    try {
      const key = `milestones_metric:${guildId}:${metric}`;
      for (let i = 0; i < amount; i++) {
        await redisManager.increment(key);
      }
    } catch (error) {
      logger.error(`[MilestoneTracker] Error incrementing ${metric} for guild ${guildId}:`, error);
    }
  }

  static getDefinitions() {
    return [...MILESTONE_DEFINITIONS];
  }
}

module.exports = { MilestoneTrackerService, MILESTONE_DEFINITIONS };
