"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const seasonEngine = require("./seasonEngine");
const { TIER_REWARDS, CURRENT_SEASON } = seasonEngine;

test("SeasonEngine - Season Configuration and Tier Rewards", () => {
  assert.equal(CURRENT_SEASON.id, 1);
  assert.equal(CURRENT_SEASON.maxTier, 30);
  assert.equal(CURRENT_SEASON.xpPerTier, 1000);

  assert.ok(TIER_REWARDS[1]);
  assert.ok(TIER_REWARDS[5]);
  assert.ok(TIER_REWARDS[10]);
  assert.ok(TIER_REWARDS[30]);

  // Validasi hadiah Free vs Premium
  assert.ok(TIER_REWARDS[1].free.gold);
  assert.ok(TIER_REWARDS[1].premium.coupons);
  assert.equal(TIER_REWARDS[30].premium.coupons, 10);
});

test("SeasonEngine - upgradeToPremium validates coupons requirement", async () => {
  const cacheManager = require("../managers/cacheManager");
  const origGetUserProfile = cacheManager.getUserProfile;
  const origGetUserSurvival = cacheManager.getUserSurvival;
  const origDebitUserSurvival = cacheManager.debitUserSurvival;
  const origGetProgress = seasonEngine.getProgress;

  try {
    seasonEngine.getProgress = async () => ({
      isPremiumPass: false,
      save: async () => {},
    });
    cacheManager.getUserProfile = async () => ({ isPremium: false });

    // 1. Kasus kupon kurang
    cacheManager.getUserSurvival = async () => ({ coupons: 2 });
    const failRes = await seasonEngine.upgradeToPremium("test_user_fail");
    assert.equal(failRes.success, false);
    assert.match(failRes.message, /5 Naura Coupon/);

    // 2. Kasus kupon cukup dan debit berhasil
    let debitCalled = false;
    cacheManager.getUserSurvival = async () => ({ coupons: 10 });
    cacheManager.debitUserSurvival = async (userId, field, amount) => {
      debitCalled = true;
      assert.equal(field, "coupons");
      assert.equal(amount, 5);
      return { ok: true, amount: 5 };
    };

    const successRes = await seasonEngine.upgradeToPremium("test_user_ok");
    assert.equal(successRes.success, true);
    assert.equal(debitCalled, true);
  } finally {
    seasonEngine.getProgress = origGetProgress;
    cacheManager.getUserProfile = origGetUserProfile;
    cacheManager.getUserSurvival = origGetUserSurvival;
    cacheManager.debitUserSurvival = origDebitUserSurvival;
  }
});
