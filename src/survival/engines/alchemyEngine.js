"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const INGREDIENT_CATEGORIES = ["herb", "mineral", "essence", "catalyst"];
const DISCOVERY_TYPES = ["potion", "elixir", "bomb", "buff_food"];

class AlchemyEngine {
  static async experiment(userId, ingredients) {
    try {
      if (!ingredients || ingredients.length < 2) return { ok: false, reason: "NEED_MIN_2_INGREDIENTS" };
      if (ingredients.length > 4) return { ok: false, reason: "MAX_4_INGREDIENTS" };

      const sortedIngredients = [...ingredients].sort();
      const recipeKey = sortedIngredients.join("+");

      const knownRecipes = await this._getKnownRecipes(userId);
      const alreadyKnown = knownRecipes[recipeKey];

      if (alreadyKnown) {
        return { ok: true, discovered: false, result: alreadyKnown, fromMemory: true };
      }

      const success = Math.random() < 0.4;
      if (!success) {
        return {
          ok: true,
          discovered: false,
          failed: true,
          failureType: Math.random() < 0.3 ? "explosion" : "inert_mixture",
          salvagedMaterials: this._salvageMaterials(ingredients),
        };
      }

      const discovery = this._generateDiscovery(sortedIngredients);
      await this._recordDiscovery(userId, recipeKey, discovery);

      logger.info(`[Alchemy] ${userId} discovered ${discovery.name}`);
      return { ok: true, discovered: true, result: discovery };
    } catch (error) {
      logger.error(`[Alchemy] Experiment error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static _generateDiscovery(ingredients) {
    const types = DISCOVERY_TYPES;
    const type = types[Math.floor(Math.random() * types.length)];
    const potency = Math.floor(Math.random() * 50) + 20;

    const names = {
      potion: ["Ramuan Penyembuhan", "Elixir Kekuatan", "Tonik Kecepatan"],
      elixir: ["Elixir Kebijaksanaan", "Ramuan Ketahanan", "Minuman Stamina"],
      bomb: ["Bom Asap", "Peledak Api", "Granat Beku"],
      buff_food: ["Sup Penguat", "Roti Energi", "Kue Keberuntungan"],
    };

    const nameList = names[type] || names.potion;
    return {
      name: nameList[Math.floor(Math.random() * nameList.length)],
      type,
      potency,
      ingredients,
      discoveredAt: Date.now(),
    };
  }

  static async _getKnownRecipes(userId) {
    try {
      const raw = await redisManager.get(`alchemy_recipes:${userId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static async _recordDiscovery(userId, recipeKey, discovery) {
    try {
      const recipes = await this._getKnownRecipes(userId);
      recipes[recipeKey] = discovery;
      await redisManager.set(`alchemy_recipes:${userId}`, JSON.stringify(recipes), "EX", 2592000);
    } catch (error) {
      logger.error(`[Alchemy] Record error:`, error);
    }
  }

  static _salvageMaterials(ingredients) {
    return ingredients.filter(() => Math.random() < 0.5);
  }
}

module.exports = { AlchemyEngine, INGREDIENT_CATEGORIES, DISCOVERY_TYPES };
