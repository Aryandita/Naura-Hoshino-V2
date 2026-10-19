"use strict";

const cacheManager = require("../../managers/cacheManager");
const {
  safeParseInventory,
  addItemsAtomic,
  takeItemsAtomic,
} = require("../../survival/engines/inventoryHelper");
const eventBus = require("../../core/eventBus");

/**
 * Survival Public Domain Contract (Naura Wilds)
 * Mengelola status vital, inventaris, Star Fragments, dan Coupons.
 * Akses ke domain Economy hanya dilakukan secara searah (One-Way Bridge).
 */
class SurvivalContract {
  /**
   * Mengambil data karakter survival lengkap.
   * @param {string} userId
   * @returns {Promise<Readonly<object>>}
   */
  async getCharacter(userId) {
    if (!userId) {
      return Object.freeze({
        userId: "",
        hp: 0,
        hunger: 0,
        thirst: 0,
        stamina: 0,
        level: 1,
        xp: 0,
        starFragments: 0,
        coupons: 0,
      });
    }

    const survival = await cacheManager.getUserSurvival(userId);
    return Object.freeze({
      userId,
      hp: Math.max(0, Math.min(100, Number(survival?.hp) || 100)),
      hunger: Math.max(0, Math.min(100, Number(survival?.hunger) || 100)),
      thirst: Math.max(0, Math.min(100, Number(survival?.thirst) || 100)),
      stamina: Math.max(0, Math.min(100, Number(survival?.stamina) || 100)),
      level: Math.max(1, Number(survival?.survival_level) || 1),
      xp: Math.max(0, Number(survival?.survival_xp) || 0),
      starFragments: Math.max(0, Number(survival?.starFragments) || 0),
      coupons: Math.max(0, Number(survival?.coupons) || 0),
      locationId: survival?.location_id || "town_square",
    });
  }

  /**
   * Memperbarui status vital (HP, Hunger, Thirst, Stamina) secara parsial dan terjepit (clamped 0-100).
   * @param {string} userId
   * @param {{ hp?: number, hunger?: number, thirst?: number, stamina?: number }} vitalsPatch
   * @returns {Promise<Readonly<object>>}
   */
  async updateVitals(userId, vitalsPatch = {}) {
    if (!userId || !vitalsPatch || typeof vitalsPatch !== "object") {
      return this.getCharacter(userId);
    }

    const patch = {};
    const validKeys = ["hp", "hunger", "thirst", "stamina"];

    for (const key of validKeys) {
      if (typeof vitalsPatch[key] === "number") {
        patch[key] = Math.max(0, Math.min(100, Math.round(vitalsPatch[key])));
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
   * Memotong Naura Star Fragments (NSF) secara atomik.
   * @param {string} userId
   * @param {number} amount
   * @param {object} [options]
   * @returns {Promise<Readonly<{ ok: boolean, balance: number, reason?: string }>>}
   */
  async chargeFragments(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, balance: 0, reason: "invalid_amount" });
    }

    const result = await cacheManager.debitUserSurvival(userId, "starFragments", safeAmount);
    const char = await this.getCharacter(userId);

    if (!result || !result.ok) {
      return Object.freeze({
        ok: false,
        balance: char.starFragments,
        reason: result?.reason || "insufficient_fragments",
      });
    }

    eventBus.emit("survival:fragments_charged", {
      userId,
      amount: safeAmount,
      balance: char.starFragments,
      reason: options.reason || "unspecified",
    });

    return Object.freeze({
      ok: true,
      balance: char.starFragments,
    });
  }

  /**
   * Menambah Naura Star Fragments (NSF) secara atomik.
   * @param {string} userId
   * @param {number} amount
   * @param {object} [options]
   * @returns {Promise<Readonly<{ ok: boolean, balance: number }>>}
   */
  async rewardFragments(userId, amount, options = {}) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      const char = await this.getCharacter(userId);
      return Object.freeze({ ok: false, balance: char.starFragments });
    }

    await cacheManager.incrementUserSurvival(userId, { starFragments: safeAmount });
    const char = await this.getCharacter(userId);

    eventBus.emit("survival:fragments_rewarded", {
      userId,
      amount: safeAmount,
      balance: char.starFragments,
      source: options.source || "reward",
    });

    return Object.freeze({
      ok: true,
      balance: char.starFragments,
    });
  }

  /**
   * Memotong Naura Coupons secara atomik.
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<Readonly<{ ok: boolean, balance: number, reason?: string }>>}
   */
  async chargeCoupons(userId, amount) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      return Object.freeze({ ok: false, balance: 0, reason: "invalid_amount" });
    }

    const result = await cacheManager.debitUserSurvival(userId, "coupons", safeAmount);
    const char = await this.getCharacter(userId);

    if (!result || !result.ok) {
      return Object.freeze({
        ok: false,
        balance: char.coupons,
        reason: result?.reason || "insufficient_coupons",
      });
    }

    return Object.freeze({
      ok: true,
      balance: char.coupons,
    });
  }

  /**
   * Menambah Naura Coupons secara atomik.
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<Readonly<{ ok: boolean, balance: number }>>}
   */
  async rewardCoupons(userId, amount) {
    const safeAmount = Math.floor(Number(amount) || 0);
    if (!userId || safeAmount <= 0) {
      const char = await this.getCharacter(userId);
      return Object.freeze({ ok: false, balance: char.coupons });
    }

    await cacheManager.incrementUserSurvival(userId, { coupons: safeAmount });
    const char = await this.getCharacter(userId);

    return Object.freeze({
      ok: true,
      balance: char.coupons,
    });
  }

  /**
   * Mengambil inventaris pengguna dalam format array terstandarisasi.
   * @param {string} userId
   * @returns {Promise<Readonly<Array>>}
   */
  async getInventory(userId) {
    if (!userId) return Object.freeze([]);
    const profile = await cacheManager.getUserProfile(userId);
    const inv = safeParseInventory(profile?.inventory);
    return Object.freeze([...inv]);
  }

  /**
   * Menambahkan item ke inventaris secara atomik.
   * @param {string} userId
   * @param {object|Array<object>} items
   * @returns {Promise<Readonly<{ ok: boolean, inventory: Array, reason?: string }>>}
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
   * Mengurangi item dari inventaris secara atomik.
   * @param {string} userId
   * @param {object|Array<object>} items
   * @returns {Promise<Readonly<{ ok: boolean, inventory: Array, reason?: string }>>}
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
   * Menghubungi currency.exchange() dengan Dynamic Spread Fee (5-25%) yang dialirkan ke ServerTreasury.
   * @param {string} userId
   * @param {number} fragmentsAmount
   * @returns {Promise<Readonly<{ ok: boolean, fragmentsDebited: number, coinsGranted: number, feeNsf?: number, reason?: string }>>}
   */
  async bridgeFragmentsToCoins(userId, fragmentsAmount) {
    const safeFragments = Math.floor(Number(fragmentsAmount) || 0);
    if (!userId || safeFragments < 1000) {
      return Object.freeze({
        ok: false,
        fragmentsDebited: 0,
        coinsGranted: 0,
        reason: "MINIMUM_1000_FRAGMENTS_REQUIRED",
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

const survivalContract = new SurvivalContract();
survivalContract.SurvivalContract = SurvivalContract;

module.exports = survivalContract;
