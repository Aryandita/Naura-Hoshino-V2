"use strict";

/**
 * @module survivalContract
 * @description Survival Public Domain Contract (Naura Wilds) - Antarmuka publik untuk
 * mengelola status vital karakter (HP, Hunger, Thirst, Stamina), inventaris item,
 * Sukamaju Koin (SC), Voucher Beasiswa (VB), dan jembatan satu arah ke domain Economy.
 *
 * ## Interface Methods
 * - `getCharacter(userId)` - Ambil data karakter survival lengkap
 * - `updateVitals(userId, vitalsPatch)` - Perbarui status vital secara parsial (clamped 0-100)
 * - `chargeFragments(userId, amount, options)` - Potong SC secara atomik
 * - `rewardFragments(userId, amount, options)` - Tambah SC secara atomik
 * - `chargeCoupons(userId, amount)` - Potong VB secara atomik
 * - `rewardCoupons(userId, amount, options)` - Tambah VB secara atomik
 * - `getInventory(userId)` - Ambil inventaris dalam format array terstandarisasi
 * - `addItems(userId, items)` - Tambah item ke inventaris secara atomik
 * - `takeItems(userId, items)` - Kurangi item dari inventaris secara atomik
 * - `bridgeFragmentsToCoins(userId, fragmentsAmount)` - Tukar NSF ke NC via Dynamic Spread Fee
 *
 * @example
 * const survival = require("./survivalContract");
 * const char = await survival.getCharacter("123456789");
 * await survival.updateVitals("123456789", { hp: 90, hunger: 80 });
 * await survival.rewardFragments("123456789", 50, { source: "daily_quest" });
 */

const cacheManager = require("../../managers/cacheManager");
const {
  safeParseInventory,
  addItemsAtomic,
  takeItemsAtomic,
} = require("../../survival/engines/inventoryHelper");
const eventBus = require("../../core/eventBus");

// ============================================================================
// CONSTANTS
// ============================================================================

/** @type {number} Nilai minimum status vital (HP, Hunger, Thirst, Stamina) */
const VITAL_MIN = 0;

/** @type {number} Nilai maksimum status vital (HP, Hunger, Thirst, Stamina) */
const VITAL_MAX = 100;

/** @type {number} Level minimum karakter survival */
const LEVEL_MIN = 1;

/** @type {number} Jumlah minimum Star Fragments untuk bridge ke koin */
const MIN_BRIDGE_FRAGMENTS = 1000;

/** @type {string[]} Daftar kunci status vital yang valid untuk updateVitals */
const VALID_VITAL_KEYS = ["hp", "hunger", "thirst", "stamina"];

/** @type {string} Alasan kegagalan: jumlah tidak valid */
const REASON_INVALID_AMOUNT = "invalid_amount";

/** @type {string} Alasan kegagalan: SC tidak mencukupi */
const REASON_INSUFFICIENT_FRAGMENTS = "insufficient_fragments";

/** @type {string} Alasan kegagalan: VB tidak mencukupi */
const REASON_INSUFFICIENT_COUPONS = "insufficient_coupons";

/** @type {string} Kode alasan kegagalan: fragment di bawah minimum bridge */
const REASON_MINIMUM_BRIDGE = "MINIMUM_1000_FRAGMENTS_REQUIRED";

/** @type {string} Lokasi default karakter baru */
const DEFAULT_LOCATION_ID = "town_square";

/**
 * @type {Readonly<object>} Data karakter default untuk userId kosong
 */
const EMPTY_CHARACTER = Object.freeze({
  userId: "",
  hp: 0,
  hunger: 0,
  thirst: 0,
  stamina: 0,
  level: 1,
  xp: 0,
  sukamajuCoins: 0,
  scholarshipVouchers: 0,
});

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

/**
 * Kelas kontrak domain survival yang mengelola status vital, inventaris,
 * mata uang SC/VB, dan jembatan satu arah ke domain Economy.
 */
class SurvivalContract {
/**
   * Mengambil data karakter survival lengkap untuk seorang pengguna.
   * Semua nilai vital dijepit (clamped) antara 0-100, level minimal 1.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @returns {Promise<Readonly<object>>} Data karakter beku dengan properti:
   *   userId, hp, hunger, thirst, stamina, level, xp, sukamajuCoins,
   *   scholarshipVouchers, locationId
   */
  async getCharacter(userId) {
    if (!userId) {
      return EMPTY_CHARACTER;
    }

    const survival = await cacheManager.getUserSurvival(userId);
    return Object.freeze({
      userId,
      hp: Math.max(VITAL_MIN, Math.min(VITAL_MAX, Number(survival?.hp) || VITAL_MAX)),
      hunger: Math.max(VITAL_MIN, Math.min(VITAL_MAX, Number(survival?.hunger) || VITAL_MAX)),
      thirst: Math.max(VITAL_MIN, Math.min(VITAL_MAX, Number(survival?.thirst) || VITAL_MAX)),
      stamina: Math.max(VITAL_MIN, Math.min(VITAL_MAX, Number(survival?.stamina) || VITAL_MAX)),
      level: Math.max(LEVEL_MIN, Number(survival?.survival_level) || LEVEL_MIN),
      xp: Math.max(0, Number(survival?.survival_xp) || 0),
      sukamajuCoins: Math.max(0, Number(survival?.sukamajuCoins) || 0),
      scholarshipVouchers: Math.max(0, Number(survival?.scholarshipVouchers) || 0),
      locationId: survival?.location_id || DEFAULT_LOCATION_ID,
    });
  }

/**
   * Memperbarui status vital (HP, Hunger, Thirst, Stamina) secara parsial.
   * Hanya kunci yang ada di vitalsPatch dan bertipe number yang diproses.
   * Semua nilai dijepit (clamped) antara 0-100 dan dibulatkan ke integer terdekat.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {{hp?: number, hunger?: number, thirst?: number, stamina?: number}} vitalsPatch
   *   Patch parsial berisi perubahan nilai vital
   * @returns {Promise<Readonly<object>>} Data karakter terbaru setelah pembaruan
   */
  async updateVitals(userId, vitalsPatch = {}) {
    if (!userId || !vitalsPatch || typeof vitalsPatch !== "object") {
      return this.getCharacter(userId);
    }

    const patch = {};

    for (const key of VALID_VITAL_KEYS) {
      if (typeof vitalsPatch[key] === "number") {
        patch[key] = Math.max(VITAL_MIN, Math.min(VITAL_MAX, Math.round(vitalsPatch[key])));
      }
    }

    if (Object.keys(patch).length > 0) {
      await cacheManager.updateUserSurvival(userId, patch);
    }

    const updated = await this.getCharacter(userId);
    eventBus.emit("survival:vitals_updated", { userId, patch, current: updated });
    return updated;
  }

/**
   * Memotong Sukamaju Koin (SC) dari saldo pengguna secara atomik.
   * Gagal jika saldo tidak mencukupi atau jumlah tidak valid.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah SC yang akan dipotong (dibulatkan ke bawah)
   * @param {object} [options] - Opsi tambahan
   * @param {string} [options.reason="unspecified"] - Alasan pemotongan untuk log event
   * @returns {Promise<Readonly<{ok: boolean, balance: number, reason?: string}>>}
   *   Hasil operasi dengan status ok, saldo SC tersisa, dan alasan jika gagal
   */
  async chargeFragments(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, balance: 0, reason: REASON_INVALID_AMOUNT });
    }

    const result = await cacheManager.debitUserSurvival(userId, "sukamajuCoins", safeAmount);
    const char = await this.getCharacter(userId);

    if (!result || !result.ok) {
      return Object.freeze({
        ok: false,
        balance: char.sukamajuCoins,
        reason: result?.reason || REASON_INSUFFICIENT_FRAGMENTS,
      });
    }

    eventBus.emit("survival:fragments_charged", {
      userId,
      amount: safeAmount,
      balance: char.sukamajuCoins,
      reason: options.reason || "unspecified",
    });

    return Object.freeze({
      ok: true,
      balance: char.sukamajuCoins,
    });
  }

/**
   * Menambah Sukamaju Koin (SC) ke saldo pengguna secara atomik.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah SC yang akan ditambahkan (dibulatkan ke bawah)
   * @param {object} [options] - Opsi tambahan
   * @param {string} [options.source="reward"] - Sumber reward untuk log event
   * @returns {Promise<Readonly<{ok: boolean, balance: number}>>}
   *   Hasil operasi dengan status ok dan saldo SC terbaru
   */
  async rewardFragments(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      const char = await this.getCharacter(userId);
      return Object.freeze({ ok: false, balance: char.sukamajuCoins });
    }

    await cacheManager.incrementUserSurvival(userId, { sukamajuCoins: safeAmount });
    const char = await this.getCharacter(userId);

    eventBus.emit("survival:fragments_rewarded", {
      userId,
      amount: safeAmount,
      balance: char.sukamajuCoins,
      source: options.source || "reward",
    });

    return Object.freeze({
      ok: true,
      balance: char.sukamajuCoins,
    });
  }

/**
   * Memotong Voucher Beasiswa (VB) dari saldo pengguna secara atomik.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah VB yang akan dipotong (dibulatkan ke bawah)
   * @returns {Promise<Readonly<{ok: boolean, balance: number, reason?: string}>>}
   *   Hasil operasi dengan status ok, saldo VB tersisa, dan alasan jika gagal
   */
  async chargeCoupons(userId, amount) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, balance: 0, reason: REASON_INVALID_AMOUNT });
    }

    const result = await cacheManager.debitUserSurvival(userId, "scholarshipVouchers", safeAmount);
    const char = await this.getCharacter(userId);

    if (!result || !result.ok) {
      return Object.freeze({
        ok: false,
        balance: char.scholarshipVouchers,
        reason: result?.reason || REASON_INSUFFICIENT_COUPONS,
      });
    }

    return Object.freeze({
      ok: true,
      balance: char.scholarshipVouchers,
    });
  }

/**
   * Menambah Voucher Beasiswa (VB) ke saldo pengguna secara atomik.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} amount - Jumlah VB yang akan ditambahkan (dibulatkan ke bawah)
   * @param {object} [options] - Opsi tambahan
   * @param {string} [options.source="reward"] - Sumber reward untuk log event
   * @returns {Promise<Readonly<{ok: boolean, balance: number}>>}
   *   Hasil operasi dengan status ok dan saldo VB terbaru
   */
  async rewardCoupons(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      const char = await this.getCharacter(userId);
      return Object.freeze({ ok: false, balance: char.scholarshipVouchers });
    }

    await cacheManager.incrementUserSurvival(userId, { scholarshipVouchers: safeAmount });
    const char = await this.getCharacter(userId);

    eventBus.emit("survival:coupons_rewarded", {
      userId,
      amount: safeAmount,
      balance: char.scholarshipVouchers,
      source: options.source || "reward",
    });

    return Object.freeze({
      ok: true,
      balance: char.scholarshipVouchers,
    });
  }

/**
   * Mengambil inventaris pengguna dalam format array terstandarisasi.
   * Menggunakan safeParseInventory untuk menangani data JSON yang mungkin korup.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @returns {Promise<Readonly<Array>>} Array item inventaris yang dibekukan
   */
  async getInventory(userId) {
    if (!userId) return Object.freeze([]);
    const profile = await cacheManager.getUserProfile(userId);
    const inv = safeParseInventory(profile?.inventory);
    return Object.freeze([...inv]);
  }

/**
   * Menambahkan item ke inventaris pengguna secara atomik.
   * Mendelegasikan ke inventoryHelper.addItemsAtomic untuk konsistensi transaksi.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {object|Array<object>} items - Item tunggal atau array item yang akan ditambahkan
   * @returns {Promise<Readonly<{ok: boolean, inventory: Array, reason?: string}>>}
   *   Hasil operasi dengan inventaris terbaru
   */
  async addItems(userId, items) {
    const res = await addItemsAtomic(userId, items);
    return Object.freeze({
      ok: Boolean(res?.ok),
      inventory: res?.inventory || [],
      reason: res?.reason,
    });
  }

/**
   * Mengurangi item dari inventaris pengguna secara atomik.
   * Mendelegasikan ke inventoryHelper.takeItemsAtomic untuk konsistensi transaksi.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {object|Array<object>} items - Item tunggal atau array item yang akan dikurangi
   * @returns {Promise<Readonly<{ok: boolean, inventory: Array, reason?: string}>>}
   *   Hasil operasi dengan inventaris terbaru
   */
  async takeItems(userId, items) {
    const res = await takeItemsAtomic(userId, items);
    return Object.freeze({
      ok: Boolean(res?.ok),
      inventory: res?.inventory || [],
      reason: res?.reason,
    });
  }

/**
   * Jembatan satu arah: Menukar Star Fragments (NSF) ke Naura Coins (NC).
   * Menggunakan Dynamic Spread Fee (5-25%) yang dialirkan ke ServerTreasury.
   * Minimum 1000 fragments per transaksi.
   *
   * @param {string} userId - Discord Snowflake ID pengguna
   * @param {number} fragmentsAmount - Jumlah NSF yang akan ditukarkan
   * @returns {Promise<Readonly<{ok: boolean, fragmentsDebited: number, coinsGranted: number, feeNsf?: number, reason?: string}>>}
   *   Hasil pertukaran dengan rincian fragment terpakai, koin diterima, dan biaya spread
   */
  async bridgeFragmentsToCoins(userId, fragmentsAmount) {
    const safeFragments = Math.floor(Number(fragmentsAmount) || 0);
    if (!userId || safeFragments < MIN_BRIDGE_FRAGMENTS) {
      return Object.freeze({
        ok: false,
        fragmentsDebited: 0,
        coinsGranted: 0,
        reason: REASON_MINIMUM_BRIDGE,
      });
    }

    const currency = require("../../survival/engines/currency");
    const [survival, profile] = await Promise.all([
      cacheManager.getUserSurvival(userId),
      cacheManager.getUserProfile(userId),
    ]);

    const result = await currency.exchange(
      { survival, profile },
      currency.FRAGMENT,
      currency.COIN,
      safeFragments,
    );

    if (!result.ok) {
      return Object.freeze({
        ok: false,
        fragmentsDebited: 0,
        coinsGranted: 0,
        reason: result.reason,
      });
    }

    eventBus.emit("survival:bridge_to_coins", {
      userId,
      fragmentsDebited: result.spent,
      coinsGranted: result.received,
      feeNsf: result.feeNsf,
      timestamp: Date.now(),
    });

    return Object.freeze({
      ok: true,
      fragmentsDebited: result.spent,
      coinsGranted: result.received,
      feeNsf: result.feeNsf,
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

const survivalContract = new SurvivalContract();
survivalContract.SurvivalContract = SurvivalContract;

module.exports = survivalContract;
