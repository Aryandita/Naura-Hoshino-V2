"use strict";

process.env.NODE_ENV = "test";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const entitlementService = require("./entitlementService");
const cacheManager = require("../managers/cacheManager");
const env = require("../config/env");

describe("Discord Entitlements & Premium Subscriptions Service", () => {
  it("resolveSku mengidentifikasi SKU terdaftar dan memberikan fallback", () => {
    const starPass = entitlementService.resolveSku("sku_star_pass");
    assert.strictEqual(starPass.id, "sku_star_pass");
    assert.strictEqual(starPass.type, "SEASON_PASS");
    assert.strictEqual(starPass.rewardCoupons, 10);
    assert.strictEqual(starPass.tier, "tier1");
    assert.strictEqual(starPass.durationDays, 30);

    const vip = entitlementService.resolveSku("sku_premium_vip");
    assert.strictEqual(vip.id, "sku_premium_vip");
    assert.strictEqual(vip.type, "VIP_SUBSCRIPTION");
    assert.strictEqual(vip.rewardCoupons, 25);
    assert.strictEqual(vip.tier, "tier2");
    assert.strictEqual(vip.durationDays, 30);

    const vvip = entitlementService.resolveSku("sku_premium_vvip");
    assert.strictEqual(vvip.id, "sku_premium_vvip");
    assert.strictEqual(vvip.type, "VVIP_SUBSCRIPTION");
    assert.strictEqual(vvip.rewardCoupons, 60);
    assert.strictEqual(vvip.tier, "tier3");
    assert.strictEqual(vvip.durationDays, 30);

    const custom = entitlementService.resolveSku("unknown_sku_123");
    assert.ok(custom);
    assert.strictEqual(custom.type, "GENERIC_PREMIUM");
    assert.strictEqual(custom.tier, "tier1");
    assert.strictEqual(custom.rewardCoupons, 10);

    assert.strictEqual(entitlementService.resolveSku(null), null);
    assert.strictEqual(entitlementService.resolveSku(""), null);
  });

  it("handleEntitlementCreate mengaktifkan subscription dan menambahkan rewards secara aman", async () => {
    const testUserId = "user_entitlement_test_01";
    let mockMutated = false;
    let mockCouponsAdded = 0;
    let mockProfileUpdated = null;

    const originalMutate = cacheManager.mutateUserProfileJson;
    const originalIncrement = cacheManager.incrementUserSurvival;
    const originalGetProfile = cacheManager.getUserProfile;
    const originalUpdateProfile = cacheManager.updateUserProfile;

    cacheManager.getUserProfile = async () => ({ isPremium: false, premiumUntil: null });
    cacheManager.updateUserProfile = async (uid, data) => {
      mockProfileUpdated = data;
      return true;
    };

    const testState = {};
    cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
      mockMutated = true;
      const res = fn(testState);
      Object.assign(testState, res);
      return testState;
    };

    cacheManager.incrementUserSurvival = async (uid, field, amt) => {
      if (field === "coupons") mockCouponsAdded += amt;
      return { ok: true };
    };

    try {
      const res = await entitlementService.handleEntitlementCreate({
        userId: testUserId,
        skuId: "sku_star_pass",
        entitlementId: "ent_create_001",
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.userId, testUserId);
      assert.strictEqual(res.activatedPlan, "Naura Star Pass");
      assert.strictEqual(res.rewardCoupons, 10);
      assert.strictEqual(res.tier, "tier1");
      assert.ok(res.expiry instanceof Date);
      assert.strictEqual(mockMutated, true);
      assert.strictEqual(mockCouponsAdded, 10);
      assert.ok(mockProfileUpdated);
      assert.strictEqual(mockProfileUpdated.isPremium, true);
      assert.strictEqual(mockProfileUpdated.premium_tier, "tier1");
    } finally {
      cacheManager.mutateUserProfileJson = originalMutate;
      cacheManager.incrementUserSurvival = originalIncrement;
      cacheManager.getUserProfile = originalGetProfile;
      cacheManager.updateUserProfile = originalUpdateProfile;
    }
  });

  it("handleEntitlementCreate menjamin idempotensi: event duplikat tidak menggandakan kupon atau durasi", async () => {
    const testUserId = "user_idempotency_test_02";
    let mockCouponsAdded = 0;
    const sharedState = { entitlements: {}, processed_entitlements: [] };

    const originalMutate = cacheManager.mutateUserProfileJson;
    const originalIncrement = cacheManager.incrementUserSurvival;
    const originalGetProfile = cacheManager.getUserProfile;
    const originalUpdateProfile = cacheManager.updateUserProfile;

    cacheManager.getUserProfile = async () => ({ isPremium: false });
    cacheManager.updateUserProfile = async () => true;

    cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
      const updated = fn(sharedState);
      Object.assign(sharedState, updated);
      return sharedState;
    };

    cacheManager.incrementUserSurvival = async (uid, field, amt) => {
      if (field === "coupons") mockCouponsAdded += amt;
      return { ok: true };
    };

    const duplicateEntitlementId = "ent_dup_99999";

    try {
      // Panggilan pertama: harus sukses dan memberikan kupon
      const res1 = await entitlementService.handleEntitlementCreate({
        userId: testUserId,
        skuId: "sku_premium_vip",
        entitlementId: duplicateEntitlementId,
      });

      assert.strictEqual(res1.success, true);
      assert.strictEqual(res1.rewardCoupons, 25);
      assert.strictEqual(mockCouponsAdded, 25);

      // Panggilan kedua dengan ID yang sama: harus ditandai duplicate dan kupon TIDAK bertambah
      const res2 = await entitlementService.handleEntitlementCreate({
        userId: testUserId,
        skuId: "sku_premium_vip",
        entitlementId: duplicateEntitlementId,
      });

      assert.strictEqual(res2.success, true);
      assert.strictEqual(res2.duplicate, true);
      assert.strictEqual(res2.rewardCoupons, 0);
      assert.strictEqual(mockCouponsAdded, 25, "Kupon tidak boleh ditambahkan dua kali pada event duplikat");
    } finally {
      cacheManager.mutateUserProfileJson = originalMutate;
      cacheManager.incrementUserSurvival = originalIncrement;
      cacheManager.getUserProfile = originalGetProfile;
      cacheManager.updateUserProfile = originalUpdateProfile;
    }
  });

  it("handleEntitlementDelete menandai status entitlement tidak aktif dan memperbarui status premium", async () => {
    const testUserId = "user_entitlement_test_03";
    let revoked = false;
    let profileRevoked = null;

    const originalMutate = cacheManager.mutateUserProfileJson;
    const originalUpdateProfile = cacheManager.updateUserProfile;

    cacheManager.updateUserProfile = async (uid, patch) => {
      profileRevoked = patch;
      return true;
    };

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
      assert.strictEqual(res.revoked, true);
      assert.strictEqual(revoked, true);
      assert.ok(profileRevoked);
      assert.strictEqual(profileRevoked.isPremium, false);
      assert.strictEqual(profileRevoked.premium_tier, "none");
    } finally {
      cacheManager.mutateUserProfileJson = originalMutate;
      cacheManager.updateUserProfile = originalUpdateProfile;
    }
  });

  it("isUserPremium dan isGuildPremium memeriksa masa aktif langganan dan status owner", async () => {
    const origGetProfile = cacheManager.getUserProfile;
    const origGetGuild = cacheManager.getGuildSettings;
    const origOwnerIds = env.OWNER_IDS;

    try {
      env.OWNER_IDS = ["bot_owner_super_user_001"];

      cacheManager.getUserProfile = async (uid) => {
        if (uid === "vip_active") {
          return { isPremium: true, premiumUntil: new Date(Date.now() + 60000).toISOString() };
        }
        if (uid === "vip_expired") {
          return { isPremium: true, premiumUntil: new Date(Date.now() - 60000).toISOString() };
        }
        return null;
      };

      cacheManager.getGuildSettings = async (gid) => {
        if (gid === "guild_active") {
          return { settings: { premium: { active: true, until: new Date(Date.now() + 60000).toISOString() } } };
        }
        return { settings: { premium: { active: false } } };
      };

      assert.strictEqual(await entitlementService.isUserPremium("bot_owner_super_user_001"), true);
      assert.strictEqual(await entitlementService.isUserPremium("vip_active"), true);
      assert.strictEqual(await entitlementService.isUserPremium("vip_expired"), false);
      assert.strictEqual(await entitlementService.isUserPremium("non_existent"), false);
      assert.strictEqual(await entitlementService.isUserPremium(null), false);

      assert.strictEqual(await entitlementService.isGuildPremium("guild_active"), true);
      assert.strictEqual(await entitlementService.isGuildPremium("guild_free"), false);
      assert.strictEqual(await entitlementService.isGuildPremium(null), false);
    } finally {
      cacheManager.getUserProfile = origGetProfile;
      cacheManager.getGuildSettings = origGetGuild;
      env.OWNER_IDS = origOwnerIds;
    }
  });

  it("verifySignature fail-closed: menolak public key kosong/invalid dan memvalidasi signature Ed25519 asli", () => {
    // 1. Argumen kosong atau invalid harus ditolak (fail-closed)
    assert.strictEqual(entitlementService.verifySignature("", "", ""), false);
    assert.strictEqual(entitlementService.verifySignature("sig", "", "body"), false);
    assert.strictEqual(entitlementService.verifySignature("invalid_sig", "12345", "body", "1234567890abcdef"), false);
    assert.strictEqual(entitlementService.verifySignature("sig", "12345", "body", null), false);
    assert.strictEqual(entitlementService.verifySignature("sig", "12345", "body", ""), false);

    // 2. Generate ephemeral Ed25519 keypair menggunakan node:crypto
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const exportedRawPublic = publicKey.export({ type: "spki", format: "der" }).subarray(12);
    const publicKeyHex = exportedRawPublic.toString("hex");

    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ type: "ENTITLEMENT_CREATE", data: { id: "test_123" } });
    const messageBuffer = Buffer.from(timestamp + rawBody);

    const signatureBuffer = crypto.sign(null, messageBuffer, privateKey);
    const signatureHex = signatureBuffer.toString("hex");

    // Signature sah harus true
    assert.strictEqual(entitlementService.verifySignature(signatureHex, timestamp, rawBody, publicKeyHex), true);

    // Payload yang diubah harus false
    assert.strictEqual(entitlementService.verifySignature(signatureHex, timestamp, rawBody + "tampered", publicKeyHex), false);

    // Timestamp yang diubah harus false
    assert.strictEqual(entitlementService.verifySignature(signatureHex, timestamp + "9", rawBody, publicKeyHex), false);

    // Signature yang salah harus false
    const tamperedSig = "00" + signatureHex.slice(2);
    assert.strictEqual(entitlementService.verifySignature(tamperedSig, timestamp, rawBody, publicKeyHex), false);
  });

  it("handleEntitlementCreate dan handleEntitlementUpdate menangani null SKU secara aman tanpa unhandled rejection", async () => {
    const resCreate = await entitlementService.handleEntitlementCreate({
      userId: "user_null_sku_01",
      skuId: null,
      entitlementId: "ent_null_sku",
    });
    assert.strictEqual(resCreate.success, false);
    assert.strictEqual(resCreate.error, "Invalid or missing SKU in entitlement");

    const resUpdate = await entitlementService.handleEntitlementUpdate({
      userId: "user_null_sku_01",
      skuId: "",
    });
    assert.strictEqual(resUpdate.success, false);
    assert.strictEqual(resUpdate.error, "Invalid or missing SKU in entitlement");

    const resDelete = await entitlementService.handleEntitlementDelete({
      userId: "user_null_sku_01",
      skuId: undefined,
    });
    assert.strictEqual(resDelete.success, false);
    assert.strictEqual(resDelete.revoked, false);
    assert.strictEqual(resDelete.error, "Invalid or missing SKU in entitlement");
  });

  it("extendUserPremium mempertahankan tier yang lebih tinggi (tidak mendowngrade dari tier3 ke vip_starter)", async () => {
    const testUserId = "user_tier_hierarchy_01";
    let updatedData = null;

    const origGet = cacheManager.getUserProfile;
    const origUpdate = cacheManager.updateUserProfile;

    // User memiliki tier3 aktif
    cacheManager.getUserProfile = async () => ({
      isPremium: true,
      premiumUntil: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      premium_tier: "tier3",
    });

    cacheManager.updateUserProfile = async (uid, patch) => {
      updatedData = patch;
      return true;
    };

    try {
      // Top.gg voter trial mencoba memberikan vip_starter
      await entitlementService.extendUserPremium(testUserId, 12 * 3600 * 1000, "vip_starter");

      // Tier tidak boleh ter-downgrade ke vip_starter
      assert.ok(updatedData);
      assert.strictEqual(updatedData.isPremium, true);
      assert.strictEqual(updatedData.premium_tier, undefined, "premium_tier tidak boleh di-downgrade");
    } finally {
      cacheManager.getUserProfile = origGet;
      cacheManager.updateUserProfile = origUpdate;
    }
  });

  it("handleEntitlementDelete tidak menghapus premium jika user memiliki langganan eksternal aktif", async () => {
    const testUserId = "user_external_premium_safe";
    let profileReset = null;

    const origGet = cacheManager.getUserProfile;
    const origUpdate = cacheManager.updateUserProfile;
    const origMutate = cacheManager.mutateUserProfileJson;

    // User memiliki langganan aktif dari Saweria (1 tahun kedepan)
    cacheManager.getUserProfile = async () => ({
      isPremium: true,
      premiumUntil: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
      premium_tier: "tier3",
    });

    cacheManager.updateUserProfile = async (uid, patch) => {
      profileReset = patch;
      return true;
    };

    cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
      const state = { entitlements: { sku_star_pass: { active: true } } };
      return fn(state);
    };

    try {
      const res = await entitlementService.handleEntitlementDelete({
        userId: testUserId,
        skuId: "sku_star_pass",
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.revoked, true);
      // Profile tidak boleh direset ke non-premium karena masih memiliki sisa waktu eksternal
      assert.strictEqual(profileReset, null, "UserProfile tidak boleh di-reset karena masih punya premium eksternal");
    } finally {
      cacheManager.getUserProfile = origGet;
      cacheManager.updateUserProfile = origUpdate;
      cacheManager.mutateUserProfileJson = origMutate;
    }
  });

  it("manifest Discord Activity memuat scope relationships.read dan social_sdk", () => {
    const manifest = require("../config/discordActivityManifest.json");
    const pkg = require("../../package.json");
    assert.ok(manifest.scopes.includes("relationships.read"));
    assert.ok(manifest.capabilities.includes("social_sdk"));
    assert.strictEqual(manifest.version, pkg.version);
  });
});
