"use strict";

const EVOLUTION_TREE = {
  wolf: {
    1: { type: "wolf", passive: "atk_1" },
    2: { type: "direwolf", passive: "atk_2" },
    3: { type: "fenrir", passive: "atk_3" }
  },
  cat: {
    1: { type: "cat", passive: "dodge_1" },
    2: { type: "panther", passive: "dodge_2" },
    3: { type: "tiger", passive: "dodge_3" }
  },
  dragon: {
    1: { type: "dragon", passive: "hp_1" },
    2: { type: "wyvern", passive: "hp_2" },
    3: { type: "ancient_dragon", passive: "hp_3" }
  },
  fox: {
    1: { type: "fox", passive: "spirit_1" },
    2: { type: "spirit_fox", passive: "spirit_2" },
    3: { type: "kitsune", passive: "spirit_3" }
  },
  owl: {
    1: { type: "owl", passive: "wisdom_1" },
    2: { type: "night_owl", passive: "wisdom_2" },
    3: { type: "phoenix", passive: "wisdom_3" }
  },
  kirin: {
    1: { type: "kirin", passive: "celestial_1" },
    2: { type: "divine_kirin", passive: "celestial_2" },
    3: { type: "celestial_kirin", passive: "celestial_3" }
  },
  leviathan: {
    1: { type: "leviathan", passive: "tank_1" },
    2: { type: "deep_leviathan", passive: "tank_2" },
    3: { type: "abyssal_leviathan", passive: "tank_3" }
  },
  bahamut: {
    1: { type: "bahamut", passive: "berserk_1" },
    2: { type: "dread_bahamut", passive: "berserk_2" },
    3: { type: "calamity_bahamut", passive: "berserk_3" }
  },
  garuda: {
    1: { type: "garuda", passive: "agility_1" },
    2: { type: "astral_garuda", passive: "agility_2" },
    3: { type: "solar_garuda", passive: "agility_3" }
  },
  // Fallback for mutants or unknown pets
  default: {
    1: { type: "pet", passive: "none" },
    2: { type: "pet_elite", passive: "none" },
    3: { type: "pet_legendary", passive: "none" }
  }
};

const PASSIVE_BUFFS = {
  none: { hp: 0, dmg: 0, dodge: 0, crit: 0 },
  atk_1: { hp: 0, dmg: 5, dodge: 0, crit: 0 },
  atk_2: { hp: 0, dmg: 10, dodge: 0, crit: 0 },
  atk_3: { hp: 0, dmg: 20, dodge: 0, crit: 5 },
  dodge_1: { hp: 0, dmg: 0, dodge: 3, crit: 0 },
  dodge_2: { hp: 0, dmg: 0, dodge: 6, crit: 0 },
  dodge_3: { hp: 0, dmg: 0, dodge: 10, crit: 5 },
  hp_1: { hp: 10, dmg: 0, dodge: 0, crit: 0 },
  hp_2: { hp: 20, dmg: 0, dodge: 0, crit: 0 },
  hp_3: { hp: 40, dmg: 5, dodge: 0, crit: 0 },
  spirit_1: { hp: 5, dmg: 2, dodge: 2, crit: 0 },
  spirit_2: { hp: 10, dmg: 5, dodge: 5, crit: 2 },
  spirit_3: { hp: 25, dmg: 12, dodge: 8, crit: 6 },
  wisdom_1: { hp: 5, dmg: 3, dodge: 0, crit: 2 },
  wisdom_2: { hp: 15, dmg: 7, dodge: 2, crit: 4 },
  wisdom_3: { hp: 30, dmg: 15, dodge: 5, crit: 8 },
  celestial_1: { hp: 30, dmg: 15, dodge: 8, crit: 8 },
  celestial_2: { hp: 60, dmg: 30, dodge: 15, crit: 15 },
  celestial_3: { hp: 120, dmg: 60, dodge: 25, crit: 25 },
  // Spesialisasi Mitologi (1 Stat Ekstrem)
  tank_1: { hp: 80, dmg: 2, dodge: 1, crit: 1 },
  tank_2: { hp: 160, dmg: 5, dodge: 2, crit: 2 },
  tank_3: { hp: 300, dmg: 10, dodge: 5, crit: 5 },
  berserk_1: { hp: 5, dmg: 35, dodge: 1, crit: 2 },
  berserk_2: { hp: 10, dmg: 70, dodge: 3, crit: 4 },
  berserk_3: { hp: 20, dmg: 140, dodge: 5, crit: 8 },
  agility_1: { hp: 10, dmg: 5, dodge: 20, crit: 15 },
  agility_2: { hp: 20, dmg: 10, dodge: 35, crit: 25 },
  agility_3: { hp: 40, dmg: 20, dodge: 55, crit: 40 }
};

/**
 * Update mood based on hunger and affection.
 * Returns true if mood changed.
 */
function evaluateMood(pet) {
  const oldMood = pet.mood;
  if (pet.hunger <= 10) {
    pet.mood = "angry";
  } else if (pet.hunger <= 40 || pet.affection <= 20) {
    pet.mood = "sad";
  } else if (pet.affection >= 80 && pet.hunger >= 80) {
    pet.mood = "happy";
  } else {
    pet.mood = "normal";
  }
  return oldMood !== pet.mood;
}

/**
 * Evaluates and applies evolution if level requirements are met.
 * Level 10 -> Stage 2
 * Level 20 -> Stage 3
 * Returns { evolved: boolean, oldName, newName }
 */
function evaluateEvolution(pet) {
  let expectedStage = 1;
  if (pet.petLevel >= 20) expectedStage = 3;
  else if (pet.petLevel >= 10) expectedStage = 2;

  if (pet.evolutionStage < expectedStage) {
    const baseType = EVOLUTION_TREE[pet.petType] ? pet.petType : Object.keys(EVOLUTION_TREE).find(k => pet.petType.includes(k)) || "default";
    const tree = EVOLUTION_TREE[baseType] || EVOLUTION_TREE["default"];
    
    const oldName = pet.petType;
    const stageData = tree[expectedStage];

    if (stageData) {
      pet.evolutionStage = expectedStage;
      pet.petType = stageData.type;
      pet.passiveSkill = stageData.passive;
      return { evolved: true, oldName, newName: pet.petType };
    }
  }

  return { evolved: false };
}

/**
 * Returns passive buffs from pet.
 * If pet is angry/sad, buffs are halved or 0.
 */
function getBuffs(pet) {
  if (!pet || !pet.isActive) return PASSIVE_BUFFS.none;

  const buff = PASSIVE_BUFFS[pet.passiveSkill] || PASSIVE_BUFFS.none;
  if (pet.mood === "angry" || pet.mood === "sad") {
     return { hp: Math.floor(buff.hp / 2), dmg: Math.floor(buff.dmg / 2), dodge: Math.floor(buff.dodge / 2), crit: Math.floor(buff.crit / 2) };
  }
  return buff;
}

module.exports = {
  evaluateMood,
  evaluateEvolution,
  getBuffs,
  PASSIVE_BUFFS
};
