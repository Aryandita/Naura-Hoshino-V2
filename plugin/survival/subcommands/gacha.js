"use strict";

const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const cacheManager = require("../../../src/managers/cacheManager");
const { addItemsAtomic } = require("../../../src/survival/engines/inventoryHelper");
const { BANNERS, getBannerPool } = require("../../../src/survival/data/gachaBanners");

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const bannerId = interaction.options.getString("banner");

    const bannerData = await getBannerPool(bannerId);
    if (!bannerData) {
      return ui.sendError(
        interaction,
        "Banner gacha tersebut tidak ditemukan.",
        true,
      );
    }

    const { banner, pool } = bannerData;

    // Validasi dan potong saldo secara atomik
    let debitSuccess = false;
    if (banner.currency === "coin") {
      debitSuccess = await cacheManager.debitUserProfile(
        userId,
        "economy_wallet",
        banner.cost,
      );
    } else if (banner.currency === "coupon") {
      debitSuccess = await cacheManager.debitUserSurvival(
        userId,
        "coupons",
        banner.cost,
      );
    }

    if (!debitSuccess) {
      return ui.sendError(
        interaction,
        `Kamu membutuhkan **${banner.cost} ${banner.currency === "coin" ? "Naura Coin" : "Naura Coupon"}** untuk roll di banner ini!`,
        true,
      );
    }

    // Ambil data user survival untuk memanipulasi pity counter
    const mutateRes = await cacheManager.mutateUserSurvivalJson(
      userId,
      "rpg_state",
      (raw) => {
        const state = (typeof raw === "string" ? JSON.parse(raw) : raw) || {};
        if (!state.gacha) state.gacha = {};
        if (!state.gacha[bannerId]) state.gacha[bannerId] = { pity: 0 };

        state.gacha[bannerId].pity += 1;
        return state;
      },
    );

    if (!mutateRes.ok) {
      return ui.sendError(
        interaction,
        "Terjadi kesalahan sistem saat memproses pity gacha. Koin/Kupon mu tetap aman.",
        true,
      );
    }

    // Pity check
    const currentPity = mutateRes.value.gacha[bannerId].pity;
    let isPity = false;
    let rarityRolled = "";

    if (currentPity >= banner.pityMax) {
      isPity = true;
      // Standard banner guarantees at least Epic, Premium guarantees Mythic
      rarityRolled =
        bannerId === "premium"
          ? "Mythic"
          : Math.random() > 0.8
            ? "Legendary"
            : "Epic";

      // Reset pity
      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (raw) => {
        const state = (typeof raw === "string" ? JSON.parse(raw) : raw) || {};
        state.gacha[bannerId].pity = 0;
        return state;
      });
    } else {
      // Normal RNG Roll
      const rng = Math.random() * 100;
      let cumulative = 0;
      for (const rate of banner.rates) {
        cumulative += rate.chance;
        if (rng <= cumulative) {
          rarityRolled = rate.rarity;
          break;
        }
      }
    }

    if (!rarityRolled) rarityRolled = banner.rates[0].rarity; // Fallback

    const possibleItems = pool[rarityRolled];
    if (!possibleItems || possibleItems.length === 0) {
      return ui.sendError(
        interaction,
        `Sistem gagal menemukan item dengan kelangkaan ${rarityRolled}.`,
        true,
      );
    }

    // Ambil 1 barang acak dari pool tersebut
    const itemWon =
      possibleItems[Math.floor(Math.random() * possibleItems.length)];

    // Masukkan ke inventory secara atomik
    const addResult = await addItemsAtomic(userId, [
      { id: itemWon.id, name: itemWon.name, amount: 1 },
    ]);
    if (!addResult.ok) {
      return ui.sendError(
        interaction,
        "Gagal memasukkan hadiah ke inventory. Hubungi admin.",
        true,
      );
    }

    // Tentukan warna berdasarkan rarity
    let color = "#FFFFFF";
    let starEmoji = ui.getEmoji("star") || "⭐";
    if (rarityRolled === "Biasa") color = "#A0A0A0";
    if (rarityRolled === "Langka") {
      color = "#3B82F6";
      starEmoji = ui.getEmoji("star") || "🌟";
    }
    if (rarityRolled === "Epic") {
      color = "#A855F7";
      starEmoji = ui.getEmoji("sparkles") || "✨";
    }
    if (rarityRolled === "Legendary") {
      color = "#F59E0B";
      starEmoji = ui.getEmoji("fire") || "🔥";
    }
    if (rarityRolled === "Mythic") {
      color = "#EF4444";
      starEmoji = ui.getEmoji("diamond") || "💎";
    }

    const pityDesc = isPity
      ? `\n\n*(${ui.getEmoji("celebrate") || "🎉"} Pity Tercapai! Hadiah Terjamin!)*`
      : `\n\n*(Pity Banner: ${currentPity}/${banner.pityMax})*`;

    const payload = buildContainerV2({
      accentColorHex: color,
      title: `${ui.getEmoji("gacha") || "🎰"} Gacha: ${banner.name}`,
      description: `Kamu melakukan roll gacha dan mendapatkan:\n\n${starEmoji} **${itemWon.name}**\n> *Kelangkaan:* **${rarityRolled}**\n> *Deskripsi:* ${itemWon.description}${pityDesc}`,
      footerText: ui.getFooter("survival"),
    });

    // if the survival framework defers reply, we use editReply
    if (interaction.deferred) {
      return interaction.editReply(payload);
    } else {
      return interaction.reply(payload);
    }
  },
};
