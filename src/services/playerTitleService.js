"use strict";

const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");

const TITLE_DEFINITIONS = [
  { id: "newcomer", name: "Pendatang Baru", description: "Baru bergabung di server", category: "default", priority: 0 },
  { id: "first_blood", name: "Pemburu Pemula", description: "Kalahkan monster pertama", category: "combat", priority: 10 },
  { id: "warrior_elite", name: "Pejuang Elite", description: "Kalahkan 500 monster", category: "combat", priority: 30 },
  { id: "boss_slayer", name: "Penakluk Boss", description: "Kalahkan World Boss", category: "combat", priority: 50 },
  { id: "master_crafter", name: "Ahli Pengrajin", description: "Craft 100 item", category: "crafting", priority: 25 },
  { id: "wealthy_merchant", name: "Pedagang Kaya", description: "Miliki 100.000 SC", category: "economy", priority: 20 },
  { id: "world_traveler", name: "Penjelajah Dunia", description: "Kunjungi semua lokasi", category: "exploration", priority: 35 },
  { id: "social_star", name: "Bintang Sosial", description: "Kirim 5000 pesan", category: "social", priority: 15 },
  { id: "vip_gold", name: "VIP Gold Member", description: "Subscriber VIP Tier 2+", category: "premium", priority: 40 },
  { id: "event_champion", name: "Juara Event", description: "Menangkan event server", category: "event", priority: 45 },
  { id: "legendary_hero", name: "Pahlawan Legendaris", description: "Capai level 50", category: "progression", priority: 55 },
  { id: "donor_patron", name: "Patron Desa", description: "Donatur aktif server", category: "donation", priority: 60 },
];

class PlayerTitleService {
  /**
   * Mendapatkan daftar title yang tersedia untuk pemain
   * @param {string} userId
   * @returns {Promise<{ unlocked: Array, equipped: string|null }>}
   */
  static async getPlayerTitles(userId) {
    try {
      const profile = await cacheManager.getUserProfile(userId);
      if (!profile) return { unlocked: [TITLE_DEFINITIONS[0]], equipped: "newcomer" };

      const unlockedIds = new Set(profile.unlockedTitles || ["newcomer"]);
      const equipped = profile.equippedTitle || "newcomer";

      const unlocked = TITLE_DEFINITIONS.filter((t) => unlockedIds.has(t.id));
      unlocked.sort((a, b) => b.priority - a.priority);

      return { unlocked, equipped };
    } catch (error) {
      logger.error(`[PlayerTitle] Error for user ${userId}:`, error);
      return { unlocked: [TITLE_DEFINITIONS[0]], equipped: "newcomer" };
    }
  }

  /**
   * Equip title tertentu
   * @param {string} userId
   * @param {string} titleId
   * @returns {Promise<{ ok: boolean, reason?: string, title?: object }>}
   */
  static async equipTitle(userId, titleId) {
    try {
      const { unlocked } = await this.getPlayerTitles(userId);
      const hasTitle = unlocked.some((t) => t.id === titleId);

      if (!hasTitle) {
        return { ok: false, reason: "TITLE_NOT_UNLOCKED" };
      }

      const title = TITLE_DEFINITIONS.find((t) => t.id === titleId);
      await cacheManager.updateUserProfile(userId, { equippedTitle: titleId });

      logger.info(`[PlayerTitle] User ${userId} equipped title: ${titleId}`);
      return { ok: true, title };
    } catch (error) {
      logger.error(`[PlayerTitle] Equip error for user ${userId}:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Unlock title baru untuk pemain
   * @param {string} userId
   * @param {string} titleId
   * @returns {Promise<{ ok: boolean, isNew: boolean, title?: object }>}
   */
  static async unlockTitle(userId, titleId) {
    try {
      const profile = await cacheManager.getUserProfile(userId);
      const currentTitles = new Set(profile?.unlockedTitles || ["newcomer"]);

      if (currentTitles.has(titleId)) {
        return { ok: true, isNew: false };
      }

      const title = TITLE_DEFINITIONS.find((t) => t.id === titleId);
      if (!title) return { ok: false, isNew: false, reason: "TITLE_NOT_FOUND" };

      currentTitles.add(titleId);
      await cacheManager.updateUserProfile(userId, { unlockedTitles: [...currentTitles] });

      logger.info(`[PlayerTitle] User ${userId} unlocked title: ${titleId}`);
      return { ok: true, isNew: true, title };
    } catch (error) {
      logger.error(`[PlayerTitle] Unlock error for user ${userId}:`, error);
      return { ok: false, isNew: false, reason: "INTERNAL_ERROR" };
    }
  }

  static getDefinitions() {
    return [...TITLE_DEFINITIONS];
  }
}

module.exports = { PlayerTitleService, TITLE_DEFINITIONS };
