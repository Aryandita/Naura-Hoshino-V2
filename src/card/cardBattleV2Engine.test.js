"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CardBattleV2Engine = require("./cardBattleV2Engine");

test("CardBattleV2Engine - initializeBattle", () => {
  const p1 = {
    userId: "user_1",
    username: "AstralHero",
    card: {
      characterName: "Hu Tao",
      quality: "EXCELLENT",
      printNumber: 1,
    },
  };

  const p2 = {
    userId: "user_2",
    username: "ShadowKnight",
    card: {
      characterName: "Gojo",
      quality: "GOOD",
      printNumber: 50,
    },
  };

  const battle = CardBattleV2Engine.initializeBattle(p1, p2);

  assert.ok(battle.id.startsWith("battle_"));
  assert.equal(battle.turn, 1);
  assert.equal(battle.isFinished, false);
  assert.equal(battle.winnerUserId, null);
  assert.ok(battle.activeUserId === "user_1" || battle.activeUserId === "user_2");

  const f1 = battle.fighters.user_1;
  const f2 = battle.fighters.user_2;

  assert.equal(f1.username, "AstralHero");
  assert.equal(f1.energy, 2);
  assert.equal(f1.shield, 0);
  assert.ok(f1.maxHp > 1000);
  assert.equal(f1.currentHp, f1.maxHp);

  assert.equal(f2.username, "ShadowKnight");
  assert.equal(f2.energy, 2);
  assert.equal(f2.shield, 0);
  assert.ok(f2.maxHp > 800);
});

test("CardBattleV2Engine - processAction GUARD & ATTACK with Shield Absorption", () => {
  const p1 = {
    userId: "p1",
    username: "Defender",
    card: { characterName: "Rem", quality: "GOOD", printNumber: 10 },
  };
  const p2 = {
    userId: "p2",
    username: "Attacker",
    card: { characterName: "Saber", quality: "GOOD", printNumber: 10 },
  };

  const battle = CardBattleV2Engine.initializeBattle(p1, p2);
  battle.activeUserId = "p1"; // Force p1 turn

  // p1 melakukan aksi GUARD
  const state1 = CardBattleV2Engine.processAction(battle, "p1", "GUARD");
  assert.ok(state1.fighters.p1.shield > 0);
  assert.equal(state1.fighters.p1.energy, 4); // 2 initial + 2 from GUARD
  assert.equal(state1.activeUserId, "p2");
  assert.equal(state1.turn, 2);

  // p2 giliran menyerang biasa (ATTACK)
  const initialShield = state1.fighters.p1.shield;
  const initialHp = state1.fighters.p1.currentHp;
  const state2 = CardBattleV2Engine.processAction(state1, "p2", "ATTACK");

  // Shield seharusnya berkurang atau menyerap damage
  assert.ok(state2.fighters.p1.shield < initialShield || state2.fighters.p1.currentHp <= initialHp);
});

test("CardBattleV2Engine - processAction SKILL with Energy Validation", () => {
  const p1 = {
    userId: "p1",
    username: "Caster",
    card: { characterName: "Megumin", quality: "GOOD", printNumber: 5 },
  };
  const p2 = {
    userId: "p2",
    username: "Target",
    card: { characterName: "Hu Tao", quality: "GOOD", printNumber: 5 },
  };

  const battle = CardBattleV2Engine.initializeBattle(p1, p2);
  battle.activeUserId = "p1";
  battle.fighters.p1.energy = 1; // Energi tidak cukup

  assert.throws(
    () => CardBattleV2Engine.processAction(battle, "p1", "SKILL"),
    /Energi tidak cukup/
  );

  // Berikan energi cukup
  battle.fighters.p1.energy = 4;
  const updatedState = CardBattleV2Engine.processAction(battle, "p1", "SKILL");
  assert.equal(updatedState.fighters.p1.energy, 0);
  assert.ok(updatedState.fighters.p2.currentHp < updatedState.fighters.p2.maxHp);
});

test("CardBattleV2Engine - processAction Victory Trigger", () => {
  const p1 = {
    userId: "p1",
    username: "Winner",
    card: { characterName: "Saber", quality: "GEM_MINT", printNumber: 1 },
  };
  const p2 = {
    userId: "p2",
    username: "LowHp",
    card: { characterName: "Rem", quality: "POOR", printNumber: 999 },
  };

  const battle = CardBattleV2Engine.initializeBattle(p1, p2);
  battle.activeUserId = "p1";
  battle.fighters.p2.currentHp = 10; // Set HP sisa 10

  const finalState = CardBattleV2Engine.processAction(battle, "p1", "ATTACK");
  assert.equal(finalState.isFinished, true);
  assert.equal(finalState.winnerUserId, "p1");
  assert.equal(finalState.fighters.p2.currentHp, 0);
  assert.ok(finalState.combatLogs[finalState.combatLogs.length - 1].includes("memenangkan duel"));
});

test("CardBattleV2Engine - calculateElo and getRankTier", () => {
  const eloResult = CardBattleV2Engine.calculateElo(1200, 1200);
  assert.ok(eloResult.winnerNewElo > 1200);
  assert.ok(eloResult.loserNewElo < 1200);
  assert.equal(eloResult.winnerDelta, eloResult.loserDelta);

  const bronze = CardBattleV2Engine.getRankTier(500);
  assert.equal(bronze.name, "Bronze");

  const gold = CardBattleV2Engine.getRankTier(1500);
  assert.equal(gold.name, "Gold");

  const cosmicMaster = CardBattleV2Engine.getRankTier(2700);
  assert.equal(cosmicMaster.name, "Cosmic Master");
});
