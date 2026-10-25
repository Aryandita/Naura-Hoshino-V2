"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const MAX_LOG_ENTRIES = 100;
const LOG_TTL_SECONDS = 604800;

class CombatLogService {
  /**
   * Mencatat log pertarungan
   * @param {string} guildId
   * @param {object} combatData - { type, participants, rounds, winnerId, durationMs, loot }
   * @returns {Promise<{ ok: boolean, logId: string }>}
   */
  static async recordCombatLog(guildId, combatData) {
    try {
      const logId = `combat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const entry = {
        id: logId,
        guildId,
        type: combatData.type || "dungeon",
        participants: combatData.participants || [],
        rounds: combatData.rounds || 0,
        winnerId: combatData.winnerId || null,
        durationMs: combatData.durationMs || 0,
        loot: combatData.loot || {},
        timestamp: Date.now(),
        stats: this._calculateStats(combatData),
      };

      const key = `combat_logs:${guildId}`;
      await redisManager.lpush(key, JSON.stringify(entry));
      await redisManager.ltrim(key, 0, MAX_LOG_ENTRIES - 1);

      const detailKey = `combat_log_detail:${logId}`;
      await redisManager.set(detailKey, JSON.stringify(entry), "EX", LOG_TTL_SECONDS);

      logger.info(`[CombatLog] Recorded ${logId} (${combatData.type}) for guild ${guildId}`);
      return { ok: true, logId };
    } catch (error) {
      logger.error(`[CombatLog] Record error for guild ${guildId}:`, error);
      return { ok: false, logId: null };
    }
  }

  /**
   * Mendapatkan riwayat combat log dengan pagination
   * @param {string} guildId
   * @param {object} options - { page, limit, filterType, userId }
   * @returns {Promise<{ logs: Array, total: number, page: number }>}
   */
  static async getCombatLogs(guildId, options = {}) {
    try {
      const key = `combat_logs:${guildId}`;
      const allLogs = await redisManager.lrange(key, 0, -1);

      let parsed = allLogs.map((raw) => JSON.parse(raw)).filter(Boolean);

      if (options.filterType) {
        parsed = parsed.filter((l) => l.type === options.filterType);
      }
      if (options.userId) {
        parsed = parsed.filter((l) => l.participants.some((p) => p.userId === options.userId));
      }

      const total = parsed.length;
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(20, Math.max(1, options.limit || 5));
      const start = (page - 1) * limit;

      return {
        logs: parsed.slice(start, start + limit),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`[CombatLog] Get error for guild ${guildId}:`, error);
      return { logs: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  /**
   * Mendapatkan detail lengkap satu combat log
   * @param {string} logId
   * @returns {Promise<object|null>}
   */
  static async getLogDetail(logId) {
    try {
      const raw = await redisManager.get(`combat_log_detail:${logId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      logger.error(`[CombatLog] Detail error for ${logId}:`, error);
      return null;
    }
  }

  /**
   * Generate replay summary teks dari combat log
   * @param {object} logEntry
   * @returns {string}
   */
  static generateSummary(logEntry) {
    if (!logEntry) return "Log tidak ditemukan.";

    const participantNames = (logEntry.participants || []).map((p) => p.name || p.userId).join(", ");
    const duration = Math.round((logEntry.durationMs || 0) / 1000);

    let summary = `**${logEntry.type.toUpperCase()}** - ${new Date(logEntry.timestamp).toLocaleDateString("id-ID")}\n`;
    summary += `Peserta: ${participantNames}\n`;
    summary += `Durasi: ${duration}s | Ronde: ${logEntry.rounds}\n`;
    summary += `Pemenang: ${logEntry.winnerId || "Draw"}\n`;

    if (logEntry.stats) {
      summary += `\n**Statistik:**\n`;
      summary += `- Total Damage: ${logEntry.stats.totalDamage?.toLocaleString("id-ID") || 0}\n`;
      summary += `- Avg DPS: ${logEntry.stats.avgDps?.toLocaleString("id-ID") || 0}\n`;
      summary += `- MVP: ${logEntry.stats.mvp || "N/A"}\n`;
    }

    return summary;
  }

  static _calculateStats(combatData) {
    const participants = combatData.participants || [];
    let totalDamage = 0;
    let mvp = null;
    let maxDamage = 0;

    for (const p of participants) {
      const dmg = p.damageDealt || 0;
      totalDamage += dmg;
      if (dmg > maxDamage) {
        maxDamage = dmg;
        mvp = p.name || p.userId;
      }
    }

    const durationSec = Math.max(1, (combatData.durationMs || 1000) / 1000);

    return {
      totalDamage,
      avgDps: Math.round(totalDamage / durationSec),
      mvp,
      participantCount: participants.length,
    };
  }
}

module.exports = { CombatLogService, MAX_LOG_ENTRIES };
