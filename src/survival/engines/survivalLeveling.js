// Lokasi: src/utils/survivalLeveling.js
const UserSurvival = require("../../models/UserSurvival");

// Gunakan fungsi murni agar tidak terkena error "this" context
function getExpRequirement(level) {
  // Memastikan input adalah angka (Integer)
  const lvl = parseInt(level) || 1;
  return lvl * lvl * 100;
}

function getMaxStatCap(level) {
  const lvl = parseInt(level) || 1;
  return lvl * 5;
}

async function addPlayerXP(userId, xpAmount) {
  const cacheManager = require("../../managers/cacheManager");
  const survival = await cacheManager.getUserSurvival(userId);

  const diffHelper = require("../helpers/difficultyHelper");
  const diffConfig = diffHelper.getDifficultyConfig(
    survival?.rpg_state?.difficulty || "Normal",
  );

  // ✨ FIX: Mengunci tipe data menjadi Integer agar tidak tergabung sebagai Teks
  const oldLevel = parseInt(survival?.survival_level) || 1;
  let currentLevel = oldLevel;
  let currentXP = parseInt(survival?.survival_xp) || 0;

  let totalXpAdded = parseInt(xpAmount);
  if (xpAmount > 0) {
    totalXpAdded = Math.floor(totalXpAdded * diffConfig.expMultiplier);
    
    // Buff Kolaboratif Klan
    if (survival && survival.clanId) {
      try {
        const GuildClan = require("../../models/GuildClan");
        const clan = await GuildClan.findByPk(survival.clanId);
        if (clan) {
          const buffMultiplier = 1 + (clan.level * 0.02); // +2% per level
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

  // ✨ FIX: Potong XP yang berlebih secara berulang sampai sesuai dengan batas level
  while (currentXP >= reqXP) {
    currentXP -= reqXP; // Sisa XP akan dibawa ke level berikutnya
    currentLevel++;
    hasLeveledUp = true;
    reqXP = getExpRequirement(currentLevel);
  }

  await cacheManager.incrementUserSurvival(userId, {
    survival_xp: currentXP - (survival.survival_xp || 0),
    survival_level: currentLevel - oldLevel,
  });

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
  addPlayerXP,
};
