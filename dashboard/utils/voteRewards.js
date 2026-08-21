"use strict";

/**
 * Hadiah vote top.gg.
 *
 * Sengaja dipisah dari berkas webhook supaya aturan hadiahnya bisa dipakai
 * ulang (misalnya oleh perintah `/vote` di dalam bot) tanpa menyalin logika.
 */

const { logger } = require("../../src/managers/logger");
const UserProfile = require("../../src/models/UserProfile");
const UserSurvival = require("../../src/models/UserSurvival");
const currency = require("../../src/survival/engines/currency");

const TRIAL_HOURS = 12;
const COUPON_PER_VOTE = 1;
const COUPON_WEEKEND = 2; // top.gg menghitung vote akhir pekan sebagai dua vote.

// top.gg membuka vote berikutnya setiap 12 jam. Ambangnya dipasang 11 jam agar
// selisih jam server tidak menolak vote yang sah.
const VOTE_COOLDOWN_MS = 11 * 60 * 60 * 1000;

const EntitlementService = require("../../src/managers/entitlementService");

async function extendPremium(userId, durationMs) {
  return EntitlementService.extendUserPremium(userId, durationMs);
}

/**
 * Berikan hadiah satu kali vote.
 *
 * @returns {Promise<{ok: boolean, reason?: string, expiry?: Date, coupons?: number, totalCoupons?: number, streak?: number}>}
 */
async function grantVoteRewards(
  userId,
  { isWeekend = false, force = false } = {},
) {
  const [survival] = await UserSurvival.findOrCreate({ where: { userId } });
  const state = survival.rpg_state || {};
  const lastVote = state.last_vote_at
    ? new Date(state.last_vote_at).getTime()
    : 0;

  // Penjaga anti-kirim-ulang: melindungi dari webhook ganda maupun percobaan
  // memanggil endpoint berkali-kali.
  if (!force && lastVote && Date.now() - lastVote < VOTE_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      nextAt: new Date(lastVote + VOTE_COOLDOWN_MS),
    };
  }

  // Periksa apakah streak masih berlanjut (toleransi jeda 36 jam antar vote)
  const MAX_STREAK_GAP_MS = 36 * 60 * 60 * 1000;
  let streak = 1;
  let daysStreak = (Number(state.vote_days_streak) || 0);

  if (lastVote && Date.now() - lastVote <= MAX_STREAK_GAP_MS) {
    streak = (Number(state.vote_streak) || 0) + 1;
    // Periksa apakah hari ini berbeda dengan vote terakhir
    const lastDate = new Date(lastVote).toDateString();
    const currentDate = new Date().toDateString();
    if (lastDate !== currentDate) {
      daysStreak += 1;
    }
  } else {
    streak = 1;
    daysStreak = 1;
  }

  // Perpanjang status premium Voter (12 jam per vote)
  const expiry = await extendPremium(userId, TRIAL_HOURS * 60 * 60 * 1000);

  // Periksa pencapaian 30 hari vote berturut-turut
  let unlockedBiggestFan = false;
  if (daysStreak >= 30 || streak >= 60) {
    try {
      const UserAchievement = require("../../src/models/UserAchievement");
      const [userAch] = await UserAchievement.findOrCreate({ where: { userId } });
      const unlocked = userAch.unlockedAchievements || [];

      if (!unlocked.includes("naura_biggest_fan")) {
        unlocked.push("naura_biggest_fan");
        userAch.unlockedAchievements = unlocked;
        userAch.changed("unlockedAchievements", true);
        await userAch.save();
        unlockedBiggestFan = true;

        // Hadiahkan Starter Plan (7 Hari)
        const [profile] = await UserProfile.findOrCreate({ where: { userId } });
        const store = require("../../src/premium/premiumStore");
        const newExpiry = await store.grantPremium(userId, profile, 7);

        // Notifikasi DM
        const { sendPremiumDM } = require("../../src/premium/premiumNotify");
        const client = global.client || require("../../src/managers/clientManager")?.client;
        if (client) {
          await sendPremiumDM(client, userId, "activated", {
            username: profile.username || "Voter Setia",
            tierName: "🌱 Naura Starter (Pencapaian 30 Hari Vote)",
            premiumUntil: newExpiry,
          }).catch(() => {});
        }
      }
    } catch (achErr) {
      logger.error("[VoteRewards Achievement Error]", achErr);
    }
  }

  // Catatan vote ditulis LEBIH DULU, dan hanya kolom rpg_state yang disentuh.
  survival.rpg_state = {
    ...(survival.rpg_state || {}),
    last_vote_at: new Date().toISOString(),
    vote_streak: streak,
    vote_days_streak: daysStreak,
    vote_total: (Number(state.vote_total) || 0) + 1,
  };
  survival.changed("rpg_state", true);
  await survival.save({ fields: ["rpg_state"] });

  const coupons = isWeekend ? COUPON_WEEKEND : COUPON_PER_VOTE;
  const totalCoupons = await currency.reward(
    currency.COUPON,
    { survival },
    coupons,
  );

  logger.info(
    `[VOTE] ${userId} menerima ${coupons} Naura Coupon (total ${totalCoupons}), vote ke-${streak} (streak hari: ${daysStreak}).`,
  );

  return {
    ok: true,
    expiry,
    coupons,
    totalCoupons,
    streak,
    daysStreak,
    isWeekend,
    unlockedBiggestFan,
  };
}

module.exports = {
  TRIAL_HOURS,
  COUPON_PER_VOTE,
  COUPON_WEEKEND,
  VOTE_COOLDOWN_MS,
  grantVoteRewards,
  extendPremium,
};
