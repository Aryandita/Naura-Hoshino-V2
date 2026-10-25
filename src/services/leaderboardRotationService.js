"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const ROTATION_SCHEDULES = [
  { id: "top_earner", label: "Top Earner", category: "wallet", rotationDay: 1 },
  { id: "top_crafter", label: "Top Crafter", category: "crafting", rotationDay: 2 },
  { id: "top_explorer", label: "Top Explorer", category: "exploration", rotationDay: 3 },
  { id: "top_combat", label: "Top Combatant", category: "combat", rotationDay: 4 },
  { id: "top_collector", label: "Top Collector", category: "collection", rotationDay: 5 },
  { id: "top_social", label: "Most Social", category: "social", rotationDay: 6 },
  { id: "top_level", label: "Highest Level", category: "level", rotationDay: 0 },
];

const WEEK_MS = 604800000;

class LeaderboardRotationService {
  /**
   * Mendapatkan jadwal rotasi leaderboard saat ini
   * @returns {{ current: object, next: object, nextRotationTime: number }}
   */
  static getCurrentRotation() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const current = ROTATION_SCHEDULES.find((s) => s.rotationDay === dayOfWeek) || ROTATION_SCHEDULES[0];
    const nextDay = (dayOfWeek + 1) % 7;
    const next = ROTATION_SCHEDULES.find((s) => s.rotationDay === nextDay) || ROTATION_SCHEDULES[0];

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      current,
      next,
      nextRotationTime: tomorrow.getTime(),
    };
  }

  /**
   * Mengambil snapshot leaderboard yang sedang aktif dan cache di Redis
   * @param {string} guildId
   * @param {number} limit
   * @returns {Promise<object>}
   */
  static async getActiveLeaderboard(guildId, limit = 10) {
    try {
      const rotation = this.getCurrentRotation();
      const cacheKey = `leaderboard_rotation:${guildId}:${rotation.current.id}`;

      const cached = await redisManager.get(cacheKey);
      if (cached) {
        return { ...JSON.parse(cached), fromCache: true, rotation: rotation.current };
      }

      const leaderboardService = require("./leaderboardService");
      const result = await leaderboardService.getLeaderboard(rotation.current.category, { guildId, limit });

      const payload = {
        entries: result.entries || [],
        total: result.total || 0,
        category: rotation.current.category,
        label: rotation.current.label,
        generatedAt: Date.now(),
      };

      await redisManager.set(cacheKey, JSON.stringify(payload), "EX", 3600);

      return { ...payload, fromCache: false, rotation: rotation.current };
    } catch (error) {
      logger.error(`[LeaderboardRotation] Error for guild ${guildId}:`, error);
      return { entries: [], total: 0, rotation: null, fromCache: false };
    }
  }

  /**
   * Mengarsipkan leaderboard minggu lalu ke storage persisten
   * @param {string} guildId
   * @param {object} archiveData
   */
  static async archiveWeeklyLeaderboard(guildId, archiveData) {
    try {
      const weekId = Math.floor(Date.now() / WEEK_MS);
      const archiveKey = `leaderboard_archive:${guildId}:${weekId}`;
      await redisManager.set(archiveKey, JSON.stringify(archiveData), "EX", WEEK_MS * 4 / 1000);
      logger.info(`[LeaderboardRotation] Archived week ${weekId} for guild ${guildId}`);
      return { ok: true, weekId };
    } catch (error) {
      logger.error(`[LeaderboardRotation] Archive error for guild ${guildId}:`, error);
      return { ok: false };
    }
  }

  static getSchedule() {
    return [...ROTATION_SCHEDULES];
  }
}

module.exports = { LeaderboardRotationService, ROTATION_SCHEDULES };
