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

  cacheManager.getUserProfile = async () => ({ isPremium: false, premiumTier: null });
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

test("survivalVitals - checkAndRescueDeadEnd rescues player in total dead-end state", async (t) => {
  const originalUpdateUserSurvival = cacheManager.updateUserSurvival;
  const originalDebitUserSurvival = cacheManager.debitUserSurvival;
  const originalDebitUserProfile = cacheManager.debitUserProfile;
  const originalGetUserProfile = cacheManager.getUserProfile;
  t.after(() => {
    cacheManager.updateUserSurvival = originalUpdateUserSurvival;
    cacheManager.debitUserSurvival = originalDebitUserSurvival;
    cacheManager.debitUserProfile = originalDebitUserProfile;
    cacheManager.getUserProfile = originalGetUserProfile;
  });

  let updatedData = null;
  let debitedSurvival = null;
  let debitedProfile = null;

  cacheManager.updateUserSurvival = async (userId, data) => {
    updatedData = data;
    return true;
  };
  cacheManager.debitUserSurvival = async (userId, field, amount) => {
    debitedSurvival = { userId, field, amount };
    return { ok: true, amount };
  };
  cacheManager.debitUserProfile = async (userId, field, amount) => {
    debitedProfile = { userId, field, amount };
    return { ok: true, amount };
  };
  cacheManager.getUserProfile = async (userId) => {
    return { economy_wallet: 150 };
  };

  const deadEndSurvival = {
    survival_level: 1,
    hp: 0,
    hunger: 0,
    thirst: 0,
    stamina: 0,
    currentLocation: "hutan",
    starFragments: 1000,
  };

  const rescueRes = await survivalVitals.checkAndRescueDeadEnd("deadUser", deadEndSurvival);
  assert.strictEqual(rescueRes.rescued, true);
  assert.strictEqual(rescueRes.clinic, "Klinik Desa");
  assert.strictEqual(rescueRes.penalty, 500);
  assert.strictEqual(rescueRes.currencyType, "NSF");
  assert.strictEqual(deadEndSurvival.hp >= 25, true);
  assert.strictEqual(deadEndSurvival.hunger, 30);
  assert.strictEqual(deadEndSurvival.thirst, 30);
  assert.strictEqual(deadEndSurvival.stamina, 30);
  assert.strictEqual(deadEndSurvival.currentLocation, "desa");
  assert.strictEqual(deadEndSurvival.starFragments, 500);
  assert.ok(updatedData);
  assert.strictEqual(updatedData.currentLocation, "desa");
  assert.deepStrictEqual(debitedSurvival, { userId: "deadUser", field: "starFragments", amount: 500 });

  // Kasus penyelamatan di Kota (potong 50 NC)
  const deadEndCity = {
    survival_level: 1,
    hp: 0,
    hunger: 0,
    thirst: 0,
    stamina: 0,
    currentLocation: "kota",
    starFragments: 1000,
  };
  const cityRescueRes = await survivalVitals.checkAndRescueDeadEnd("cityUser", deadEndCity);
  assert.strictEqual(cityRescueRes.rescued, true);
  assert.strictEqual(cityRescueRes.clinic, "RS Kota");
  assert.strictEqual(cityRescueRes.penalty, 50);
  assert.strictEqual(cityRescueRes.currencyType, "NC");
  assert.strictEqual(deadEndCity.currentLocation, "kota");
  assert.deepStrictEqual(debitedProfile, { userId: "cityUser", field: "economy_wallet", amount: 50 });

  // Kasus pemain sehat tidak di-rescue
  const healthySurvival = {
    survival_level: 1,
    hp: 100,
    hunger: 80,
    thirst: 80,
    stamina: 80,
  };
  const healthyRes = await survivalVitals.checkAndRescueDeadEnd("healthyUser", healthySurvival);
  assert.strictEqual(healthyRes.rescued, false);
});
