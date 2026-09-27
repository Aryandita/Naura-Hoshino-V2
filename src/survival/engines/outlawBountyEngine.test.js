"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const outlawEngine = require("./outlawBountyEngine");
const cacheManager = require("../../managers/cacheManager");

describe("OutlawBountyEngine - Wanted Outlaw PvP Board", () => {
  beforeEach(() => {
    outlawEngine.clearBoardMemory();
  });

  it("menolak penempatan bounty ke diri sendiri", async () => {
    const res = await outlawEngine.placeOutlawBounty({
      issuerId: "hunter_1",
      targetUserId: "hunter_1",
      rewardNsf: 500,
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes("kepalamu sendiri"));
  });

  it("menolak penempatan bounty dengan imbalan di bawah 100 NSF", async () => {
    const res = await outlawEngine.placeOutlawBounty({
      issuerId: "hunter_1",
      targetUserId: "outlaw_1",
      rewardNsf: 50,
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes("minimal 100"));
  });

  it("berhasil mendaftarkan dan mencairkan bounty saat berhasil diklaim", async () => {
    // Mock debitUserSurvival & incrementUserSurvival
    const originalDebit = cacheManager.debitUserSurvival;
    const originalInc = cacheManager.incrementUserSurvival;

    cacheManager.debitUserSurvival = async () => true;
    cacheManager.incrementUserSurvival = async () => true;

    try {
      const placeRes = await outlawEngine.placeOutlawBounty({
        issuerId: "hunter_1",
        targetUserId: "outlaw_bandit",
        rewardNsf: 1000,
        reason: "Penyergap karavan dagang",
      });
      assert.strictEqual(placeRes.success, true);

      const board = await outlawEngine.getWantedBoard();
      assert.strictEqual(board.length, 1);
      assert.strictEqual(board[0].targetUserId, "outlaw_bandit");
      assert.strictEqual(board[0].rewardNsf, 1000);

      // Claim bounty
      const claimRes = await outlawEngine.claimOutlawBounty("hunter_2", "outlaw_bandit");
      assert.strictEqual(claimRes.success, true);
      assert.strictEqual(claimRes.rewardNsf, 1000);

      const updatedBoard = await outlawEngine.getWantedBoard();
      assert.strictEqual(updatedBoard.length, 0);
    } finally {
      cacheManager.debitUserSurvival = originalDebit;
      cacheManager.incrementUserSurvival = originalInc;
    }
  });
});
