// Lokasi: src/adapters/paymentBoundaryAdapter.js
// Implementasi Law 3: Keep external systems behind a boundary & Law 6: Make errors useful
// Mengisolasi webhook pembayaran / donasi / voting ke bentuk transaksi domain yang tervalidasi.

"use strict";

const { ValidationError } = require("../errors/DomainError");

/**
 * Menormalisasi payload webhook pembayaran pihak ketiga ke bentuk transaksi domain
 * @param {string} provider 'saweria' | 'trakteer' | 'topgg'
 * @param {any} rawPayload
 * @returns {{
 *   provider: string,
 *   transactionId: string,
 *   donatorName: string,
 *   targetUserId: string|null,
 *   amount: number,
 *   message: string,
 *   isWeekendVote: boolean,
 *   timestamp: number
 * }}
 */
function normalizePaymentWebhook(provider, rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new ValidationError(
      "Payload webhook kosong atau bukan objek valid.",
      { provider },
    );
  }

  const normalizedProvider = String(provider || "").toLowerCase();
  let transactionId = "";
  let donatorName = "Anonymous";
  let targetUserId = null;
  let amount = 0;
  let message = "";
  let isWeekendVote = false;

  switch (normalizedProvider) {
    case "saweria": {
      transactionId = String(rawPayload.donation_id || rawPayload.id || "");
      donatorName = String(
        rawPayload.donator_name || rawPayload.name || "Anonymous",
      ).trim();
      amount = Number(rawPayload.amount_raw || rawPayload.amount || 0);
      message = String(rawPayload.message || "").trim();
      break;
    }

    case "trakteer": {
      transactionId = String(
        rawPayload.tr_id || rawPayload.order_id || rawPayload.id || "",
      );
      donatorName = String(
        rawPayload.supporter_name || rawPayload.name || "Anonymous",
      ).trim();
      amount = Number(rawPayload.amount || rawPayload.total_price || 0);
      message = String(
        rawPayload.supporter_message || rawPayload.message || "",
      ).trim();
      break;
    }

    case "topgg": {
      targetUserId = String(rawPayload.user || rawPayload.userId || "").trim();
      transactionId = `topgg-${targetUserId}-${Date.now()}`;
      donatorName = "Top.gg Voter";
      amount = 1; // 1 vote
      isWeekendVote = Boolean(rawPayload.isWeekend);
      break;
    }

    default:
      throw new ValidationError(
        `Provider webhook '${provider}' tidak dikenal.`,
        { provider },
      );
  }

  // Ekstraksi ID Discord bila pengguna menyertakan ID di pesan atau donator_name
  if (!targetUserId && message) {
    const matchedDiscordId = message.match(/\b\d{17,20}\b/);
    if (matchedDiscordId) {
      targetUserId = matchedDiscordId[0];
    }
  }

  if (amount < 0 || Number.isNaN(amount)) {
    throw new ValidationError("Nominal pembayaran tidak valid.", {
      provider,
      amount,
      rawPayload,
    });
  }

  return Object.freeze({
    provider: normalizedProvider,
    transactionId: transactionId || `txn-${Date.now()}`,
    donatorName,
    targetUserId,
    amount,
    message,
    isWeekendVote,
    timestamp: Date.now(),
  });
}

module.exports = {
  normalizePaymentWebhook,
};
