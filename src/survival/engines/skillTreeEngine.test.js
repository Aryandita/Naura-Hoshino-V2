"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const skillTree = require("./skillTreeEngine");
const cacheManager = require("../../managers/cacheManager");

test("skillTreeEngine - getUnspentPoints and getLifeStatBonuses", () => {
  const survival = {
    strength: 20,
    agility: 15,
    intelligence: 30,
    luck: 10,
    rpg_state: {
      unspent_points: 5,
      class: "mage",
    },
  };

  assert.strictEqual(skillTree.getUnspentPoints(survival), 5);

  const bonuses = skillTree.getLifeStatBonuses(survival);
  assert.ok(bonuses.salaryBonusPercent >= 40);
  assert.ok(bonuses.craftingSpeedBonusPercent >= 20);

  const synergy = skillTree.getPathSynergy(survival);
  assert.strictEqual(synergy.hasSynergy, true);
  assert.strictEqual(synergy.className, "mage");
  assert.strictEqual(synergy.dominantStat, "intelligence");
  assert.strictEqual(synergy.multiplier, 1.2);
});

test("skillTreeEngine - Path Synergy Mismatch", () => {
  const survival = {
    strength: 50,
    agility: 10,
    intelligence: 10,
    luck: 10,
    rpg_state: {
      class: "mage",
    },
  };

  const synergy = skillTree.getPathSynergy(survival);
  assert.strictEqual(synergy.hasSynergy, false);
  assert.strictEqual(synergy.dominantStat, "strength");
  assert.strictEqual(synergy.multiplier, 1.0);
});

test("skillTreeEngine - investPoint with mock cache", async (t) => {
  const originalGetUserSurvival = cacheManager.getUserSurvival;
  const originalMutate = cacheManager.mutateUserSurvivalJson;
  const originalIncrement = cacheManager.incrementUserSurvival;

  t.after(() => {
    cacheManager.getUserSurvival = originalGetUserSurvival;
    cacheManager.mutateUserSurvivalJson = originalMutate;
    cacheManager.incrementUserSurvival = originalIncrement;
  });

  let mockSurvival = {
    survival_level: 10,
    strength: 20,
    rpg_state: { unspent_points: 2 },
  };

  cacheManager.getUserSurvival = async () => ({ ...mockSurvival });
  cacheManager.mutateUserSurvivalJson = async (userId, field, mutator) => {
    mockSurvival.rpg_state = mutator(mockSurvival.rpg_state);
  };
  cacheManager.incrementUserSurvival = async (userId, deltas) => {
    for (const [k, v] of Object.entries(deltas)) {
      mockSurvival[k] = (mockSurvival[k] || 0) + v;
    }
  };

  const res = await skillTree.investPoint("user1", "strength");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.newValue, 21);
  assert.strictEqual(res.remainingPoints, 1);

  // Coba invest dengan stat yang salah
  const invalidRes = await skillTree.investPoint("user1", "invalid_stat");
  assert.strictEqual(invalidRes.success, false);
  assert.strictEqual(invalidRes.reason, "INVALID_STAT");
});
