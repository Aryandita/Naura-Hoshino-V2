"use strict";

const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");

const REFERRAL_REWARDS = {
  referrer: [
    { milestone: 1, sukamajuCoins: 500, starFragments: 25, title: null },
    { milestone: 3, sukamajuCoins: 1500, starFragments: 75, title: "mentor" },
    { milestone: 5, sukamajuCoins: 3000, starFragments: 150, title: "recruiter" },
    { milestone: 10, sukamajuCoins: 7500, starFragments: 400, title: "ambassador" },
  ],
  referee: {
    sukamajuCoins: 200,
    starFragments: 10,
    starterKit: true,
  },
};

class ReferralRewardService {
  /**
   * Mendaftarkan referral baru
   * @param {string} referrerId - ID pemain yang mereferensikan
   * @param {string} refereeId - ID pemain baru
   * @returns {Promise<{ ok: boolean, reason?: string, rewards?: object }>}
   */
  static async registerReferral(referrerId, refereeId) {
    try {
      if (referrerId === refereeId) {
        return { ok: false, reason: "SELF_REFERRAL_NOT_ALLOWED" };
      }

      const referrerProfile = await cacheManager.getUserProfile(referrerId);
      const existingReferrals = referrerProfile?.referralList || [];

      if (existingReferrals.includes(refereeId)) {
        return { ok: false, reason: "ALREADY_REFERRED" };
      }

      const updatedReferrals = [...existingReferrals, refereeId];
      await cacheManager.updateUserProfile(referrerId, { referralList: updatedReferrals });

      const refereeRewards = REFERRAL_REWARDS.referee;
      await cacheManager.incrementUserSurvival(refereeId, {
        sukamajuCoins: refereeRewards.sukamajuCoins,
        starFragments: refereeRewards.starFragments,
      });

      const milestoneReward = this._getMilestoneReward(updatedReferrals.length);
      let referrerReward = null;

      if (milestoneReward) {
        await cacheManager.incrementUserSurvival(referrerId, {
          sukamajuCoins: milestoneReward.sukamajuCoins,
          starFragments: milestoneReward.starFragments,
        });
        referrerReward = milestoneReward;
      }

      logger.info(`[Referral] ${referrerId} referred ${refereeId} (total: ${updatedReferrals.length})`);

      return {
        ok: true,
        rewards: {
          referrer: referrerReward,
          referee: refereeRewards,
          totalReferrals: updatedReferrals.length,
        },
      };
    } catch (error) {
      logger.error(`[Referral] Error registering ${referrerId} -> ${refereeId}:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Mendapatkan status referral pemain
   * @param {string} userId
   * @returns {Promise<{ totalReferrals: number, nextMilestone: object|null, rewardsClaimed: Array }>}
   */
  static async getReferralStatus(userId) {
    try {
      const profile = await cacheManager.getUserProfile(userId);
      const referrals = profile?.referralList || [];
      const total = referrals.length;

      const nextMilestone = REFERRAL_REWARDS.referrer.find((r) => r.milestone > total) || null;

      return {
        totalReferrals: total,
        nextMilestone,
        referralList: referrals,
      };
    } catch (error) {
      logger.error(`[Referral] Status error for ${userId}:`, error);
      return { totalReferrals: 0, nextMilestone: null, referralList: [] };
    }
  }

  static _getMilestoneReward(count) {
    return REFERRAL_REWARDS.referrer.find((r) => r.milestone === count) || null;
  }

  static getRewardTable() {
    return { ...REFERRAL_REWARDS };
  }
}

module.exports = { ReferralRewardService, REFERRAL_REWARDS };
