"use strict";

/**
 * @file smartCraftingAdvisor.js
 * @description Penasihat Crafting Cerdas dengan Saran Resep Berbasis Inventory & Tren Server via OpenRouter.
 * Terintegrasi ke aiEnsembleRouter dengan fallback prosedural instan saat offline atau circuit-breaker aktif.
 */

const { logger } = require("../managers/logger");
const aiEnsembleRouter = require("../ai/aiEnsembleRouter");

class SmartCraftingAdvisor {
  /**
   * @param {string} [advisorId="default_advisor"] - ID unik penasihat
   * @param {object} [baseConfig={}] - Konfigurasi penasihat dan database resep
   */
  constructor(advisorId = "default_advisor", baseConfig = {}) {
    this.advisorId = advisorId;
    this.name = baseConfig.name || "AI Crafting Master";
    this.recipeDatabase = Array.isArray(baseConfig.recipeDatabase) ? baseConfig.recipeDatabase : [];
    this.serverTrends = new Map();
  }

  /**
   * Menghasilkan saran crafting berdasarkan inventory pemain, konteks level, dan tren server
   * @param {string} userId - ID Pengguna Discord
   * @param {object|Array} [playerInventory={}] - Inventory pemain saat ini
   * @param {object} [craftingContext={}] - Konteks tambahan ({ level, unlockedRecipes, tier, premium_tier })
   * @returns {Promise<{ advisorId: string, advisorName: string, promptPrepared: string, suggestions: Array<{ name: string, materials: object|string, rarity: string, benefit: string }>, explanation: string, trendBonus: boolean, readyForAiActivation: boolean, isAiGenerated: boolean }>}
   */
  async generateCraftingSuggestions(userId, playerInventory = {}, craftingContext = {}) {
    try {
      logger.info(`[SmartCrafting:${this.advisorId}] Generating suggestions for user ${userId}`);

      const playerLevel = typeof craftingContext.level === "number" ? craftingContext.level : 1;
      const unlockedRecipes = Array.isArray(craftingContext.unlockedRecipes)
        ? craftingContext.unlockedRecipes
        : [];

      let availableMaterials = [];
      let totalItems = 0;

      if (Array.isArray(playerInventory)) {
        availableMaterials = playerInventory
          .map((it) => (it && (it.name || it.id)) || "")
          .filter(Boolean);
        totalItems = playerInventory.reduce((acc, it) => acc + (it && it.amount ? it.amount : 1), 0);
      } else if (typeof playerInventory === "object" && playerInventory !== null) {
        availableMaterials = Object.keys(playerInventory);
        totalItems = Object.values(playerInventory).reduce(
          (acc, val) => acc + (typeof val === "number" ? val : 1),
          0
        );
      }

      const sanitizedMaterials = availableMaterials
        .slice(0, 30)
        .map((m) => String(m).replace(/[\r\n`]/g, " ").trim().slice(0, 60))
        .filter(Boolean);

      let promptTemplate = `Berikan saran crafting untuk pemain RPG dengan detail berikut:\n`;
      promptTemplate += `Level pemain: ${playerLevel}. Material tersedia: ${sanitizedMaterials.join(", ") || "tidak ada"}.\n`;
      promptTemplate += `Resep terbuka: ${unlockedRecipes.length}. Inventory size: ${totalItems} item.\n`;
      promptTemplate += `Sarankan 3 resep optimal dalam format JSON array murni tanpa markdown fences: [{ "name": "...", "materials": "...", "rarity": "...", "benefit": "..." }].`;

      const simulatedSuggestions = this._generateSimulatedSuggestions(availableMaterials, playerLevel);
      const simulatedExplanation = this._generateExplanation(simulatedSuggestions);

      let suggestions = simulatedSuggestions;
      let explanation = simulatedExplanation;
      let isAi = false;

      try {
        const userTier = craftingContext.tier || craftingContext.premium_tier || "free";
        const aiResponse = await aiEnsembleRouter.generate({
          taskType: aiEnsembleRouter.TASK_TYPES.TACTICAL_REASONING,
          prompt: promptTemplate,
          systemInstruction:
            "Kamu adalah AI Crafting Advisor untuk game RPG Naura Wilds. Balas HANYA berupa JSON array valid tanpa markdown format (tanpa ```json) berisi objek [{ name, materials, rarity, benefit }]. Berikan saran logis dalam bahasa Indonesia. Jangan gunakan karakter em dash.",
          config: { temperature: 0.5, maxOutputTokens: 400 },
          userId: userId,
          userTier: userTier,
        });

        if (
          aiResponse &&
          typeof aiResponse.text === "string" &&
          aiResponse.text.trim().length > 0 &&
          aiResponse.provider !== "fallback" &&
          !aiResponse.isPremiumRestricted
        ) {
          const rawText = aiResponse.text.trim();
          const jsonMatch = rawText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              suggestions = parsed.map((item) => ({
                name: String(item.name || "Item Misterius").replace(/[\u2014\u2013]/g, "-"),
                materials: typeof item.materials === "object" && item.materials !== null
                  ? item.materials
                  : String(item.materials || "Material dasar").replace(/[\u2014\u2013]/g, "-"),
                rarity: String(item.rarity || "Common").replace(/[\u2014\u2013]/g, "-"),
                benefit: String(item.benefit || "Meningkatkan kemampuan bertualang").replace(/[\u2014\u2013]/g, "-"),
              }));
              explanation = `Berdasarkan material dan level Anda (${playerLevel}), kami merekomendasikan ${suggestions[0].name} sebagai prioritas utama tempa.`;
              isAi = true;
            }
          }
        }
      } catch (aiErr) {
        logger.warn(
          `[SmartCrafting:${this.advisorId}] OpenRouter gagal (${aiErr.message}), beralih ke saran prosedural.`
        );
      }

      const hasTrendBonus = this._checkServerTrend(suggestions);

      return {
        advisorId: this.advisorId,
        advisorName: this.name,
        promptPrepared: promptTemplate,
        suggestions,
        explanation: explanation.replace(/[\u2014\u2013]/g, "-"),
        trendBonus: hasTrendBonus,
        readyForAiActivation: true,
        isAiGenerated: isAi,
      };
    } catch (error) {
      logger.error(`[SmartCrafting] Galat pada advisor ${this.advisorId}:`, error);
      return {
        advisorId: this.advisorId,
        advisorName: this.name,
        promptPrepared: "",
        suggestions: [],
        explanation: "Maaf, saya tidak dapat memberikan saran saat ini.",
        trendBonus: false,
        readyForAiActivation: false,
        isAiGenerated: false,
      };
    }
  }

  /**
   * Memperbarui tren crafting server
   * @param {string} recipeName
   * @param {number} [craftCount=1]
   */
  updateServerTrend(recipeName, craftCount = 1) {
    const current = this.serverTrends.get(recipeName) || 0;
    this.serverTrends.set(recipeName, current + craftCount);
  }

  /**
   * Generator saran prosedural instan berbasis level dan material
   * @param {Array<string>} materials
   * @param {number} level
   * @returns {Array<{ name: string, materials: object, rarity: string, benefit: string }>}
   */
  _generateSimulatedSuggestions(materials, level) {
    const basicRecipes = [
      { name: "Health Potion", materials: { herb: 2, water: 1 }, rarity: "common", benefit: "Restore 50 HP" },
      { name: "Iron Sword", materials: { iron_ore: 3, wood: 1 }, rarity: "uncommon", benefit: "+15 ATK" },
      { name: "Leather Armor", materials: { leather: 4, thread: 2 }, rarity: "common", benefit: "+10 DEF" },
      { name: "Steel Broadsword", materials: { steel_ingot: 4, leather: 2 }, rarity: "rare", benefit: "+35 ATK" },
      { name: "Guardian Shield", materials: { iron_ore: 5, wood: 3 }, rarity: "uncommon", benefit: "+25 DEF" },
    ];

    const available = basicRecipes.filter((r) => {
      const minLevel = r.rarity === "rare" ? 10 : r.rarity === "uncommon" ? 5 : 1;
      return level >= minLevel;
    });

    return (available.length > 0 ? available : basicRecipes).slice(0, 3);
  }

  /**
   * Memeriksa apakah saran mendapatkan bonus tren server
   * @param {Array<object>} suggestions
   * @returns {boolean}
   */
  _checkServerTrend(suggestions) {
    if (!Array.isArray(suggestions)) return false;
    return suggestions.some((s) => (this.serverTrends.get(s.name) || 0) > 10);
  }

  /**
   * Penjelasan rekomendasi resep
   * @param {Array<object>} suggestions
   * @returns {string}
   */
  _generateExplanation(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return "Material Anda belum cukup untuk crafting.";
    }
    return `Berdasarkan material Anda, saya sarankan ${suggestions[0].name} sebagai prioritas.`;
  }
}

const defaultCraftingAdvisor = new SmartCraftingAdvisor("default_advisor");

module.exports = SmartCraftingAdvisor;
module.exports.SmartCraftingAdvisor = SmartCraftingAdvisor;
module.exports.defaultCraftingAdvisor = defaultCraftingAdvisor;
