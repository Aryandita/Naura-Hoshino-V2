"use strict";

process.env.NODE_ENV = "test";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const voteService = require("./voteService");
const cacheManager = require("../managers/cacheManager");
const UserSurvival = require("../models/UserSurvival");
const currency = require("../survival/engines/currency");

describe("Top.gg Vote Service & Taste of Premium Suite", () => {
  it("isWeekend mengidentifikasi hari Jumat, Sabtu, dan Minggu UTC", () => {
    // 2026-10-16 is Friday (UTC day 5)
    assert.strictEqual(voteService.isWeekend(new Date("2026-10-16T12:00:00Z")), true);
    // 2026-10-17 is Saturday (UTC day 6)
    assert.strictEqual(voteService.isWeekend(new Date("2026-10-17T12:00:00Z")), true);
    // 2026-10-18 is Sunday (UTC day 0)
    assert.strictEqual(voteService.isWeekend(new Date("2026-10-18T12:00:00Z")), true);
    // 2026-10-19 is Monday (UTC day 1)
    assert.strictEqual(voteService.isWeekend(new Date("2026-10-19T12:00:00Z")), false);
    // 2026-10-21 is Wednesday (UTC day 3)
    assert.strictEqual(voteService.isWeekend(new Date("2026-10-21T12:00:00Z")), false);
  });

  it("processTopGgVote menolak userId yang bukan Snowflake valid", async () => {
    const res1 = await voteService.processTopGgVote({ userId: "invalid_id" });
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.reason, "invalid_user_id");

    const res2 = await voteService.processTopGgVote({ userId: "12345" });
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.reason, "invalid_user_id");
  });

  it("processTopGgVote berhasil memberikan VIP Starter 12 jam, kupon, dan streak", async () => {
    const testUserId = "112233445566778899";
    let extendedUser = null;

    const entitlementService = require("./entitlementService");
    const origExtend = entitlementService.extendUserPremium;
    const origFindOrCreate = UserSurvival.findOrCreate;
    const origReward = currency.reward;
    const origMutate = cacheManager.mutateUserProfileJson;

    const mockSurvival = {
      userId: testUserId,
      rpg_state: {},
      changed: () => {},
      save: async () => true,
    };

    UserSurvival.findOrCreate = async () => [mockSurvival, true];
    currency.reward = async () => 10;
    cacheManager.mutateUserProfileJson = async () => true;

    entitlementService.extendUserPremium = async (uid, ms, tier) => {
      extendedUser = { uid, ms, tier };
      return new Date(Date.now() + ms);
    };

    try {
      const res = await voteService.processTopGgVote({
        userId: testUserId,
        isWeekend: false,
        force: true,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.vipGranted, true);
      assert.strictEqual(res.coupons, voteService.COUPON_PER_VOTE);
      assert.strictEqual(res.coins, 1500);
      assert.strictEqual(res.streak, 1);
      assert.ok(res.expiry instanceof Date);

      assert.ok(extendedUser);
      assert.strictEqual(extendedUser.uid, testUserId);
      assert.strictEqual(extendedUser.ms, 12 * 3600 * 1000);
      assert.strictEqual(extendedUser.tier, "vip_starter");
    } finally {
      entitlementService.extendUserPremium = origExtend;
      UserSurvival.findOrCreate = origFindOrCreate;
      currency.reward = origReward;
      cacheManager.mutateUserProfileJson = origMutate;
    }
  });

  it("Weekend Astral Surge memberikan 2x kupon dan drop trial voucher", async () => {
    const testUserId = "998877665544332211";
    let inventoryState = [];

    const origExtend = voteService.extendPremium;
    const origFindOrCreate = UserSurvival.findOrCreate;
    const origReward = currency.reward;
    const origMutate = cacheManager.mutateUserProfileJson;

    const mockSurvival = {
      userId: testUserId,
      rpg_state: {},
      changed: () => {},
      save: async () => true,
    };

    UserSurvival.findOrCreate = async () => [mockSurvival, true];
    currency.reward = async () => 20;
    cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
      if (field === "inventory") {
        inventoryState = fn(inventoryState);
      }
      return true;
    };

    voteService.extendPremium = async (uid, ms, tier) => new Date(Date.now() + ms);

    try {
      const res = await voteService.processTopGgVote({
        userId: testUserId,
        isWeekend: true,
        force: true,
        dropTrialVoucher: true,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.isWeekend, true);
      assert.strictEqual(res.coupons, voteService.COUPON_WEEKEND);
      assert.strictEqual(res.trialDropped, true);

      // Pastikan voucher 1 hari tersimpan di inventory
      const voucher = inventoryState.find((item) => item.id === "trial_voucher_1d");
      assert.ok(voucher, "Voucher trial_voucher_1d harus ada di inventory");
      assert.strictEqual(voucher.amount, 1);
      assert.strictEqual(voucher.type, "VOUCHER");
    } finally {
      voteService.extendPremium = origExtend;
      UserSurvival.findOrCreate = origFindOrCreate;
      currency.reward = origReward;
      cacheManager.mutateUserProfileJson = origMutate;
    }
  });

  it("getVoteStatus mengembalikan informasi cooldown secara presisi", async () => {
    const testUserId = "123456789012345678";
    const origFindOne = UserSurvival.findOne;

    // Skenario 1: User belum pernah vote
    UserSurvival.findOne = async () => null;
    const status1 = await voteService.getVoteStatus(testUserId);
    assert.strictEqual(status1.canVote, true);
    assert.strictEqual(status1.nextVoteAt, null);

    // Skenario 2: User baru vote 1 jam yang lalu (masih cooldown)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    UserSurvival.findOne = async () => ({
      userId: testUserId,
      rpg_state: {
        last_vote_at: oneHourAgo,
        vote_streak: 5,
        vote_days_streak: 3,
        vote_total: 12,
      },
    });

    const status2 = await voteService.getVoteStatus(testUserId);
    assert.strictEqual(status2.canVote, false);
    assert.ok(status2.nextVoteAt instanceof Date);
    assert.strictEqual(status2.streak, 5);
    assert.strictEqual(status2.daysStreak, 3);
    assert.strictEqual(status2.totalVotes, 12);

    UserSurvival.findOne = origFindOne;
  });
});
