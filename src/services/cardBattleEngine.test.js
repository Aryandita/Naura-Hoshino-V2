"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const cardBattleEngine = require("./cardBattleEngine");
const {
  CardBattleEngine,
  ELEMENTS,
  ELEMENT_MULTIPLIERS,
  ACTIONS,
  BATTLE_STATES,
} = cardBattleEngine;

test("CardBattleEngine - Constants and Multipliers Integrity", () => {
  assert.ok(cardBattleEngine);
  assert.ok(ELEMENT_MULTIPLIERS.FIRE);
  assert.equal(ELEMENTS.FIRE, "FIRE");
  assert.equal(ELEMENTS.WATER, "WATER");
  assert.equal(ELEMENTS.NATURE, "NATURE");
  assert.equal(ELEMENTS.LIGHT, "LIGHT");
  assert.equal(ELEMENTS.DARK, "DARK");

  // Element Matchup Matrix
  assert.equal(CardBattleEngine.getElementMultiplier(ELEMENTS.FIRE, ELEMENTS.NATURE), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier(ELEMENTS.FIRE, ELEMENTS.WATER), 0.75);
  assert.equal(CardBattleEngine.getElementMultiplier(ELEMENTS.WATER, ELEMENTS.FIRE), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier(ELEMENTS.NATURE, ELEMENTS.WATER), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier(ELEMENTS.LIGHT, ELEMENTS.DARK), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier(ELEMENTS.DARK, ELEMENTS.LIGHT), 1.5);
  assert.equal(CardBattleEngine.getElementMultiplier(ELEMENTS.FIRE, ELEMENTS.FIRE), 1.0);
});

test("CardBattleEngine - computeCardStats calculates rarity, quality and serial print", () => {
  const commonCard = {
    cardCode: "NRA-001",
    characterName: "Goblin Scout",
    rarity: "COMMON",
    quality: "GOOD",
    printNumber: 150,
  };
  const statsCommon = CardBattleEngine.computeCardStats(commonCard);
  assert.equal(statsCommon.maxHp, 1000);
  assert.equal(statsCommon.atk, 200);
  assert.equal(statsCommon.def, 100);
  assert.equal(statsCommon.spd, 100);

  // Mythic #1 Gem Mint Card (Heavy Bonus)
  const mythicCard = {
    cardCode: "NRA-002",
    characterName: "Saber",
    rarity: "MYTHIC",
    quality: "GEM_MINT",
    printNumber: 1,
  };
  const statsMythic = CardBattleEngine.computeCardStats(mythicCard);
  // Base HP 3000 * 1.5 * 1.2 = 5400
  assert.equal(statsMythic.maxHp, 5400);
  // Base ATK 680 * 1.5 * 1.2 = 1224
  assert.equal(statsMythic.atk, 1224);
  assert.ok(statsMythic.critRate >= 0.25);
});

test("CardBattleEngine - 5-Card Deck Validation and Synergies", () => {
  // Reject non-array or length !== 5
  assert.throws(() => CardBattleEngine.validateDeck5([]), /tepat 5 kartu/);
  assert.throws(() => CardBattleEngine.validateDeck5([{}, {}, {}, {}]), /tepat 5 kartu/);

  // Reject more than 2 duplicates of same character
  const tripleCard = [
    { cardCode: "c1", characterName: "Rem", element: "WATER" },
    { cardCode: "c2", characterName: "Rem", element: "WATER" },
    { cardCode: "c3", characterName: "Rem", element: "WATER" },
    { cardCode: "c4", characterName: "Saber", element: "LIGHT" },
    { cardCode: "c5", characterName: "Gojo", element: "DARK" },
  ];
  assert.throws(() => CardBattleEngine.validateDeck5(tripleCard), /tidak boleh digunakan lebih dari 2 kali/);

  // Valid 5 unique elements deck (Cosmic Quintet)
  const cosmicDeck = [
    { cardCode: "c1", characterName: "Hu Tao", element: "FIRE" },
    { cardCode: "c2", characterName: "Rem", element: "WATER" },
    { cardCode: "c3", characterName: "Mikasa", element: "NATURE" },
    { cardCode: "c4", characterName: "Saber", element: "LIGHT" },
    { cardCode: "c5", characterName: "Gojo", element: "DARK" },
  ];

  const validation = CardBattleEngine.validateDeck5(cosmicDeck);
  assert.equal(validation.valid, true);
  assert.equal(validation.cards.length, 5);
  assert.ok(validation.deckPower > 0);
  assert.ok(validation.synergies.some((s) => s.id === "cosmic_quintet"));

  // Valid Dual Fire + Dual Light deck
  const dualDeck = [
    { cardCode: "d1", characterName: "Hu Tao", element: "FIRE" },
    { cardCode: "d2", characterName: "Megumin", element: "FIRE" },
    { cardCode: "d3", characterName: "Saber", element: "LIGHT" },
    { cardCode: "d4", characterName: "Raiden", element: "LIGHT" },
    { cardCode: "d5", characterName: "Rem", element: "WATER" },
  ];
  const dualVal = CardBattleEngine.validateDeck5(dualDeck);
  assert.ok(dualVal.synergies.some((s) => s.id === "fire_resonance"));
  assert.ok(dualVal.synergies.some((s) => s.id === "light_resonance"));
});

test("CardBattleEngine - Deterministic Damage Formula", () => {
  const attacker = {
    element: "FIRE",
    atk: 500,
    critRate: 0,
  };
  const defender = {
    element: "NATURE",
    def: 200,
    shield: 0,
    isGuarding: false,
  };

  // Base: (500 * 1.0 - 200 * 0.45) * 1.5 (Fire vs Nature) = (500 - 90) * 1.5 = 410 * 1.5 = 615
  const attackRes = CardBattleEngine.calculateDamage(attacker, defender, ACTIONS.ATTACK, {
    forceCrit: false,
  });
  assert.equal(attackRes.damage, 615);
  assert.equal(attackRes.isSuperEffective, true);
  assert.equal(attackRes.isResisted, false);

  // Skill: 2.2x action mult
  const skillRes = CardBattleEngine.calculateDamage(attacker, defender, ACTIONS.SKILL, {
    forceCrit: false,
  });
  // (500 * 2.2 - 90) * 1.5 = (1100 - 90) * 1.5 = 1010 * 1.5 = 1515
  assert.equal(skillRes.damage, 1515);

  // Shield Absorption Test
  defender.shield = 200;
  const shieldRes = CardBattleEngine.calculateDamage(attacker, defender, ACTIONS.ATTACK, {
    forceCrit: false,
  });
  assert.equal(shieldRes.absorbedByShield, 200);
  assert.equal(shieldRes.damage, 415); // 615 - 200 = 415
});

test("CardBattleEngine - Turn-based PvP Battle Lifecycle & Victory State", () => {
  const p1 = {
    userId: "p1_user",
    username: "Player 1",
    card: {
      cardCode: "NRA-P1",
      characterName: "Saber",
      rarity: "EPIC",
      element: "LIGHT",
      quality: "EXCELLENT",
    },
  };
  const p2 = {
    userId: "p2_user",
    username: "Player 2",
    card: {
      cardCode: "NRA-P2",
      characterName: "Gojo",
      rarity: "RARE",
      element: "DARK",
      quality: "GOOD",
    },
  };

  const battle = CardBattleEngine.createBattle(p1, p2, { bet: 100 });
  assert.equal(battle.state, BATTLE_STATES.IN_PROGRESS);
  assert.equal(battle.bet, 100);
  assert.ok(battle.activeUserId === p1.userId || battle.activeUserId === p2.userId);

  // Simulasikan Forfeit
  const forfeitBattle = JSON.parse(JSON.stringify(battle));
  CardBattleEngine.processTurn(forfeitBattle, p1.userId, ACTIONS.FORFEIT);
  assert.equal(forfeitBattle.state, BATTLE_STATES.FINISHED);
  assert.equal(forfeitBattle.winnerUserId, p2.userId);
  assert.equal(forfeitBattle.loserUserId, p1.userId);

  const summary = CardBattleEngine.getBattleSummary(forfeitBattle);
  assert.equal(summary.isFinished, true);
  assert.equal(summary.winner.userId, p2.userId);
  assert.equal(summary.winner.earnedBet, 200);
});

test("CardBattleEngine - AI Turn Tactical Decision Execution", () => {
  const p1 = {
    userId: "human_user",
    username: "Human",
    card: { characterName: "Hu Tao", element: "FIRE", rarity: "RARE" },
  };
  const p2 = {
    userId: "ai_bot",
    username: "AI Opponent",
    card: { characterName: "Rem", element: "WATER", rarity: "RARE" },
  };

  const battle = CardBattleEngine.createBattle(p1, p2);
  battle.activeUserId = "ai_bot";
  const initialHp = battle.fighters.human_user.currentHp;

  // AI Turn
  CardBattleEngine.resolveAiTurn(battle, "ai_bot");
  assert.ok(battle.fighters.human_user.currentHp < initialHp, "AI harus menyerang pemain");
  assert.equal(battle.activeUserId, "human_user", "Giliran harus berpindah ke pemain manusia");
});

test("CardBattleEngine - Character Skill Mapping and Tower Monster", () => {
  // Hu Tao with character-specific skill
  const huTaoCard = CardBattleEngine.computeCardStats({
    characterName: "Hu Tao",
    rarity: "SECRET_MYTHIC",
  });
  assert.ok(huTaoCard.skill, "Kartu wajib memiliki properti skill");
  assert.equal(huTaoCard.skill.name, "Ghost Purge");
  assert.equal(huTaoCard.skill.element, "FIRE");
  assert.ok(huTaoCard.skill.energyCost >= 2);

  // Generic character with default skill fallback
  const genericCard = CardBattleEngine.computeCardStats({
    characterName: "Random Wanderer",
    rarity: "COMMON",
  });
  assert.ok(genericCard.skill, "Kartu generik wajib memiliki skill fallback");
  assert.equal(genericCard.skill.name, "Chakra Burst");

  // Tower Monster progression
  const floor1Monster = CardBattleEngine.getTowerMonster(1);
  assert.ok(floor1Monster);
  assert.ok(floor1Monster.maxHp > 0);
  assert.ok(floor1Monster.atk > 0);

  const floor10Monster = CardBattleEngine.getTowerMonster(10);
  assert.ok(floor10Monster.maxHp > floor1Monster.maxHp, "Monster lantai lebih tinggi harus lebih kuat");
});
