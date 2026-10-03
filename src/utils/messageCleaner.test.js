"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const messageCleaner = require("./messageCleaner");

test.beforeEach(() => {
  messageCleaner.resetForTesting();
});

test("messageCleaner: registerAutoDelete dan cancelAutoDelete", () => {
  let deleted = false;
  const mockMessage = {
    id: "msg-123",
    delete: async () => {
      deleted = true;
    },
  };

  const cancel = messageCleaner.registerAutoDelete(mockMessage, 60);
  assert.equal(messageCleaner.activeTimers.has("msg-123"), true);

  cancel();
  assert.equal(messageCleaner.activeTimers.has("msg-123"), false);
  assert.equal(deleted, false);
});

test("messageCleaner: acquireLock dan releaseLock mencegah race condition", () => {
  assert.equal(messageCleaner.acquireLock("msg-999"), true);
  // Klik kedua harus ditolak
  assert.equal(messageCleaner.acquireLock("msg-999"), false);

  messageCleaner.releaseLock("msg-999");
  assert.equal(messageCleaner.acquireLock("msg-999"), true);
});

test("messageCleaner: klaim hadiah berhasil dan menghormati cooldown 10s", async () => {
  const mockIncrement = async () => {};
  const res1 = await messageCleaner.claimCleanupReward("user-1", mockIncrement);
  assert.equal(res1.success, true);
  assert.equal(res1.reward, 5);
  assert.equal(res1.currentDaily, 5);

  // Klaim kedua seketika harus kena cooldown
  const res2 = await messageCleaner.claimCleanupReward("user-1", mockIncrement);
  assert.equal(res2.success, false);
  assert.equal(res2.reason, "COOLDOWN");
  assert.ok(res2.waitSeconds > 0);
});

test("messageCleaner: menghormati batas harian 50 NSF", async () => {
  const userId = "user-daily-cap";
  // Simulasikan akumulasi hingga batas 50 NSF
  const dateKey = messageCleaner.getTodayDateKey();
  messageCleaner.dailyClaims.set(`${userId}:${dateKey}`, 50);

  const res = await messageCleaner.claimCleanupReward(userId);
  assert.equal(res.success, false);
  assert.equal(res.reason, "DAILY_LIMIT_REACHED");
  assert.equal(res.currentDaily, 50);
});
