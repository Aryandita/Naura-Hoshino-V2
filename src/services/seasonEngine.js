"use strict";

/**
 * @namespace: src/services/seasonEngine.js
 * @type: Engine / Service
 * @description: Sistem Musim & Battle Pass 30-Hari (Season 1: Awakening of Hoshino)
 */

const SeasonProgress = require("../models/SeasonProgress");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const CURRENT_SEASON = {
  id: 1,
  name: "Season 1: Awakening of Hoshino 🌸",
  maxTier: 30,
  xpPerTier: 1000,
  endDate: "2026-09-30T23:59:59Z",
};

// Tabel Hadiah 30 Tiers (Free & Premium Tracks)
const TIER_REWARDS = {
  1: {
    free: { gold: 1000, starFragments: 500 },
    premium: { gold: 5000, coupons: 1 },
  },
  2: { free: { gold: 1500 }, premium: { starFragments: 1500 } },
  3: { free: { starFragments: 1000 }, premium: { gold: 7500, coupons: 1 } },
  4: { free: { gold: 2000 }, premium: { starFragments: 2000 } },
  5: {
    free: { starFragments: 2500, label: "📦 Mystery Lootbox" },
    premium: { coupons: 2, label: "🎴 SR Card Pack" },
  },
  10: {
    free: { gold: 5000, starFragments: 3000 },
    premium: { coupons: 3, label: "🌟 Title: [Season Pioneer]" },
  },
  15: {
    free: { gold: 7500 },
    premium: { coupons: 3, label: "⚡ Card Awakening Shard" },
  },
  20: {
    free: { starFragments: 5000 },
    premium: { coupons: 4, label: "🎴 SSR Guaranteed Pack" },
  },
  25: {
    free: { gold: 10000, coupons: 1 },
    premium: { coupons: 5, label: "🐾 Cosmic Pet Shard" },
  },
  30: {
    free: { coupons: 3, label: "⚔️ Title: [Grand Adventurer]" },
    premium: { coupons: 10, label: "👑 Badge: [Hoshino Champion]" },
  },
};

class SeasonEngine {
  constructor() {
    this.season = CURRENT_SEASON;
  }

  /**
   * Dapatkan data progres battle pass user
   * @param {string} userId
   * @returns {Promise<SeasonProgress>}
   */
  async getProgress(userId) {
    const [progress] = await SeasonProgress.findOrCreate({
      where: { userId, seasonId: this.season.id },
      defaults: {
        level: 1,
        xp: 0,
        isPremiumPass: false,
        claimedTiersFree: [],
        claimedTiersPremium: [],
      },
    });
    return progress;
  }

  /**
   * Tambahkan Season XP ke akun pemain
   * @param {string} userId
   * @param {number} amount
   */
  async addSeasonXp(userId, amount) {
    if (!userId || amount <= 0) return;
    try {
      const progress = await this.getProgress(userId);
      let newXp = progress.xp + amount;
      let newLevel = progress.level;

      while (newXp >= this.season.xpPerTier && newLevel < this.season.maxTier) {
        newXp -= this.season.xpPerTier;
        newLevel += 1;
      }

      progress.xp = newXp;
      progress.level = newLevel;
      await progress.save({ fields: ["xp", "level"] });
    } catch (e) {
      logger.error(
        `[SeasonEngine] Gagal menambah Season XP untuk ${userId}:`,
        e.message,
      );
    }
  }

  /**
   * Upgrade ke Premium Battle Pass (memerlukan 5 Naura Coupons atau gratis untuk user VIP)
   * @param {string} userId
   */
  async upgradeToPremium(userId) {
    const progress = await this.getProgress(userId);
    if (progress.isPremiumPass) {
      return {
        success: false,
        message: "Kamu sudah memiliki **Premium Battle Pass** musim ini!",
      };
    }

    const profile = await cacheManager.getUserProfile(userId);
    const survival = await cacheManager.getUserSurvival(userId);

    if (profile.isPremium) {
      // Pengguna VIP mendapatkan akses gratis otomatis
      progress.isPremiumPass = true;
      await progress.save({ fields: ["isPremiumPass"] });
      return {
        success: true,
        message:
          "💎 Kamu mengaktifkan **Premium Battle Pass** gratis sebagai benefit VIP!",
      };
    }

    // Cek kupon (biaya 5 Naura Coupons)
    const COST_COUPONS = 5;
    if ((survival.coupons || 0) < COST_COUPONS) {
      return {
        success: false,
        message: `Kamu membutuhkan **${COST_COUPONS} Naura Coupon** untuk upgrade ke Premium Pass. (Saldo saat ini: ${survival.coupons || 0} Kupon)`,
      };
    }

    const debitResult = await cacheManager.debitUserSurvival(
      userId,
      "coupons",
      COST_COUPONS,
    );
    if (!debitResult || !debitResult.ok) {
      return {
        success: false,
        message: `Gagal memotong Kupon (${debitResult?.reason || "saldo_kurang"}). Saldo Kupon tidak mencukupi!`,
      };
    }

    progress.isPremiumPass = true;
    await progress.save({ fields: ["isPremiumPass"] });

    return {
      success: true,
      message: `🎉 Selamat! Kamu berhasil membuka **Premium Battle Pass Season 1**! Klaim semua hadiah jalur premium sekarang!`,
    };
  }

  /**
   * Klaim seluruh hadiah tier yang sudah terbuka (1-click claim)
   * @param {string} userId
   */
  async claimAllRewards(userId) {
    const progress = await this.getProgress(userId);
    const currentLevel = progress.level;
    const claimedFree = new Set(progress.claimedTiersFree || []);
    const claimedPrem = new Set(progress.claimedTiersPremium || []);

    let totalGold = 0;
    let totalStarFragments = 0;
    let totalCoupons = 0;
    const unlockedLabels = [];

    const newlyClaimedFree = [];
    const newlyClaimedPrem = [];

    for (let t = 1; t <= currentLevel; t++) {
      const r = TIER_REWARDS[t];
      if (!r) continue;

      // Free track
      if (!claimedFree.has(t) && r.free) {
        if (r.free.gold) totalGold += r.free.gold;
        if (r.free.starFragments) totalStarFragments += r.free.starFragments;
        if (r.free.coupons) totalCoupons += r.free.coupons;
        if (r.free.label)
          unlockedLabels.push(`[Free Tier ${t}] ${r.free.label}`);
        newlyClaimedFree.push(t);
      }

      // Premium track
      if (progress.isPremiumPass && !claimedPrem.has(t) && r.premium) {
        if (r.premium.gold) totalGold += r.premium.gold;
        if (r.premium.starFragments)
          totalStarFragments += r.premium.starFragments;
        if (r.premium.coupons) totalCoupons += r.premium.coupons;
        if (r.premium.label)
          unlockedLabels.push(`[Premium Tier ${t}] ${r.premium.label}`);
        newlyClaimedPrem.push(t);
      }
    }

    if (newlyClaimedFree.length === 0 && newlyClaimedPrem.length === 0) {
      return {
        claimed: false,
        message:
          "Tidak ada hadiah baru yang bisa diklaim saat ini. Naikkan level pass-mu dengan beraktivitas!",
      };
    }

    // Berikan reward via cacheManager
    if (totalGold > 0)
      await cacheManager.incrementProfile(userId, "economy_wallet", totalGold);
    if (totalStarFragments > 0)
      await cacheManager.incrementSurvival(
        userId,
        "starFragments",
        totalStarFragments,
      );
    if (totalCoupons > 0)
      await cacheManager.incrementSurvival(userId, "coupons", totalCoupons);

    progress.claimedTiersFree = [...claimedFree, ...newlyClaimedFree];
    progress.claimedTiersPremium = [...claimedPrem, ...newlyClaimedPrem];
    await progress.save({
      fields: ["claimedTiersFree", "claimedTiersPremium"],
    });

    return {
      claimed: true,
      totalGold,
      totalStarFragments,
      totalCoupons,
      unlockedLabels,
      message: `🎉 Berhasil mengklaim hadiah dari **${newlyClaimedFree.length + newlyClaimedPrem.length} milestone tier**!`,
    };
  }

  /**
   * Catat hasil pertandingan PvP ranked antara dua pemain dan hitung rating ELO baru.
   * @param {string} winnerId - ID pemain pemenang
   * @param {string} loserId - ID pemain kalah
   * @returns {Promise<{ winnerElo: number, loserElo: number, deltaWinner: number, deltaLoser: number }>}
   */
  async recordMatchResult(winnerId, loserId) {
    const winnerSurvival = await cacheManager.getUserSurvival(winnerId);
    const loserSurvival = await cacheManager.getUserSurvival(loserId);

    const eloWinner = Number(winnerSurvival?.rpg_state?.pvp_elo || 1200);
    const eloLoser = Number(loserSurvival?.rpg_state?.pvp_elo || 1200);

    const K = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (eloLoser - eloWinner) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (eloWinner - eloLoser) / 400));

    const deltaWinner = Math.max(10, Math.round(K * (1 - expectedWinner)));
    const deltaLoser = Math.min(-10, Math.round(K * (0 - expectedLoser)));

    const newWinnerElo = eloWinner + deltaWinner;
    const newLoserElo = Math.max(1000, eloLoser + deltaLoser);

    await cacheManager.mutateUserSurvivalJson(winnerId, "rpg_state", (s) => {
      const state = s || {};
      state.pvp_elo = newWinnerElo;
      state.pvp_wins = (state.pvp_wins || 0) + 1;
      return state;
    });

    await cacheManager.mutateUserSurvivalJson(loserId, "rpg_state", (s) => {
      const state = s || {};
      state.pvp_elo = newLoserElo;
      state.pvp_losses = (state.pvp_losses || 0) + 1;
      return state;
    });

    // Tambahkan Season Battle Pass XP
    await this.addSeasonXp(winnerId, 100);
    await this.addSeasonXp(loserId, 25);

    // Cek achievement
    const tracker = require("../survival/helpers/achievementTracker");
    await tracker.checkAndUnlock(winnerId).catch(() => {});

    return {
      winnerElo: newWinnerElo,
      loserElo: newLoserElo,
      deltaWinner,
      deltaLoser,
    };
  }
}

module.exports = new SeasonEngine();
module.exports.CURRENT_SEASON = CURRENT_SEASON;
module.exports.TIER_REWARDS = TIER_REWARDS;
