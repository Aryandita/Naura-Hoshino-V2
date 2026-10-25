"use strict";

const { MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");
const cacheManager = require("../../../src/managers/cacheManager");

class RaidStrategyPlanner {
  constructor() {
    this.roleDefinitions = {
      tank: { primary: "defense", secondary: "aggro_control" },
      healer: { primary: "support", secondary: "sustain" },
      dps_melee: { primary: "damage", secondary: "burst" },
      dps_ranged: { primary: "damage", secondary: "kiting" },
      support: { primary: "buff", secondary: "debuff" },
    };
  }

  async planRaidStrategy(guildId, partyMembers = [], bossData = {}) {
    try {
      const compositionAnalysis = this._analyzeComposition(partyMembers);
      const strategy = this._generateStrategy(compositionAnalysis, bossData);
      const callouts = this._generateCallouts(
        bossData.mechanics || [],
        compositionAnalysis,
      );

      return {
        compositionAnalysis,
        strategy,
        callouts,
      };
    } catch (error) {
      logger.error(`[RaidPlanner] Error for guild ${guildId}:`, error);
      return {
        compositionAnalysis: {},
        strategy: null,
        callouts: [],
      };
    }
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
    if (partySize === 0) return 0;
    const idealRatios = {
      tank: 0.2,
      healer: 0.2,
      dps_melee: 0.3,
      dps_ranged: 0.2,
      support: 0.1,
    };
    let deviation = 0;

    for (const [role, ratio] of Object.entries(idealRatios)) {
      const actualRatio = (roleCounts[role] || 0) / partySize;
      deviation += Math.abs(actualRatio - ratio);
    }

    return Math.max(0, 1 - deviation);
  }

  _suggestAdjustments(roleCounts, partySize) {
    const suggestions = [];

    if (!roleCounts.tank) {
      suggestions.push("Tambahkan 1 Tank untuk aggro control.");
    }
    if (!roleCounts.healer) {
      suggestions.push("Tambahkan 1 Healer untuk sustain party.");
    }
    if (
      (roleCounts.dps_melee || 0) + (roleCounts.dps_ranged || 0) <
      partySize * 0.4
    ) {
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
        callouts.push({
          trigger: mechanic,
          action: "SPREAD OUT! Hindari area merah!",
          priority: "critical",
        });
      } else if (/heal|regen/i.test(mechanic)) {
        callouts.push({
          trigger: mechanic,
          action: "FOCUS DPS! Hentikan heal boss!",
          priority: "high",
        });
      } else if (/enrage|timer/i.test(mechanic)) {
        callouts.push({
          trigger: mechanic,
          action: "BURST NOW! Waktu terbatas!",
          priority: "critical",
        });
      }
    }

    if (callouts.length === 0) {
      callouts.push({
        trigger: "general",
        action: "Ikuti instruksi tank. Jaga posisi.",
        priority: "normal",
      });
    }

    return callouts;
  }
}

const planner = new RaidStrategyPlanner();

module.exports = {
  name: "raidplan",
  description: "Analisis komposisi party dan strategi raid optimal",

  async execute(interaction) {
    const userId = interaction.user.id;
    const bossName = interaction.options.getString("boss") || "World Boss";
    const bossLevel = interaction.options.getInteger("level") || 50;

    try {
      const userSurvival = await cacheManager.getUserSurvival(userId);

      if (!userSurvival) {
        const errorPayload = buildErrorContainerV2(
          "Anda belum memulai petualangan survival. Gunakan `/survival start` terlebih dahulu.",
        );
        return interaction.editReply({ ...errorPayload, embeds: [] });
      }

      const playerRole = userSurvival.class || "dps_melee";
      const partyMembers = [
        {
          userId,
          username: interaction.user.displayName || interaction.user.username,
          role: playerRole,
          stats: {
            hp: userSurvival.vitality || 100,
            atk: userSurvival.strength || 50,
            def: userSurvival.endurance || 30,
            spd: userSurvival.agility || 40,
          },
        },
      ];

      const bossData = {
        name: bossName,
        level: bossLevel,
        mechanics: ["aoe_attack", "heal_regen", "enrage_timer"],
      };

      const result = await planner.planRaidStrategy(
        interaction.guildId,
        partyMembers,
        bossData,
      );

      const roleBreakdown = Object.entries(result.compositionAnalysis.roleCounts)
        .map(([role, count]) => `• **${role.toUpperCase()}**: ${count}`)
        .join("\n");

      const adjustments =
        result.compositionAnalysis.recommendedAdjustments.length > 0
          ? result.compositionAnalysis.recommendedAdjustments
              .map((adj) => `⚠️ ${adj}`)
              .join("\n")
          : "✅ Komposisi party sudah optimal!";

      const calloutList = result.callouts
        .map(
          (c) =>
            `[${c.priority.toUpperCase()}] ${c.trigger}: ${c.action}`,
        )
        .join("\n");

      const payload = buildContainerV2({
        accentColorHex: survivalUI.getColor("danger"),
        authorName: "Raid Strategy Planner",
        title: `⚔️ Strategi Raid: ${bossName} (Lv.${bossLevel})`,
        description: [
          `**📊 Analisis Komposisi Party:**`,
          roleBreakdown,
          "",
          `**💯 Balance Score:** ${(result.compositionAnalysis.balanceScore * 100).toFixed(1)}%`,
          "",
          `**🎯 Formasi:** ${result.strategy.formation.replace(/_/g, " ").toUpperCase()}`,
          `**⚡ Approach:** ${result.strategy.approach.toUpperCase()}`,
          `**⚠️ Risk Level:** ${result.strategy.riskLevel.toUpperCase()}`,
          "",
          `**📋 Battle Phases:**`,
          result.strategy.phases.map((p, i) => `${i + 1}. ${p.replace(/_/g, " ")}`).join("\n"),
          "",
          `**🔔 Callouts:**`,
          calloutList,
          "",
          `**💡 Rekomendasi:**`,
          adjustments,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, embeds: [] });
    } catch (error) {
      logger.error(`[RaidPlan] Error for user ${userId}:`, error);
      const errorPayload = buildErrorContainerV2(
        "Gagal menganalisis strategi raid. Silakan coba lagi.",
      );
      return interaction.editReply({ ...errorPayload, embeds: [] });
    }
  },
};
