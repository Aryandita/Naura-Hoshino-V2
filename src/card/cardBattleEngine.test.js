"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CardBattleEngine = require("./cardBattleEngine");

test("CardBattleEngine - Elemental multipliers", () => {
  assert.equal(CardBattleEngine.getElementMultiplier("FIRE", "NATURE"), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier("WATER", "FIRE"), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier("NATURE", "WATER"), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier("LIGHT", "DARK"), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier("DARK", "LIGHT"), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier("FIRE", "WATER"), 0.75);
});

test("CardBattleEngine - computeCardStats scaling with Quality", () => {
  const cardGood = {
    characterName: "Hutao",
    seriesName: "Genshin Impact",
    quality: "GOOD",
    printNumber: 100,
  };
  const cardMint = {
    characterName: "Hutao",
    seriesName: "Genshin Impact",
    quality: "GEM_MINT",
    printNumber: 1,
  };

  const statsGood = CardBattleEngine.computeCardStats(cardGood);
  const statsMint = CardBattleEngine.computeCardStats(cardMint);

  assert.ok(
    statsMint.maxHp > statsGood.maxHp,
    "GEM_MINT HP should exceed GOOD HP",
  );
  assert.ok(
    statsMint.atk > statsGood.atk,
    "GEM_MINT ATK should exceed GOOD ATK",
  );
  assert.equal(statsMint.critRate, 0.25);
});

test("CardBattleEngine - executeTurn deals damage and updates HP", () => {
  const p1 = CardBattleEngine.computeCardStats({
    characterName: "Saber",
    quality: "EXCELLENT",
    printNumber: 5,
  });
  const p2 = CardBattleEngine.computeCardStats({
    characterName: "Rem",
    quality: "GOOD",
    printNumber: 50,
  });

  const result = CardBattleEngine.executeTurn(p1, p2, "ATTACK");
  assert.ok(result.damageDealt > 0, "Damage dealt should be positive");
  assert.ok(p2.currentHp < p2.maxHp, "Defender HP should be reduced");
});

test("CardBattleEngine - getTowerMonster floor progression", () => {
  const f1 = CardBattleEngine.getTowerMonster(1);
  const f10 = CardBattleEngine.getTowerMonster(10);

  assert.equal(f1.printNumber, 1);
  assert.ok(f10.maxHp > f1.maxHp, "Boss floor should have higher HP");
  assert.equal(f10.characterName, "Slime Sovereign");
});
