// Lokasi: src/domain/decisions/economyDecisions.js
// Implementasi Law 5: Separate decisions from actions & Law 2: Name things by meaning
// Mesin kalkulasi murni (pure function) untuk keputusan transfer dan pajak ekonomi tanpa I/O.

"use strict";

/**
 * Menghitung besaran potongan pajak transfer
 * @param {number} transferAmount
 * @param {number} [taxRate=0.05] Default 5%
 * @returns {number}
 */
function calculateTransferTax(transferAmount, taxRate = 0.05) {
  const safeAmount = Math.max(0, Math.floor(Number(transferAmount) || 0));
  const safeTaxRate = Math.min(0.5, Math.max(0, Number(taxRate) || 0));
  return Math.floor(safeAmount * safeTaxRate);
}

/**
 * Mengevaluasi keputusan transaksi transfer antar pengguna secara deterministik
 * @param {{
 *   senderId: string,
 *   receiverId: string,
 *   senderBalance: number,
 *   transferAmount: number,
 *   dailyTransfersCount?: number,
 *   maxDailyTransfers?: number,
 *   minTransferAmount?: number,
 *   taxRate?: number
 * }} params
 * @returns {{
 *   isAllowed: boolean,
 *   reasonCode: string|null,
 *   errorMessage: string|null,
 *   grossAmount: number,
 *   taxAmount: number,
 *   netAmountReceived: number,
 *   resultingSenderBalance: number
 * }}
 */
function evaluateTransferDecision({
  senderId,
  receiverId,
  senderBalance,
  transferAmount,
  dailyTransfersCount = 0,
  maxDailyTransfers = 20,
  minTransferAmount = 100,
  taxRate = 0.05,
}) {
  const safeSenderBalance = Math.max(0, Math.floor(Number(senderBalance) || 0));
  const safeTransferAmount = Math.floor(Number(transferAmount) || 0);
  const safeDailyCount = Math.max(0, Math.floor(Number(dailyTransfersCount) || 0));

  // Guard 1: Larangan transfer ke diri sendiri
  if (senderId && receiverId && senderId === receiverId) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "SELF_TRANSFER_PROHIBITED",
      errorMessage: "Anda tidak dapat mentransfer saldo ke akun Anda sendiri.",
      grossAmount: safeTransferAmount,
      taxAmount: 0,
      netAmountReceived: 0,
      resultingSenderBalance: safeSenderBalance,
    });
  }

  // Guard 2: Batas minimum transfer
  if (safeTransferAmount < minTransferAmount) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "AMOUNT_BELOW_MINIMUM",
      errorMessage: `Nominal transfer minimal adalah ${minTransferAmount.toLocaleString("id-ID")}.`,
      grossAmount: safeTransferAmount,
      taxAmount: 0,
      netAmountReceived: 0,
      resultingSenderBalance: safeSenderBalance,
    });
  }

  // Guard 3: Batas frekuensi harian
  if (safeDailyCount >= maxDailyTransfers) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "DAILY_LIMIT_REACHED",
      errorMessage: `Anda telah mencapai batas ${maxDailyTransfers} transaksi transfer per hari.`,
      grossAmount: safeTransferAmount,
      taxAmount: 0,
      netAmountReceived: 0,
      resultingSenderBalance: safeSenderBalance,
    });
  }

  // Guard 4: Kecukupan saldo pengirim
  if (safeSenderBalance < safeTransferAmount) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "INSUFFICIENT_FUNDS",
      errorMessage: "Saldo Anda tidak mencukupi untuk melakukan transfer ini.",
      grossAmount: safeTransferAmount,
      taxAmount: 0,
      netAmountReceived: 0,
      resultingSenderBalance: safeSenderBalance,
    });
  }

  // Happy Path: Keputusan disetujui, kalkulasi potongan pajak & nilai bersih
  const taxAmount = calculateTransferTax(safeTransferAmount, taxRate);
  const netAmountReceived = safeTransferAmount - taxAmount;
  const resultingSenderBalance = safeSenderBalance - safeTransferAmount;

  return Object.freeze({
    isAllowed: true,
    reasonCode: null,
    errorMessage: null,
    grossAmount: safeTransferAmount,
    taxAmount,
    netAmountReceived,
    resultingSenderBalance,
  });
}

module.exports = {
  calculateTransferTax,
  evaluateTransferDecision,
};
