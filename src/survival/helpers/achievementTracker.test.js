"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const achievementTracker = require("./achievementTracker");
const cacheManager = require("../../managers/cacheManager");
const UserAchievement = require("../../models/UserAchievement");

test("achievementTracker - checkAndUnlock milestone detection", async (t) => {
  const originalGetUserSurvival = cacheManager.getUserSurvival;
  const originalFindOrCreate = UserAchievement.findOrCreate;

  t.after(() => {
    cacheManager.getUserSurvival = originalGetUserSurvival;
    UserAchievement.findOrCreate = originalFindOrCreate;
  });

  const mockSurvival = {
    survival_level: 25,
    inGameDay: 35,
    strength: 55,
    intelligence: 20,
    agility: 15,
    luck: 10,
    rpg_state: {
      dungeon_max_floor: 50,
      married_to: "damar",
    },
  };

  const mockUserAch = {
    unlockedAchievements: [],
    activeTitle: null,
    save: async () => {},
  };

  cacheManager.getUserSurvival = async () => ({ ...mockSurvival });
  UserAchievement.findOrCreate = async () => [mockUserAch, false];

  const unlocked = await achievementTracker.checkAndUnlock("user123");

  assert.ok(unlocked.includes("veteran_survivor"));
  assert.ok(unlocked.includes("month_survivor"));
  assert.ok(unlocked.includes("titan_strength"));
  assert.ok(unlocked.includes("abyssal_champion"));
  assert.ok(unlocked.includes("eternal_vow"));
  assert.strictEqual(mockUserAch.activeTitle, unlocked[0]);

  // Cek jika dijalankan lagi untuk user yang sama tidak menduplikasi
  const secondRun = await achievementTracker.checkAndUnlock("user123");
  assert.strictEqual(secondRun.length, 0);
});
