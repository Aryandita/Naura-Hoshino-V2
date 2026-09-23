"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const survivalVitals = require("./survivalVitals");
const cacheManager = require("../../managers/cacheManager");

test("survivalVitals - checkVitalThresholds and buildVitalsSummaryLine", () => {
  const healthySurvival = {
    survival_level: 5,
    hp: 200,
    stamina: 80,
    hunger: 90,
    thirst: 85,
  };

  const thresholds = survivalVitals.checkVitalThresholds(healthySurvival);
  assert.strictEqual(thresholds.isHealthy, true);
  assert.strictEqual(thresholds.isCritical, false);
  assert.strictEqual(thresholds.warnings.length, 0);

  const criticalSurvival = {
    survival_level: 1,
    hp: 15,
    stamina: 5,
    hunger: 10,
    thirst: 12,
  };

  const critThresholds = survivalVitals.checkVitalThresholds(criticalSurvival);
  assert.strictEqual(critThresholds.isHealthy, false);
  assert.strictEqual(critThresholds.isCritical, true);
  assert.ok(critThresholds.warnings.length >= 2);

  const summary = survivalVitals.buildVitalsSummaryLine(healthySurvival);
  assert.ok(summary.includes("HP"));
  assert.ok(summary.includes("Stamina"));
  assert.ok(summary.includes("Lapar"));
  assert.ok(summary.includes("Haus"));
});

test("survivalVitals - drainVitals and recoverVitals with mock cache", async (t) => {
  const originalGetUserSurvival = cacheManager.getUserSurvival;
  const originalIncrementUserSurvival = cacheManager.incrementUserSurvival;
  const originalGetUserProfile = cacheManager.getUserProfile;

  t.after(() => {
    cacheManager.getUserSurvival = originalGetUserSurvival;
    cacheManager.incrementUserSurvival = originalIncrementUserSurvival;
    cacheManager.getUserProfile = originalGetUserProfile;
  });

  const mockSurvival = {
    survival_level: 2,
    hp: 140,
    stamina: 100,
    hunger: 100,
    thirst: 100,
  };

  cacheManager.getUserProfile = async () => ({
    isPremium: false,
    premiumTier: null,
  });
  cacheManager.getUserSurvival = async () => ({ ...mockSurvival });
  cacheManager.incrementUserSurvival = async (userId, deltas) => {
    for (const [k, v] of Object.entries(deltas)) {
      mockSurvival[k] = (mockSurvival[k] || 0) + v;
    }
  };

  const drainRes = await survivalVitals.drainVitals("testUser", {
    hunger: 20,
    thirst: 15,
    stamina: 30,
    hp: 10,
  });

  assert.strictEqual(drainRes.hunger, 80);
  assert.strictEqual(drainRes.thirst, 85);
  assert.strictEqual(drainRes.stamina, 70);
  assert.strictEqual(drainRes.hp, 130);
  assert.strictEqual(drainRes.isExhausted, false);

  const recRes = await survivalVitals.recoverVitals("testUser", {
    hunger: 10,
    thirst: 10,
    stamina: 20,
    hp: 5,
  });

  assert.strictEqual(recRes.hunger, 90);
  assert.strictEqual(recRes.thirst, 95);
  assert.strictEqual(recRes.stamina, 90);
  assert.strictEqual(recRes.hp, 135);
});
