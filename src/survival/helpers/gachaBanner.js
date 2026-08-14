"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const cacheManager = require("../../managers/cacheManager");
const { addItemsAtomic } = require("../engines/inventoryHelper");

// Daftar banner eksklusif Gacha (bisa dikembangkan)
const BANNER_POOL = [
  { id: "banner_sakura", name: "Sakura Blossom", rarity: 1 },
  { id: "banner_ocean", name: "Deep Ocean", rarity: 1 },
  { id: "banner_cyber", name: "Cyberpunk City", rarity: 2 },
  { id: "banner_galaxy", name: "Galaxy Space", rarity: 3 },
  { id: "banner_naura_vip", name: "Naura VIP Gold", rarity: 5 },
];

const GACHA_COST_COUPON = 5;

async function showGachaBannerShop(interaction, user) {
  const survival = await cacheManager.getUserSurvival(user.id);
  const coupons = survival ? survival.coupons || 0 : 0;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gacha_banner_roll")
      .setLabel(`Roll Banner (${GACHA_COST_COUPON} Kupon)`)
      .setEmoji(ui.getEmoji("coupon") || "🎫")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(coupons < GACHA_COST_COUPON),
    new ButtonBuilder()
      .setCustomId("gacha_banner_help")
      .setLabel("Info Banner")
      .setStyle(ButtonStyle.Secondary),
  );

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    title: "🎰 Toko Gacha Luna",
    authorName: "Luna Gacha",
    description: `Halo ${user.username}! Selamat datang di Toko Gacha Kosmetik.\n\nKamu bisa mendapatkan **Banner** eksklusif untuk dipasang di Profil dan Music Card milikmu!\n\n**Saldo Kuponmu:** ${coupons} 🎫\n*Satu kali roll butuh ${GACHA_COST_COUPON} Kupon.*`,
    iconURL: "https://i.imgur.com/example.png", // Fallback if no banner
    buttonsRow: row,
    footerText: ui.getFooter("survival"),
  });

  const msg = await interaction
    .followUp({ ...payload, flags: MessageFlags.Ephemeral })
    .catch(() => null);
  if (!msg) return;

  const collector = msg.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === user.id && i.customId.startsWith("gacha_banner_"),
    time: 120000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "gacha_banner_help") {
      const poolText = BANNER_POOL.map(
        (b) => `- **${b.name}** (Rarity: ${b.rarity}★)`,
      ).join("\n");
      return i.reply({
        content: `**Daftar Banner di Pool Gacha:**\n${poolText}\n\n*Banner yang didapat akan masuk ke tasmu dan bisa dipasang via \`n!banner set\`.*`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (i.customId === "gacha_banner_roll") {
      const currentSurvival = await cacheManager.getUserSurvival(user.id);
      if (
        !currentSurvival ||
        (currentSurvival.coupons || 0) < GACHA_COST_COUPON
      ) {
        return i.reply({
          content: "Kuponmu tidak cukup!",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Potong saldo
      await cacheManager.debitUserSurvival(
        user.id,
        "coupons",
        GACHA_COST_COUPON,
      );

      // Roll logic (weighted random)
      const totalWeight = BANNER_POOL.reduce(
        (acc, b) => acc + (10 - b.rarity),
        0,
      );
      let random = Math.floor(Math.random() * totalWeight);
      let selected = BANNER_POOL[0];

      for (const b of BANNER_POOL) {
        const weight = 10 - b.rarity;
        if (random < weight) {
          selected = b;
          break;
        }
        random -= weight;
      }

      // Beri item banner
      const itemId = selected.id;
      await addItemsAtomic(user.id, [{ id: itemId, amount: 1 }]);

      const rewardPayload = buildContainerV2({
        accentColorHex: selected.rarity >= 4 ? "#FFD700" : "#FFB6C1",
        title: "🎉 Selamat!",
        description: `Kamu mendapatkan kosmetik eksklusif:\n\n**[ ${selected.name} ]** (${selected.rarity}★)\n\nBanner ini sudah ditambahkan ke dalam tasmu.`,
        footerText: ui.getFooter("survival"),
      });

      await i.update({ ...rewardPayload, components: [] });
    }
  });
}

module.exports = { showGachaBannerShop };
