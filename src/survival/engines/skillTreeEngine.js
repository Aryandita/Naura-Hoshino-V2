"use strict";

const cacheManager = require("../../managers/cacheManager");
const leveling = require("./survivalLeveling");

const VALID_STATS = ["strength", "agility", "intelligence", "luck", "hp"];

/**
 * Mengambil jumlah Stat Points yang belum diinvestasikan pemain.
 *
 * @param {object} survival - Objek data UserSurvival
 * @returns {number} Jumlah unspent points
 */
function getUnspentPoints(survival) {
  const rpgState = survival?.rpg_state || {};
  return Math.max(0, parseInt(rpgState.unspent_points, 10) || 0);
}

/**
 * Menghitung sinergi antara Life Stat tertinggi dengan Combat Path (Kelas).
 *
 * @param {object} survival - Objek data UserSurvival
 * @returns {{ hasSynergy: boolean, className: string|null, dominantStat: string, label: string, bonusDescription: string, multiplier: number }}
 */
function getPathSynergy(survival) {
  const rpgState = survival?.rpg_state || {};
  const className = rpgState.class || null;

  const str = Number(survival?.strength || 1);
  const agi = Number(survival?.agility || 1);
  const int = Number(survival?.intelligence || 1);
  const lck = Number(survival?.luck || 1);

  // Cari stat tertinggi
  let dominantStat = "strength";
  let maxVal = str;

  if (agi > maxVal) {
    dominantStat = "agility";
    maxVal = agi;
  }
  if (int > maxVal) {
    dominantStat = "intelligence";
    maxVal = int;
  }
  if (lck > maxVal) {
    dominantStat = "luck";
    maxVal = lck;
  }

  const SYNERGY_MAP = {
    warrior: {
      requiredStat: "strength",
      label: "Berserker Resonance \u2694\uFE0F",
      bonusDescription: "+15% Daya Rusak Fisik Tebasan Pedang (Iron Slash)",
      multiplier: 1.15,
    },
    mage: {
      requiredStat: "intelligence",
      label: "Arcane Singularity \uD83D\uDD2E",
      bonusDescription: "+20% Daya Ledak Sihir Elemen (Fireball)",
      multiplier: 1.2,
    },
    assassin: {
      requiredStat: "agility",
      label: "Shadow Phantom \uD83D\uDDE1\uFE0F",
      bonusDescription:
        "+20% Akurasi Serangan Bayangan (Shadow Strike Tak Meleset)",
      multiplier: 1.2,
    },
    ranger: {
      requiredStat: "luck",
      label: "Fortune Hunter \uD83C\uDFF9",
      bonusDescription: "+25% Peluang Drop Jarahan Langka Dungeon & Boss",
      multiplier: 1.25,
    },
  };

  if (className && SYNERGY_MAP[className]) {
    const config = SYNERGY_MAP[className];
    const isMatched = dominantStat === config.requiredStat;
    return {
      hasSynergy: isMatched,
      className,
      dominantStat,
      label: config.label,
      bonusDescription: config.bonusDescription,
      multiplier: isMatched ? config.multiplier : 1.0,
    };
  }

  return {
    hasSynergy: false,
    className: null,
    dominantStat,
    label: "Belum Memilih Path",
    bonusDescription:
      "Pilih kelas di /survival class untuk mengaktifkan Path Synergy.",
    multiplier: 1.0,
  };
}

/**
 * Menghitung efektivitas dan bonus Life Stats di dunia biasa (pekerjaan, panen, dll).
 */
function getLifeStatBonuses(survival) {
  const str = Number(survival?.strength || 1);
  const agi = Number(survival?.agility || 1);
  const int = Number(survival?.intelligence || 1);
  const lck = Number(survival?.luck || 1);

  return {
    salaryBonusPercent: Math.min(100, Math.floor(int * 1.5)),
    craftingSpeedBonusPercent: Math.min(50, Math.floor(str * 1.2)),
    travelDiscountPercent: Math.min(40, Math.floor(agi * 1.0)),
    resourceDropBonusPercent: Math.min(75, Math.floor(lck * 1.2)),
  };
}

/**
 * Menginvestasikan 1 Stat Point ke salah satu atribut kehidupan pemain.
 *
 * @param {string} userId - ID Discord User
 * @param {string} statName - strength | agility | intelligence | luck | hp
 * @returns {Promise<{ success: boolean, reason?: string, statName?: string, newValue?: number, remainingPoints?: number }>}
 */
async function investPoint(userId, statName) {
  const statKey = String(statName || "")
    .toLowerCase()
    .trim();
  if (!VALID_STATS.includes(statKey)) {
    return { success: false, reason: "INVALID_STAT" };
  }

  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival) {
    return { success: false, reason: "NO_PROFILE" };
  }

  const unspent = getUnspentPoints(survival);
  if (unspent < 1) {
    return { success: false, reason: "NO_POINTS" };
  }

  const currentLevel = survival.survival_level || 1;
  const statCap = leveling.getMaxStatCap(currentLevel);

  if (statKey !== "hp") {
    const currentVal = Number(survival[statKey] || 1);
    if (currentVal >= statCap) {
      return {
        success: false,
        reason: "STAT_CAPPED",
        cap: statCap,
        currentVal,
      };
    }
  }

  // Kurangi 1 point secara aman lewat mutateUserSurvivalJson
  await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
    const s = state || {};
    s.unspent_points = Math.max(0, (s.unspent_points || 1) - 1);
    return s;
  });

  // Tambahkan stat
  const addValue = statKey === "hp" ? 20 : 1;
  await cacheManager.incrementUserSurvival(userId, {
    [statKey]: addValue,
  });

  const updatedSurvival = await cacheManager.getUserSurvival(userId);
  const newValue = Number(updatedSurvival[statKey] || 1);
  const remainingPoints = getUnspentPoints(updatedSurvival);

  return {
    success: true,
    statName: statKey,
    newValue,
    remainingPoints,
    addedValue: addValue,
  };
}

module.exports = {
  VALID_STATS,
  getUnspentPoints,
  getPathSynergy,
  getLifeStatBonuses,
  investPoint,
};
