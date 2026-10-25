"use strict";

const { logger } = require("../../../src/managers/logger");
const ServerTreasury = require("../../../src/models/ServerTreasury");

class TreasuryAuditService {
  /**
   * Mengambil log audit mutasi ServerTreasury dengan pagination
   * @param {string} guildId
   * @param {object} options - Filter dan pagination
   * @returns {Promise<{ entries: Array, total: number, page: number, totalPages: number }>}
   */
  static async getAuditLog(guildId, options = {}) {
    try {
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(50, Math.max(1, options.limit || 20));
      const offset = (page - 1) * limit;
      const typeFilter = options.type || null;

      const whereClause = { guildId };
      if (typeFilter) whereClause.mutationType = typeFilter;

      const { count, rows } = await ServerTreasury.findAndCountAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      return {
        entries: rows.map((r) => r.toJSON()),
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
      };
    } catch (error) {
      logger.error(`[TreasuryAudit] Error fetching audit log for guild ${guildId}:`, error);
      return { entries: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  /**
   * Mencatat mutasi treasury ke audit log
   * @param {object} entry - Data mutasi
   */
  static async recordMutation(entry) {
    try {
      await ServerTreasury.create({
        guildId: entry.guildId,
        mutationType: entry.type,
        amount: entry.amount,
        currency: entry.currency || "sukamajuCoins",
        actorUserId: entry.actorUserId || null,
        description: entry.description || "",
        referenceId: entry.referenceId || null,
      });
    } catch (error) {
      logger.error(`[TreasuryAudit] Error recording mutation:`, error);
    }
  }

  /**
   * Export audit log sebagai CSV string
   * @param {string} guildId
   * @param {object} filters
   * @returns {Promise<string>}
   */
  static async exportCSV(guildId, filters = {}) {
    try {
      const result = await this.getAuditLog(guildId, { ...filters, limit: 500, page: 1 });
      const headers = ["Timestamp", "Type", "Amount", "Currency", "Actor", "Description", "Reference"];
      const lines = [headers.join(",")];

      for (const entry of result.entries) {
        lines.push([
          new Date(entry.createdAt).toISOString(),
          entry.mutationType,
          entry.amount,
          entry.currency,
          entry.actorUserId || "system",
          `"${(entry.description || "").replace(/"/g, '""')}"`,
          entry.referenceId || "",
        ].join(","));
      }

      return lines.join("\n");
    } catch (error) {
      logger.error(`[TreasuryAudit] Error exporting CSV for guild ${guildId}:`, error);
      return "Error generating CSV export";
    }
  }

  /**
   * Ringkasan mutasi per tipe dalam periode tertentu
   * @param {string} guildId
   * @param {number} daysBack
   * @returns {Promise<object>}
   */
  static async getSummary(guildId, daysBack = 7) {
    try {
      const since = new Date(Date.now() - daysBack * 86400000);
      const { Op } = require("sequelize");

      const results = await ServerTreasury.findAll({
        where: {
          guildId,
          createdAt: { [Op.gte]: since },
        },
        attributes: ["mutationType", "currency"],
      });

      const summary = {};
      for (const row of results) {
        const key = `${row.mutationType}:${row.currency}`;
        summary[key] = (summary[key] || 0) + 1;
      }

      return { periodDays: daysBack, totalEntries: results.length, breakdown: summary };
    } catch (error) {
      logger.error(`[TreasuryAudit] Error getting summary for guild ${guildId}:`, error);
      return { periodDays: daysBack, totalEntries: 0, breakdown: {} };
    }
  }
}

module.exports = { TreasuryAuditService };
