"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const economyAuditService = require("./economyAuditService");

test("EconomyAuditService - recordAudit menolak parameter kosong dengan aman", async () => {
  const result = await economyAuditService.recordAudit({});
  assert.equal(result, null);
});

test("EconomyAuditService - recordAudit menolak nominal invalid dengan aman", async () => {
  const resultNaN = await economyAuditService.recordAudit({
    targetUserId: "user123",
    currency: "sukamajuCoins",
    action: "CREDIT",
    amount: "invalid_amount",
  });
  assert.equal(resultNaN, null);

  const resultNegative = await economyAuditService.recordAudit({
    targetUserId: "user123",
    currency: "sukamajuCoins",
    action: "CREDIT",
    amount: -100,
  });
  assert.equal(resultNegative, null);
});

test("EconomyAuditService - recordAudit menolak saldo invalid dengan aman", async () => {
  const result = await economyAuditService.recordAudit({
    targetUserId: "user123",
    currency: "sukamajuCoins",
    action: "CREDIT",
    amount: 100,
    balanceBefore: -50,
  });
  assert.equal(result, null);
});

test("EconomyAuditService - getRecentAudits mengembalikan array kosong saat user tidak diberikan", async () => {
  const result = await economyAuditService.getRecentAudits("");
  assert.deepEqual(result, []);
});

test("EconomyAuditService - getRecentAudits mengembalikan array kosong dan bounded saat limit adalah 0", async () => {
  const result = await economyAuditService.getRecentAudits("user123", 0);
  assert.deepEqual(result, []);
});

