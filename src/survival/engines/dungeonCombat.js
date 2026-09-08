"use strict";

// Mesin tempur Infinite Dungeon: bonus kelas, penskalaan musuh, skill, dan
// tabel jarahan. Dipisahkan dari subcommand supaya rumusnya bisa dibaca dan
// diuji tanpa menyentuh urusan tampilan.
//
// Parameter `multiplier` dipakai oleh Dungeon Special Pass dari kota: musuhnya
// dua kali lebih tebal, tetapi jarahan dan hadiahnya juga dua kali lipat.

const helpers = require("../helpers/craftHelpers");
const { calculateMaxHp } = require("./survivalLeveling");

const CLASS_BONUS = {
  warrior: { maxHp: 50, strength: 5, agility: 0, intelligence: 0, luck: 0 },
  mage: { maxHp: 0, strength: 0, agility: 3, intelligence: 8, luck: 0 },
  assassin: { maxHp: 0, strength: 0, agility: 8, intelligence: 0, luck: 5 },
  ranger: { maxHp: 0, strength: 0, agility: 5, intelligence: 0, luck: 8 },
};

const SKILLS = {
  warrior: { name: "Iron Slash", cost: 15 },
  mage: { name: "Fireball", cost: 25 },
  assassin: { name: "Shadow Strike", cost: 20 },
  ranger: { name: "Piercing Arrow", cost: 15 },
};

// Nama cadangan untuk jarahan yang belum terdaftar di katalog item.
const LOOT_NAMES = {
  demon_horn: "Tanduk Iblis",
  dragon_scale: "Sisik Naga",
  cursed_eye: "Mata Terkutuk",
  mega_potion: "Ramuan Mega",
  naura_shard: "Serpih Naura",
  goblin_ear: "Telinga Goblin",
  leather: "Kulit Monster",
  glass_shard: "Pecahan Kaca",
  copper_ore: "Bijih Tembaga",
};

// Versi lama memakai SATU angka acak untuk semua baris, jadi siapa pun yang
// mendapat Sisik Naga otomatis mendapat Tanduk Iblis juga. Sekarang setiap
// baris dilempar sendiri-sendiri.
//
// Kulit, bijih tembaga, dan pecahan kaca sengaja dimasukkan karena resep
// peleburan di tungku Bagas membutuhkannya dan sebelumnya tidak ada sumbernya.
const BOSS_LOOT = [
  { id: "demon_horn", chance: 20 },
  { id: "dragon_scale", chance: 12 },
  { id: "naura_shard", chance: 8 },
  { id: "cursed_eye", chance: 5 },
  { id: "mega_potion", chance: 100 },
];

const FLOOR_LOOT = [
  { id: "leather", chance: 40 },
  { id: "goblin_ear", chance: 35 },
  { id: "copper_ore", chance: 25 },
  { id: "iron_ore", chance: 15 },
  { id: "glass_shard", chance: 10 },
];

const BOSS_EVERY = 10;
const FREE_FLOOR_LIMIT = 50;

function lootName(id) {
  const known = helpers.nameOf(id);
  if (known && known !== id) return known;
  return LOOT_NAMES[id] || id;
}

function bonusOf(userClass) {
  return (
    CLASS_BONUS[userClass] || {
      maxHp: 0,
      strength: 0,
      agility: 0,
      intelligence: 0,
      luck: 0,
    }
  );
}

function statsFor(survival, profile) {
  const rpgState = survival.rpg_state || {};
  const userClass = rpgState.class || null;
  const bonus = bonusOf(userClass);

  const playerMaxHp = calculateMaxHp(survival, bonus.maxHp);
  const strength = (survival.strength || 1) + bonus.strength;
  const agility = (survival.agility || 1) + bonus.agility;
  const intelligence = (survival.intelligence || 1) + bonus.intelligence;
  const luck = (survival.luck || 1) + bonus.luck;

  const { getPathSynergy } = require("./skillTreeEngine");
  const synergy = getPathSynergy(survival);

  return {
    userClass,
    skill: SKILLS[userClass] || null,
    playerMaxHp,
    strength,
    agility,
    intelligence,
    luck,
    weaponDmg: (profile.weapon_level || 1) * 10 + strength * 3,
    dodgeChance: Math.min(50, agility * 2),
    synergy,
  };
}

function enemyFor(floor, diffConfig, multiplier = 1) {
  const isBoss = floor % BOSS_EVERY === 0;

  let type = "slime";
  if (isBoss) type = "demon";
  else if (floor > 20) type = "dragon";
  else if (floor > 10) type = "goblin";

  let maxHp = Math.floor(50 * Math.pow(1.2, Math.floor(floor / 2)));
  if (isBoss) maxHp *= 3;
  if (diffConfig && diffConfig.extreme) maxHp = Math.floor(maxHp * 1.5);
  maxHp = Math.floor(maxHp * (multiplier || 1));

  const special = (multiplier || 1) > 1;
  let name = isBoss
    ? "Raja Iblis Lantai " + floor
    : type.toUpperCase() + " Lantai " + floor;
  if (special) name = name + " (Segel Spesial)";

  return { isBoss, type, name, maxHp, special };
}

function rollLoot(floor, luck, multiplier = 1) {
  const isBoss = floor % BOSS_EVERY === 0;
  const table = isBoss ? BOSS_LOOT : FLOOR_LOOT;
  const luckMod = Math.min(25, (luck || 1) * 0.5);
  const stack = Math.max(1, Math.floor(multiplier || 1));

  const loot = [];
  for (const row of table) {
    if (Math.random() * 100 < row.chance + luckMod) {
      loot.push({ id: row.id, name: lootName(row.id), amount: stack });
    }
  }
  return loot;
}

function rewardsFor(floor, diffConfig, multiplier = 1) {
  const isBoss = floor % BOSS_EVERY === 0;
  const coinMultiplier = diffConfig ? diffConfig.coinMultiplier : 1;
  const expMultiplier = diffConfig ? diffConfig.expMultiplier : 1;
  const bonus = multiplier || 1;
  return {
    money: Math.floor(
      (isBoss ? floor * 100 : floor * 20) * coinMultiplier * bonus,
    ),
    xp: Math.floor((isBoss ? floor * 50 : floor * 10) * expMultiplier * bonus),
  };
}

// Serangan biasa maupun skill dihitung di satu tempat supaya log dan angkanya
// tidak pernah berbeda antara tampilan dan perhitungan.
function resolveAttack({ useSkill, stats, profile }) {
  const roll = 0.8 + Math.random() * 0.4;
  const base = stats.weaponDmg;

  if (!useSkill || !stats.skill) {
    const damage = Math.floor(base * roll);
    return {
      damage,
      cost: 0,
      log: "Kamu menebas musuh dan memberikan **" + damage + "** damage!",
    };
  }

  const synergyMult =
    stats?.synergy && stats.synergy.hasSynergy ? stats.synergy.multiplier : 1.0;
  const cost = stats.skill.cost;

  if (stats.userClass === "warrior") {
    const damage = Math.floor(base * 1.8 * roll * synergyMult);
    const tag =
      synergyMult > 1
        ? "[Iron Slash \u2022 Berserker Synergy!]"
        : "[Iron Slash]";
    return {
      damage,
      cost,
      log:
        tag + " Tebasanmu membelah perisai musuh, **" + damage + "** damage!",
    };
  }

  if (stats.userClass === "mage") {
    const magic = (profile.weapon_level || 1) * 8 + stats.intelligence * 4;
    const damage = Math.floor(magic * 2.2 * roll * synergyMult);
    const tag =
      synergyMult > 1 ? "[Fireball \u2022 Arcane Synergy!]" : "[Fireball]";
    return {
      damage,
      cost,
      log: tag + " Bola api raksasa meledak, **" + damage + "** damage!",
    };
  }

  if (stats.userClass === "assassin") {
    const missThreshold = synergyMult > 1 ? 50 : 70;
    if (Math.random() * 100 >= missThreshold + stats.agility) {
      return {
        damage: 0,
        cost,
        log: "[Shadow Strike] Serangan bayanganmu meleset. Sabar, ya!",
      };
    }
    const isCrit = Math.random() * 100 < 30 + stats.luck * 2;
    const damage = Math.floor(base * (isCrit ? 2.5 : 1.2) * roll);
    const tag =
      synergyMult > 1
        ? "[Shadow Strike \u2022 Phantom Synergy!]"
        : "[Shadow Strike]";
    return {
      damage,
      cost,
      log: isCrit
        ? tag +
          " [KRITIS!] Tebasan mematikan dari balik bayangan, **" +
          damage +
          "** damage!"
        : tag +
          " Tebasan cepat dari balik bayangan, **" +
          damage +
          "** damage!",
    };
  }

  if (Math.random() * 100 >= 85 + stats.agility * 2) {
    return {
      damage: 0,
      cost,
      log: "[Piercing Arrow] Musuhnya terlalu gesit, panahmu meleset!",
    };
  }
  const damage = Math.floor(base * 1.5 * (0.9 + Math.random() * 0.2));
  return {
    damage,
    cost,
    log:
      "[Piercing Arrow] Panahmu menembus pertahanan musuh, **" +
      damage +
      "** damage!",
  };
}

function enemyDamage(floor, isBoss, diffConfig, multiplier = 1) {
  let damage = Math.floor(
    (isBoss ? floor * 5 : floor * 2) * (0.8 + Math.random() * 0.4),
  );
  if (diffConfig && diffConfig.extreme) damage = Math.floor(damage * 1.5);
  // Musuh segel spesial memukul lebih keras, tapi tidak sampai dua kali penuh
  // supaya pemain masih punya kesempatan bertahan.
  if ((multiplier || 1) > 1) damage = Math.floor(damage * 1.5);
  return damage;
}

module.exports = {
  CLASS_BONUS,
  SKILLS,
  BOSS_LOOT,
  FLOOR_LOOT,
  BOSS_EVERY,
  FREE_FLOOR_LIMIT,
  lootName,
  statsFor,
  enemyFor,
  rollLoot,
  rewardsFor,
  resolveAttack,
  enemyDamage,
};
