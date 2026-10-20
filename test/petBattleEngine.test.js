"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDivisionTier,
  getPetCombatStats,
  generateWildChallenger,
  simulatePetBattle,
  SPECIES_BASE_STATS,
} = require("../src/survival/engines/petBattleEngine");

test("PetBattleEngine - getDivisionTier() maps MMR correctly", () => {
  assert.equal(getDivisionTier(900).name, "Bronze");
  assert.equal(getDivisionTier(1150).name, "Silver");
  assert.equal(getDivisionTier(1400).name, "Gold");
  assert.equal(getDivisionTier(1750).name, "Platinum");
  assert.equal(getDivisionTier(2050).name, "Diamond");
  assert.equal(getDivisionTier(2300).name, "Master Rimba");

  assert.ok(SPECIES_BASE_STATS.wolf);
  assert.ok(SPECIES_BASE_STATS.dragon);
  assert.ok(SPECIES_BASE_STATS.cat);
});

test("PetBattleEngine - getPetCombatStats() computes level and species bonuses", () => {
  const petWolfLv1 = {
    petType: "wolf",
    petName: "Fang",
    petLevel: 1,
    evolutionStage: 1,
    mood: "happy",
    hunger: 100,
  };

  const stats1 = getPetCombatStats(petWolfLv1);
  assert.equal(stats1.name, "Fang");
  assert.ok(stats1.hp > 100);
  assert.ok(stats1.atk >= 25);

  const petWolfLv10 = {
    petType: "wolf",
    petName: "Direfang",
    petLevel: 10,
    evolutionStage: 2,
    mood: "energized",
    hunger: 100,
  };

  const stats10 = getPetCombatStats(petWolfLv10);
  assert.ok(stats10.hp > stats1.hp);
  assert.ok(stats10.atk > stats1.atk);
  assert.ok(stats10.crit > stats1.crit);
});

test("PetBattleEngine - generateWildChallenger() creates scaled opponent", () => {
  const npc = generateWildChallenger(1200);
  assert.ok(npc.isNpc);
  assert.ok(npc.stats);
  assert.ok(npc.stats.hp > 0);
  assert.ok(npc.stats.atk > 0);
  assert.ok(npc.mmr >= 1000 && npc.mmr <= 1400);
});

test("PetBattleEngine - simulatePetBattle() finishes with winner and combat logs", () => {
  const petA = getPetCombatStats({
    petType: "dragon",
    petName: "Ignis",
    petLevel: 5,
    evolutionStage: 1,
    mood: "happy",
    hunger: 100,
  });

  const petB = getPetCombatStats({
    petType: "cat",
    petName: "Shadow",
    petLevel: 4,
    evolutionStage: 1,
    mood: "normal",
    hunger: 100,
  });

  const result = simulatePetBattle(petA, petB, "Ignis", "Shadow");
  assert.ok(result.winner === "A" || result.winner === "B");
  assert.ok(result.loser === "A" || result.loser === "B");
  assert.notEqual(result.winner, result.loser);
  assert.ok(result.rounds >= 1 && result.rounds <= 10);
  assert.ok(Array.isArray(result.roundLogs));
  assert.ok(result.roundLogs.length > 0);
});
