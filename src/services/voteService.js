"use strict";

/**
 * 🗳️ Vote Service - Top.gg Integration - Naura Hoshino V2
 * ---------------------------------------------------------
 * Orchestrates Top.gg vote processing with Taste of Premium rewards.
 * Handles VIP Starter grants, coupon distribution, and weekend bonuses.
 *
 * Features:
 * - Automatic VIP Starter 12-hour grant on vote
 * - Coupon rewards (doubled on weekends)
 * - Vote streak tracking and statistics
 * - Cooldown enforcement to prevent abuse
 * - Weekend Astral Surge bonus detection
 *
 * @module src/services/voteService
 * @example
 * const voteService = require('./voteService');
 *
 * // Process a vote
 * const result = await voteService.processTopGgVote({ userId: '123456789' });
 * if (result.success) {
 *   console.log(`Granted VIP until ${result.expiry}`);
 * }
 *
 * // Check vote status
 * const status = await voteService.getVoteStatus(userId);
 * console.log(`Can vote: ${status.canVote}, Streak: ${status.streak}`);
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

// ============================================================================
// CONSTANTS
// ============================================================================

/** Discord Snowflake ID validation pattern (17-20 digits) */
const SNOWFLAKE_REGEX = /^\d{17,20}$/;

// ============================================================================
// VOTE SERVICE CLASS
// ============================================================================

/**
 * Manages Top.gg vote processing and reward distribution.
 */
class VoteService {
  /**
   * Check if current time is within Top.gg weekend period.
   * Weekend: Friday 00:00 UTC through Sunday 23:59 UTC.
   * @param {Date} [now=new Date()] - Time to check (defaults to now)
   * @returns {boolean} True if currently weekend
   * @example
   * const isWeekend = voteService.isWeekend();
   * const coupons = isWeekend ? COUPON_WEEKEND : COUPON_PER_VOTE;
   */
  isWeekend(now = new Date()) {
    const day = now.getUTCDay(); // 0=Sunday, 5=Friday, 6=Saturday
    return day === 0 || day === 5 || day === 6;
  }

  /**
   * Process Top.gg vote and grant rewards to user.
   * Awards VIP Starter status, coupons, coins, and potential trial voucher.
   *
   * Reward Flow:
   * 1. Validate user ID format
   * 2. Check cooldown (unless force=true)
   * 3. Grant VIP Starter 12h + base coupons
   * 4. Apply weekend multiplier if applicable
   * 5. Roll for trial voucher (weekend only)
   * 6. Update vote streak counters
   *
   * @param {Object} params - Vote parameters
   * @param {string} params.userId - Discord user ID (Snowflake format)
   * @param {boolean} [params.isWeekend] - Override weekend detection
   * @param {boolean} [params.force=false] - Bypass cooldown (testing/admin)
   * @param {boolean} [params.dropTrialVoucher] - Force trial voucher drop
   * @returns {Promise<VoteResult>} Processing result with rewards granted
   * @example
   * const result = await voteService.processTopGgVote({
   *   userId: '123456789012345678',
   *   isWeekend: true,
   * });
   */
  async processTopGgVote({
    userId,
    isWeekend = this.isWeekend(),
    force = false,
    dropTrialVoucher,
  } = {}) {
    // Validate user ID format
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

      // Handle cooldown or other failure
      if (!result.ok) {
        return {
          success: false,
          vipGranted: false,
          reason: result.reason || "cooldown",
          nextAt: result.nextAt,
        };
      }

      // Success: return all granted rewards
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
      logger.error(`[VoteService] Failed to process vote for user ${userId}:`, err.message);
      return {
        success: false,
        vipGranted: false,
        reason: "internal_error",
        error: err.message,
      };
    }
  }

  /**
   * Get user's current vote status and statistics.
   * Checks cooldown state and retrieves voting history.
   * @param {string} userId - Discord user ID
   * @returns {Promise<VoteStatus>} Current voting status
   * @example
   * const status = await voteService.getVoteStatus('123456789012345678');
   * if (status.canVote) {
   *   console.log('User can vote now!');
   * } else {
   *   console.log(`Next vote available at ${status.nextVoteAt}`);
   * }
   */
  async getVoteStatus(userId) {
    // Validate user ID
    if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) {
      return {
        canVote: false,
        nextVoteAt: null,
        streak: 0,
        daysStreak: 0,
        totalVotes: 0,
      };
    }

    // Fetch user survival data
    const survival = await UserSurvival.findOne({ where: { userId } });
    if (!survival) {
      // New user, no vote history
      return {
        canVote: true,
        nextVoteAt: null,
        streak: 0,
        daysStreak: 0,
        totalVotes: 0,
      };
    }

    // Extract vote state from RPG data
    const state = survival.rpg_state || {};
    const lastVote = state.last_vote_at
      ? new Date(state.last_vote_at).getTime()
      : 0;

    // Calculate cooldown status
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} VoteResult
 * @property {boolean} success - Whether vote was processed successfully
 * @property {boolean} vipGranted - Whether VIP status was granted
 * @property {Date} [expiry] - VIP expiration timestamp
 * @property {number} [coupons] - Coupons granted this vote
 * @property {number} [totalCoupons] - User's total coupon balance
 * @property {number} [coins] - Coins granted
 * @property {number} [streak] - Current vote streak count
 * @property {number} [daysStreak] - Consecutive days voted
 * @property {boolean} [isWeekend] - Whether vote occurred during weekend
 * @property {boolean} [trialDropped] - Whether trial voucher was awarded
 * @property {boolean} [unlockedBiggestFan] - Whether Biggest Fan badge unlocked
 * @property {string} [reason] - Failure reason if unsuccessful
 * @property {string} [error] - Error message if internal error
 * @property {Date} [nextAt] - Next allowed vote time if on cooldown
 */

/**
 * @typedef {Object} VoteStatus
 * @property {boolean} canVote - Whether user can vote now
 * @property {Date|null} nextVoteAt - When cooldown expires (null if ready)
 * @property {number} streak - Current vote streak
 * @property {number} daysStreak - Consecutive voting days
 * @property {number} totalVotes - Lifetime vote count
 */

// ============================================================================
// GLOBAL INSTANCE & EXPORTS
// ============================================================================

/**
 * Global VoteService instance for application-wide vote processing.
 * @type {VoteService}
 */
const voteService = new VoteService();

// Expose class and constants for external use
voteService.VoteService = VoteService;
voteService.TRIAL_HOURS = TRIAL_HOURS;
voteService.COUPON_PER_VOTE = COUPON_PER_VOTE;
voteService.COUPON_WEEKEND = COUPON_WEEKEND;
voteService.VOTE_COOLDOWN_MS = VOTE_COOLDOWN_MS;
voteService.extendPremium = extendPremium;

module.exports = voteService;
