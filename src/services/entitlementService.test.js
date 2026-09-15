"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const entitlementService = require("./entitlementService");
const cacheManager = require("../managers/cacheManager");

describe("Discord Entitlements & Premium Subscriptions Service", () => {
  it("resolveSku mengidentifikasi SKU terdaftar dan memberikan fallback", () => {
    const starPass = entitlementService.resolveSku("sku_star_pass");
    assert.strictEqual(starPass.id, "sku_star_pass");
    assert.strictEqual(starPass.type, "SEASON_PASS");
    assert.strictEqual(starPass.rewardCoupons, 10);

    const vip = entitlementService.resolveSku("sku_premium_vip");
    assert.strictEqual(vip.id, "sku_premium_vip");
    assert.strictEqual(vip.rewardCoupons, 25);

    const custom = entitlementService.resolveSku("unknown_sku_123");
    assert.ok(custom);
    assert.strictEqual(custom.type, "GENERIC_PREMIUM");
  });

  it("handleEntitlementCreate mengaktifkan subscription dan menambahkan rewards secara aman", async () => {
    const testUserId = "user_entitlement_test_01";
    let mockMutated = false;
    let mockCouponsAdded = 0;

    const originalMutate = cacheManager.mutateUserProfileJson;
    const originalIncrement = cacheManager.incrementUserSurvival;

    cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
      mockMutated = true;
      const res = fn({});
      assert.ok(res.entitlements["sku_star_pass"].active);
      return res;
    };

    cacheManager.incrementUserSurvival = async (uid, field, amt) => {
      if (field === "coupons") mockCouponsAdded += amt;
      return { ok: true };
    };

    try {
      const res = await entitlementService.handleEntitlementCreate({
        userId: testUserId,
        skuId: "sku_star_pass",
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.userId, testUserId);
      assert.strictEqual(res.activatedPlan, "Naura Star Pass");
      assert.strictEqual(mockMutated, true);
      assert.strictEqual(mockCouponsAdded, 10);
    } finally {
      cacheManager.mutateUserProfileJson = originalMutate;
      cacheManager.incrementUserSurvival = originalIncrement;
    }
  });

  it("handleEntitlementDelete menandai status entitlement tidak aktif", async () => {
    const testUserId = "user_entitlement_test_02";
    let revoked = false;

    const originalMutate = cacheManager.mutateUserProfileJson;
    cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
      const state = { entitlements: { sku_star_pass: { active: true } } };
      const res = fn(state);
      if (res.entitlements.sku_star_pass.active === false) {
        revoked = true;
      }
      return res;
    };

    try {
      const res = await entitlementService.handleEntitlementDelete({
        userId: testUserId,
        skuId: "sku_star_pass",
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(revoked, true);
    } finally {
      cacheManager.mutateUserProfileJson = originalMutate;
    }
  });

  it("manifest Discord Activity memuat scope relationships.read dan social_sdk", () => {
    const manifest = require("../config/discordActivityManifest.json");
    assert.ok(manifest.scopes.includes("relationships.read"));
    assert.ok(manifest.capabilities.includes("social_sdk"));
    assert.strictEqual(manifest.version, "2.3.0");
  });
});
