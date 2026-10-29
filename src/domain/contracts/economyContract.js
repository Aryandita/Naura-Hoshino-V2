"use strict";

/**
 * @module economyContract
 * @description Economy Public Domain Contract - Antarmuka publik untuk semua operasi
 * ekonomi Naura Hoshino V2 termasuk saldo Naura Coins (NC), bank, pajak transfer,
 * dan ServerTreasury. Seluruh operasi bersifat atomik dan satu arah tanpa
 * ketergantungan balik ke domain lain.
 *
 * ## Interface Methods
 * - `getBalance(userId)` - Ambil saldo wallet dan bank pengguna
 * - `charge(userId, amount, options)` - Potong koin dari dompet secara atomik
 * - `reward(userId, amount, options)` - Tambah koin ke dompet secara atomik
 * - `deposit(userId, amount)` - Transfer wallet ke bank
 * - `withdraw(userId, amount)` - Transfer bank ke wallet
 * - `transfer(senderId, receiverId, amount, options)` - Transfer antar pengguna dengan pajak
 * - `calculateDynamicTax(amount, taxRate)` - Hitung pajak transfer murni
 * - `getTreasuryPools()` - Baca status kolam ServerTreasury
 *
 * @example
 * const economy = require("./economyContract");
 * const balance = await economy.getBalance("123456789");
 * const result = await economy.charge("123456789", 500, { reason: "shop_purchase" });
 */

const cacheManager = require("../../managers/cacheManager");
const ServerTreasury = require("../../models/ServerTreasury");
const {
  calculateTransferTax,
  evaluateTransferDecision,
} = require("../decisions/economyDecisions");
const eventBus = require("../../core/eventBus");
const { logger } = require("../../managers/logger");

// ============================================================================
// CONSTANTS
// ============================================================================

/** @type {number} Pajak transfer default (5%) */
const DEFAULT_TAX_RATE = 0.05;

/** @type {string} Alasan kegagalan: jumlah tidak valid */
const REASON_INVALID_AMOUNT = "invalid_amount";

/** @type {string} Alasan kegagalan: saldo tidak mencukupi */
const REASON_INSUFFICIENT_BALANCE = "insufficient_balance";

/** @type {string} Alasan kegagalan: saldo wallet tidak cukup untuk deposit */
const REASON_INSUFFICIENT_WALLET = "insufficient_wallet";

/** @type {string} Alasan kegagalan: saldo bank tidak cukup untuk withdraw */
const REASON_INSUFFICIENT_BANK = "insufficient_bank";

/** @type {string} Kode alasan kegagalan: saldo tidak cukup saat transfer atomik */
const REASON_CODE_INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE";

/** @type {Readonly<{wallet: number, bank: number, total: number}>} Saldo nol beku untuk fallback */
const ZERO_BALANCE = Object.freeze({ wallet: 0, bank: 0, total: 0 });

/** @type {Readonly<{lottery_pool: number, novice_pool: number, merchant_pool: number}>} Pool treasury nol */
const ZERO_TREASURY_POOLS = Object.freeze({ lottery_pool: 0, novice_pool: 0, merchant_pool: 0 });

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

/**
 * Kelas kontrak domain ekonomi yang membungkus semua operasi saldo NC,
 * bank, pajak, dan ServerTreasury secara atomik dan aman.
 */
class EconomyContract {
/**
   * Mengambil saldo pengguna secara defensif.
   * Mengembalikan saldo nol jika userId kosong atau profil tidak ditemukan.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @returns {Promise<Readonly<{wallet: number, bank: number, total: number}>>}
   *   Saldo beku dengan properti wallet, bank, dan total
   */
  async getBalance(userId) {
    if (!userId) {
      return ZERO_BALANCE;
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
   * Memotong koin dari dompet pengguna secara atomik.
   * Gagal jika saldo tidak mencukupi atau jumlah tidak valid.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah koin yang akan dipotong (dibulatkan ke bawah)
   * @param {object} [options] - Opsi tambahan
   * @param {string} [options.reason="unspecified"] - Alasan pemotongan untuk log event
   * @returns {Promise<Readonly<{ok: boolean, balance: number, reason?: string}>>}
   *   Hasil operasi dengan status ok, saldo tersisa, dan alasan jika gagal
   */
  async charge(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, balance: 0, reason: REASON_INVALID_AMOUNT });
    }

    const result = await cacheManager.debitUserProfile(userId, "economy_wallet", safeAmount);
    if (!result || !result.ok) {
      const current = await this.getBalance(userId);
      return Object.freeze({
        ok: false,
        balance: current.wallet,
        reason: result?.reason || REASON_INSUFFICIENT_BALANCE,
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
   * Menambah koin ke dompet pengguna secara atomik.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah koin yang akan ditambahkan (dibulatkan ke bawah)
   * @param {object} [options] - Opsi tambahan
   * @param {string} [options.source="reward"] - Sumber reward untuk log event
   * @returns {Promise<Readonly<{ok: boolean, balance: number}>>}
   *   Hasil operasi dengan status ok dan saldo terbaru
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
   * Melakukan debit wallet terlebih dahulu, kemudian kredit bank.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah koin yang akan didepositkan (dibulatkan ke bawah)
   * @returns {Promise<Readonly<{ok: boolean, wallet: number, bank: number, reason?: string}>>}
   *   Hasil operasi dengan saldo wallet dan bank terbaru
   */
  async deposit(userId, amount) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, wallet: 0, bank: 0, reason: REASON_INVALID_AMOUNT });
    }

    const debitResult = await cacheManager.debitUserProfile(userId, "economy_wallet", safeAmount);
    if (!debitResult || !debitResult.ok) {
      const cur = await this.getBalance(userId);
      return Object.freeze({ ok: false, wallet: cur.wallet, bank: cur.bank, reason: REASON_INSUFFICIENT_WALLET });
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
   * Melakukan debit bank terlebih dahulu, kemudian kredit wallet.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah koin yang akan ditarik (dibulatkan ke bawah)
   * @returns {Promise<Readonly<{ok: boolean, wallet: number, bank: number, reason?: string}>>}
   *   Hasil operasi dengan saldo wallet dan bank terbaru
   */
  async withdraw(userId, amount) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, wallet: 0, bank: 0, reason: REASON_INVALID_AMOUNT });
    }

    const debitResult = await cacheManager.debitUserProfile(userId, "economy_bank", safeAmount);
    if (!debitResult || !debitResult.ok) {
      const cur = await this.getBalance(userId);
      return Object.freeze({ ok: false, wallet: cur.wallet, bank: cur.bank, reason: REASON_INSUFFICIENT_BANK });
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
   * Alur: evaluasi keputusan -> debit sender (gross) -> credit receiver (net) -> setor pajak ke treasury.
   *
   * @param {string} senderId - Discord Snowflake ID pengirim
   * @param {string} receiverId - Discord Snowflake ID penerima
   * @param {number} amount - Jumlah koin bersih yang ingin dikirim (sebelum pajak)
   * @param {object} [options] - Opsi tambahan
   * @param {number} [options.taxRate=0.05] - Tarif pajak transfer (0.0 - 1.0)
   * @returns {Promise<Readonly<{ok: boolean, grossAmount?: number, taxAmount?: number, netAmountReceived?: number, reason?: string, errorMessage?: string}>>}
   *   Hasil transfer dengan rincian gross, pajak, dan net yang diterima
   */
  async transfer(senderId, receiverId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    const senderBalance = await this.getBalance(senderId);

    const decision = evaluateTransferDecision({
      senderId,
      receiverId,
      senderBalance: senderBalance.wallet,
      transferAmount: safeAmount,
      taxRate: options.taxRate ?? DEFAULT_TAX_RATE,
    });

    if (!decision.isAllowed) {
      return Object.freeze({
        ok: false,
        reason: decision.reasonCode,
        errorMessage: decision.errorMessage,
      });
    }

    const debitRes = await cacheManager.debitUserProfile(senderId, "economy_wallet", decision.grossAmount);
    if (!debitRes || !debitRes.ok) {
      return Object.freeze({
        ok: false,
        reason: REASON_CODE_INSUFFICIENT_BALANCE,
        errorMessage: "Saldo dompet tidak mencukupi saat proses transfer.",
      });
    }

    await cacheManager.incrementUserProfile(receiverId, { economy_wallet: decision.netAmountReceived });

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
   * Menghitung pajak transfer dinamis murni tanpa side-effect.
   * Fungsi ini adalah wrapper stateless dari economyDecisions.calculateTransferTax.
   *
   * @param {number} amount - Jumlah koin yang akan ditransfer
   * @param {number} [taxRate=0.05] - Tarif pajak (0.0 - 1.0)
   * @returns {object} Hasil kalkulasi pajak dari economyDecisions
   */
  calculateDynamicTax(amount, taxRate = DEFAULT_TAX_RATE) {
    return calculateTransferTax(amount, taxRate);
  }

/**
   * Membaca status kolam ServerTreasury (lottery, novice, merchant).
   * Mengembalikan pool nol jika ServerTreasury tidak tersedia.
   *
   * @returns {Promise<Readonly<{lottery_pool: number, novice_pool: number, merchant_pool: number}>>}
   *   Status pool treasury yang dibekukan
   */
  async getTreasuryPools() {
    if (!ServerTreasury || typeof ServerTreasury.getPools !== "function") {
      return ZERO_TREASURY_POOLS;
    }
    const pools = await ServerTreasury.getPools();
    return Object.freeze(pools || {});
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

const economyContract = new EconomyContract();
economyContract.EconomyContract = EconomyContract;

module.exports = economyContract;
