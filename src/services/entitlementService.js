"use strict";

/**
 * @file entitlementService.js
 * @description Layanan penanganan monetisasi Discord Entitlements & Premium Subscriptions API.
 * Menangani pembelian in-app subscriptions, aktivasi otomatis Star Pass, VIP/VVIP, dan Naura Premium Tier.
 */

const crypto = require("node:crypto");
const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");
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
      // 1. Aktivasi status premium dan masa aktif di UserProfile
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

      // 2. Tambahkan reward kupon dan Star Fragments secara atomik
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

module.exports = new EntitlementService();
