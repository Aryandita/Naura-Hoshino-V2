"use strict";

const UserAchievement = require("../../models/UserAchievement");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

/**
 * Pengecekan otomatis pencapaian petualang secara non-blocking.
 * Membandingkan statistik dan progres pemain dengan pool achievement.
 *
 * @param {string} userId - ID Discord User
 * @returns {Promise<string[]>} Daftar ID achievement baru yang berhasil dibuka
 */
async function checkAndUnlock(userId) {
  if (!userId) return [];

  try {
    const survival = await cacheManager.getUserSurvival(userId);
    if (!survival) return [];

    const [userAch] = await UserAchievement.findOrCreate({
      where: { userId },
    });

    const unlocked = Array.isArray(userAch.unlockedAchievements)
      ? [...userAch.unlockedAchievements]
      : [];

    const newlyUnlocked = [];

    const check = (id, condition) => {
      if (condition && !unlocked.includes(id)) {
        unlocked.push(id);
        newlyUnlocked.push(id);
      }
    };

    const level = Number(survival.survival_level || 1);
    const day = Number(survival.inGameDay || 1);
    const str = Number(survival.strength || 1);
    const int = Number(survival.intelligence || 1);
    const agi = Number(survival.agility || 1);
    const lck = Number(survival.luck || 1);
    const rpgState = survival.rpg_state || {};

    // Milestone Level
    check("veteran_survivor", level >= 25);
    check("high_mage", level >= 50);
    check("legendary_survivor", level >= 75);
    check("ascended_god", level >= 100);

    // Milestone Hari Petualangan
    check("swallowtail_citizen", day >= 30);
    check("month_survivor", day >= 30);
    check("centennial_pioneer", day >= 100);

    // Milestone Life Stats
    check("titan_strength", str >= 50);
    check("sage_wisdom", int >= 50);
    check("wind_strider", agi >= 50);
    check("blessed_by_fortune", lck >= 50);

    // Milestone Dungeon
    const maxFloor = Number(rpgState.dungeon_max_floor || 0);
    check("abyssal_champion", maxFloor >= 50);
    check("dungeon_conqueror", maxFloor >= 100);

    // Milestone Rebirth & Pernikahan
    check("elf_evolution", Number(rpgState.rebirth_count || 0) >= 1);
    check("eternal_vow", Boolean(rpgState.married_to));
    check(
      "gem_master",
      Boolean(
        rpgState.enchanted_gear &&
        Object.keys(rpgState.enchanted_gear).length > 0,
      ),
    );

    if (newlyUnlocked.length > 0) {
      userAch.unlockedAchievements = unlocked;
      if (!userAch.activeTitle) {
        userAch.activeTitle = newlyUnlocked[0];
      }
      await userAch.save({ fields: ["unlockedAchievements", "activeTitle"] });
      logger.info(
        `[AchievementTracker] User ${userId} membuka ${newlyUnlocked.length} achievement baru: ${newlyUnlocked.join(", ")}`,
      );
    }

    return newlyUnlocked;
  } catch (error) {
    logger.error("[AchievementTracker Error]:", error.message);
    return [];
  }
}

module.exports = {
  checkAndUnlock,
};
