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

test("survivalVitals - calculateFoodEnergyBonus calculates tier bonuses up to +25", () => {
  const t1Food = { iconType: "food", tier: 1 };
  const t2Food = { iconType: "food", tier: 2 };
  const t3Drink = { iconType: "drink", tier: 3 };
  const t4Food = { iconType: "food", tier: 4 };
  const t5Food = { iconType: "food", tier: 5 };
  const toolItem = { iconType: "tool", category: "tool", tier: 3 };

  assert.strictEqual(survivalVitals.calculateFoodEnergyBonus(t1Food), 5);
  assert.strictEqual(survivalVitals.calculateFoodEnergyBonus(t2Food), 10);
  assert.strictEqual(survivalVitals.calculateFoodEnergyBonus(t3Drink), 15);
  assert.strictEqual(survivalVitals.calculateFoodEnergyBonus(t4Food), 20);
  assert.strictEqual(survivalVitals.calculateFoodEnergyBonus(t5Food), 25);
  assert.strictEqual(survivalVitals.calculateFoodEnergyBonus(toolItem), 0);
  assert.strictEqual(survivalVitals.calculateFoodEnergyBonus(null), 0);
});

test("survivalVitals - checkAndApplyEnergyReset resets every 5 hours", async (t) => {
  const originalGetUserSurvival = cacheManager.getUserSurvival;
  const originalUpdateUserSurvival = cacheManager.updateUserSurvival;
  const originalGetUserProfile = cacheManager.getUserProfile;

  t.after(() => {
    cacheManager.getUserSurvival = originalGetUserSurvival;
    cacheManager.updateUserSurvival = originalUpdateUserSurvival;
    cacheManager.getUserProfile = originalGetUserProfile;
  });

  cacheManager.getUserProfile = async () => ({ isPremium: false });

  // 1. Reset pertama kali saat belum ada last_energy_reset
  const userSurvivalData = {
    userId: "energyUser1",
    stamina: 20,
    rpg_state: {},
  };
  cacheManager.getUserSurvival = async () => userSurvivalData;
  cacheManager.updateUserSurvival = async (userId, patch) => {
    Object.assign(userSurvivalData, patch);
    return true;
  };

  const firstReset = await survivalVitals.checkAndApplyEnergyReset("energyUser1");
  assert.strictEqual(firstReset.reset, true);
  assert.strictEqual(firstReset.stamina, 100);
  assert.strictEqual(userSurvivalData.stamina, 100);
  assert.ok(userSurvivalData.rpg_state.last_energy_reset);

  // 2. Cek setelah 1 jam (belum 5 jam) -> tidak boleh direset
  userSurvivalData.stamina = 40;
  userSurvivalData.rpg_state.last_energy_reset = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  const cooldownCheck = await survivalVitals.checkAndApplyEnergyReset("energyUser1");
  assert.strictEqual(cooldownCheck.reset, false);
  assert.strictEqual(cooldownCheck.stamina, 40);
  assert.ok(cooldownCheck.nextResetInMs > 0);
  assert.ok(cooldownCheck.formattedCountdown.includes("jam") || cooldownCheck.formattedCountdown.includes("menit"));

  // 3. Cek setelah 5 jam lewat -> stamina direset kembali ke 100
  userSurvivalData.stamina = 15;
  userSurvivalData.rpg_state.last_energy_reset = new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString();
  const dueReset = await survivalVitals.checkAndApplyEnergyReset("energyUser1");
  assert.strictEqual(dueReset.reset, true);
  assert.strictEqual(dueReset.stamina, 100);
  assert.strictEqual(userSurvivalData.stamina, 100);
});

test("survivalVitals - consumeEnergyOrVitals with 1.5x hunger and thirst fallback", async (t) => {
  const originalGetUserSurvival = cacheManager.getUserSurvival;
  const originalUpdateUserSurvival = cacheManager.updateUserSurvival;
  const originalDebitUserSurvival = cacheManager.debitUserSurvival;
  const originalGetUserProfile = cacheManager.getUserProfile;

  t.after(() => {
    cacheManager.getUserSurvival = originalGetUserSurvival;
    cacheManager.updateUserSurvival = originalUpdateUserSurvival;
    cacheManager.debitUserSurvival = originalDebitUserSurvival;
    cacheManager.getUserProfile = originalGetUserProfile;
  });

  cacheManager.getUserProfile = async () => ({ isPremium: false });

  // 1. Stamina cukup (stamina 50, butuh 20)
  const user1 = {
    userId: "vitUser1",
    stamina: 50,
    hunger: 80,
    thirst: 80,
    hp: 100,
    rpg_state: { last_energy_reset: new Date().toISOString() },
  };
  cacheManager.getUserSurvival = async () => user1;
  cacheManager.debitUserSurvival = async (uid, field, amt) => {
    if (user1[field] >= amt) {
      user1[field] -= amt;
      return { ok: true, amount: amt };
    }
    return { ok: false, reason: "insufficient" };
  };
  cacheManager.updateUserSurvival = async (uid, patch) => {
    Object.assign(user1, patch);
    return true;
  };

  const spendNormal = await survivalVitals.consumeEnergyOrVitals("vitUser1", 20);
  assert.strictEqual(spendNormal.ok, true);
  assert.strictEqual(spendNormal.usedVitalsFallback, false);
  assert.strictEqual(spendNormal.staminaSpent, 20);
  assert.strictEqual(spendNormal.hungerSpent, 0);
  assert.strictEqual(spendNormal.thirstSpent, 0);
  assert.strictEqual(user1.stamina, 30);

  // 2. Stamina habis (stamina 0, butuh 20) -> fallback 1.5x = 30 Lapar dan 30 Haus
  user1.stamina = 0;
  user1.hunger = 80;
  user1.thirst = 80;

  const spendFallback = await survivalVitals.consumeEnergyOrVitals("vitUser1", 20);
  assert.strictEqual(spendFallback.ok, true);
  assert.strictEqual(spendFallback.usedVitalsFallback, true);
  assert.strictEqual(spendFallback.staminaSpent, 0);
  assert.strictEqual(spendFallback.hungerSpent, 30);
  assert.strictEqual(spendFallback.thirstSpent, 30);
  assert.strictEqual(user1.stamina, 0);
  assert.strictEqual(user1.hunger, 50);
  assert.strictEqual(user1.thirst, 50);
  assert.ok(spendFallback.warning.includes("1.5x"));

  // 3. Stamina parsial (stamina 10, butuh 20) -> sisa 10 * 1.5 = 15 Lapar dan Haus
  user1.stamina = 10;
  user1.hunger = 50;
  user1.thirst = 50;

  const spendPartial = await survivalVitals.consumeEnergyOrVitals("vitUser1", 20);
  assert.strictEqual(spendPartial.ok, true);
  assert.strictEqual(spendPartial.usedVitalsFallback, true);
  assert.strictEqual(spendPartial.staminaSpent, 10);
  assert.strictEqual(spendPartial.hungerSpent, 15);
  assert.strictEqual(spendPartial.thirstSpent, 15);
  assert.strictEqual(user1.stamina, 0);
  assert.strictEqual(user1.hunger, 35);
  assert.strictEqual(user1.thirst, 35);

  // 4. Kondisi ambruk total (stamina 0, hunger 0, thirst 0)
  user1.stamina = 0;
  user1.hunger = 0;
  user1.thirst = 0;

  const spendExhausted = await survivalVitals.consumeEnergyOrVitals("vitUser1", 20);
  assert.strictEqual(spendExhausted.ok, false);
  assert.strictEqual(spendExhausted.reason, "completely_exhausted");
});
