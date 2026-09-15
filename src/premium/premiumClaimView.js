"use strict";

/**
 * premiumClaimView.js - Penanganan Klaim Hadiah & Gaji Dividen Harian Anggota V.I.P.
 *
 * Mengelola:
 *   1. Verifikasi status langganan V.I.P aktif.
 *   2. Pembatasan klaim harian (Cooldown 24 Jam via Redis / Memory fallback).
 *   3. Penyerahan dividen Naura Coupon, Star Fragments, dan Mystery Box secara atomik.
 */

const cacheManager = require("../managers/cacheManager");
const redisManager = require("../managers/redisManager");
const ui = require("../config/ui");
const { buildContainerV2, buildErrorContainerV2 } = require("../utils/NauraContainerBuilder");
const {
  checkPremiumStatus,
  getUserPremiumTier,
  getDailyStipend,
} = require("./premiumHelper");
const { addItemsAtomic } = require("../survival/engines/inventoryHelper");

const CLAIM_COOLDOWN_KEY = "cooldown:premium_claim:";

async function runClaim(interaction) {
  const userId = interaction.user.id;
  const isPremium = await checkPremiumStatus(userId);

  if (!isPremium) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: "Akses V.I.P Diperlukan",
        description: [
          "Hadiah dividen harian hanya tersedia untuk anggota **Naura V.I.P** aktif.",
          "",
          "Kamu dapat mengaktifkan V.I.P lewat:",
          "> • `/premium buy` - Beli menggunakan Naura Coupon in-game.",
          "> • `/premium info` - Langganan via QRIS.",
        ].join("\n"),
        footerText: ui.getFooter("premium"),
      }),
    );
  }

  const profile = await cacheManager.getUserProfile(userId);
  const tier = getUserPremiumTier(profile);
  const stipend = getDailyStipend(tier);

  if (!stipend) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: "Paket Tidak Memiliki Dividen",
        description: "Tier Voter tidak memiliki dividen harian. Upgrade ke Starter, Supporter, Friends, atau V.I.P!",
        footerText: ui.getFooter("premium"),
      }),
    );
  }

  // Pengecekan Cooldown 24 Jam
  const redisKey = `${CLAIM_COOLDOWN_KEY}${userId}`;
  if (redisManager.isReady) {
    const lastClaim = await redisManager.getCache(redisKey);
    if (lastClaim) {
      const remainingMs = parseInt(lastClaim, 10) - Date.now();
      if (remainingMs > 0) {
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Dividen Sudah Diklaim Hari Ini",
            description: `Kamu sudah mengambil dividen harianmu. Silakan kembali dalam **${hours} jam ${minutes} menit** lagi.`,
            footerText: ui.getFooter("premium"),
          }),
        );
      }
    }
  }

  // Set Cooldown 24 Jam
  const nextClaimTime = Date.now() + 24 * 60 * 60 * 1000;
  if (redisManager.isReady) {
    await redisManager.setCache(redisKey, String(nextClaimTime), 86400).catch(() => {});
  }

  // Penyerahan Hadiah Secara Atomik
  const rewardLines = [];

  if (stipend.coupons > 0) {
    await cacheManager.incrementUserSurvival(userId, "coupons", stipend.coupons);
    rewardLines.push(`• 🎫 **+${stipend.coupons} Naura Coupon** (Mata uang langka)`);
  }

  if (stipend.nsf > 0) {
    await cacheManager.incrementUserSurvival(userId, "starFragments", stipend.nsf);
    rewardLines.push(`• 💰 **+${stipend.nsf.toLocaleString("id-ID")} Star Fragments**`);
  }

  if (stipend.mysteryBox) {
    const boxItem = {
      id: stipend.mysteryBox,
      name: stipend.mysteryBox === "legendary_relic_box" ? "Legendary Relic Box" : stipend.mysteryBox === "rare_mystery_box" ? "Rare Mystery Box" : "Common Mystery Box",
      type: "consumable",
      tier: tier === "vip" ? 5 : tier === "friends" ? 4 : 3,
      amount: 1,
    };
    await addItemsAtomic(userId, [boxItem]);
    rewardLines.push(`• 🎁 **+1 ${boxItem.name}** (Tersimpan di Backpack)`);
  }

  if (stipend.dungeonKeys > 0) {
    const keyItem = {
      id: "celestial_dungeon_key",
      name: "Celestial Dungeon Key",
      type: "material",
      tier: 4,
      amount: stipend.dungeonKeys,
    };
    await addItemsAtomic(userId, [keyItem]);
    rewardLines.push(`• 🗝️ **+${stipend.dungeonKeys} Celestial Dungeon Key**`);
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("gold") || "#FFD700",
    authorName: "NAURA V.I.P DAILY VAULT",
    title: "✨ Dividen Harian V.I.P Berhasil Diklaim!",
    expression: "celebrate",
    description: [
      `Terima kasih telah menjadi pendukung setia Naura! Dividen harian untuk tier **${tier.toUpperCase()}** telah dicairkan:`,
      "",
      ...rewardLines,
      "",
      "-# Dividen dapat diklaim kembali setiap 24 jam sekali. Jangan lupa kembali esok hari!",
    ].join("\n"),
    footerText: ui.getFooter("premium"),
  });

  return interaction.editReply(payload);
}

module.exports = { runClaim };
