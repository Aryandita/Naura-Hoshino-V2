"use strict";

/**
 * premiumBuyView.js - Alur Pembelian & Perpanjangan Langganan V.I.P Menggunakan Mata Uang In-Game.
 *
 * Mengelola:
 *   1. Pembelian status V.I.P murni menggunakan Naura Coupon.
 *   2. Akumulasi durasi perpanjangan jika pengguna sudah memiliki status premium aktif.
 *   3. Pemotongan saldo secara atomik via cacheManager.debitUserSurvival.
 *   4. Pembaruan data isPremium dan premiumUntil pada UserProfile.
 */

const cacheManager = require("../managers/cacheManager");
const ui = require("../config/ui");
const { buildContainerV2, buildErrorContainerV2 } = require("../utils/NauraContainerBuilder");
const { tierByKey } = require("./premiumTiers");
const { sendPremiumDM } = require("./premiumNotify");

async function runBuy(interaction) {
  const tierKey = interaction.options.getString("paket");
  const userId = interaction.user.id;

  const tierInfo = tierByKey(tierKey);
  if (!tierInfo || tierInfo.tier === "voter") {
    return interaction.editReply(
      buildErrorContainerV2({
        title: "Paket Tidak Valid",
        description: "Pilihlah salah satu dari paket Starter, Supporter, Friends, atau V.I.P.",
        footerText: ui.getFooter("premium"),
      }),
    );
  }

  const cost = tierInfo.couponPrice;

  const survival = await cacheManager.getUserSurvival(userId);
  const currentBalance = Number(survival?.coupons || 0);

  if (currentBalance < cost) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: "Kupon Tidak Cukup",
        description: [
          `Kamu membutuhkan **${cost} Naura Coupon** untuk mengaktifkan paket **${tierInfo.name}**.`,
          "",
          `Saldo Kupon milikmu saat ini: **${currentBalance} Kupon**.`,
          "",
          "-# Kumpulkan Kupon dari Vote Top.gg harian (`/vote`), reward Battle Pass, atau event spesial server!",
        ].join("\n"),
        footerText: ui.getFooter("premium"),
      }),
    );
  }

  // Pemotongan Saldo Kupon Secara Atomik
  const debitSuccess = await cacheManager.debitUserSurvival(userId, "coupons", cost);
  if (!debitSuccess) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: "Transaksi Gagal",
        description: "Gagal memproses pemotongan kupon. Silakan coba lagi.",
        footerText: ui.getFooter("premium"),
      }),
    );
  }

  // Hitung Tanggal Kadaluarsa Baru (Akumulatif jika masih aktif)
  const profile = await cacheManager.getUserProfile(userId);
  const now = new Date();
  let baseDate = now;

  if (profile && profile.isPremium && profile.premiumUntil) {
    const existingUntil = new Date(profile.premiumUntil);
    if (existingUntil > now) {
      baseDate = existingUntil;
    }
  }

  const durationMs = tierInfo.days * 24 * 60 * 60 * 1000;
  const newUntil = new Date(baseDate.getTime() + durationMs);

  await cacheManager.updateUserProfile(userId, {
    isPremium: true,
    premiumUntil: newUntil,
  });

  // Notifikasi personal DM
  sendPremiumDM(interaction.client, userId, tierInfo.days, newUntil).catch(() => {});

  const untilFormatted = newUntil.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const payload = buildContainerV2({
    accentColorHex: ui.getPremiumColor(tierInfo.tier) || "#FFD700",
    authorName: "NAURA V.I.P SUBSCRIPTION STORE",
    title: `🎉 Selamat! Paket ${tierInfo.name} Telah Aktif`,
    expression: "celebrate",
    description: [
      `Pembelian langganan V.I.P berhasil menggunakan **${cost} Naura Coupon**!`,
      "",
      `> 👑 **Paket:** \`${tierInfo.name}\``,
      `> ⏳ **Tambahan Durasi:** \`+${tierInfo.days} Hari\``,
      `> 📅 **Aktif Hingga:** \`${untilFormatted}\``,
      "",
      "**Keistimewaan Baru yang Langsung Aktif:**",
      `• 💎 Gaji Dividen Harian via \`/premium claim\``,
      `• 🛡️ Durability Shield (Alat aus lebih lambat saat survival)`,
      `• ⚡ Akselerasi Cooldown & Boost Pengali XP`,
      `• 🎚️ Hak Akses Lossless Hi-Fi Audio & Filter DSP`,
      "",
      "-# Gunakan `/premium check` kapan saja untuk memantau sisa hari dan status manfaatmu.",
    ].join("\n"),
    footerText: ui.getFooter("premium"),
  });

  return interaction.editReply(payload);
}

module.exports = { runBuy };
