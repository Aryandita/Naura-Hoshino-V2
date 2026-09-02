"use strict";

// Lokasi: src/survival/engines/survivalLeveling.js

// Gunakan fungsi murni agar tidak terkena error "this" context
function getExpRequirement(level) {
  // Memastikan input adalah angka (Integer)
  const lvl = parseInt(level, 10) || 1;
  return lvl * lvl * 100;
}

function getMaxStatCap(level) {
  const lvl = parseInt(level, 10) || 1;
  return lvl * 5;
}

/**
 * Satu-satunya sumber kebenaran untuk formula kalkulasi Max HP petualang.
 * Digunakan seragam oleh infoStats, dungeonCombat, dan duelEngine.
 *
 * @param {object} survival - Objek data UserSurvival
 * @param {number} [classBonusHp=0] - Bonus HP dari kelas petarung
 * @returns {number} Nilai Max HP
 */
function calculateMaxHp(survival, classBonusHp = 0) {
  const level = parseInt(survival?.survival_level, 10) || 1;
  return level * 20 + 100 + (parseInt(classBonusHp, 10) || 0);
}

/**
 * Terapkan batas maksimum stat cap pada atribut pemain berdasarkan level saat ini.
 *
 * @param {string} userId - ID Discord User
 * @returns {Promise<number|null>} Nilai stat cap
 */
async function applyStatCap(userId) {
  const cacheManager = require("../../managers/cacheManager");
  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival) return null;

  const cap = getMaxStatCap(survival.survival_level || 1);
  const updates = {};
  for (const stat of ["strength", "agility", "intelligence", "luck"]) {
    if ((survival[stat] || 1) > cap) {
      updates[stat] = cap;
    }
  }
  if (Object.keys(updates).length > 0) {
    await cacheManager.updateUserSurvival(userId, updates);
  }
  return cap;
}

async function addPlayerXP(userId, xpAmount) {
  const cacheManager = require("../../managers/cacheManager");
  const survival = await cacheManager.getUserSurvival(userId);

  const diffHelper = require("../helpers/difficultyHelper");
  const diffConfig = diffHelper.getDifficultyConfig(
    survival?.rpg_state?.difficulty || "Normal",
  );

  const oldLevel = parseInt(survival?.survival_level, 10) || 1;
  let currentLevel = oldLevel;
  let currentXP = parseInt(survival?.survival_xp, 10) || 0;

  let totalXpAdded = parseInt(xpAmount, 10);
  if (xpAmount > 0) {
    totalXpAdded = Math.floor(totalXpAdded * diffConfig.expMultiplier);

    // Buff Kolaboratif Klan
    if (survival && survival.clanId) {
      try {
        const GuildClan = require("../../models/GuildClan");
        const clan = await GuildClan.findByPk(survival.clanId);
        if (clan) {
          const buffMultiplier = 1 + clan.level * 0.02; // +2% per level
          totalXpAdded = Math.floor(totalXpAdded * buffMultiplier);
        }
      } catch (e) {
        // Abaikan error jika ada
      }
    }
  }

  currentXP += totalXpAdded;

  let reqXP = getExpRequirement(currentLevel);
  let hasLeveledUp = false;

  // Potong XP yang berlebih secara berulang sampai sesuai dengan batas level
  while (currentXP >= reqXP) {
    currentXP -= reqXP; // Sisa XP akan dibawa ke level berikutnya
    currentLevel++;
    hasLeveledUp = true;
    reqXP = getExpRequirement(currentLevel);
  }

  await cacheManager.incrementUserSurvival(userId, {
    survival_xp: currentXP - (survival?.survival_xp || 0),
    survival_level: currentLevel - oldLevel,
  });

  if (hasLeveledUp) {
    const levelsGained = currentLevel - oldLevel;
    const pointsAwarded = levelsGained * 3;
    if (typeof cacheManager.mutateUserSurvivalJson === "function") {
      await cacheManager.mutateUserSurvivalJson(
        userId,
        "rpg_state",
        (state) => {
          const currentState = state || {};
          currentState.unspent_points =
            (currentState.unspent_points || 0) + pointsAwarded;
          return currentState;
        },
      );
    }
    await applyStatCap(userId);
  }

  return {
    currentLevel,
    currentXP,
    reqXP,
    hasLeveledUp,
    maxStatCap: getMaxStatCap(currentLevel),
  };
}

module.exports = {
  getExpRequirement,
  getMaxStatCap,
  calculateMaxHp,
  applyStatCap,
  addPlayerXP,
};
