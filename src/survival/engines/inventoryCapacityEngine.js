"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const BASE_CAPACITY = 30;
const LEVEL_BONUS = 2;
const VIP_TIER_BONUS = {
  vip_starter: 10,
  vip_tier1: 20,
  vip_tier2: 35,
  vip_tier3: 50,
};

class InventoryCapacityEngine {
  /**
   * Hitung kapasitas inventory maksimal pemain
   * @param {object} profile - UserProfile data
   * @param {object} survival - UserSurvival data
   * @returns {{ capacity: number, base: number, levelBonus: number, vipBonus: number }}
   */
  static calculateCapacity(profile, survival) {
    const level = profile?.leveling_level || 1;
    const premiumTier = profile?.premiumTier || null;

    const base = BASE_CAPACITY;
    const levelBonus = Math.floor(level * LEVEL_BONUS);
    const vipBonus = VIP_TIER_BONUS[premiumTier] || 0;

    return {
      capacity: base + levelBonus + vipBonus,
      base,
      levelBonus,
      vipBonus,
    };
  }

  /**
   * Periksa apakah inventory penuh
   * @param {string} userId
   * @returns {Promise<{ full: boolean, current: number, capacity: number, remaining: number }>}
   */
  static async checkCapacity(userId) {
    try {
      const [profile, survival] = await Promise.all([
        cacheManager.getUserProfile(userId),
        cacheManager.getUserSurvival(userId),
      ]);

      const { capacity } = this.calculateCapacity(profile, survival);
      const { safeParseInventory } = require("./inventoryHelper");
      const inventory = safeParseInventory(profile?.inventory);
      const current = inventory.length;

      return {
        full: current >= capacity,
        current,
        capacity,
        remaining: Math.max(0, capacity - current),
      };
    } catch (error) {
      logger.error(`[InventoryCapacity] Check error for ${userId}:`, error);
      return { full: false, current: 0, capacity: BASE_CAPACITY, remaining: BASE_CAPACITY };
    }
  }

  /**
   * Build warning message saat inventory hampir penuh
   * @param {number} current
   * @param {number} capacity
   * @returns {object|null}
   */
  static buildWarningIfNeeded(current, capacity) {
    const ratio = current / capacity;
    if (ratio < 0.8) return null;

    const severity = ratio >= 1 ? "critical" : ratio >= 0.9 ? "high" : "medium";
    const colors = { critical: 0xFF0000, high: 0xFFA500, medium: 0xFFFF00 };

    return {
      title: `Inventory ${ratio >= 1 ? "PENUH!" : "Hampir Penuh"}`,
      description: `${current}/${capacity} slot terpakai (${Math.round(ratio * 100)}%)\n\n${ratio >= 1 ? "Kosongkan inventory untuk menerima item baru." : "Segera kelola inventory Anda."}`,
      color: colors[severity],
      footer: "Gunakan /survival inventory untuk mengelola item",
    };
  }

  static getVipBonuses() {
    return { ...VIP_TIER_BONUS };
  }
}

module.exports = { InventoryCapacityEngine, BASE_CAPACITY, LEVEL_BONUS };
