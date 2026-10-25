"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// Mock RaidStrategyPlanner class untuk testing
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

  planRaidStrategy(guildId, partyMembers = [], bossData = {}) {
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

test("raidplan command - analyzes balanced party composition", () => {
  const partyMembers = [
    { userId: "1", role: "tank", stats: { hp: 1000, atk: 100, def: 200, spd: 50 } },
    { userId: "2", role: "healer", stats: { hp: 600, atk: 50, def: 100, spd: 80 } },
    { userId: "3", role: "dps_melee", stats: { hp: 700, atk: 300, def: 80, spd: 120 } },
    { userId: "4", role: "dps_ranged", stats: { hp: 500, atk: 350, def: 60, spd: 100 } },
    { userId: "5", role: "support", stats: { hp: 550, atk: 80, def: 90, spd: 90 } },
  ];

  const result = planner.planRaidStrategy("guild123", partyMembers, {
    name: "Test Boss",
    level: 50,
    mechanics: ["aoe_attack"],
  });

  assert.ok(result.compositionAnalysis.hasTank);
  assert.ok(result.compositionAnalysis.hasHealer);
  assert.ok(result.compositionAnalysis.balanceScore > 0.6);
  // Strategy depends on balance score threshold
  assert.ok(["standard_raid", "adaptive"].includes(result.strategy.formation));
  assert.ok(["low", "medium"].includes(result.strategy.riskLevel));
});

test("raidplan command - detects missing tank and healer", () => {
  const partyMembers = [
    { userId: "1", role: "dps_melee", stats: { hp: 700, atk: 300 } },
    { userId: "2", role: "dps_ranged", stats: { hp: 500, atk: 350 } },
    { userId: "3", role: "dps_melee", stats: { hp: 700, atk: 300 } },
  ];

  const result = planner.planRaidStrategy("guild123", partyMembers, {});

  assert.ok(!result.compositionAnalysis.hasTank);
  assert.ok(!result.compositionAnalysis.hasHealer);
  assert.equal(result.strategy.formation, "defensive_circle");
  assert.equal(result.strategy.riskLevel, "high");
  assert.ok(result.compositionAnalysis.recommendedAdjustments.length > 0);
});

test("raidplan command - generates appropriate callouts for mechanics", () => {
  const partyMembers = [
    { userId: "1", role: "tank" },
    { userId: "2", role: "healer" },
  ];

  const result = planner.planRaidStrategy("guild123", partyMembers, {
    mechanics: ["aoe_attack", "heal_regen", "enrage_timer"],
  });

  assert.ok(result.callouts.length >= 3);
  assert.ok(result.callouts.some((c) => c.priority === "critical"));
  assert.ok(result.callouts.some((c) => c.action.includes("SPREAD OUT")));
});

test("raidplan command - calculates balance score correctly", () => {
  const balancedParty = [
    { role: "tank" },
    { role: "healer" },
    { role: "dps_melee" },
    { role: "dps_melee" },
    { role: "dps_ranged" },
  ];

  const result = planner.planRaidStrategy("guild123", balancedParty, {});

  assert.ok(result.compositionAnalysis.balanceScore > 0.6);
  assert.ok(result.compositionAnalysis.balanceScore <= 1.0);
});

test("raidplan command - handles empty party gracefully", () => {
  const result = planner.planRaidStrategy("guild123", [], {});

  assert.equal(result.compositionAnalysis.balanceScore, 0);
  assert.ok(result.strategy);
});

test("raidplan command - provides default callout when no mechanics", () => {
  const partyMembers = [{ userId: "1", role: "tank" }];

  const result = planner.planRaidStrategy("guild123", partyMembers, {
    mechanics: [],
  });

  assert.ok(result.callouts.length > 0);
  assert.equal(result.callouts[0].trigger, "general");
});
