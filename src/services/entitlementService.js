"use strict";

/**
 * @file entitlementService.js
 * @description Layanan terpadu penanganan monetisasi Discord Entitlements, Premium Subscriptions API,
 * serta manajemen status VIP/Voter (Sequelize & Cache).
 * Mengonsolidasikan logika dari src/managers/entitlementService.js dan src/services/entitlementService.js.
 */

const crypto = require("node:crypto");
const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");
const UserProfile = require("../models/UserProfile");
const { sequelize } = require("../managers/dbManager");
const env = require("../config/env");

// SKU Mapping ke Benefit/Role
const DISCORD_SKUS = {
    SKU_STAR_PASS: {
        id: "sku_star_pass",
        type: "SEASON_PASS",
        name: "Naura Star Pass",
        durationDays: 30,
        rewardCoupons: 10,
        rewardStarFragments: 1500,
    },
    SKU_PREMIUM_VIP: {
        id: "sku_premium_vip",
        type: "VIP_SUBSCRIPTION",
        name: "Naura VIP Member",
        durationDays: 30,
        rewardCoupons: 25,
        rewardStarFragments: 5000,
    },
    SKU_PREMIUM_VVIP: {
        id: "sku_premium_vvip",
        type: "VVIP_SUBSCRIPTION",
        name: "Naura VVIP Elite",
        durationDays: 30,
        rewardCoupons: 60,
        rewardStarFragments: 15000,
    },
};

class EntitlementService {
    constructor() {
        this.skus = DISCORD_SKUS;
    }

    /**
     * Mengecek apakah user memiliki status premium aktif.
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async isUserPremium(userId) {
        if (!userId) return false;
        const profile = await cacheManager.getUserProfile(userId);
        if (!profile) return false;
        if (
            profile.isPremium &&
            profile.premiumUntil &&
            new Date(profile.premiumUntil) > new Date()
        ) {
            return true;
        }
        return false;
    }

    /**
     * Memperpanjang durasi premium user secara atomik. Jika sudah kedaluwarsa, dimulai dari waktu sekarang.
     * @param {string} userId
     * @param {number} durationMs Waktu perpanjangan dalam milidetik
     * @returns {Promise<Date>} Waktu kedaluwarsa yang baru
     */
    async extendUserPremium(userId, durationMs) {
        let expiry = new Date();

        if (typeof cacheManager.flushUser === "function") {
            await cacheManager.flushUser(userId);
        }

        const rowLock =
            typeof sequelize.getDialect === "function" &&
            sequelize.getDialect() === "sqlite"
                ? {}
                : { lock: true };

        await sequelize.transaction(async (t) => {
            const [profile] = await UserProfile.findOrCreate({
                where: { userId },
                transaction: t,
                ...rowLock,
            });

            const stillActive =
                profile.isPremium &&
                profile.premiumUntil &&
                new Date(profile.premiumUntil) > new Date();
            const base = stillActive
                ? new Date(profile.premiumUntil).getTime()
                : Date.now();
            expiry = new Date(base + durationMs);

            profile.isPremium = true;
            profile.premiumUntil = expiry;
            await profile.save({
                fields: ["isPremium", "premiumUntil"],
                transaction: t,
            });
        });

        if (typeof cacheManager.invalidateUserProfile === "function") {
            await cacheManager.invalidateUserProfile(userId);
        }

        return expiry;
    }

    /**
     * Mengecek apakah guild memiliki status premium aktif.
     * @param {string} guildId
     * @returns {Promise<boolean>}
     */
    async isGuildPremium(guildId) {
        if (!guildId) return false;
        const settings = await cacheManager.getGuildSettings(guildId);
        if (!settings) return false;
        const premiumData = settings.settings?.premium || {};
        if (
            premiumData.active &&
            premiumData.until &&
            new Date(premiumData.until) > new Date()
        ) {
            return true;
        }
        return false;
    }

    /**
     * Adapter handler untuk pembayaran/donasi pihak ketiga (Saweria, Trakteer, Top.gg).
     * @param {string} userId
     * @param {number} amount
     * @param {string} adapterName
     */
    async handleDonation(userId, amount, adapterName) {
        logger.info(
            `[Entitlement] Donasi diterima via ${adapterName || "external"} untuk user ${userId} sebesar ${amount}`,
        );
        return { ok: true, userId, amount, provider: adapterName || "external" };
    }

    /**
     * Identifikasi benefit berdasarkan SKU ID Discord
     * @param {string} skuId
     * @returns {object|null}
     */
    resolveSku(skuId) {
        if (!skuId) return null;
        for (const item of Object.values(this.skus)) {
            if (item.id === skuId || skuId.includes(item.id)) {
                return item;
            }
        }
        // Fallback generik VIP
        return {
            id: skuId,
            type: "GENERIC_PREMIUM",
            name: "Discord Premium Tier",
            durationDays: 30,
            rewardCoupons: 10,
            rewardStarFragments: 1000,
        };
    }

    /**
     * Menangani saat langganan baru dibeli (ENTITLEMENT_CREATE)
     * @param {object} entitlement - Objek entitlement Discord
     * @returns {Promise<{success: boolean, activatedPlan?: string, userId: string}>}
     */
    async handleEntitlementCreate(entitlement) {
        if (!entitlement) return { success: false, error: "Entitlement data empty" };

        const userId = entitlement.userId || entitlement.user_id;
        const skuId = entitlement.skuId || entitlement.sku_id;

        if (!userId) {
            return { success: false, error: "Missing userId in entitlement" };
        }

        const plan = this.resolveSku(skuId);
        logger.info(`💎 [Entitlement] Aktivasi SKU "${plan.name}" untuk User ${userId}`);

        try {
            const expiryDate = new Date(Date.now() + plan.durationDays * 86400 * 1000);
            await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
                state = state || {};
                state.entitlements = state.entitlements || {};
                state.entitlements[plan.id] = {
                    active: true,
                    activatedAt: new Date().toISOString(),
                    expiresAt: expiryDate.toISOString(),
                    planName: plan.name,
                };
                return state;
            });

            if (plan.rewardCoupons > 0) {
                await cacheManager.incrementUserSurvival(userId, "coupons", plan.rewardCoupons);
            }
            if (plan.rewardStarFragments > 0) {
                await cacheManager.incrementUserSurvival(userId, "starFragments", plan.rewardStarFragments);
            }

            return {
                success: true,
                userId,
                activatedPlan: plan.name,
                expiresAt: expiryDate,
            };
        } catch (err) {
            logger.error(`[Entitlement] Gagal aktivasi entitlement: ${err.message}`);
            return { success: false, error: err.message, userId };
        }
    }

    /**
     * Menangani pembaruan masa aktif langganan (ENTITLEMENT_UPDATE)
     * @param {object} entitlement
     * @returns {Promise<{success: boolean, userId: string}>}
     */
    async handleEntitlementUpdate(entitlement) {
        if (!entitlement) return { success: false };
        const userId = entitlement.userId || entitlement.user_id;
        const skuId = entitlement.skuId || entitlement.sku_id;
        const plan = this.resolveSku(skuId);

        logger.info(`🔄 [Entitlement] Pembaruan SKU "${plan.name}" untuk User ${userId}`);

        try {
            const endsAt = entitlement.endsAt || entitlement.ends_at;
            const expiryDate = endsAt ? new Date(endsAt) : new Date(Date.now() + plan.durationDays * 86400 * 1000);

            await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
                state = state || {};
                state.entitlements = state.entitlements || {};
                state.entitlements[plan.id] = {
                    active: true,
                    updatedAt: new Date().toISOString(),
                    expiresAt: expiryDate.toISOString(),
                    planName: plan.name,
                };
                return state;
            });

            return { success: true, userId, expiresAt: expiryDate };
        } catch (err) {
            logger.error(`[Entitlement] Gagal memperbarui entitlement: ${err.message}`);
            return { success: false, error: err.message, userId };
        }
    }

    /**
     * Menangani pembatalan atau kadaluwarsa langganan (ENTITLEMENT_DELETE)
     * @param {object} entitlement
     * @returns {Promise<{success: boolean, userId: string}>}
     */
    async handleEntitlementDelete(entitlement) {
        if (!entitlement) return { success: false };
        const userId = entitlement.userId || entitlement.user_id;
        const skuId = entitlement.skuId || entitlement.sku_id;
        const plan = this.resolveSku(skuId);

        logger.warn(`⚠️ [Entitlement] Pencabutan SKU "${plan.name}" untuk User ${userId}`);

        try {
            await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
                state = state || {};
                if (state.entitlements && state.entitlements[plan.id]) {
                    state.entitlements[plan.id].active = false;
                    state.entitlements[plan.id].revokedAt = new Date().toISOString();
                }
                return state;
            });

            return { success: true, userId, revokedPlan: plan.name };
        } catch (err) {
            logger.error(`[Entitlement] Gagal mencabut entitlement: ${err.message}`);
            return { success: false, error: err.message, userId };
        }
    }

    /**
     * Verifikasi signature Discord Webhook Entitlements
     * @param {string} signature
     * @param {string} timestamp
     * @param {string} rawBody
     * @param {string} [publicKey]
     * @returns {boolean}
     */
    verifySignature(signature, timestamp, rawBody, publicKey = env.DISCORD_PUBLIC_KEY) {
        if (!signature || !timestamp || !rawBody) return false;
        if (!publicKey) return true; // Fallback jika belum di-set di dev

        try {
            const isVerified = crypto.verify(
                null,
                Buffer.from(timestamp + rawBody),
                crypto.createPublicKey({
                    key: Buffer.concat([
                        Buffer.from("302a300506032b6570032100", "hex"),
                        Buffer.from(publicKey, "hex"),
                    ]),
                    format: "der",
                    type: "spki",
                }),
                Buffer.from(signature, "hex"),
            );
            return isVerified;
        } catch (_) {
            return false;
        }
    }
}

const entitlementService = new EntitlementService();
entitlementService.EntitlementService = EntitlementService;

module.exports = entitlementService;
