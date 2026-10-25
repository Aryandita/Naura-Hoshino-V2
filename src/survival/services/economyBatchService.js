"use strict";

/**
 * @file economyBatchService.js
 * @description Layanan pemrosesan pembagian saldo dan reward massal dari file spreadsheet (CSV/Excel).
 * Menjalankan transaksi atomik via CacheManager untuk mencegah inflasi atau race condition.
 */

const { parseSpreadsheet } = require("../../ai/documentParser");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const BATCH_SIZE_LIMIT = 1000;

function createTotalsObject() {
  return {
    sukamajuCoins: 0,
    pratamaDollars: 0,
    scholarshipVouchers: 0,
    get starFragments() {
      return this.sukamajuCoins;
    },
    set starFragments(v) {
      this.sukamajuCoins = v;
    },
    get coins() {
      return this.pratamaDollars;
    },
    set coins(v) {
      this.pratamaDollars = v;
    },
    get coupons() {
      return this.scholarshipVouchers;
    },
    set coupons(v) {
      this.scholarshipVouchers = v;
    },
  };
}

class EconomyBatchService {
  /**
   * Parse dan pratinjau data spreadsheet tanpa melakukan mutasi saldo
   * @param {Buffer|string} buffer - Buffer file spreadsheet
   * @returns {{ validRows: Array<{ userId: string, amount: number, currency: string, reason: string }>, totals: { sukamajupratamaDollars: number, pratamaDollars: number, scholarshipVouchers: number }, invalidCount: number }}
   */
  previewBatch(buffer) {
    const rows = parseSpreadsheet(buffer);

    const totals = createTotalsObject();

    const validRows = [];

    for (const r of rows) {
      if (!r.userId || isNaN(r.amount) || r.amount <= 0) continue;

      const curr = String(r.currency).toLowerCase();
      if (curr.includes("frag") || curr === "sc" || curr === "nsf" || curr === "star") {
        totals.sukamajuCoins += r.amount;
        validRows.push({ ...r, normalizedCurrency: "sukamajuCoins" });
      } else if (curr.includes("coin") || curr === "pd" || curr === "nc" || curr === "uang") {
        totals.pratamaDollars += r.amount;
        validRows.push({ ...r, normalizedCurrency: "pratamaDollars" });
      } else if (curr.includes("coupon") || curr === "kupon" || curr === "vb" || curr === "voucher") {
        totals.scholarshipVouchers += r.amount;
        validRows.push({ ...r, normalizedCurrency: "scholarshipVouchers" });
      } else {
        // Default ke Sukamaju Coins (Star Fragments)
        totals.sukamajuCoins += r.amount;
        validRows.push({ ...r, normalizedCurrency: "sukamajuCoins" });
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
   * @returns {Promise<{ success: boolean, processedCount: number, failedCount: number, totals: { sukamajuCoins: number, pratamaDollars: number, scholarshipVouchers: number }, failedUsers: string[] }>}
   */
  async executeBatch(validRows, context = {}) {
    if (!Array.isArray(validRows) || validRows.length === 0) {
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        totals: createTotalsObject(),
        failedUsers: [],
      };
    }

    if (validRows.length > BATCH_SIZE_LIMIT) {
      logger.warn(
        `[EconomyBatch] Batch size ${validRows.length} exceeds limit ${BATCH_SIZE_LIMIT}, truncating.`,
      );
      validRows = validRows.slice(0, BATCH_SIZE_LIMIT);
    }

    let processed = 0;
    const failedUsers = [];
    const totals = createTotalsObject();

    for (const row of validRows) {
      try {
        if (row.normalizedCurrency === "sukamajuCoins" || row.normalizedCurrency === "starFragments") {
          await cacheManager.incrementUserSurvival(row.userId, { sukamajuCoins: row.amount });
          totals.sukamajuCoins += row.amount;
        } else if (row.normalizedCurrency === "pratamaDollars" || row.normalizedCurrency === "coins") {
          await cacheManager.incrementUserProfile(row.userId, { economy_wallet: row.amount });
          totals.pratamaDollars += row.amount;
        } else if (row.normalizedCurrency === "scholarshipVouchers" || row.normalizedCurrency === "coupons") {
          await cacheManager.incrementUserSurvival(row.userId, { scholarshipVouchers: row.amount });
          totals.scholarshipVouchers += row.amount;
        }
        processed++;
        
        if (processed % 100 === 0) {
          logger.info(`[EconomyBatch] Progress: ${processed}/${validRows.length} users processed...`);
        }
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
