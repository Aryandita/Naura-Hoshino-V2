"use strict";

const DuelRecord = require("../../models/DuelRecord");

// Mesin pertarungan antar pemain untuk /survival duel.
// Bonus kelas diambil dari dungeonCombat supaya nilainya selalu sama dengan
// pertarungan di dungeon, tidak lagi disalin ulang di dua tempat.

const { CLASS_BONUS } = require("./dungeonCombat");
const petActions = require("../helpers/petActions");

const BASE_HP = 100;
const HP_PER_LEVEL = 20;
const MIN_HP_AFTER = 20;
const MIN_STAMINA_AFTER = 20;

// Jurus khusus per kelas. staminaCost dipakai untuk mencegah spam skill.
const SKILLS = {
  warrior: {
    name: "Iron Slash",
    staminaCost: 15,
    multiplier: 1.8,
    kind: "physical",
  },
  mage: { name: "Fireball", staminaCost: 25, multiplier: 1.1, kind: "magic" },
  assassin: {
    name: "Shadow Strike",
    staminaCost: 20,
    multiplier: 2.2,
    kind: "sneak",
  },
  ranger: {
    name: "Piercing Arrow",
    staminaCost: 15,
    multiplier: 1.5,
    kind: "ranged",
  },
};

function bonusFor(className) {
  return (className && CLASS_BONUS[className]) || {};
}

function maxHpFor(survival, bonus) {
  const level = Number(survival.survival_level) || 1;
  return BASE_HP + level * HP_PER_LEVEL + (Number(bonus.maxHp) || 0);
}

/** Susun data satu petarung dari profil dan data survival-nya. */
function buildFighter(user, profile, survival, activePet = null) {
  const className = (survival.rpg_state && survival.rpg_state.class) || null;
  const bonus = bonusFor(className);

  const petBuffs = petActions.getBuffs(activePet);

  const maxHp = maxHpFor(survival, bonus) + petBuffs.hp;

  const strength =
    (Number(survival.strength) || 1) + (Number(bonus.strength) || 0);
  const agility =
    (Number(survival.agility) || 1) + (Number(bonus.agility) || 0);
  const intelligence =
    (Number(survival.intelligence) || 1) + (Number(bonus.intelligence) || 0);
  const luck = (Number(survival.luck) || 1) + (Number(bonus.luck) || 0);

  return {
    id: user.id,
    username: user.displayName || user.username,
    avatarUrl: user.displayAvatarURL({ extension: "png", size: 128 }),
    className,
    skill: className ? SKILLS[className] || null : null,
    maxHp,
    hp: Math.min(maxHp, Number(survival.hp) || maxHp),
    stamina: Number(survival.stamina) || 0,
    strength,
    agility,
    intelligence,
    luck,
    weaponDmg:
      (Number(profile.weapon_level) || 1) * 10 + strength * 3 + petBuffs.dmg,
    petBuffs: petBuffs,
  };
}

function dodgeChance(target) {
  return Math.min(
    45,
    target.agility * 1.5 + (target.petBuffs ? target.petBuffs.dodge : 0),
  );
}

function critChance(active) {
  return Math.min(
    50,
    active.luck * 1.5 + (active.petBuffs ? active.petBuffs.crit : 0),
  );
}

function roll(chancePercent) {
  return Math.random() * 100 < chancePercent;
}

function variance(value, spread = 0.3) {
  const low = 1 - spread / 2;
  return Math.floor(value * (low + Math.random() * spread));
}

/** Serangan biasa: menghindar dan kritikal ikut dihitung. */
function basicAttack(active, target) {
  if (roll(dodgeChance(target))) {
    active.stamina = Math.min(100, active.stamina + 8);
    return { damage: 0, dodged: true, crit: false, label: "serangan biasa" };
  }

  let damage = variance(active.weaponDmg);
  const crit = roll(critChance(active));
  if (crit) damage = Math.floor(damage * 1.6);

  target.hp = Math.max(0, target.hp - damage);
  active.stamina = Math.min(100, active.stamina + 8);

  return { damage, dodged: false, crit, label: "serangan biasa" };
}

/**
 * Jurus kelas. Mengembalikan `ok: false` bila kelas belum dipilih atau
 * staminanya kurang, supaya pemain tidak kehilangan giliran begitu saja.
 */
function useSkill(active, target) {
  const skill = active.skill;
  if (!skill) return { ok: false, reason: "no_class" };
  if (active.stamina < skill.staminaCost) {
    return { ok: false, reason: "no_stamina", needed: skill.staminaCost };
  }

  active.stamina = Math.max(0, active.stamina - skill.staminaCost);

  let damage;
  if (skill.kind === "magic") {
    damage = variance(
      active.intelligence * 4.5 + active.weaponDmg * skill.multiplier,
      0.25,
    );
  } else {
    damage = variance(
      active.weaponDmg * skill.multiplier,
      skill.kind === "sneak" ? 0.4 : 0.2,
    );
  }

  // Jurus penyelinap masih bisa dihindari, panah bisa meleset.
  if (skill.kind === "sneak" && roll(dodgeChance(target))) {
    return { ok: true, skill, damage: 0, dodged: true };
  }
  if (skill.kind === "ranged" && !roll(85 + active.agility * 2)) {
    return { ok: true, skill, damage: 0, missed: true };
  }

  target.hp = Math.max(0, target.hp - damage);
  return { ok: true, skill, damage, dodged: false };
}

/** Kalimat pertarungan. Naura yang menarasikan, jadi nadanya tetap hangat. */
function narrate(active, target, result) {
  if (result.skill) {
    if (result.dodged)
      return `${target.username} berhasil lolos dari ${result.skill.name} milik ${active.username}!`;
    if (result.missed)
      return `${result.skill.name} dari ${active.username} meleset, ${target.username} terlalu gesit!`;
    return `${active.username} melepas ${result.skill.name} dan melukai ${target.username} sebesar ${result.damage} HP!`;
  }

  if (result.dodged)
    return `${target.username} menghindar tepat waktu dari serangan ${active.username}!`;
  if (result.crit)
    return `KRITIKAL! ${active.username} menghantam ${target.username} sebesar ${result.damage} HP!`;
  return `${active.username} menyerang ${target.username} sebesar ${result.damage} HP!`;
}

function calculateElo(winnerMmr, loserMmr) {
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserMmr - winnerMmr) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerMmr - loserMmr) / 400));

  const winnerDiff = Math.round(K * (1 - expectedWinner));
  const loserDiff = Math.round(K * (0 - expectedLoser));

  return { winnerDiff, loserDiff };
}

/** Simpan kondisi akhir kedua petarung. Tidak ada yang benar-benar mati. */
async function settle(
  p1Survival,
  p1State,
  p2Survival,
  p2State,
  isRanked = false,
) {
  p1Survival.hp = Math.max(MIN_HP_AFTER, Math.floor(p1State.hp));
  p1Survival.stamina = Math.max(MIN_STAMINA_AFTER, Math.floor(p1State.stamina));
  await p1Survival.save();

  p2Survival.hp = Math.max(MIN_HP_AFTER, Math.floor(p2State.hp));
  p2Survival.stamina = Math.max(MIN_STAMINA_AFTER, Math.floor(p2State.stamina));
  await p2Survival.save();

  let eloChanges = null;

  if (isRanked) {
    const p1Id = p1State.id;
    const p2Id = p2State.id;

    // Tentukan siapa yang menang
    let winnerId = p1State.hp > 0 ? p1Id : p2Id;
    let loserId = p1State.hp > 0 ? p2Id : p1Id;

    // Jika seri (keduanya 0 HP atau time out), anggap tidak ada perubahan MMR drastis,
    // tapi untuk duel, biasanya ada satu yang HP nya <=0 duluan.

    let [wRecord] = await DuelRecord.findOrCreate({
      where: { userId: winnerId },
    });
    let [lRecord] = await DuelRecord.findOrCreate({
      where: { userId: loserId },
    });

    const { winnerDiff, loserDiff } = calculateElo(wRecord.mmr, lRecord.mmr);

    wRecord.mmr += winnerDiff;
    wRecord.matchesPlayed += 1;
    await wRecord.save({ fields: ["mmr", "matchesPlayed", "wins", "kills"] });

    lRecord.mmr = Math.max(0, lRecord.mmr + loserDiff); // loserDiff is negative
    lRecord.matchesPlayed += 1;
    lRecord.losses += 1;
    lRecord.deaths += 1;
    await lRecord.save({
      fields: ["mmr", "matchesPlayed", "losses", "deaths"],
    });

    eloChanges = {
      winner: { id: winnerId, diff: winnerDiff, mmr: wRecord.mmr },
      loser: { id: loserId, diff: loserDiff, mmr: lRecord.mmr },
    };
  }

  return eloChanges;
}

module.exports = {
  SKILLS,
  BASE_HP,
  HP_PER_LEVEL,
  MIN_HP_AFTER,
  MIN_STAMINA_AFTER,
  bonusFor,
  maxHpFor,
  buildFighter,
  basicAttack,
  useSkill,
  narrate,
  settle,
  calculateElo,
};
