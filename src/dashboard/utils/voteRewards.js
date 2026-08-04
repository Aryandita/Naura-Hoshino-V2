'use strict';

/**
 * Hadiah vote top.gg.
 *
 * Sengaja dipisah dari berkas webhook supaya aturan hadiahnya bisa dipakai
 * ulang (misalnya oleh perintah `/vote` di dalam bot) tanpa menyalin logika.
 */

const { logger } = require('../../managers/logger');
const UserProfile = require('../../models/UserProfile');
const UserSurvival = require('../../models/UserSurvival');
const currency = require('../../../plugin/survival/currency');

const TRIAL_HOURS = 12;
const COUPON_PER_VOTE = 1;
const COUPON_WEEKEND = 2; // top.gg menghitung vote akhir pekan sebagai dua vote.

// top.gg membuka vote berikutnya setiap 12 jam. Ambangnya dipasang 11 jam agar
// selisih jam server tidak menolak vote yang sah.
const VOTE_COOLDOWN_MS = 11 * 60 * 60 * 1000;

async function extendPremium(userId, durationMs) {
    const { sequelize } = require('../../managers/dbManager');
    let expiry = new Date();

    await sequelize.transaction(async (t) => {
        const [profile] = await UserProfile.findOrCreate({
            where: { userId },
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        const stillActive = profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date();
        const base = stillActive ? profile.premiumUntil.getTime() : Date.now();
        expiry = new Date(base + durationMs);

        profile.isPremium = true;
        profile.premiumUntil = expiry;
        await profile.save({ transaction: t });
    });

    return expiry;
}

/**
 * Berikan hadiah satu kali vote.
 *
 * @returns {Promise<{ok: boolean, reason?: string, expiry?: Date, coupons?: number, totalCoupons?: number, streak?: number}>}
 */
async function grantVoteRewards(userId, { isWeekend = false, force = false } = {}) {
    const [survival] = await UserSurvival.findOrCreate({ where: { userId } });
    const state = survival.rpg_state || {};
    const lastVote = state.last_vote_at ? new Date(state.last_vote_at).getTime() : 0;

    // Penjaga anti-kirim-ulang: melindungi dari webhook ganda maupun percobaan
    // memanggil endpoint berkali-kali.
    if (!force && lastVote && Date.now() - lastVote < VOTE_COOLDOWN_MS) {
        return { ok: false, reason: 'cooldown', nextAt: new Date(lastVote + VOTE_COOLDOWN_MS) };
    }

    const expiry = await extendPremium(userId, TRIAL_HOURS * 60 * 60 * 1000);

    const coupons = isWeekend ? COUPON_WEEKEND : COUPON_PER_VOTE;
    const totalCoupons = await currency.reward(currency.COUPON, { survival }, coupons);

    const streak = (Number(state.vote_streak) || 0) + 1;
    survival.rpg_state = {
        ...(survival.rpg_state || {}),
        last_vote_at: new Date().toISOString(),
        vote_streak: streak,
        vote_total: (Number(state.vote_total) || 0) + 1
    };
    survival.changed('rpg_state', true);
    await survival.save();

    logger.info(`[VOTE] ${userId} menerima ${coupons} Naura Coupon (total ${totalCoupons}), vote ke-${streak}.`);

    return { ok: true, expiry, coupons, totalCoupons, streak, isWeekend };
}

module.exports = {
    TRIAL_HOURS,
    COUPON_PER_VOTE,
    COUPON_WEEKEND,
    VOTE_COOLDOWN_MS,
    grantVoteRewards,
    extendPremium
};
