"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const cacheManager = require("./cacheManager");
const redisManager = require("./redisManager");
const UserProfile = require("../models/UserProfile");
const UserSurvival = require("../models/UserSurvival");

test("CacheManager - Signature Normalization & Write-Behind Safety", async (t) => {
  const userId = "test_user_cache_12345";

  // Mock loader dan Redis agar unit test sepenuhnya terisolasi dan tidak bergantung pada koneksi DB/Redis
  const origGetUserSurvival = cacheManager.getUserSurvival;
  const origGetUserProfile = cacheManager.getUserProfile;
  const origSetCache = redisManager.setCache;
  const origGetCache = redisManager.getCache;

  cacheManager.getUserSurvival = async () => ({
    userId,
    stamina: 100,
    starFragments: 500,
    coupons: 5,
  });
  cacheManager.getUserProfile = async () => ({
    userId,
    economy_wallet: 1000,
    economy_bank: 5000,
    dailyNotify: true,
  });
  redisManager.setCache = async () => true;
  redisManager.getCache = async () => null;

  t.after(() => {
    cacheManager.getUserSurvival = origGetUserSurvival;
    cacheManager.getUserProfile = origGetUserProfile;
    redisManager.setCache = origSetCache;
    redisManager.getCache = origGetCache;
    cacheManager.survivalQueue.delete(userId);
    cacheManager.writeQueue.delete(userId);
  });

  await t.test(
    "incrementUserSurvival normalizes string field and numeric value",
    async () => {
      // Clear write queue for this user
      cacheManager.survivalQueue.delete(userId);

      // Call with (userId, field, value)
      await cacheManager.incrementUserSurvival(userId, "starFragments", 250);

      const queued = cacheManager.survivalQueue.get(userId);
      assert.ok(queued, "Entry should exist in survivalQueue");
      assert.equal(queued.inc.starFragments, 250);
      assert.equal(
        queued.inc["0"],
        undefined,
        "Must not contain indexed key '0'",
      );

      cacheManager.survivalQueue.delete(userId);
    },
  );

  await t.test(
    "incrementUserSurvival supports object delta format",
    async () => {
      cacheManager.survivalQueue.delete(userId);

      // Call with (userId, { starFragments: 100, coupons: 2 })
      await cacheManager.incrementUserSurvival(userId, {
        starFragments: 100,
        coupons: 2,
      });

      const queued = cacheManager.survivalQueue.get(userId);
      assert.ok(queued, "Entry should exist in survivalQueue");
      assert.equal(queued.inc.starFragments, 100);
      assert.equal(queued.inc.coupons, 2);

      cacheManager.survivalQueue.delete(userId);
    },
  );

  await t.test(
    "incrementUserProfile normalizes string field and numeric value",
    async () => {
      cacheManager.writeQueue.delete(userId);

      await cacheManager.incrementUserProfile(userId, "economy_wallet", 500);

      const queued = cacheManager.writeQueue.get(userId);
      assert.ok(queued, "Entry should exist in writeQueue");
      assert.equal(queued.inc.economy_wallet, 500);
      assert.equal(
        queued.inc["0"],
        undefined,
        "Must not contain indexed key '0'",
      );

      cacheManager.writeQueue.delete(userId);
    },
  );

  await t.test(
    "updateUserSurvival normalizes string field and value",
    async () => {
      cacheManager.survivalQueue.delete(userId);

      await cacheManager.updateUserSurvival(userId, "stamina", 85);

      const queued = cacheManager.survivalQueue.get(userId);
      assert.ok(queued, "Entry should exist in survivalQueue");
      assert.equal(queued.set.stamina, 85);
      assert.equal(
        queued.set["0"],
        undefined,
        "Must not contain indexed key '0'",
      );

      cacheManager.survivalQueue.delete(userId);
    },
  );

  await t.test(
    "updateUserProfile normalizes string field and value",
    async () => {
      cacheManager.writeQueue.delete(userId);

      await cacheManager.updateUserProfile(userId, "dailyNotify", false);

      const queued = cacheManager.writeQueue.get(userId);
      assert.ok(queued, "Entry should exist in writeQueue");
      assert.equal(queued.set.dailyNotify, false);
      assert.equal(
        queued.set["0"],
        undefined,
        "Must not contain indexed key '0'",
      );

      cacheManager.writeQueue.delete(userId);
    },
  );

  await t.test(
    "_flushOne ignores non-attribute keys and does not invoke SQL with column '0'",
    async () => {
      // Inject corrupt entry into queue with numeric keys
      cacheManager.survivalQueue.set(userId, {
        set: { 0: "s", 1: "t", stamina: 90 },
        inc: { 0: 0, 1: 0, starFragments: 50 },
      });

      let capturedSet = null;
      let capturedInc = null;

      const originalUpdate = UserSurvival.update;
      const originalIncrement = UserSurvival.increment;

      UserSurvival.update = async (setObj) => {
        capturedSet = setObj;
        return [1];
      };
      UserSurvival.increment = async (incObj) => {
        capturedInc = incObj;
        return [1];
      };

      try {
        await cacheManager._flushOne(
          cacheManager.survivalQueue,
          UserSurvival,
          "UserSurvival",
          userId,
        );

        assert.ok(capturedSet, "update was called");
        assert.equal(capturedSet["0"], undefined, "column '0' was stripped");
        assert.equal(capturedSet.stamina, 90, "valid attribute retained");

        assert.ok(capturedInc, "increment was called");
        assert.equal(capturedInc["0"], undefined, "column '0' was stripped");
        assert.equal(capturedInc.starFragments, 50, "valid attribute retained");
      } finally {
        UserSurvival.update = originalUpdate;
        UserSurvival.increment = originalIncrement;
        cacheManager.survivalQueue.delete(userId);
      }
    },
  );

  await t.test(
    "_flushOne handles UserProfile attributes correctly",
    async () => {
      cacheManager.writeQueue.set(userId, {
        set: { dailyNotify: true },
        inc: { economy_wallet: 150 },
      });

      let capturedSet = null;
      let capturedInc = null;

      const originalUpdate = UserProfile.update;
      const originalIncrement = UserProfile.increment;

      UserProfile.update = async (setObj) => {
        capturedSet = setObj;
        return [1];
      };
      UserProfile.increment = async (incObj) => {
        capturedInc = incObj;
        return [1];
      };

      try {
        await cacheManager._flushOne(
          cacheManager.writeQueue,
          UserProfile,
          "UserProfile",
          userId,
        );

        assert.ok(capturedSet, "update was called");
        assert.equal(capturedSet.dailyNotify, true);
        assert.ok(capturedInc, "increment was called");
        assert.equal(capturedInc.economy_wallet, 150);
      } finally {
        UserProfile.update = originalUpdate;
        UserProfile.increment = originalIncrement;
        cacheManager.writeQueue.delete(userId);
      }
    },
  );
});
