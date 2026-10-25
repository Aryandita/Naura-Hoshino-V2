"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const QUALITY_GRADES = ["normal", "fine", "superior", "masterpiece"];
const SPECIALIZATIONS = ["blacksmith", "alchemist", "chef", "tailor", "jeweler"];
const MASTERY_LEVELS = 10;

class CraftingMasteryEngine {
  static calculateQuality(playerMastery, recipeDifficulty) {
    const baseChance = Math.max(0.1, (playerMastery / recipeDifficulty) * 0.5);
    const roll = Math.random();

    if (roll < baseChance * 0.1) return "masterpiece";
    if (roll < baseChance * 0.3) return "superior";
    if (roll < baseChance * 0.6) return "fine";
    return "normal";
  }

  static getQualityMultiplier(grade) {
    const multipliers = { normal: 1, fine: 1.5, superior: 2.5, masterpiece: 5 };
    return multipliers[grade] || 1;
  }

  static async gainMastery(userId, specialization, amount = 1) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const masteries = survival?.craftingMasteries || {};
      const current = masteries[specialization] || 0;
      const newLevel = Math.min(MASTERY_LEVELS, current + amount);
      masteries[specialization] = newLevel;

      await cacheManager.updateUserSurvival(userId, { craftingMasteries: masteries });
      return { ok: true, specialization, oldLevel: current, newLevel };
    } catch (error) {
      logger.error(`[CraftingMastery] Gain error:`, error);
      return { ok: false };
    }
  }

  static async getMasteryStatus(userId) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const masteries = survival?.craftingMasteries || {};
      return { masteries, specializations: SPECIALIZATIONS, maxLevel: MASTERY_LEVELS };
    } catch (error) {
      return { masteries: {}, specializations: SPECIALIZATIONS, maxLevel: MASTERY_LEVELS };
    }
  }

  static salvageFailedCraft(materials, recoveryRate = 0.5) {
    const salvaged = {};
    for (const [material, count] of Object.entries(materials)) {
      const recovered = Math.floor(count * recoveryRate);
      if (recovered > 0) salvaged[material] = recovered;
    }
    return salvaged;
  }
}

module.exports = { CraftingMasteryEngine, QUALITY_GRADES, SPECIALIZATIONS, MASTERY_LEVELS };
