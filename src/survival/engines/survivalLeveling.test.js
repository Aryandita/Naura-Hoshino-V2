const test = require("node:test");
const assert = require("node:assert");
const survivalLeveling = require("./survivalLeveling");

test("survivalLeveling - getExpRequirement", (t) => {
  assert.strictEqual(survivalLeveling.getExpRequirement(1), 100);
  assert.strictEqual(survivalLeveling.getExpRequirement(2), 400);
  assert.strictEqual(survivalLeveling.getExpRequirement(5), 2500);

  // Fallback to level 1 for invalid input
  assert.strictEqual(survivalLeveling.getExpRequirement(0), 100);
  assert.strictEqual(survivalLeveling.getExpRequirement("abc"), 100);
});

test("survivalLeveling - getMaxStatCap", (t) => {
  assert.strictEqual(survivalLeveling.getMaxStatCap(1), 5);
  assert.strictEqual(survivalLeveling.getMaxStatCap(10), 50);
});

// For addPlayerXP, we would need to mock cacheManager and difficultyHelper.
// We can test the math logic by bypassing the database.
test("survivalLeveling - addPlayerXP logic", async (t) => {
  const cacheManager = require("../../managers/cacheManager");
  const difficultyHelper = require("../helpers/difficultyHelper");

  const originalGetUserSurvival = cacheManager.getUserSurvival;
  const originalIncrementUserSurvival = cacheManager.incrementUserSurvival;
  const originalGetDifficultyConfig = difficultyHelper.getDifficultyConfig;

  t.after(() => {
    cacheManager.getUserSurvival = originalGetUserSurvival;
    cacheManager.incrementUserSurvival = originalIncrementUserSurvival;
    difficultyHelper.getDifficultyConfig = originalGetDifficultyConfig;
  });

  // Mock diffHelper
  difficultyHelper.getDifficultyConfig = () => ({ expMultiplier: 1.0 });

  let lastIncrementArgs = {};
  cacheManager.incrementUserSurvival = async (userId, deltas) => {
    lastIncrementArgs = deltas;
  };

  await t.test("adds XP without leveling up", async () => {
    cacheManager.getUserSurvival = async () => ({
      survival_xp: 10,
      survival_level: 1,
      rpg_state: { difficulty: "Normal" },
    });

    const result = await survivalLeveling.addPlayerXP("user1", 50);

    assert.strictEqual(result.currentXP, 60);
    assert.strictEqual(result.currentLevel, 1);
    assert.strictEqual(result.hasLeveledUp, false);

    assert.strictEqual(lastIncrementArgs.survival_xp, 50);
    assert.strictEqual(lastIncrementArgs.survival_level, 0);
  });

  await t.test("adds XP and triggers level up", async () => {
    // level 1 req is 100. Let's give 150 xp.
    cacheManager.getUserSurvival = async () => ({
      survival_xp: 0,
      survival_level: 1,
      rpg_state: { difficulty: "Normal" },
    });

    const result = await survivalLeveling.addPlayerXP("user1", 150);

    // 150 - 100 (req for lvl 1) = 50 leftover. Now level 2.
    assert.strictEqual(result.currentXP, 50);
    assert.strictEqual(result.currentLevel, 2);
    assert.strictEqual(result.hasLeveledUp, true);

    assert.strictEqual(lastIncrementArgs.survival_xp, 50); // XP delta is 50 - 0 = 50
    assert.strictEqual(lastIncrementArgs.survival_level, 1);
  });

  await t.test("triggers multiple level ups", async () => {
    // level 1 req = 100
    // level 2 req = 400
    // Total needed to reach level 3 = 100 + 400 = 500
    cacheManager.getUserSurvival = async () => ({
      survival_xp: 0,
      survival_level: 1,
      rpg_state: { difficulty: "Normal" },
    });

    const result = await survivalLeveling.addPlayerXP("user1", 600);

    // 600 - 100 = 500 (lvl 2)
    // 500 - 400 = 100 (lvl 3)
    assert.strictEqual(result.currentXP, 100);
    assert.strictEqual(result.currentLevel, 3);
    assert.strictEqual(result.hasLeveledUp, true);

    assert.strictEqual(lastIncrementArgs.survival_xp, 100);
    assert.strictEqual(lastIncrementArgs.survival_level, 2);
  });
});
