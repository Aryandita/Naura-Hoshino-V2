"use strict";

const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

/**
 * Declarative Transaction Helper
 * Menyediakan abstraksi atomik untuk transaksi saldo dan inventaris dengan
 * compensatory rollback otomatis jika langkah berikutnya mengalami kegagalan.
 */

/**
 * Eksekusi pembayaran atomik dengan perlindungan rollback kompensasi.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {number} params.amount
 * @param {"sukamajuCoins"|"scholarshipVouchers"|"pratamaDollars"|"economy_bank"|"adishaDiamonds"} [params.currency="sukamajuCoins"]
 * @param {Function} params.action - async () => result
 * @param {string} [params.reason="payment"]
 * @returns {Promise<{ ok: boolean, result?: any, reason?: string }>}
 */
async function executeAtomicPayment({
  userId,
  amount,
  currency = "sukamajuCoins",
  action,
  reason = "payment",
}) {
  const safeAmount = Math.floor(Number(amount) || 0);
  if (!userId || safeAmount <= 0) {
    return Object.freeze({ ok: false, reason: "INVALID_AMOUNT" });
  }

  // 1. Lakukan debit awal
  let debitRes;
  if (currency === "economy_wallet" || currency === "economy_bank") {
    debitRes = await cacheManager.debitUserProfile(userId, currency, safeAmount);
  } else {
    debitRes = await cacheManager.debitUserSurvival(userId, currency, safeAmount);
  }

  if (!debitRes || !debitRes.ok) {
    return Object.freeze({
      ok: false,
      reason: debitRes?.reason || "INSUFFICIENT_FUNDS",
    });
  }

  // 2. Eksekusi aksi jika ada
  if (typeof action === "function") {
    try {
      const result = await action();
      return Object.freeze({ ok: true, result });
    } catch (actionErr) {
      // 3. Rollback kompensasi jika aksi gagal
      logger.warn(
        `[TransactionHelper] Aksi gagal untuk user ${userId} (${reason}), melakukan rollback ${safeAmount} ${currency}: ${actionErr.message}`,
      );
      try {
        if (currency === "economy_wallet" || currency === "economy_bank") {
          await cacheManager.incrementUserProfile(userId, { [currency]: safeAmount });
        } else {
          await cacheManager.incrementUserSurvival(userId, { [currency]: safeAmount });
        }
      } catch (rollbackErr) {
        logger.error(
          `[TransactionHelper CRITICAL] Rollback gagal untuk user ${userId}: ${rollbackErr.message}`,
        );
      }
      return Object.freeze({
        ok: false,
        reason: "ACTION_FAILED",
        error: actionErr.message,
      });
    }
  }

  return Object.freeze({ ok: true });
}

module.exports = {
  executeAtomicPayment,
};
