"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const REPUTATION_ACTIONS = {
  tax_paid: 1,
  boss_damage_1k: 2,
  event_hosted: 5,
  quest_completed: 1,
  referral_made: 3,
  donation: 10,
  violation: -5,
};

const REPUTATION_TIERS = [
  { min: 0, label: "Newcomer", emoji: "🌱" },
  { min: 50, label: "Contributor", emoji: "⭐" },
  { min: 150, label: "Veteran", emoji: "🏅" },
  { min: 500, label: "Elite", emoji: "💎" },
  { min: 1000, label: "Legend", emoji: "👑" },
];

class GuildReputationEngine {
  /**
   * Menambah reputasi guild untuk user tertentu
   * @param {string} guildId
   * @param {string} userId
   * @param {string} actionType
   * @param {number} amount
   * @returns {Promise<{ ok: boolean, newReputation: number, tierChanged: boolean, newTier?: object }>}
   */
  static async addReputation(guildId, userId, actionType, amount = 1) {
    try {
      const basePoints = REPUTATION_ACTIONS[actionType] || 1;
      const points = basePoints * amount;

      const key = `guild_reputation:${guildId}:${userId}`;
      const currentRaw = await redisManager.get(key);
      const current = currentRaw ? parseInt(currentRaw, 10) : 0;
      const newValue = Math.max(0, current + points);

      await redisManager.set(key, String(newValue));

      const oldTier = this._getTier(current);
      const newTier = this._getTier(newValue);
      const tierChanged = oldTier.label !== newTier.label;

      if (tierChanged && points > 0) {
        logger.info(`[GuildReputation] ${userId} in ${guildId} promoted to ${newTier.label}`);
      }

      return { ok: true, newReputation: newValue, tierChanged, newTier };
    } catch (error) {
      logger.error(`[GuildReputation] Add error for ${userId} in ${guildId}:`, error);
      return { ok: false, newReputation: 0, tierChanged: false };
    }
  }

  /**
   * Mendapatkan reputasi dan tier user di guild
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<{ reputation: number, tier: object, nextTier: object|null }>}
   */
  static async getReputation(guildId, userId) {
    try {
      const key = `guild_reputation:${guildId}:${userId}`;
      const raw = await redisManager.get(key);
      const reputation = raw ? parseInt(raw, 10) : 0;
      const tier = this._getTier(reputation);
      const nextTier = REPUTATION_TIERS.find((t) => t.min > reputation) || null;

      return { reputation, tier, nextTier };
    } catch (error) {
      logger.error(`[GuildReputation] Get error for ${userId}:`, error);
      return { reputation: 0, tier: REPUTATION_TIERS[0], nextTier: REPUTATION_TIERS[1] };
    }
  }

  /**
   * Leaderboard reputasi guild
   * @param {string} guildId
   * @param {Array<string>} userIds
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  static async getLeaderboard(guildId, userIds, limit = 10) {
    try {
      const entries = [];
      for (const userId of userIds) {
        const key = `guild_reputation:${guildId}:${userId}`;
        const raw = await redisManager.get(key);
        if (raw) {
          entries.push({ userId, reputation: parseInt(raw, 10), tier: this._getTier(parseInt(raw, 10)) });
        }
      }

      entries.sort((a, b) => b.reputation - a.reputation);
      return entries.slice(0, limit);
    } catch (error) {
      logger.error(`[GuildReputation] Leaderboard error for ${guildId}:`, error);
      return [];
    }
  }

  static _getTier(reputation) {
    let tier = REPUTATION_TIERS[0];
    for (const t of REPUTATION_TIERS) {
      if (reputation >= t.min) tier = t;
    }
    return tier;
  }

  static getTiers() {
    return [...REPUTATION_TIERS];
  }

  static getActions() {
    return { ...REPUTATION_ACTIONS };
  }
}

module.exports = { GuildReputationEngine, REPUTATION_ACTIONS, REPUTATION_TIERS };
