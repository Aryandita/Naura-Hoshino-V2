"use strict";

const redisManager = require("../../managers/redisManager");
const cacheManager = require("../../managers/cacheManager");
const GuildClan = require("../../models/GuildClan");
const { logger } = require("../../managers/logger");

const WAR_STATE_KEY = "survival:clan_war:state";
const SERVER_BLESSING_KEY_PREFIX = "server:buff:clan_champion:";

class GuildWarEngine {
  /**
   * Ambil status Clan War aktif
   */
  static async getWarStatus() {
    if (redisManager.isReady) {
      const cached = await redisManager.getCache(WAR_STATE_KEY);
      if (cached) return typeof cached === "string" ? JSON.parse(cached) : cached;
    }

    const defaultState = {
      season: 1,
      phase: "ACTIVE", // ACTIVE, RESOLVED
      contenders: [],
      winnerClanId: null,
      winnerGuildId: null,
      blessingExpiresAt: null,
    };

    return defaultState;
  }

  /**
   * Serang base klan lawan dalam Clan War
   */
  static async attackClanBase(attackerUserId, attackerClanId, targetClanId, { power = 100 } = {}) {
    const warState = await this.getWarStatus();
    const damage = Math.floor(Math.random() * 50) + power;

    logger.info(`[ClanWar] User ${attackerUserId} (Clan ${attackerClanId}) menyerang Clan ${targetClanId} dengan ${damage} Damage!`);

    return {
      success: true,
      damage,
      message: `Serangan berhasil menembus barikade base musuh dan menghasilkan ${damage} kerusakan!`,
    };
  }

  /**
   * Nyatakan pemenang Clan War dan aktifkan Server-Wide Blessing 24 Jam
   * (2x XP Boost & 2x Stamina Regeneration untuk seluruh member di Guild pemenang)
   */
  static async declareChampion(winningClanId, guildId) {
    const warState = await this.getWarStatus();
    const blessingDurationMs = 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + blessingDurationMs);

    warState.phase = "RESOLVED";
    warState.winnerClanId = winningClanId;
    warState.winnerGuildId = guildId;
    warState.blessingExpiresAt = expiresAt.toISOString();

    if (redisManager.isReady) {
      await redisManager.setCache(WAR_STATE_KEY, JSON.stringify(warState), 86400);
      // Simpan Server Blessing Key di Redis selama 24 jam (86400 detik)
      const blessingKey = `${SERVER_BLESSING_KEY_PREFIX}${guildId}`;
      await redisManager.setCache(blessingKey, JSON.stringify({
        clanId: winningClanId,
        xpMultiplier: 2.0,
        staminaRegenMultiplier: 2.0,
        expiresAt: expiresAt.toISOString(),
      }), 86400);

      logger.success(`[ClanWar] Clan ${winningClanId} di Guild ${guildId} menang! Server Blessing 2x XP & Stamina aktif 24 jam.`);
    }

    return {
      winnerClanId: winningClanId,
      guildId,
      expiresAt,
    };
  }

  /**
   * Periksa apakah server memiliki Server Blessing aktif
   */
  static async getServerBlessing(guildId) {
    if (!guildId || !redisManager.isReady) return null;
    const blessingKey = `${SERVER_BLESSING_KEY_PREFIX}${guildId}`;
    const data = await redisManager.getCache(blessingKey);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : data;
  }
}

module.exports = GuildWarEngine;
