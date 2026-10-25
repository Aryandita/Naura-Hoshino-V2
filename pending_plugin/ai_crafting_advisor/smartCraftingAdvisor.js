"use strict";

/**
 * @file smartCraftingAdvisor.js
 * @description Blueprint Sistem Crafting Cerdas dengan Saran Resep Berbasis Inventory & Tren Server.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class SmartCraftingAdvisor {
  constructor(advisorId, baseConfig = {}) {
    this.advisorId = advisorId;
    this.name = baseConfig.name || "AI Crafting Master";
    this.recipeDatabase = baseConfig.recipeDatabase || [];
    this.serverTrends = new Map();
  }

  /**
   * Menghasilkan saran crafting berdasarkan inventory pemain dan tren server
   * @param {string} userId - ID Pengguna Discord
   * @param {object} playerInventory - Inventory pemain saat ini
   * @param {object} craftingContext - Konteks tambahan (level, unlocked recipes)
   * @returns {Promise<{ suggestions: Array, explanation: string, trendBonus: boolean }>}
   */
  async generateCraftingSuggestions(userId, playerInventory = {}, craftingContext = {}) {
    try {
      logger.info(`[SmartCrafting:${this.advisorId}] Generating suggestions for user ${userId}`);

      const playerLevel = craftingContext.level || 1;
      const unlockedRecipes = craftingContext.unlockedRecipes || [];
      const availableMaterials = Object.keys(playerInventory);

      let promptTemplate = `Berikan saran crafting untuk pemain RPG dengan detail berikut:\n`;
      promptTemplate += `Level pemain: ${playerLevel}. Material tersedia: ${availableMaterials.join(', ') || 'tidak ada'}.\n`;
      promptTemplate += `Resep terbuka: ${unlockedRecipes.length}. Inventory size: ${Object.values(playerInventory).reduce((a, b) => a + b, 0)} item.\n`;
      promptTemplate += `Sarankan 3 resep optimal dalam format JSON: [{ name, materials{}, rarity, benefit }].`;

      const suggestions = this._generateSimulatedSuggestions(availableMaterials, playerLevel);
      const hasTrendBonus = this._checkServerTrend(suggestions);

      return {
        advisorId: this.advisorId,
        advisorName: this.name,
        promptPrepared: promptTemplate,
        suggestions,
        explanation: this._generateExplanation(suggestions),
        trendBonus: hasTrendBonus,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[SmartCrafting] Galat pada advisor ${this.advisorId}:`, error);
      return {
        advisorId: this.advisorId,
        advisorName: this.name,
        suggestions: [],
        explanation: "Maaf, saya tidak dapat memberikan saran saat ini.",
        trendBonus: false,
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Memperbarui tren crafting server
   * @param {string} recipeName
   * @param {number} craftCount
   */
  updateServerTrend(recipeName, craftCount = 1) {
    const current = this.serverTrends.get(recipeName) || 0;
    this.serverTrends.set(recipeName, current + craftCount);
  }

  _generateSimulatedSuggestions(materials, level) {
    const basicRecipes = [
      { name: "Health Potion", materials: { herb: 2, water: 1 }, rarity: "common", benefit: "Restore 50 HP" },
      { name: "Iron Sword", materials: { iron_ore: 3, wood: 1 }, rarity: "uncommon", benefit: "+15 ATK" },
      { name: "Leather Armor", materials: { leather: 4, thread: 2 }, rarity: "common", benefit: "+10 DEF" },
    ];

    return basicRecipes.filter(r => level >= (r.rarity === "uncommon" ? 5 : 1)).slice(0, 3);
  }

  _checkServerTrend(suggestions) {
    return suggestions.some(s => (this.serverTrends.get(s.name) || 0) > 10);
  }

  _generateExplanation(suggestions) {
    if (suggestions.length === 0) return "Material Anda belum cukup untuk crafting.";
    return `Berdasarkan material Anda, saya sarankan ${suggestions[0].name} sebagai prioritas.`;
  }
}

module.exports = {
  SmartCraftingAdvisor,
};
