"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const MAX_HISTORY = 20;

class NicknameHistoryService {
  /**
   * Mencatat perubahan nickname
   * @param {string} userId
   * @param {string} guildId
   * @param {string} oldName
   * @param {string} newName
   * @returns {Promise<{ ok: boolean }>}
   */
  static async recordChange(userId, guildId, oldName, newName) {
    try {
      if (oldName === newName) return { ok: true };

      const key = `nickname_history:${guildId}:${userId}`;
      const entry = {
        oldName: oldName || "Unknown",
        newName: newName || "Unknown",
        changedAt: Date.now(),
      };

      await redisManager.lpush(key, JSON.stringify(entry));
      await redisManager.ltrim(key, 0, MAX_HISTORY - 1);

      logger.info(`[NicknameHistory] ${userId} in ${guildId}: "${oldName}" -> "${newName}"`);
      return { ok: true };
    } catch (error) {
      logger.error(`[NicknameHistory] Record error:`, error);
      return { ok: false };
    }
  }

  /**
   * Mendapatkan riwayat nickname
   * @param {string} userId
   * @param {string} guildId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  static async getHistory(userId, guildId, limit = 10) {
    try {
      const key = `nickname_history:${guildId}:${userId}`;
      const rawList = await redisManager.lrange(key, 0, Math.min(limit, MAX_HISTORY) - 1);
      return rawList.map((raw) => JSON.parse(raw)).filter(Boolean);
    } catch (error) {
      logger.error(`[NicknameHistory] Get error:`, error);
      return [];
    }
  }

  /**
   * Format riwayat sebagai teks untuk tampilan
   * @param {Array} history
   * @returns {string}
   */
  static formatHistory(history) {
    if (!history || history.length === 0) return "Tidak ada riwayat perubahan nickname.";

    return history.map((entry, i) => {
      const date = new Date(entry.changedAt).toLocaleDateString("id-ID");
      return `${i + 1}. **${entry.oldName}** → **${entry.newName}** (${date})`;
    }).join("\n");
  }
}

module.exports = { NicknameHistoryService, MAX_HISTORY };
