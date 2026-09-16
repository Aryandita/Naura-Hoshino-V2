"use strict";

/**
 * @file economyBatchService.js
 * @description Layanan pemrosesan pembagian saldo dan reward massal dari file spreadsheet (CSV/Excel).
 * Menjalankan transaksi atomik via CacheManager untuk mencegah inflasi atau race condition.
 */

const { parseSpreadsheet } = require("../../ai/documentParser");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

class EconomyBatchService {
  /**
   * Parse dan pratinjau data spreadsheet tanpa melakukan mutasi saldo
   * @param {Buffer|string} buffer - Buffer file spreadsheet
   * @returns {{ validRows: Array<{ userId: string, amount: number, currency: string, reason: string }>, totals: { starFragments: number, coins: number, coupons: number }, invalidCount: number }}
   */
  previewBatch(buffer) {
    const rows = parseSpreadsheet(buffer);

    const totals = {
      starFragments: 0,
      coins: 0,
      coupons: 0,
    };

    const validRows = [];

    for (const r of rows) {
      if (!r.userId || isNaN(r.amount) || r.amount <= 0) continue;

      const curr = String(r.currency).toLowerCase();
      if (curr.includes("frag") || curr === "nsf" || curr === "star") {
        totals.starFragments += r.amount;
        validRows.push({ ...r, normalizedCurrency: "starFragments" });
      } else if (curr.includes("coin") || curr === "nc" || curr === "uang") {
        totals.coins += r.amount;
        validRows.push({ ...r, normalizedCurrency: "coins" });
      } else if (curr.includes("coupon") || curr === "kupon") {
        totals.coupons += r.amount;
        validRows.push({ ...r, normalizedCurrency: "coupons" });
      } else {
        // Default ke Star Fragments
        totals.starFragments += r.amount;
        validRows.push({ ...r, normalizedCurrency: "starFragments" });
      }
    }

    return {
      validRows,
      totals,
      invalidCount: Math.max(0, rows.length - validRows.length),
    };
  }

  /**
   * Eksekusi pemberian saldo massal secara atomik ke masing-masing profil pengguna
   * @param {Array<{ userId: string, amount: number, normalizedCurrency: string, reason: string }>} validRows
   * @param {object} [context]
   * @param {string} [context.guildId]
   * @param {string} [context.adminId]
   * @returns {Promise<{ success: boolean, processedCount: number, failedCount: number, totals: { starFragments: number, coins: number, coupons: number }, failedUsers: string[] }>}
   */
  async executeBatch(validRows, context = {}) {
    if (!Array.isArray(validRows) || validRows.length === 0) {
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        totals: { starFragments: 0, coins: 0, coupons: 0 },
        failedUsers: [],
      };
    }

    let processed = 0;
    const failedUsers = [];
    const totals = { starFragments: 0, coins: 0, coupons: 0 };

    for (const row of validRows) {
      try {
        if (row.normalizedCurrency === "starFragments") {
          await cacheManager.incrementUserSurvival(row.userId, "starFragments", row.amount);
          totals.starFragments += row.amount;
        } else if (row.normalizedCurrency === "coins") {
          await cacheManager.incrementUserProfile(row.userId, "economy_wallet", row.amount);
          totals.coins += row.amount;
        } else if (row.normalizedCurrency === "coupons") {
          await cacheManager.incrementUserSurvival(row.userId, "coupons", row.amount);
          totals.coupons += row.amount;
        }
        processed++;
      } catch (err) {
        logger.error(`[EconomyBatch] Gagal menambahkan saldo ke user ${row.userId}: ${err.message}`);
        failedUsers.push(row.userId);
      }
    }

    logger.success(
      `[EconomyBatch] Berhasil membagikan reward massal ke ${processed} pengguna oleh admin ${context.adminId || "System"}.`,
    );

    return {
      success: true,
      processedCount: processed,
      failedCount: failedUsers.length,
      totals,
      failedUsers,
    };
  }
}

module.exports = new EconomyBatchService();
