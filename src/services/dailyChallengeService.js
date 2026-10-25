"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const CHALLENGE_TEMPLATES = [
  { type: "kill", description: "Kalahkan {count} monster di {location}", baseReward: 200 },
  { type: "craft", description: "Craft {count}x {item}", baseReward: 150 },
  { type: "collect", description: "Kumpulkan {count}x {resource}", baseReward: 100 },
  { type: "visit", description: "Kunjungi {location}", baseReward: 175 },
  { type: "social", description: "Kirim {count} pesan di server", baseReward: 75 },
  { type: "trade", description: "Selesaikan {count} trade di market", baseReward: 250 },
];

class DailyChallengeService {
  /**
   * Generate tantangan harian baru untuk guild
   * @param {string} guildId
   * @returns {Promise<{ ok: boolean, challenge?: object, reason?: string }>}
   */
  static async generateDailyChallenge(guildId) {
    try {
      const key = `daily_challenge:${guildId}`;
      const existing = await redisManager.get(key);

      if (existing) {
        const data = JSON.parse(existing);
        if (data.expiresAt > Date.now()) {
          return { ok: true, challenge: data, reason: "ALREADY_ACTIVE" };
        }
      }

      const template = CHALLENGE_TEMPLATES[Math.floor(Math.random() * CHALLENGE_TEMPLATES.length)];
      const count = Math.floor(Math.random() * 10) + 3;
      const locations = ["Desa Sukamaju", "Hutan Mistis", "Tambang Kristal", "Pelabuhan"];
      const items = ["Health Potion", "Iron Sword", "Leather Armor"];
      const resources = ["herb_common", "ore_iron", "wood_log"];

      const challenge = {
        id: `challenge_${Date.now()}`,
        guildId,
        type: template.type,
        description: template.description
          .replace("{count}", count)
          .replace("{location}", locations[Math.floor(Math.random() * locations.length)])
          .replace("{item}", items[Math.floor(Math.random() * items.length)])
          .replace("{resource}", resources[Math.floor(Math.random() * resources.length)]),
        target: count,
        reward: {
          sukamajuCoins: Math.round(template.baseReward * (1 + Math.random() * 0.5)),
          starFragments: Math.round(template.baseReward / 10),
        },
        createdAt: Date.now(),
        expiresAt: this._getNextMidnight(),
        completions: {},
      };

      const ttl = Math.ceil((challenge.expiresAt - Date.now()) / 1000);
      await redisManager.set(key, JSON.stringify(challenge), "EX", ttl);

      logger.info(`[DailyChallenge] Generated for guild ${guildId}: ${challenge.description}`);
      return { ok: true, challenge };
    } catch (error) {
      logger.error(`[DailyChallenge] Generate error for ${guildId}:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Catat progress tantangan pemain
   * @param {string} guildId
   * @param {string} userId
   * @param {number} progress
   * @returns {Promise<{ ok: boolean, completed: boolean, currentProgress: number }>}
   */
  static async recordProgress(guildId, userId, progress = 1) {
    try {
      const key = `daily_challenge:${guildId}`;
      const raw = await redisManager.get(key);
      if (!raw) return { ok: false, completed: false, currentProgress: 0 };

      const challenge = JSON.parse(raw);
      const current = (challenge.completions[userId] || 0) + progress;
      challenge.completions[userId] = current;

      const ttl = Math.ceil((challenge.expiresAt - Date.now()) / 1000);
      if (ttl <= 0) return { ok: false, completed: false, currentProgress: current };

      await redisManager.set(key, JSON.stringify(challenge), "EX", ttl);

      const completed = current >= challenge.target;
      return { ok: true, completed, currentProgress: current, target: challenge.target };
    } catch (error) {
      logger.error(`[DailyChallenge] Progress error:`, error);
      return { ok: false, completed: false, currentProgress: 0 };
    }
  }

  /**
   * Get challenge aktif
   * @param {string} guildId
   * @returns {Promise<object|null>}
   */
  static async getActiveChallenge(guildId) {
    try {
      const raw = await redisManager.get(`daily_challenge:${guildId}`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.expiresAt <= Date.now()) return null;
      return data;
    } catch (error) {
      logger.error(`[DailyChallenge] Get error:`, error);
      return null;
    }
  }

  static _getNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }
}

module.exports = { DailyChallengeService, CHALLENGE_TEMPLATES };
