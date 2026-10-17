"use strict";

const cacheManager = require("../../managers/cacheManager");
const ServerTreasury = require("../../models/ServerTreasury");
const {
  calculateTransferTax,
  evaluateTransferDecision,
} = require("../decisions/economyDecisions");
const eventBus = require("../../core/eventBus");
const { logger } = require("../../managers/logger");

/**
 * Economy Public Domain Contract
 * Membungkus semua operasi saldo Naura Coins (NC), bank, pajak, dan ServerTreasury
 * secara atomik, aman, dan satu arah tanpa ketergantungan balik ke domain lain.
 */
class EconomyContract {
  /**
   * Mengambil saldo pengguna secara defensif.
   * @param {string} userId
   * @returns {Promise<Readonly<{ wallet: number, bank: number, total: number }>>}
   */
  async getBalance(userId) {
    if (!userId) {
      return Object.freeze({ wallet: 0, bank: 0, total: 0 });
    }

    const profile = await cacheManager.getUserProfile(userId);
    const wallet = Math.max(0, Math.floor(Number(profile?.economy_wallet) || 0));
    const bank = Math.max(0, Math.floor(Number(profile?.economy_bank) || 0));

    return Object.freeze({
      wallet,
      bank,
      total: wallet + bank,
    });
  }

  /**
   * Memotong koin dari dompet secara atomik. Gagal jika saldo tidak mencukupi.
   * @param {string} userId
   * @param {number} amount
   * @param {object} [options]
   * @returns {Promise<Readonly<{ ok: boolean, balance: number, reason?: string }>>}
   */
  async charge(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, balance: 0, reason: "invalid_amount" });
    }

    const result = await cacheManager.debitUserProfile(userId, "economy_wallet", safeAmount);
    if (!result || !result.ok) {
      const current = await this.getBalance(userId);
      return Object.freeze({
        ok: false,
        balance: current.wallet,
        reason: result?.reason || "insufficient_balance",
      });
    }

    const updated = await this.getBalance(userId);
    eventBus.emit("economy:charge", {
      userId,
      amount: safeAmount,
      balance: updated.wallet,
      reason: options.reason || "unspecified",
    });

    return Object.freeze({
      ok: true,
      balance: updated.wallet,
    });
  }

  /**
   * Menambah koin ke dompet secara atomik.
   * @param {string} userId
   * @param {number} amount
   * @param {object} [options]
   * @returns {Promise<Readonly<{ ok: boolean, balance: number }>>}
   */
  async reward(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      const current = await this.getBalance(userId);
      return Object.freeze({ ok: false, balance: current.wallet });
    }

    await cacheManager.incrementUserProfile(userId, { economy_wallet: safeAmount });
    const updated = await this.getBalance(userId);

    eventBus.emit("economy:reward", {
      userId,
      amount: safeAmount,
      balance: updated.wallet,
      source: options.source || "reward",
    });

    return Object.freeze({
      ok: true,
      balance: updated.wallet,
    });
  }

  /**
   * Mentransfer koin dari wallet ke rekening bank pengguna.
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<Readonly<{ ok: boolean, wallet: number, bank: number, reason?: string }>>}
   */
  async deposit(userId, amount) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, wallet: 0, bank: 0, reason: "invalid_amount" });
    }

    const debitResult = await cacheManager.debitUserProfile(userId, "economy_wallet", safeAmount);
    if (!debitResult || !debitResult.ok) {
      const cur = await this.getBalance(userId);
      return Object.freeze({ ok: false, wallet: cur.wallet, bank: cur.bank, reason: "insufficient_wallet" });
    }

    await cacheManager.incrementUserProfile(userId, { economy_bank: safeAmount });
    const updated = await this.getBalance(userId);

    eventBus.emit("economy:deposit", { userId, amount: safeAmount });
    return Object.freeze({
      ok: true,
      wallet: updated.wallet,
      bank: updated.bank,
    });
  }

  /**
   * Menarik koin dari rekening bank ke dompet pengguna.
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<Readonly<{ ok: boolean, wallet: number, bank: number, reason?: string }>>}
   */
  async withdraw(userId, amount) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, wallet: 0, bank: 0, reason: "invalid_amount" });
    }

    const debitResult = await cacheManager.debitUserProfile(userId, "economy_bank", safeAmount);
    if (!debitResult || !debitResult.ok) {
      const cur = await this.getBalance(userId);
      return Object.freeze({ ok: false, wallet: cur.wallet, bank: cur.bank, reason: "insufficient_bank" });
    }

    await cacheManager.incrementUserProfile(userId, { economy_wallet: safeAmount });
    const updated = await this.getBalance(userId);

    eventBus.emit("economy:withdraw", { userId, amount: safeAmount });
    return Object.freeze({
      ok: true,
      wallet: updated.wallet,
      bank: updated.bank,
    });
  }

  /**
   * Menjalankan transfer koin antar pengguna dengan kalkulasi pajak dan evaluasi deterministik.
   * @param {string} senderId
   * @param {string} receiverId
   * @param {number} amount
   * @param {object} [options]
   */
  async transfer(senderId, receiverId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    const senderBalance = await this.getBalance(senderId);

    const decision = evaluateTransferDecision({
      senderId,
      receiverId,
      senderBalance: senderBalance.wallet,
      transferAmount: safeAmount,
      taxRate: options.taxRate ?? 0.05,
    });

    if (!decision.isAllowed) {
      return Object.freeze({
        ok: false,
        reason: decision.reasonCode,
        errorMessage: decision.errorMessage,
      });
    }

    // Eksekusi atomik: debit sender untuk grossAmount
    const debitRes = await cacheManager.debitUserProfile(senderId, "economy_wallet", decision.grossAmount);
    if (!debitRes || !debitRes.ok) {
      return Object.freeze({
        ok: false,
        reason: "INSUFFICIENT_BALANCE",
        errorMessage: "Saldo dompet tidak mencukupi saat proses transfer.",
      });
    }

    // Credit receiver untuk netAmountReceived
    await cacheManager.incrementUserProfile(receiverId, { economy_wallet: decision.netAmountReceived });

    // Setor pajak ke ServerTreasury bila ada
    if (decision.taxAmount > 0 && typeof ServerTreasury?.contributeTax === "function") {
      try {
        await ServerTreasury.contributeTax(decision.taxAmount);
      } catch (err) {
        logger.warn("[EconomyContract] Gagal menyetor pajak ke treasury: " + err.message);
      }
    }

    eventBus.emit("economy:transaction", {
      type: "TRANSFER",
      from: senderId,
      to: receiverId,
      grossAmount: decision.grossAmount,
      taxAmount: decision.taxAmount,
      netAmount: decision.netAmountReceived,
      timestamp: Date.now(),
    });

    return Object.freeze({
      ok: true,
      grossAmount: decision.grossAmount,
      taxAmount: decision.taxAmount,
      netAmountReceived: decision.netAmountReceived,
    });
  }

  /**
   * Menghitung pajak transfer dinamis murni.
   */
  calculateDynamicTax(amount, taxRate = 0.05) {
    return calculateTransferTax(amount, taxRate);
  }

  /**
   * Membaca status kolam ServerTreasury.
   */
  async getTreasuryPools() {
    if (!ServerTreasury || typeof ServerTreasury.getPools !== "function") {
      return Object.freeze({ lottery_pool: 0, novice_pool: 0, merchant_pool: 0 });
    }
    const pools = await ServerTreasury.getPools();
    return Object.freeze(pools || {});
  }
}

const economyContract = new EconomyContract();
economyContract.EconomyContract = EconomyContract;

module.exports = economyContract;
