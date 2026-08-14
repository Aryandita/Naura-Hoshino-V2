"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");
const cacheManager = require("../../managers/cacheManager");
const { BANNERS, getBannerPool } = require("../data/gachaBanners");
const { addItemsAtomic } = require("../engines/inventoryHelper");

// Helper function to pick item based on rate
function pullGachaItem(pool, banner, pityCounter) {
  let isPity = pityCounter >= banner.pityMax;
  
  // Decide Rarity
  let selectedRarity = "Biasa";
  if (isPity) {
    selectedRarity = banner.rates[banner.rates.length - 1].rarity; // Top rarity
  } else {
    let rand = Math.random() * 100;
    let cumulative = 0;
    for (const rate of banner.rates) {
      cumulative += rate.chance;
      if (rand <= cumulative) {
        selectedRarity = rate.rarity;
        break;
      }
    }
  }

  // Pick random item from that rarity pool
  const itemsInRarity = pool[selectedRarity] || [];
  if (itemsInRarity.length === 0) return null;
  const item = itemsInRarity[Math.floor(Math.random() * itemsInRarity.length)];
  return { item, isPity };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gacha")
    .setDescription("Sistem Gacha Naura - Undi Nasibmu!")
    .addSubcommand((sub) =>
      sub
        .setName("roll")
        .setDescription("Lakukan gacha pada banner tertentu")
        .addStringOption((opt) =>
          opt
            .setName("banner")
            .setDescription("Pilih banner gacha")
            .setRequired(true)
            .addChoices(
              { name: "Silver Supply Drop (Naura Coin)", value: "standard" },
              { name: "Gold Mystic Crate (NFS)", value: "gold" },
              { name: "Diamond Mythic Crate (Naura Coupon)", value: "premium" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("equip")
        .setDescription("Pasang banner visual ke profil atau musik")
        .addStringOption((opt) =>
          opt
            .setName("item_id")
            .setDescription("ID Banner yang kamu miliki")
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === "roll") {
      const bannerId = interaction.options.getString("banner");
      const bannerData = await getBannerPool(bannerId);
      
      if (!bannerData) {
        return interaction.reply({
          embeds: [buildErrorContainerV2({ title: "Banner Tidak Ditemukan", description: "Banner gacha tidak valid." })],
          flags: MessageFlags.Ephemeral
        });
      }

      const survival = await cacheManager.getUserSurvival(userId);
      if (!survival) {
        return interaction.reply({
          embeds: [buildErrorContainerV2({ title: "Profil Tidak Ditemukan", description: "Kamu belum memulai perjalanan survival." })],
          flags: MessageFlags.Ephemeral
        });
      }

      // Check balance
      const cost = bannerData.banner.cost;
      const currencyType = bannerData.banner.currency;
      let balance = 0;
      let profile = null;

      if (currencyType === "coin") {
        profile = await cacheManager.getUserProfile(userId);
        balance = profile ? profile.economy_wallet : 0;
      } else if (currencyType === "starFragments") {
        balance = survival.starFragments;
      } else if (currencyType === "coupon") {
        balance = survival.coupons;
      }

      if (balance < cost) {
        let currName = currencyType === "coin" ? "Naura Coin" : (currencyType === "starFragments" ? "NFS" : "Naura Coupon");
        return interaction.reply({
          embeds: [buildErrorContainerV2({ title: "Saldo Tidak Cukup", description: `Kamu membutuhkan ${cost} ${currName} untuk roll banner ini.` })],
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply();

      // Deduct balance
      if (currencyType === "coin") {
        await cacheManager.debitUserProfile(userId, "economy_wallet", cost);
      } else if (currencyType === "starFragments") {
        await cacheManager.debitUserSurvival(userId, "starFragments", cost);
      } else if (currencyType === "coupon") {
        await cacheManager.debitUserSurvival(userId, "coupons", cost);
      }

      // Fetch and Update Pity
      let rpgState = typeof survival.rpg_state === "string" ? JSON.parse(survival.rpg_state) : (survival.rpg_state || {});
      const pityKey = `pity_${bannerId}`;
      let pityCounter = rpgState[pityKey] || 0;
      pityCounter += 1;

      // Roll
      const pullResult = pullGachaItem(bannerData.pool, bannerData.banner, pityCounter);
      
      if (!pullResult || !pullResult.item) {
        return interaction.editReply({
          embeds: [buildErrorContainerV2({ title: "Gagal Roll", description: "Terjadi kesalahan internal saat menarik item." })]
        });
      }

      // Reset Pity if we got the highest rarity
      const isTopRarity = pullResult.item.rarity === bannerData.banner.rates[bannerData.banner.rates.length - 1].rarity;
      if (isTopRarity) {
        pityCounter = 0;
      }

      // Save Pity
      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (draft) => {
        draft[pityKey] = pityCounter;
      });

      // Add item to inventory
      await addItemsAtomic(userId, [{ id: pullResult.item.id, amount: 1 }]);

      const colorMap = {
        "Biasa": "#B2BABB",
        "Langka": "#3498DB",
        "Epic": "#9B59B6",
        "Legendary": "#F1C40F",
        "Mythic": "#E74C3C"
      };

      const path = require("path");
      const { AttachmentBuilder } = require("discord.js");
      const lunaPath = path.join(__dirname, "../../assets/survival/characters/luna_gacha.jpeg");
      const lunaAttachment = new AttachmentBuilder(lunaPath, { name: "luna_gacha.jpeg" });
      
      const payload = buildContainerV2({
        accentColorHex: colorMap[pullResult.item.rarity] || "#FFFFFF",
        authorName: "Luna - Penjaga Gacha",
        iconURL: "attachment://luna_gacha.jpeg",
        title: `🎰 Hasil Gacha: ${bannerData.banner.name}`,
        description: `Selamat! Kamu mendapatkan **${pullResult.item.name}** [${pullResult.item.rarity}]\n\n${pullResult.item.description}`,
        footerText: pullResult.isPity ? "Guaranteed Pity!" : `Pity Counter: ${pityCounter}/${bannerData.banner.pityMax}`,
      });

      return interaction.editReply({ ...payload, files: [lunaAttachment] });
    } 
    else if (subcommand === "equip") {
      const itemId = interaction.options.getString("item_id");
      const itemsArray = require("../data/items");
      const targetItem = itemsArray.find(i => i.id === itemId);

      if (!targetItem || targetItem.category !== "banner") {
        return interaction.reply({
          embeds: [buildErrorContainerV2({ title: "Item Tidak Valid", description: "ID yang dimasukkan bukan banner." })],
          flags: MessageFlags.Ephemeral
        });
      }

      // Check if user has it
      const profile = await cacheManager.getUserProfile(userId);
      let inventory = {};
      try { inventory = typeof profile.inventory === "string" ? JSON.parse(profile.inventory) : (profile.inventory || {}); } catch(e) {}

      if (!inventory[itemId] || inventory[itemId] <= 0) {
        return interaction.reply({
          embeds: [buildErrorContainerV2({ title: "Item Tidak Dimiliki", description: "Kamu tidak memiliki banner ini di inventory." })],
          flags: MessageFlags.Ephemeral
        });
      }

      // Save to Profile
      await cacheManager.mutateUserProfileJson(userId, "settings", (draft) => {
        draft.equippedBanner = targetItem.attributes?.banner_url || null;
      });

      return interaction.reply({
        embeds: [buildContainerV2({ title: "Banner Terpasang!", description: `Kamu berhasil memasang **${targetItem.name}** sebagai banner profil & musik utamamu.` })],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
