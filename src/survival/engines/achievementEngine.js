"use strict";

const { logger } = require("../../managers/logger");

const ACHIEVEMENT_DEFINITIONS = [
  { id: "first_blood", name: "First Blood", description: "Kalahkan monster pertama", category: "combat", tier: "bronze", condition: (stats) => stats.monstersKilled >= 1 },
  { id: "warrior_initiate", name: "Warrior Initiate", description: "Kalahkan 50 monster", category: "combat", tier: "silver", condition: (stats) => stats.monstersKilled >= 50 },
  { id: "warrior_master", name: "Warrior Master", description: "Kalahkan 500 monster", category: "combat", tier: "gold", condition: (stats) => stats.monstersKilled >= 500 },
  { id: "level_10", name: "Rising Star", description: "Capai level 10", category: "progression", tier: "bronze", condition: (stats) => stats.level >= 10 },
  { id: "level_25", name: "Seasoned Adventurer", description: "Capai level 25", category: "progression", tier: "silver", condition: (stats) => stats.level >= 25 },
  { id: "level_50", name: "Legendary Hero", description: "Capai level 50", category: "progression", tier: "gold", condition: (stats) => stats.level >= 50 },
  { id: "first_craft", name: "Novice Crafter", description: "Craft item pertama", category: "crafting", tier: "bronze", condition: (stats) => stats.itemsCrafted >= 1 },
  { id: "master_crafter", name: "Master Crafter", description: "Craft 100 item", category: "crafting", tier: "silver", condition: (stats) => stats.itemsCrafted >= 100 },
  { id: "rich_10k", name: "Wealthy Citizen", description: "Miliki 10.000 SC", category: "economy", tier: "bronze", condition: (stats) => stats.sukamajuCoins >= 10000 },
  { id: "rich_100k", name: "Economic Elite", description: "Miliki 100.000 SC", category: "economy", tier: "silver", condition: (stats) => stats.sukamajuCoins >= 100000 },
  { id: "explorer_5", name: "Curious Explorer", description: "Kunjungi 5 lokasi berbeda", category: "exploration", tier: "bronze", condition: (stats) => stats.locationsVisited >= 5 },
  { id: "explorer_all", name: "World Traveler", description: "Kunjungi semua lokasi", category: "exploration", tier: "gold", condition: (stats) => stats.locationsVisited >= 20 },
  { id: "collector_50", name: "Item Collector", description: "Kumpulkan 50 jenis item unik", category: "collection", tier: "silver", condition: (stats) => stats.uniqueItems >= 50 },
  { id: "boss_slayer", name: "Boss Slayer", description: "Kalahkan World Boss pertama", category: "combat", tier: "gold", condition: (stats) => stats.bossesDefeated >= 1 },
  { id: "social_butterfly", name: "Social Butterfly", description: "Kirim 1000 pesan di server", category: "social", tier: "bronze", condition: (stats) => stats.messagesSent >= 1000 },
];

const TIER_COLORS = {
  bronze: 0xCD7F32,
  silver: 0xC0C0C0,
  gold: 0xFFD700,
};

class AchievementEngine {
  static getDefinitions() {
    return [...ACHIEVEMENT_DEFINITIONS];
  }

  static getByCategory(category) {
    return ACHIEVEMENT_DEFINITIONS.filter((a) => a.category === category);
  }

  static getById(id) {
    return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id) || null;
  }

  /**
   * Memeriksa achievement yang baru di-unlock berdasarkan statistik pemain
   * @param {string} userId
   * @param {object} playerStats - Statistik agregat pemain
   * @param {Array<string>} unlockedIds - Daftar ID achievement yang sudah di-unlock
   * @returns {Array<object>} Achievement yang baru di-unlock
   */
  static checkNewAchievements(playerStats, unlockedIds = []) {
    const newlyUnlocked = [];
    const unlockedSet = new Set(unlockedIds);

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (unlockedSet.has(def.id)) continue;
      try {
        if (def.condition(playerStats)) {
          newlyUnlocked.push({ ...def, unlockedAt: Date.now() });
        }
      } catch (err) {
        logger.error(`[AchievementEngine] Error checking ${def.id}:`, err);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Membangun payload Components V2 untuk notifikasi achievement unlock
   * @param {object} achievement
   * @param {string} userId
   * @returns {object}
   */
  static buildUnlockNotification(achievement, userId) {
    const tierEmoji = { bronze: "🥉", silver: "🥈", gold: "🥇" };
    return {
      title: `${tierEmoji[achievement.tier] || "🏆"} Achievement Unlocked!`,
      description: `**${achievement.name}**\n${achievement.description}`,
      color: TIER_COLORS[achievement.tier] || 0x5865F2,
      footer: `Tier: ${achievement.tier.toUpperCase()} | Category: ${achievement.category}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Menghitung persentase completion achievement
   * @param {Array<string>} unlockedIds
   * @returns {{ total: number, unlocked: number, percentage: number }}
   */
  static getProgress(unlockedIds = []) {
    const total = ACHIEVEMENT_DEFINITIONS.length;
    const unlocked = unlockedIds.length;
    return {
      total,
      unlocked,
      percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    };
  }
}

module.exports = { AchievementEngine, ACHIEVEMENT_DEFINITIONS, TIER_COLORS };
