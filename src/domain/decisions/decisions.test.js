// Lokasi: src/domain/decisions/decisions.test.js
// Unit test untuk modul Pure Decision Engines (Law 5)

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateRequiredXpForNextLevel,
  evaluateExperienceGain,
  calculateStatCap,
} = require("./levelingDecisions");

const {
  calculateTransferTax,
  evaluateTransferDecision,
} = require("./economyDecisions");

describe("Law 5: Leveling Decision Engine (Pure Functions)", () => {
  it("calculateRequiredXpForNextLevel menghitung kurva kuadratik secara tepat", () => {
    // Level 1: 5*(1)^2 + 50*(1) + 100 = 155
    assert.strictEqual(calculateRequiredXpForNextLevel(1), 155);
    // Level 2: 5*(4) + 100 + 100 = 220
    assert.strictEqual(calculateRequiredXpForNextLevel(2), 220);
  });

  it("evaluateExperienceGain menghitung kenaikan level beruntun dan hadiah", () => {
    const result = evaluateExperienceGain({
      currentXp: 50,
      currentLevel: 1,
      gainedXp: 500, // Cukup untuk level 1 (butuh 155, sisa 395) -> level 2 (butuh 220, sisa 175) -> level 3
    });

    assert.strictEqual(result.didLevelUp, true);
    assert.strictEqual(result.levelsGained, 2);
    assert.strictEqual(result.resultingLevel, 3);
    assert.strictEqual(result.resultingXp, 175);
    assert.strictEqual(result.skillPointsEarned, 4); // 2 level * 2 poin
    assert.strictEqual(result.rewardCoins, 2 * 50 + 3 * 50); // 100 + 150 = 250
  });

  it("evaluateExperienceGain tanpa level up hanya menambah sisa XP", () => {
    const result = evaluateExperienceGain({
      currentXp: 10,
      currentLevel: 1,
      gainedXp: 20,
    });

    assert.strictEqual(result.didLevelUp, false);
    assert.strictEqual(result.levelsGained, 0);
    assert.strictEqual(result.resultingLevel, 1);
    assert.strictEqual(result.resultingXp, 30);
  });

  it("calculateStatCap mengembalikan batas stat berdasarkan level", () => {
    assert.strictEqual(calculateStatCap("health", 1), 100);
    assert.strictEqual(calculateStatCap("health", 10), 190);
    assert.strictEqual(calculateStatCap("stamina", 5), 120);
  });
});

describe("Law 5: Economy Decision Engine (Pure Functions)", () => {
  it("calculateTransferTax menghitung persentase pajak dengan pembulatan ke bawah", () => {
    assert.strictEqual(calculateTransferTax(1000, 0.05), 50);
    assert.strictEqual(calculateTransferTax(1005, 0.05), 50); // Math.floor(50.25) = 50
  });

  it("evaluateTransferDecision menolak transfer ke diri sendiri", () => {
    const decision = evaluateTransferDecision({
      senderId: "user-1",
      receiverId: "user-1",
      senderBalance: 5000,
      transferAmount: 1000,
    });

    assert.strictEqual(decision.isAllowed, false);
    assert.strictEqual(decision.reasonCode, "SELF_TRANSFER_PROHIBITED");
  });

  it("evaluateTransferDecision menolak transfer di bawah minimum", () => {
    const decision = evaluateTransferDecision({
      senderId: "user-1",
      receiverId: "user-2",
      senderBalance: 5000,
      transferAmount: 50,
      minTransferAmount: 100,
    });

    assert.strictEqual(decision.isAllowed, false);
    assert.strictEqual(decision.reasonCode, "AMOUNT_BELOW_MINIMUM");
  });

  it("evaluateTransferDecision menolak transfer saat saldo tidak cukup", () => {
    const decision = evaluateTransferDecision({
      senderId: "user-1",
      receiverId: "user-2",
      senderBalance: 200,
      transferAmount: 500,
    });

    assert.strictEqual(decision.isAllowed, false);
    assert.strictEqual(decision.reasonCode, "INSUFFICIENT_FUNDS");
  });

  it("evaluateTransferDecision menyetujui transaksi valid dan memotong pajak", () => {
    const decision = evaluateTransferDecision({
      senderId: "user-1",
      receiverId: "user-2",
      senderBalance: 10000,
      transferAmount: 2000,
      taxRate: 0.05,
    });

    assert.strictEqual(decision.isAllowed, true);
    assert.strictEqual(decision.reasonCode, null);
    assert.strictEqual(decision.grossAmount, 2000);
    assert.strictEqual(decision.taxAmount, 100);
    assert.strictEqual(decision.netAmountReceived, 1900);
    assert.strictEqual(decision.resultingSenderBalance, 8000);
  });
});
