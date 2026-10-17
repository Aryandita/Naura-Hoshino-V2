"use strict";

/**
 * @file voteService.js
 * @description Layanan orkestrasi pemrosesan vote Top.gg dan integrasi Taste of Premium / Weekend Astral Surge.
 */

const { logger } = require("../managers/logger");
const UserSurvival = require("../models/UserSurvival");
const {
  grantVoteRewards,
  extendPremium,
  TRIAL_HOURS,
  COUPON_PER_VOTE,
  COUPON_WEEKEND,
  VOTE_COOLDOWN_MS,
} = require("../../dashboard/utils/voteRewards");

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

class VoteService {
  /**
   * Menentukan apakah waktu saat ini tergolong akhir pekan (Top.gg Weekend: Jumat 00:00 UTC - Minggu 23:59 UTC).
   * @param {Date} [now]
   * @returns {boolean}
   */
  isWeekend(now = new Date()) {
    const day = now.getUTCDay(); // 0 = Minggu, 5 = Jumat, 6 = Sabtu
    return day === 0 || day === 5 || day === 6;
  }

  /**
   * Memproses pemberian hadiah vote Top.gg kepada user.
   * Memberikan status VIP Starter 12 jam, kupon, coins, dan peluang voucher trial saat weekend.
   *
   * @param {object} params
   * @param {string} params.userId - Snowflake Discord ID pengguna
   * @param {boolean} [params.isWeekend] - Override status akhir pekan
   * @param {boolean} [params.force] - Abaikan cooldown untuk pengujian/admin
   * @param {boolean} [params.dropTrialVoucher] - Override eksplisit drop voucher untuk pengujian
   * @returns {Promise<{success: boolean, vipGranted: boolean, coupons?: number, trialDropped?: boolean, reason?: string, expiry?: Date, streak?: number, daysStreak?: number}>}
   */
  async processTopGgVote({
    userId,
    isWeekend = this.isWeekend(),
    force = false,
    dropTrialVoucher,
  } = {}) {
    if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) {
      return {
        success: false,
        vipGranted: false,
        reason: "invalid_user_id",
      };
    }

    try {
      const result = await grantVoteRewards(String(userId), {
        isWeekend: Boolean(isWeekend),
        force: Boolean(force),
        dropTrialVoucher,
      });

      if (!result.ok) {
        return {
          success: false,
          vipGranted: false,
          reason: result.reason || "cooldown",
          nextAt: result.nextAt,
        };
      }

      return {
        success: true,
        vipGranted: true,
        expiry: result.expiry,
        coupons: result.coupons,
        totalCoupons: result.totalCoupons,
        coins: result.coins,
        streak: result.streak,
        daysStreak: result.daysStreak,
        isWeekend: result.isWeekend,
        trialDropped: Boolean(result.trialDropped),
        unlockedBiggestFan: Boolean(result.unlockedBiggestFan),
      };
    } catch (err) {
      logger.error(`[VoteService] Gagal memproses vote untuk user ${userId}:`, err.message);
      return {
        success: false,
        vipGranted: false,
        reason: "internal_error",
        error: err.message,
      };
    }
  }

  /**
   * Mengambil status cooldown dan statistik voting pengguna.
   * @param {string} userId
   * @returns {Promise<{canVote: boolean, nextVoteAt: Date | null, streak: number, daysStreak: number, totalVotes: number}>}
   */
  async getVoteStatus(userId) {
    if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) {
      return {
        canVote: false,
        nextVoteAt: null,
        streak: 0,
        daysStreak: 0,
        totalVotes: 0,
      };
    }

    const survival = await UserSurvival.findOne({ where: { userId } });
    if (!survival) {
      return {
        canVote: true,
        nextVoteAt: null,
        streak: 0,
        daysStreak: 0,
        totalVotes: 0,
      };
    }

    const state = survival.rpg_state || {};
    const lastVote = state.last_vote_at
      ? new Date(state.last_vote_at).getTime()
      : 0;

    const onCooldown = lastVote && Date.now() - lastVote < VOTE_COOLDOWN_MS;
    const nextVoteAt = onCooldown ? new Date(lastVote + VOTE_COOLDOWN_MS) : null;

    return {
      canVote: !onCooldown,
      nextVoteAt,
      streak: Number(state.vote_streak) || 0,
      daysStreak: Number(state.vote_days_streak) || 0,
      totalVotes: Number(state.vote_total) || 0,
    };
  }
}

const voteService = new VoteService();
voteService.VoteService = VoteService;
voteService.TRIAL_HOURS = TRIAL_HOURS;
voteService.COUPON_PER_VOTE = COUPON_PER_VOTE;
voteService.COUPON_WEEKEND = COUPON_WEEKEND;
voteService.VOTE_COOLDOWN_MS = VOTE_COOLDOWN_MS;
voteService.extendPremium = extendPremium;

module.exports = voteService;
