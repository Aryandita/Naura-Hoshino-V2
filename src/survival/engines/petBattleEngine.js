"use strict";

const cacheManager = require("../../managers/cacheManager");
const survivalLeveling = require("./survivalLeveling");
const { addItemsAtomic } = require("./inventoryHelper");
const { PASSIVE_BUFFS } = require("../helpers/petActions");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const survivalUI = require("../../utils/survivalUIHelper");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const PET_ARENA_STATE = "petArena";
const XP_PER_LEVEL = 100;

const SPECIES_BASE_STATS = {
  wolf: { hp: 130, atk: 28, def: 10, spd: 14, crit: 14, dodge: 8, emoji: "🐺", name: "Serigala Rimba" },
  cat: { hp: 110, atk: 25, def: 8, spd: 19, crit: 20, dodge: 16, emoji: "🐱", name: "Kucing Bayangan" },
  dragon: { hp: 170, atk: 35, def: 16, spd: 10, crit: 12, dodge: 5, emoji: "🐉", name: "Naga Langit" },
  fox: { hp: 120, atk: 26, def: 9, spd: 17, crit: 15, dodge: 14, emoji: "🦊", name: "Rubah Roh" },
  owl: { hp: 115, atk: 29, def: 10, spd: 15, crit: 18, dodge: 11, emoji: "🦉", name: "Burung Hantu Bijak" },
  kirin: { hp: 160, atk: 32, def: 14, spd: 13, crit: 14, dodge: 9, emoji: "🦄", name: "Kirin Suci" },
  leviathan: { hp: 190, atk: 26, def: 18, spd: 8, crit: 8, dodge: 4, emoji: "🌊", name: "Leviathan Samudra" },
  bahamut: { hp: 140, atk: 40, def: 11, spd: 12, crit: 22, dodge: 6, emoji: "🔥", name: "Bahamut Kehancuran" },
  garuda: { hp: 125, atk: 30, def: 9, spd: 21, crit: 16, dodge: 18, emoji: "🦅", name: "Garuda Angkasa" },
  default: { hp: 125, atk: 26, def: 10, spd: 13, crit: 12, dodge: 8, emoji: "🐾", name: "Peliharaan Sahabat" },
};

function getDivisionTier(mmr) {
  const rating = parseInt(mmr, 10) || 1000;
  if (rating >= 2200) return { name: "Master Rimba", badge: "👑", color: "#F59E0B" };
  if (rating >= 1900) return { name: "Diamond", badge: "💠", color: "#06B6D4" };
  if (rating >= 1600) return { name: "Platinum", badge: "💎", color: "#38BDF8" };
  if (rating >= 1300) return { name: "Gold", badge: "🥇", color: "#EAB308" };
  if (rating >= 1100) return { name: "Silver", badge: "🥈", color: "#94A3B8" };
  return { name: "Bronze", badge: "🥉", color: "#B45309" };
}

/**
 * Menghitung stat tempur lengkap pet dari spesies, level, evolusi, pasif, dan mood.
 */
function getPetCombatStats(pet) {
  const speciesKey = (pet.petType || "default").toLowerCase();
  const base = SPECIES_BASE_STATS[speciesKey] || SPECIES_BASE_STATS.default;

  const level = Math.max(1, parseInt(pet.petLevel, 10) || 1);
  const stage = Math.max(1, parseInt(pet.evolutionStage, 10) || 1);

  // Bonus pertambahan level
  let hp = base.hp + (level - 1) * 12;
  let atk = base.atk + (level - 1) * 3;
  let def = base.def + (level - 1) * 1.5;
  let spd = base.spd + (level - 1) * 0.8;
  let crit = base.crit;
  let dodge = base.dodge;

  // Pengali tahap evolusi
  const stageMulti = stage === 3 ? 1.5 : stage === 2 ? 1.25 : 1.0;
  hp = Math.round(hp * stageMulti);
  atk = Math.round(atk * stageMulti);
  def = Math.round(def * stageMulti);

  // Pasif skill jika ada
  if (pet.passiveSkill && PASSIVE_BUFFS[pet.passiveSkill]) {
    const buff = PASSIVE_BUFFS[pet.passiveSkill];
    hp += buff.hp || 0;
    atk += buff.dmg || 0;
    dodge += buff.dodge || 0;
    crit += buff.crit || 0;
  }

  // Pengaruh Mood
  const mood = (pet.mood || "normal").toLowerCase();
  if (mood === "ascended" || mood === "energized") {
    atk = Math.round(atk * 1.15);
    crit += 5;
  } else if (mood === "happy") {
    hp = Math.round(hp * 1.05);
    atk = Math.round(atk * 1.05);
  } else if (mood === "angry") {
    atk = Math.round(atk * 1.1);
    def = Math.max(1, Math.round(def * 0.9));
  } else if (mood === "sad") {
    spd = Math.max(1, Math.round(spd * 0.9));
  }

  // Pengaruh Rasa Lapar
  const hunger = parseInt(pet.hunger, 10) || 100;
  if (hunger < 25) {
    hp = Math.round(hp * 0.8);
    atk = Math.round(atk * 0.8);
    def = Math.round(def * 0.8);
  }

  return {
    name: pet.petName || base.name,
    species: speciesKey,
    emoji: base.emoji,
    level,
    stage,
    hp,
    maxHp: hp,
    atk,
    def: Math.round(def),
    spd: Math.round(spd),
    crit: Math.min(60, Math.round(crit)),
    dodge: Math.min(45, Math.round(dodge)),
    mood,
  };
}

async function getPetArenaProfile(userId) {
  const profile = await cacheManager.getUserProfile(userId);
  const rpgState = profile?.rpg_state || {};
  const arenaData = rpgState[PET_ARENA_STATE] || {
    mmr: 1000,
    wins: 0,
    losses: 0,
    streak: 0,
    bestMmr: 1000,
    history: [],
  };
  return arenaData;
}

async function updatePetArenaProfile(userId, arenaData) {
  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (st) => {
    st[PET_ARENA_STATE] = arenaData;
    return st;
  });
}

/**
 * Menghasilkan penantang liar AI dengan MMR yang seimbang dengan pemain.
 */
function generateWildChallenger(playerMmr = 1000) {
  const speciesKeys = Object.keys(SPECIES_BASE_STATS).filter((k) => k !== "default");
  const randomKey = speciesKeys[Math.floor(Math.random() * speciesKeys.length)];
  const base = SPECIES_BASE_STATS[randomKey];

  // Hitung level bot seimbang dengan MMR (1000 MMR = Lv 5)
  const botLevel = Math.max(1, Math.round((playerMmr - 800) / 40) + Math.floor(Math.random() * 3));
  const botMmr = Math.max(500, playerMmr + Math.floor(Math.random() * 80) - 40);

  const mockPet = {
    petType: randomKey,
    petName: `Liar: ${base.name}`,
    petLevel: botLevel,
    evolutionStage: botLevel >= 20 ? 3 : botLevel >= 10 ? 2 : 1,
    mood: "energized",
    hunger: 100,
  };

  const stats = getPetCombatStats(mockPet);

  return {
    isNpc: true,
    ownerName: "Alam Liar Sukamaju",
    mmr: botMmr,
    pet: mockPet,
    stats,
  };
}

/**
 * Simulasi pertarungan giliran otomatis antar dua pet.
 */
function simulatePetBattle(fighterA, fighterB, nameA = "Pet A", nameB = "Pet B") {
  const pA = { ...fighterA, curHp: fighterA.hp };
  const pB = { ...fighterB, curHp: fighterB.hp };

  const roundLogs = [];
  const maxRounds = 10;
  let round = 1;
  let winner = null;
  let loser = null;

  while (round <= maxRounds && pA.curHp > 0 && pB.curHp > 0) {
    const isAFaster = pA.spd >= pB.spd || Math.random() < 0.5;
    const first = isAFaster ? pA : pB;
    const second = isAFaster ? pB : pA;

    // --- Turn 1: Pet tercepat menyerang ---
    const isDodge1 = Math.random() * 100 < second.dodge;
    if (isDodge1) {
      roundLogs.push(`Ronde ${round}: ${second.emoji} **${second.name}** dengan gesit menghindari serangan ${first.name}! 💨`);
    } else {
      const isCrit = Math.random() * 100 < first.crit;
      const rawDmg = first.atk * (isCrit ? 1.5 : 1.0);
      const netDmg = Math.max(6, Math.round(rawDmg - second.def * 0.45));
      second.curHp = Math.max(0, second.curHp - netDmg);

      const critBadge = isCrit ? " ⚡ **CRITICAL HIT!**" : "";
      roundLogs.push(
        `Ronde ${round}: ${first.emoji} **${first.name}** menyerang ${second.name} sebesar **${netDmg} DMG**${critBadge} (Sisa HP: ${second.curHp}/${second.maxHp})`,
      );
    }

    if (second.curHp <= 0) {
      winner = isAFaster ? "A" : "B";
      loser = isAFaster ? "B" : "A";
      break;
    }

    // --- Turn 2: Pet kedua membalas ---
    const isDodge2 = Math.random() * 100 < first.dodge;
    if (isDodge2) {
      roundLogs.push(`Ronde ${round}: ${first.emoji} **${first.name}** berkelit dari serangan balasan ${second.name}! 💨`);
    } else {
      const isCrit = Math.random() * 100 < second.crit;
      const rawDmg = second.atk * (isCrit ? 1.5 : 1.0);
      const netDmg = Math.max(6, Math.round(rawDmg - first.def * 0.45));
      first.curHp = Math.max(0, first.curHp - netDmg);

      const critBadge = isCrit ? " ⚡ **CRITICAL HIT!**" : "";
      roundLogs.push(
        `Ronde ${round}: Balasan dari ${second.emoji} **${second.name}** menghasilkan **${netDmg} DMG**${critBadge} ke ${first.name} (Sisa HP: ${first.curHp}/${first.maxHp})`,
      );
    }

    if (first.curHp <= 0) {
      winner = isAFaster ? "B" : "A";
      loser = isAFaster ? "A" : "B";
      break;
    }

    round++;
  }

  // Jika sampai ronde 10 belum ada yang tumbang, pemenang adalah yang persentase sisa HP-nya lebih tinggi
  if (!winner) {
    const pctA = pA.curHp / pA.maxHp;
    const pctB = pB.curHp / pB.maxHp;
    if (pctA >= pctB) {
      winner = "A";
      loser = "B";
      roundLogs.push(`⏱️ Waktu habis! ${pA.emoji} **${pA.name}** menang berdasarkan sisa vitalitas yang lebih tinggi.`);
    } else {
      winner = "B";
      loser = "A";
      roundLogs.push(`⏱️ Waktu habis! ${pB.emoji} **${pB.name}** menang berdasarkan sisa vitalitas yang lebih tinggi.`);
    }
  }

  return {
    winner,
    loser,
    rounds: Math.min(round, maxRounds),
    roundLogs,
    finalHpA: pA.curHp,
    finalHpB: pB.curHp,
    maxHpA: pA.maxHp,
    maxHpB: pB.maxHp,
  };
}

/**
 * Memproses hasil pertarungan, pembaruan rating MMR, hadiah, dan level pet.
 */
async function processPetBattle(userId, userPetRecord, opponentData) {
  const userStats = getPetCombatStats(userPetRecord);
  const oppStats = opponentData.stats;

  const battleRes = simulatePetBattle(
    userStats,
    oppStats,
    userPetRecord.petName || userStats.name,
    opponentData.pet.petName || oppStats.name,
  );

  const isUserVictory = battleRes.winner === "A";

  // Hitung Elo Rating MMR
  const userArena = await getPetArenaProfile(userId);
  const playerMmr = userArena.mmr || 1000;
  const oppMmr = opponentData.mmr || 1000;

  const expectedScore = 1 / (1 + Math.pow(10, (oppMmr - playerMmr) / 400));
  const actualScore = isUserVictory ? 1 : 0;
  let mmrDelta = Math.round(32 * (actualScore - expectedScore));

  if (isUserVictory && mmrDelta < 12) mmrDelta = 12;
  if (!isUserVictory && mmrDelta > -8) mmrDelta = -8;

  const newMmr = Math.max(500, playerMmr + mmrDelta);
  const newWins = isUserVictory ? (userArena.wins || 0) + 1 : userArena.wins || 0;
  const newLosses = !isUserVictory ? (userArena.losses || 0) + 1 : userArena.losses || 0;
  const newStreak = isUserVictory ? (userArena.streak || 0) + 1 : 0;
  const bestMmr = Math.max(newMmr, userArena.bestMmr || 1000);

  const division = getDivisionTier(newMmr);

  await updatePetArenaProfile(userId, {
    mmr: newMmr,
    wins: newWins,
    losses: newLosses,
    streak: newStreak,
    bestMmr,
    lastBattleAt: new Date(),
  });

  // Hadiah & EXP
  const rewardNsf = isUserVictory ? 200 : 50;
  const rewardPetXp = isUserVictory ? 45 : 15;
  const rewardPlayerXp = isUserVictory ? 60 : 20;

  if (rewardNsf > 0) {
    await cacheManager.incrementUserSurvival(userId, "starFragments", rewardNsf);
    await addItemsAtomic(userId, [
      {
        id: "star_fragment",
        name: "Naura Star Fragment",
        amount: rewardNsf,
        icon: "💎",
        note: `Hadiah Pet Battle Arena [${division.name}]`,
      },
    ]);
  }

  await survivalLeveling.addPlayerXP(userId, rewardPlayerXp);

  // Update EXP pet di database
  let petLeveledUp = false;
  let newPetLvl = userPetRecord.petLevel || 1;
  let newPetExp = (userPetRecord.petExp || 0) + rewardPetXp;

  if (newPetExp >= XP_PER_LEVEL) {
    newPetExp -= XP_PER_LEVEL;
    newPetLvl += 1;
    petLeveledUp = true;
  }

  userPetRecord.petExp = newPetExp;
  userPetRecord.petLevel = newPetLvl;
  userPetRecord.hunger = Math.max(5, (userPetRecord.hunger || 100) - 8);
  await userPetRecord.save({ fields: ["petExp", "petLevel", "hunger"] });

  // Panggil auto-tracking quest
  try {
    const { recordQuestProgress } = require("./dailyQuestEngine");
    await recordQuestProgress(userId, "pet_battle", 1);
  } catch (qErr) {
    // Non-blocking
  }

  return {
    isVictory: isUserVictory,
    battleRes,
    mmrDelta,
    newMmr,
    division,
    rewards: {
      nsf: rewardNsf,
      petXp: rewardPetXp,
      playerXp: rewardPlayerXp,
    },
    petLeveledUp,
    newPetLevel: newPetLvl,
    userStats,
    oppStats,
    opponentName: opponentData.ownerName,
  };
}

/**
 * Menyusun render UI kartu Discord Components V2 hasil pertarungan pet arena.
 */
function renderPetBattleCard(battleResult, user, lang = "id") {
  const isEn = lang === "en";
  const { isVictory, battleRes, mmrDelta, newMmr, division, rewards, petLeveledUp, userStats, oppStats, opponentName } = battleResult;

  const titleEmoji = isVictory ? "🏆" : "☠️";
  const titleText = isEn
    ? (isVictory ? "Pet Battle Arena Victory!" : "Pet Battle Arena Defeat")
    : (isVictory ? "Kemenangan Pet Battle Arena!" : "Kekalahan di Pet Battle Arena");

  const deltaText = mmrDelta > 0 ? `+${mmrDelta}` : `${mmrDelta}`;
  const logSnippet = battleRes.roundLogs.slice(-4).join("\n");

  const hpBarA = survivalUI.buildVitalsBar({
    current: battleRes.finalHpA,
    target: battleRes.maxHpA,
    length: 8,
  });

  const hpBarB = survivalUI.buildVitalsBar({
    current: battleRes.finalHpB,
    target: battleRes.maxHpB,
    length: 8,
  });

  const descLines = [
    `**${userStats.emoji} ${userStats.name}** vs **${oppStats.emoji} ${oppStats.name}** (Milik: *${opponentName}*)`,
    "",
    `> **${userStats.name}:** \`${hpBarA.bar}\` (${battleRes.finalHpA}/${battleRes.maxHpA} HP)`,
    `> **${oppStats.name}:** \`${hpBarB.bar}\` (${battleRes.finalHpB}/${battleRes.maxHpB} HP)`,
    "",
    "**📜 Cuplikan Ronde Penentu:**",
    logSnippet,
    "",
    `📊 **Peringkat MMR:** \`${deltaText} MMR\` ➔ **${newMmr} MMR** (${division.badge} Divisi: **${division.name}**)`,
    `🎁 **Hadiah Diperoleh:** 💎 +${rewards.nsf} NSF • 🐾 +${rewards.petXp} Pet EXP • 🌟 +${rewards.playerXp} Player XP`,
  ];

  if (petLeveledUp) {
    descLines.push("", `🎉 **LEVEL UP!** Peliharaanmu naik ke **Level ${battleResult.newPetLevel}**! Atribut bertambah kuat.`);
  }

  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_petarena_match")
      .setLabel("Tanding Lagi")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("⚔️"),
    new ButtonBuilder()
      .setCustomId("btn_petarena_leaderboard")
      .setLabel("Papan Peringkat")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏆"),
  );

  return buildContainerV2({
    accentColorHex: isVictory ? survivalUI.survivalColors.moss : survivalUI.survivalColors.danger,
    authorName: `NAURA WILDS • Pet Battle Arena (${division.name})`,
    title: `${titleEmoji} ${titleText}`,
    iconURL: user.displayAvatarURL?.() || null,
    description: descLines.join("\n"),
    buttonsRow: [buttonsRow],
    footerText: survivalUI.getFooter(),
  });
}

module.exports = {
  PET_ARENA_STATE,
  SPECIES_BASE_STATS,
  getDivisionTier,
  getPetCombatStats,
  getPetArenaProfile,
  updatePetArenaProfile,
  generateWildChallenger,
  simulatePetBattle,
  processPetBattle,
  renderPetBattleCard,
};
