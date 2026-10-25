"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const DECAY_RATES = {
  food: { decayPerHour: 5, minQuality: 0 },
  potion: { decayPerHour: 2, minQuality: 10 },
  material: { decayPerHour: 0.5, minQuality: 20 },
  weapon: { decayPerHour: 0, minQuality: 0 },
  armor: { decayPerHour: 0, minQuality: 0 },
};

class ItemDecayEngine {
  /**
   * Menghitung kualitas item setelah periode waktu tertentu
   * @param {object} item - Item dengan properti type, quality, lastUpdated
   * @returns {{ currentQuality: number, decayed: boolean, hoursElapsed: number }}
   */
  static calculateDecay(item) {
    if (!item || !item.lastUpdated) {
      return { currentQuality: item?.quality ?? 100, decayed: false, hoursElapsed: 0 };
    }

    const decayConfig = DECAY_RATES[item.type] || DECAY_RATES.material;
    if (decayConfig.decayPerHour <= 0) {
      return { currentQuality: item.quality ?? 100, decayed: false, hoursElapsed: 0 };
    }

    const now = Date.now();
    const hoursElapsed = Math.max(0, (now - item.lastUpdated) / 3600000);
    const totalDecay = Math.floor(hoursElapsed * decayConfig.decayPerHour);
    const currentQuality = Math.max(decayConfig.minQuality, (item.quality ?? 100) - totalDecay);

    return {
      currentQuality,
      decayed: currentQuality < (item.quality ?? 100),
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    };
  }

  /**
   * Terapkan decay ke seluruh inventory pemain
   * @param {string} userId
   * @returns {Promise<{ decayedItems: Array, totalDecayed: number }>}
   */
  static async applyDecayToInventory(userId) {
    try {
      const profile = await cacheManager.getUserProfile(userId);
      if (!profile) return { decayedItems: [], totalDecayed: 0 };

      const { safeParseInventory } = require("./inventoryHelper");
      const inventory = safeParseInventory(profile.inventory);
      const decayedItems = [];
      let modified = false;

      for (let i = 0; i < inventory.length; i++) {
        const item = inventory[i];
        if (!item || !item.lastUpdated) continue;

        const result = this.calculateDecay(item);
        if (result.decayed) {
          inventory[i].quality = result.currentQuality;
          inventory[i].lastUpdated = Date.now();
          decayedItems.push({ name: item.name || item.id, oldQuality: item.quality, newQuality: result.currentQuality });
          modified = true;
        }
      }

      if (modified) {
        await cacheManager.mutateUserProfileJson(userId, "inventory", JSON.stringify(inventory));
        logger.info(`[ItemDecay] User ${userId}: ${decayedItems.length} items decayed`);
      }

      return { decayedItems, totalDecayed: decayedItems.length };
    } catch (error) {
      logger.error(`[ItemDecay] Error for user ${userId}:`, error);
      return { decayedItems: [], totalDecayed: 0 };
    }
  }

  /**
   * Refresh timestamp item agar tidak decay (misal setelah digunakan/dipindahkan)
   * @param {object} item
   * @returns {object}
   */
  static refreshTimestamp(item) {
    if (!item) return item;
    return { ...item, lastUpdated: Date.now() };
  }

  static getDecayRates() {
    return { ...DECAY_RATES };
  }
}

module.exports = { ItemDecayEngine, DECAY_RATES };
