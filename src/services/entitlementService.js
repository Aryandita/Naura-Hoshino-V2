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
        tier: "tier1",
    },
    SKU_PREMIUM_VIP: {
        id: "sku_premium_vip",
        type: "VIP_SUBSCRIPTION",
        name: "Naura VIP Member",
        durationDays: 30,
        rewardCoupons: 25,
        rewardStarFragments: 5000,
        tier: "tier2",
    },
    SKU_PREMIUM_VVIP: {
        id: "sku_premium_vvip",
        type: "VVIP_SUBSCRIPTION",
        name: "Naura VVIP Elite",
        durationDays: 30,
        rewardCoupons: 60,
        rewardStarFragments: 15000,
        tier: "tier3",
    },
};

const TIER_WEIGHTS = {
    none: 0,
    voter: 1,
    vip_starter: 1,
    starter: 1,
    tier1: 2,
    supporter: 2,
    tier2: 3,
    friends: 3,
    tier3: 4,
    vip: 4,
};

class EntitlementService {
    constructor() {
        this.skus = DISCORD_SKUS;
        this.processedEntitlements = new Set();
    }

    /**
     * Mengecek apakah user memiliki status premium aktif.
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async isUserPremium(userId) {
        if (!userId) return false;
        if (env.OWNER_IDS && env.OWNER_IDS.includes(userId)) {
            return true;
        }
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
     * Single Source of Truth (SSOT) untuk perpanjangan masa aktif premium.
     * @param {string} userId
     * @param {number} durationMs Waktu perpanjangan dalam milidetik
     * @param {string} [tier] Tier premium yang diaktifkan (opsional)
     * @returns {Promise<Date>} Waktu kedaluwarsa yang baru
     */
    async extendUserPremium(userId, durationMs, tier = null) {
        let expiry = new Date();

        if (typeof cacheManager.flushUser === "function") {
            await cacheManager.flushUser(userId);
        }

        let dbSucceeded = false;
        const canAttemptDb = Boolean(
            sequelize &&
            typeof sequelize.transaction === "function" &&
            env.NODE_ENV !== "test"
        );

        if (canAttemptDb) {
            try {
                const rowLock =
                    typeof sequelize.getDialect === "function" &&
                    sequelize.getDialect() === "sqlite"
                        ? {}
                        : { lock: true };

                let savedTier = null;
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
                    const fields = ["isPremium", "premiumUntil"];

                    if (tier && profile.rawAttributes && profile.rawAttributes.premium_tier) {
                        const currentWeight = TIER_WEIGHTS[profile.premium_tier] || 0;
                        const incomingWeight = TIER_WEIGHTS[tier] || 0;
                        if (!stillActive || incomingWeight >= currentWeight) {
                            profile.premium_tier = tier;
                            fields.push("premium_tier");
                        }
                    }

                    // Simpan di dalam transaksi agar penulisan atomik dan
                    // tidak menimpa kolom saldo numerik yang sedang mengantre flush.
                    await profile.save({
                        fields,
                        transaction: t,
                    });

                    savedTier = profile.premium_tier || null;
                });
                dbSucceeded = true;
                if (typeof cacheManager.updateUserProfile === "function") {
                    const cachePatch = {
                        isPremium: true,
                        premiumUntil: expiry,
                    };
                    if (savedTier) cachePatch.premium_tier = savedTier;
                    await cacheManager.updateUserProfile(userId, cachePatch).catch(() => {});
                }
            } catch (dbErr) {
                logger.debug?.(`[Entitlement] Database update fallback: ${dbErr.message}`);
            }
        }

        if (!dbSucceeded) {
            let base = Date.now();
            let currentTier = "none";
            let stillActive = false;

            if (typeof cacheManager.getUserProfile === "function") {
                const profile = await Promise.race([
                    cacheManager.getUserProfile(userId),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100)),
                ]).catch(() => null);

                if (
                    profile &&
                    profile.isPremium &&
                    profile.premiumUntil &&
                    new Date(profile.premiumUntil) > new Date()
                ) {
                    base = new Date(profile.premiumUntil).getTime();
                    stillActive = true;
                    currentTier = profile.premium_tier || "none";
                }
            }

            expiry = new Date(base + durationMs);

            const patch = {
                isPremium: true,
                premiumUntil: expiry,
            };

            if (tier) {
                const currentWeight = TIER_WEIGHTS[currentTier] || 0;
                const incomingWeight = TIER_WEIGHTS[tier] || 0;
                if (!stillActive || incomingWeight >= currentWeight) {
                    patch.premium_tier = tier;
                }
            }

            if (typeof cacheManager.updateUserProfile === "function") {
                await cacheManager.updateUserProfile(userId, patch).catch(() => {});
            }
        }

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
        const premiumData = settings.settings?.premium || settings.premium || {};
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
            if (item.id === skuId || String(skuId).includes(item.id)) {
                return { ...item };
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
            tier: "tier1",
        };
    }

    /**
     * Menangani saat langganan baru dibeli (ENTITLEMENT_CREATE)
     * @param {object} entitlement - Objek entitlement Discord
     * @returns {Promise<{success: boolean, activatedPlan?: string, userId: string, expiry?: Date, rewardCoupons?: number}>}
     */
    async handleEntitlementCreate(entitlement) {
        if (!entitlement) return { success: false, error: "Entitlement data empty" };

        const userId = entitlement.userId || entitlement.user_id;
        const skuId = entitlement.skuId || entitlement.sku_id;
        const entitlementId = entitlement.entitlementId || entitlement.id || entitlement.entitlement_id;

        if (!userId) {
            return { success: false, error: "Missing userId in entitlement" };
        }

        const plan = this.resolveSku(skuId);
        if (!plan) {
            logger.warn(`⚠️ [Entitlement] SKU tidak valid atau kosong ("${skuId}") untuk User ${userId}`);
            return { success: false, error: "Invalid or missing SKU in entitlement", userId };
        }

        logger.info(`💎 [Entitlement] Aktivasi SKU "${plan.name}" untuk User ${userId}`);

        // Proteksi Idempotensi pada memory set
        if (entitlementId && this.processedEntitlements.has(entitlementId)) {
            logger.info(`[Entitlement] Entitlement ${entitlementId} sudah pernah diproses (idempotent).`);
            let currentExpiry = new Date();
            try {
                if (typeof cacheManager.getUserProfile === "function") {
                    const existingProfile = await Promise.race([
                        cacheManager.getUserProfile(userId),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100)),
                    ]).catch(() => null);
                    if (existingProfile?.premiumUntil) {
                        currentExpiry = new Date(existingProfile.premiumUntil);
                    }
                }
            } catch (_) {}
            return {
                success: true,
                duplicate: true,
                userId,
                activatedPlan: plan.name,
                expiry: currentExpiry,
                expiresAt: currentExpiry,
                rewardCoupons: 0,
                tier: plan.tier,
            };
        }

        try {
            const durationMs = plan.durationDays * 86400 * 1000;

            let isDuplicateInState = false;

            // Catat ke json state rpg untuk cek idempotensi persisten
            await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
                state = state || {};
                state.processed_entitlements = state.processed_entitlements || [];

                if (entitlementId && state.processed_entitlements.includes(entitlementId)) {
                    isDuplicateInState = true;
                    return state;
                }

                if (entitlementId) {
                    state.processed_entitlements.push(entitlementId);
                }
                return state;
            });

            if (isDuplicateInState) {
                if (entitlementId) this.processedEntitlements.add(entitlementId);
                logger.info(`[Entitlement] Entitlement ${entitlementId} sudah tercatat di rpg_state.`);
                let currentExpiry = new Date();
                try {
                    if (typeof cacheManager.getUserProfile === "function") {
                        const existingProfile = await Promise.race([
                            cacheManager.getUserProfile(userId),
                            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100)),
                        ]).catch(() => null);
                        if (existingProfile?.premiumUntil) {
                            currentExpiry = new Date(existingProfile.premiumUntil);
                        }
                    }
                } catch (_) {}
                return {
                    success: true,
                    duplicate: true,
                    userId,
                    activatedPlan: plan.name,
                    expiry: currentExpiry,
                    expiresAt: currentExpiry,
                    rewardCoupons: 0,
                    tier: plan.tier,
                };
            }

            // Single Source of Truth: Delegasikan perpanjangan durasi langsung ke extendUserPremium
            const expiryDate = await this.extendUserPremium(userId, durationMs, plan.tier);

            // Perbarui rpg_state dengan data entitlement aktif dan expiryDate
            await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
                state = state || {};
                state.entitlements = state.entitlements || {};
                state.entitlements[plan.id] = {
                    active: true,
                    activatedAt: new Date().toISOString(),
                    expiresAt: expiryDate.toISOString(),
                    planName: plan.name,
                    entitlementId: entitlementId || null,
                    tier: plan.tier,
                };
                return state;
            });

            // Tambahkan reward coupon & star fragments
            if (plan.rewardCoupons > 0) {
                await cacheManager.incrementUserSurvival(userId, "coupons", plan.rewardCoupons);
            }
            if (plan.rewardStarFragments > 0) {
                await cacheManager.incrementUserSurvival(userId, "starFragments", plan.rewardStarFragments);
            }

            if (entitlementId) {
                this.processedEntitlements.add(entitlementId);
            }

            return {
                success: true,
                userId,
                activatedPlan: plan.name,
                expiry: expiryDate,
                expiresAt: expiryDate,
                rewardCoupons: plan.rewardCoupons,
                tier: plan.tier,
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
        if (!entitlement) return { success: false, error: "Entitlement data empty" };
        const userId = entitlement.userId || entitlement.user_id;
        const skuId = entitlement.skuId || entitlement.sku_id;

        if (!userId) {
            return { success: false, error: "Missing userId in entitlement" };
        }

        const plan = this.resolveSku(skuId);
        if (!plan) {
            logger.warn(`⚠️ [Entitlement] SKU tidak valid atau kosong ("${skuId}") untuk User ${userId}`);
            return { success: false, error: "Invalid or missing SKU in entitlement", userId };
        }

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
                    tier: plan.tier,
                };
                return state;
            });

            if (typeof cacheManager.updateUserProfile === "function") {
                await cacheManager.updateUserProfile(userId, {
                    isPremium: true,
                    premiumUntil: expiryDate,
                    premium_tier: plan.tier,
                }).catch(() => {});
            }

            return { success: true, userId, expiresAt: expiryDate };
        } catch (err) {
            logger.error(`[Entitlement] Gagal memperbarui entitlement: ${err.message}`);
            return { success: false, error: err.message, userId };
        }
    }

    /**
     * Menangani pembatalan atau kadaluwarsa langganan (ENTITLEMENT_DELETE)
     * @param {object} entitlement
     * @returns {Promise<{success: boolean, revoked: boolean, userId: string}>}
     */
    async handleEntitlementDelete(entitlement) {
        if (!entitlement) return { success: false, revoked: false };
        const userId = entitlement.userId || entitlement.user_id;
        const skuId = entitlement.skuId || entitlement.sku_id;

        if (!userId) {
            return { success: false, revoked: false, error: "Missing userId" };
        }

        const plan = this.resolveSku(skuId);
        if (!plan) {
            logger.warn(`⚠️ [Entitlement] SKU tidak valid atau kosong ("${skuId}") untuk User ${userId}`);
            return { success: false, revoked: false, error: "Invalid or missing SKU in entitlement", userId };
        }

        logger.warn(`⚠️ [Entitlement] Pencabutan SKU "${plan.name}" untuk User ${userId}`);

        try {
            let wasActive = false;
            let hasOtherActive = false;

            await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
                state = state || {};
                if (state.entitlements && plan && state.entitlements[plan.id]?.active) {
                    wasActive = true;
                    state.entitlements[plan.id].active = false;
                    state.entitlements[plan.id].revokedAt = new Date().toISOString();
                }
                hasOtherActive = Object.values(state.entitlements || {}).some(
                    (e) => e && e.active === true,
                );
                return state;
            });

            if (!wasActive) {
                logger.info(`[Entitlement] SKU "${plan.name}" tidak aktif untuk User ${userId}, pencabutan dilewati.`);
                return {
                    success: true,
                    revoked: false,
                    message: "Entitlement not active",
                    userId,
                    plan: plan.name,
                };
            }

            let hasUnexpiredExternalPremium = false;
            try {
                if (typeof cacheManager.getUserProfile === "function") {
                    const profile = await Promise.race([
                        cacheManager.getUserProfile(userId),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100)),
                    ]).catch(() => null);

                    if (profile?.premiumUntil && new Date(profile.premiumUntil) > new Date()) {
                        hasUnexpiredExternalPremium = true;
                    }
                }
            } catch (_) {}

            if (!hasOtherActive && !hasUnexpiredExternalPremium) {
                if (typeof cacheManager.updateUserProfile === "function") {
                    await cacheManager.updateUserProfile(userId, {
                        isPremium: false,
                        premiumUntil: null,
                        premium_tier: "none",
                    }).catch(() => {});
                }

                if (env.NODE_ENV !== "test" && sequelize && typeof sequelize.transaction === "function") {
                    try {
                        await sequelize.transaction(async (t) => {
                            const [profile] = await UserProfile.findOrCreate({
                                where: { userId },
                                transaction: t,
                            });
                            profile.isPremium = false;
                            profile.premiumUntil = null;
                            if (profile.rawAttributes && profile.rawAttributes.premium_tier) {
                                profile.premium_tier = "none";
                                await profile.save({
                                    fields: ["isPremium", "premiumUntil", "premium_tier"],
                                    transaction: t,
                                });
                            } else {
                                await profile.save({
                                    fields: ["isPremium", "premiumUntil"],
                                    transaction: t,
                                });
                            }
                        });
                    } catch (_) {}
                }

                if (typeof cacheManager.invalidateUserProfile === "function") {
                    await cacheManager.invalidateUserProfile(userId);
                }
            }

            return {
                success: true,
                revoked: true,
                userId,
                revokedPlan: plan.name,
            };
        } catch (err) {
            logger.error(`[Entitlement] Gagal mencabut entitlement: ${err.message}`);
            return { success: false, revoked: false, error: err.message, userId };
        }
    }

    /**
     * Verifikasi signature Discord Webhook Entitlements (Ed25519)
     * @param {string} signature
     * @param {string} timestamp
     * @param {string} rawBody
     * @param {string} [publicKey]
     * @returns {boolean}
     */
    verifySignature(signature, timestamp, rawBody, publicKey = env.DISCORD_PUBLIC_KEY) {
        if (!signature || !timestamp || !rawBody) return false;
        if (!publicKey || typeof publicKey !== "string") return false;

        const cleanKey = publicKey.trim();
        const cleanSig = typeof signature === "string" ? signature.trim() : "";

        // Discord public key must be 32 bytes (64 hex characters)
        if (cleanKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
            return false;
        }

        // Discord Ed25519 signature must be 64 bytes (128 hex characters)
        if (cleanSig.length !== 128 || !/^[0-9a-fA-F]{128}$/.test(cleanSig)) {
            return false;
        }

        try {
            const isVerified = crypto.verify(
                null,
                Buffer.from(timestamp + rawBody),
                crypto.createPublicKey({
                    key: Buffer.concat([
                        Buffer.from("302a300506032b6570032100", "hex"),
                        Buffer.from(cleanKey, "hex"),
                    ]),
                    format: "der",
                    type: "spki",
                }),
                Buffer.from(cleanSig, "hex"),
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
