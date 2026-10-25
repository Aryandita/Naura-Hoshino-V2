"use strict";

/**
 * @file raidStrategyPlanner.js
 * @description Blueprint Koordinator Raid AI untuk Analisis Komposisi Party dan Rekomendasi Strategi.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class RaidStrategyPlanner {
  constructor(plannerId, baseConfig = {}) {
    this.plannerId = plannerId;
    this.name = baseConfig.name || "AI Raid Commander";
    this.roleDefinitions = {
      tank: { primary: "defense", secondary: "aggro_control" },
      healer: { primary: "support", secondary: "sustain" },
      dps_melee: { primary: "damage", secondary: "burst" },
      dps_ranged: { primary: "damage", secondary: "kiting" },
      support: { primary: "buff", secondary: "debuff" },
    };
    this.bossWeaknesses = new Map();
  }

  /**
   * Menganalisis komposisi party dan menghasilkan strategi raid optimal
   * @param {string} guildId - ID Guild Discord
   * @param {Array} partyMembers - Daftar anggota party dengan role dan stat
   * @param {object} bossData - Data boss target (name, level, mechanics)
   * @returns {Promise<{ strategy: object, formation: string, callouts: Array }>}
   */
  async planRaidStrategy(guildId, partyMembers = [], bossData = {}) {
    try {
      logger.info(`[RaidPlanner:${this.plannerId}] Planning strategy for guild ${guildId}`);

      const partySize = partyMembers.length;
      const bossName = bossData.name || "Unknown Boss";
      const bossLevel = bossData.level || 50;
      const bossMechanics = bossData.mechanics || [];

      let promptTemplate = `Analisis komposisi party raid dan berikan strategi optimal:\n`;
      promptTemplate += `Boss: ${bossName} (Lv.${bossLevel}). Mechanics: ${bossMechanics.join(', ') || 'unknown'}.\n`;
      promptTemplate += `Party size: ${partySize}. Roles: ${partyMembers.map(m => m.role).join(', ')}.\n`;
      promptTemplate += `Berikan strategi dalam format JSON: { formation, priority_targets[], phase_strategy[], callouts[] }.`;

      const compositionAnalysis = this._analyzeComposition(partyMembers);
      const strategy = this._generateStrategy(compositionAnalysis, bossData);
      const callouts = this._generateCallouts(bossMechanics, compositionAnalysis);

      return {
        plannerId: this.plannerId,
        plannerName: this.name,
        promptPrepared: promptTemplate,
        compositionAnalysis,
        strategy,
        callouts,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[RaidPlanner] Galat pada planner ${this.plannerId}:`, error);
      return {
        plannerId: this.plannerId,
        plannerName: this.name,
        compositionAnalysis: {},
        strategy: null,
        callouts: [],
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Mencatat kelemahan boss untuk referensi masa depan
   * @param {string} bossName
   * @param {object} weaknessData
   */
  recordBossWeakness(bossName, weaknessData) {
    this.bossWeaknesses.set(bossName, {
      ...weaknessData,
      lastUpdated: Date.now(),
    });
  }

  _analyzeComposition(members) {
    const roleCounts = {};
    const totalStats = { hp: 0, atk: 0, def: 0, spd: 0 };

    for (const member of members) {
      const role = member.role || "dps_melee";
      roleCounts[role] = (roleCounts[role] || 0) + 1;

      if (member.stats) {
        totalStats.hp += member.stats.hp || 0;
        totalStats.atk += member.stats.atk || 0;
        totalStats.def += member.stats.def || 0;
        totalStats.spd += member.stats.spd || 0;
      }
    }

    const balanceScore = this._calculateBalanceScore(roleCounts, members.length);

    return {
      roleCounts,
      totalStats,
      balanceScore,
      hasTank: (roleCounts.tank || 0) > 0,
      hasHealer: (roleCounts.healer || 0) > 0,
      recommendedAdjustments: this._suggestAdjustments(roleCounts, members.length),
    };
  }

  _calculateBalanceScore(roleCounts, partySize) {
    const idealRatios = { tank: 0.2, healer: 0.2, dps_melee: 0.3, dps_ranged: 0.2, support: 0.1 };
    let deviation = 0;

    for (const [role, ratio] of Object.entries(idealRatios)) {
      const actualRatio = (roleCounts[role] || 0) / partySize;
      deviation += Math.abs(actualRatio - ratio);
    }

    return Math.max(0, 1 - deviation);
  }

  _suggestAdjustments(roleCounts, partySize) {
    const suggestions = [];

    if (!roleCounts.tank) suggestions.push("Tambahkan 1 Tank untuk aggro control.");
    if (!roleCounts.healer) suggestions.push("Tambahkan 1 Healer untuk sustain party.");
    if ((roleCounts.dps_melee || 0) + (roleCounts.dps_ranged || 0) < partySize * 0.4) {
      suggestions.push("Kurangi support, tambah DPS untuk damage output.");
    }

    return suggestions;
  }

  _generateStrategy(composition, bossData) {
    const bossLevel = bossData.level || 50;

    if (!composition.hasTank || !composition.hasHealer) {
      return {
        formation: "defensive_circle",
        approach: "cautious",
        phases: ["survive", "chip_damage", "finish"],
        riskLevel: "high",
      };
    }

    if (composition.balanceScore > 0.8) {
      return {
        formation: "standard_raid",
        approach: "aggressive",
        phases: ["tank_pull", "dps_burst", "heal_sustain", "execute"],
        riskLevel: "low",
      };
    }

    return {
      formation: "adaptive",
      approach: "balanced",
      phases: ["position", "test_mechanics", "full_engage"],
      riskLevel: "medium",
    };
  }

  _generateCallouts(mechanics, composition) {
    const callouts = [];

    for (const mechanic of mechanics) {
      if (/aoe|area/i.test(mechanic)) {
        callouts.push({ trigger: mechanic, action: "SPREAD OUT! Hindari area merah!", priority: "critical" });
      } else if (/heal|regen/i.test(mechanic)) {
        callouts.push({ trigger: mechanic, action: "FOCUS DPS! Hentikan heal boss!", priority: "high" });
      } else if (/enrage|timer/i.test(mechanic)) {
        callouts.push({ trigger: mechanic, action: "BURST NOW! Waktu terbatas!", priority: "critical" });
      }
    }

    if (callouts.length === 0) {
      callouts.push({ trigger: "general", action: "Ikuti instruksi tank. Jaga posisi.", priority: "normal" });
    }

    return callouts;
  }
}

module.exports = {
  RaidStrategyPlanner,
};
