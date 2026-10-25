"use strict";

const { logger } = require("../../managers/logger");

class LootTableEngine {
  constructor(tableId, entries = []) {
    this.tableId = tableId;
    this.entries = entries;
    this.totalWeight = entries.reduce((sum, e) => sum + (e.weight || 1), 0);
    this.pityCounter = new Map();
    this.pityThreshold = 50;
  }

  /**
   * Roll satu item dari loot table
   * @param {string} userId - Untuk tracking pity
   * @returns {{ item: object, rolledFromPity: boolean }}
   */
  roll(userId) {
    const pityKey = `${this.tableId}:${userId}`;
    let counter = this.pityCounter.get(pityKey) || 0;
    counter++;

    const rareEntries = this.entries.filter((e) => (e.rarity === "legendary" || e.rarity === "epic"));
    if (rareEntries.length > 0 && counter >= this.pityThreshold) {
      const rareTotalWeight = rareEntries.reduce((sum, e) => sum + (e.weight || 1), 0);
      const pick = this._weightedPick(rareEntries, rareTotalWeight);
      this.pityCounter.set(pityKey, 0);
      logger.info(`[LootTable:${this.tableId}] Pity triggered for ${userId}: ${pick.id}`);
      return { item: pick, rolledFromPity: true };
    }

    const pick = this._weightedPick(this.entries, this.totalWeight);
    this.pityCounter.set(pityKey, counter);
    return { item: pick, rolledFromPity: false };
  }

  /**
   * Roll multiple items sekaligus
   * @param {string} userId
   * @param {number} count
   * @returns {Array<{ item: object, rolledFromPity: boolean }>}
   */
  rollMultiple(userId, count = 1) {
    const results = [];
    for (let i = 0; i < Math.min(count, 100); i++) {
      results.push(this.roll(userId));
    }
    return results;
  }

  /**
   * Mendapatkan pity counter saat ini
   * @param {string} userId
   * @returns {number}
   */
  getPityCount(userId) {
    return this.pityCounter.get(`${this.tableId}:${userId}`) || 0;
  }

  resetPity(userId) {
    this.pityCounter.set(`${this.tableId}:${userId}`, 0);
  }

  _weightedPick(entries, totalWeight) {
    let random = Math.random() * totalWeight;
    for (const entry of entries) {
      random -= (entry.weight || 1);
      if (random <= 0) return entry;
    }
    return entries[entries.length - 1];
  }
}

/**
 * Factory untuk membuat loot table dari konfigurasi
 * @param {string} tableId
 * @param {Array<{ id: string, name: string, weight: number, rarity: string }>} entries
 * @returns {LootTableEngine}
 */
function createLootTable(tableId, entries) {
  return new LootTableEngine(tableId, entries);
}

module.exports = { LootTableEngine, createLootTable };
