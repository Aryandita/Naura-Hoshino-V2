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

const {
  evaluateDungeonEntryRequirement,
  evaluateCombatRound,
} = require("./dungeonDecisions");

const {
  evaluateMarketAccess,
  calculateMarketItemPrice,
  evaluatePurchaseDecision,
  calculateSellYield,
} = require("./marketDecisions");

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

describe("Law 5: Dungeon Decision Engine (Pure Functions)", () => {
  it("evaluateDungeonEntryRequirement menolak jika tidak memiliki tiket", () => {
    const res = evaluateDungeonEntryRequirement({
      currentLocation: "desa",
      hp: 100,
      stamina: 100,
      normalPassCount: 0,
      specialPassCount: 0,
    });
    assert.strictEqual(res.isAllowed, false);
    assert.strictEqual(res.reasonCode, "NO_PASS_AVAILABLE");
    assert.strictEqual(res.suggestShopCta, true);
  });

  it("evaluateDungeonEntryRequirement menolak jika lokasi bukan gua/desa", () => {
    const res = evaluateDungeonEntryRequirement({
      currentLocation: "hutan",
      hp: 100,
      stamina: 100,
      normalPassCount: 1,
    });
    assert.strictEqual(res.isAllowed, false);
    assert.strictEqual(res.reasonCode, "INVALID_LOCATION");
  });

  it("evaluateDungeonEntryRequirement menolak jika HP atau Stamina <= 20", () => {
    const res = evaluateDungeonEntryRequirement({
      currentLocation: "desa",
      hp: 15,
      stamina: 100,
      normalPassCount: 1,
    });
    assert.strictEqual(res.isAllowed, false);
    assert.strictEqual(res.reasonCode, "VITALS_TOO_LOW");
  });

  it("evaluateDungeonEntryRequirement menolak jika non-premium melebihi lantai gratis", () => {
    const res = evaluateDungeonEntryRequirement({
      currentLocation: "desa",
      hp: 100,
      stamina: 100,
      floor: 55,
      isPremium: false,
      normalPassCount: 1,
      freeFloorLimit: 50,
    });
    assert.strictEqual(res.isAllowed, false);
    assert.strictEqual(res.reasonCode, "FREE_FLOOR_LIMIT_EXCEEDED");
  });

  it("evaluateDungeonEntryRequirement mengizinkan penjelajahan yang memenuhi syarat", () => {
    const res = evaluateDungeonEntryRequirement({
      currentLocation: "desa",
      hp: 100,
      stamina: 100,
      floor: 10,
      isPremium: false,
      normalPassCount: 1,
    });
    assert.strictEqual(res.isAllowed, true);
    assert.strictEqual(res.reasonCode, null);
  });

  it("evaluateCombatRound mengevaluasi kemenangan pemain", () => {
    const round = evaluateCombatRound({
      playerDamage: 120,
      playerHp: 100,
      enemyHp: 100,
      enemyDamage: 30,
    });
    assert.strictEqual(round.roundStatus, "PLAYER_VICTORY");
    assert.strictEqual(round.nextEnemyHp, 0);
    assert.strictEqual(round.nextPlayerHp, 100);
  });

  it("evaluateCombatRound mengevaluasi serangan balik musuh dan dodge", () => {
    const roundDodge = evaluateCombatRound({
      playerDamage: 30,
      playerHp: 100,
      enemyHp: 100,
      enemyDamage: 40,
      dodgeSuccess: true,
    });
    assert.strictEqual(roundDodge.roundStatus, "ONGOING");
    assert.strictEqual(roundDodge.nextEnemyHp, 70);
    assert.strictEqual(roundDodge.nextPlayerHp, 100);
    assert.strictEqual(roundDodge.effectiveEnemyHit, 0);

    const roundHit = evaluateCombatRound({
      playerDamage: 30,
      playerHp: 100,
      enemyHp: 100,
      enemyDamage: 40,
      dodgeSuccess: false,
    });
    assert.strictEqual(roundHit.roundStatus, "ONGOING");
    assert.strictEqual(roundHit.nextEnemyHp, 70);
    assert.strictEqual(roundHit.nextPlayerHp, 60);
    assert.strictEqual(roundHit.effectiveEnemyHit, 40);
  });
});

describe("Law 5: Market Decision Engine (Pure Functions)", () => {
  it("evaluateMarketAccess menolak akses saat berada di penjara", () => {
    const res = evaluateMarketAccess({ currentLocation: "prison" });
    assert.strictEqual(res.isAllowed, false);
    assert.strictEqual(res.reasonCode, "IN_PRISON");
    assert.strictEqual(res.errorCode, "err_sys_51");
  });

  it("evaluateMarketAccess menolak akses jika di luar area desa", () => {
    const res = evaluateMarketAccess({ currentLocation: "hutan" });
    assert.strictEqual(res.isAllowed, false);
    assert.strictEqual(res.reasonCode, "NOT_IN_VILLAGE");
    assert.strictEqual(res.errorCode, "err_sys_52");
  });

  it("evaluateMarketAccess mengizinkan akses di desa", () => {
    const res = evaluateMarketAccess({ currentLocation: "desa" });
    assert.strictEqual(res.isAllowed, true);
  });

  it("calculateMarketItemPrice menghitung harga dengan pengali cuaca dan extreme", () => {
    const normalPrice = calculateMarketItemPrice({
      basePrice: 100,
      weatherMultiplier: 1.2,
      demandCount: 2,
    });
    // 100 * 1.2 * (1 + 0.2) = 144
    assert.strictEqual(normalPrice, 144);

    const extremePrice = calculateMarketItemPrice({
      basePrice: 100,
      weatherMultiplier: 1.2,
      demandCount: 2,
      isExtreme: true,
    });
    // 144 * 1.5 = 216
    assert.strictEqual(extremePrice, 216);
  });

  it("evaluatePurchaseDecision menolak jika saldo kurang dan menghitung kekurangan", () => {
    const res = evaluatePurchaseDecision({
      userBalance: 300,
      itemPrice: 200,
      quantity: 2,
    });
    assert.strictEqual(res.isAllowed, false);
    assert.strictEqual(res.reasonCode, "INSUFFICIENT_FUNDS");
    assert.strictEqual(res.totalPrice, 400);
    assert.strictEqual(res.shortage, 100);
  });

  it("evaluatePurchaseDecision mengizinkan jika saldo cukup", () => {
    const res = evaluatePurchaseDecision({
      userBalance: 500,
      itemPrice: 200,
      quantity: 2,
    });
    assert.strictEqual(res.isAllowed, true);
    assert.strictEqual(res.totalPrice, 400);
    assert.strictEqual(res.shortage, 0);
    assert.strictEqual(res.remainingBalance, 100);
  });

  it("calculateSellYield menghitung hasil jual dan bonus Midas", () => {
    const normal = calculateSellYield({
      unitPrice: 50,
      quantity: 4,
    });
    assert.strictEqual(normal.totalGross, 200);
    assert.strictEqual(normal.bonusEarned, 0);
    assert.strictEqual(normal.totalEarned, 200);

    const withMidas = calculateSellYield({
      unitPrice: 50,
      quantity: 4,
      bonusMultiplier: 1.25,
    });
    assert.strictEqual(withMidas.totalGross, 200);
    assert.strictEqual(withMidas.totalEarned, 250);
    assert.strictEqual(withMidas.bonusEarned, 50);
  });
});
