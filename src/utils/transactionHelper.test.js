"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { executeAtomicPayment } = require("./transactionHelper");
const cacheManager = require("../managers/cacheManager");

test("transactionHelper - executeAtomicPayment validation", async () => {
  const res = await executeAtomicPayment({
    userId: "",
    amount: 100,
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "INVALID_AMOUNT");

  const resZero = await executeAtomicPayment({
    userId: "u123",
    amount: 0,
  });
  assert.equal(resZero.ok, false);
  assert.equal(resZero.reason, "INVALID_AMOUNT");
});

test("transactionHelper - executeAtomicPayment successful execution", async () => {
  const origDebit = cacheManager.debitUserSurvival;
  cacheManager.debitUserSurvival = async () => ({ ok: true });

  try {
    let actionExecuted = false;
    const res = await executeAtomicPayment({
      userId: "u-ok",
      amount: 50,
      currency: "starFragments",
      action: async () => {
        actionExecuted = true;
        return { itemAwarded: "Iron Sword" };
      },
    });

    assert.equal(res.ok, true);
    assert.equal(actionExecuted, true);
    assert.equal(res.result.itemAwarded, "Iron Sword");
  } finally {
    cacheManager.debitUserSurvival = origDebit;
  }
});

test("transactionHelper - executeAtomicPayment compensatory rollback on action failure", async () => {
  const origDebit = cacheManager.debitUserSurvival;
  const origInc = cacheManager.incrementUserSurvival;

  let debited = false;
  let rolledBack = false;

  cacheManager.debitUserSurvival = async () => {
    debited = true;
    return { ok: true };
  };

  cacheManager.incrementUserSurvival = async (userId, deltas) => {
    if (deltas.starFragments === 100) {
      rolledBack = true;
    }
    return true;
  };

  try {
    const res = await executeAtomicPayment({
      userId: "u-fail",
      amount: 100,
      currency: "starFragments",
      action: async () => {
        throw new Error("Simulated inventory full");
      },
    });

    assert.equal(debited, true);
    assert.equal(rolledBack, true);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "ACTION_FAILED");
    assert.equal(res.error, "Simulated inventory full");
  } finally {
    cacheManager.debitUserSurvival = origDebit;
    cacheManager.incrementUserSurvival = origInc;
  }
});
