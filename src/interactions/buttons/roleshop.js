const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const cacheManager = require("../../managers/cacheManager");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const RoleLease = require("../../models/RoleLease");

module.exports = {
  customId: "roleshop_buy_",
  execute: async (interaction, args) => {
    // args: [roleId, currency?]
    const roleId = args[0];
    const currency = args[1]; // "nsf", "coin", "coupon"

    const guildData = await cacheManager.getGuildSettings(interaction.guild.id);
    const shop = guildData?.settings?.roleShop || [];
    const item = shop.find((r) => r.roleId === roleId);

    if (!item) {
      return interaction.reply({
        content: "Item ini sudah tidak dijual.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const roleObj = interaction.guild.roles.cache.get(roleId);
    if (!roleObj) {
      return interaction.reply({
        content: "Role tidak ditemukan di server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!currency) {
      // Tampilkan 3 opsi pembayaran
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`roleshop_buy_${roleId}_nsf`)
          .setLabel(`Bayar pakai NSF (${item.prices.nsf})`)
          .setEmoji("💠")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`roleshop_buy_${roleId}_coin`)
          .setLabel(`Bayar pakai Coin (${item.prices.coin})`)
          .setEmoji("🪙")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`roleshop_buy_${roleId}_coupon`)
          .setLabel(`Bayar pakai Coupon (${item.prices.coupon})`)
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Success),
      );

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🛍️ Pilih Metode Pembayaran",
        description: `Kamu akan menyewa role **${roleObj.name}** selama **${item.days} Hari**.\nSilakan pilih metode pembayaran di bawah ini.`,
        buttonsRow: row,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    // Proses Pembayaran
    const userId = interaction.user.id;
    const survival = await cacheManager.getUserSurvival(userId);
    const profile = await cacheManager.getUserProfile(userId);

    let price = 0;
    let balance = 0;
    let currencyName = "";

    if (currency === "nsf") {
      price = item.prices.nsf;
      balance = survival.starFragments || 0;
      currencyName = "NSF";
    } else if (currency === "coin") {
      price = item.prices.coin;
      balance = profile.economy_wallet || 0;
      currencyName = "Naura Coin";
    } else if (currency === "coupon") {
      price = item.prices.coupon;
      balance = survival.coupons || 0;
      currencyName = "Naura Coupon";
    }

    if (balance < price) {
      return interaction.reply({
        content: `${ui.getEmoji("cross") || "❌"} Saldo **${currencyName}** kamu tidak cukup! (Butuh: ${price})`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Lakukan pemotongan saldo
    if (currency === "nsf") {
      await cacheManager.debitUserSurvival(userId, "starFragments", price);
    } else if (currency === "coin") {
      await cacheManager.debitUserProfile(userId, "economy_wallet", price);
    } else if (currency === "coupon") {
      await cacheManager.debitUserSurvival(userId, "coupons", price);
    }

    // Tambahkan role
    await interaction.member.roles.add(roleObj).catch(() => {});

    // Catat sewa
    const expiresAt = new Date(Date.now() + item.days * 24 * 60 * 60 * 1000);
    await RoleLease.upsert({
      userId,
      guildId: interaction.guild.id,
      roleId,
      expiresAt,
    });

    const successPayload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22C55E",
      title: "🎉 Pembelian Berhasil!",
      description: `Kamu telah berhasil menyewa role **${roleObj.name}** selama **${item.days} Hari**.\nRole akan dicabut otomatis pada <t:${Math.floor(expiresAt.getTime() / 1000)}:f>.`,
      footerText: ui.getFooter("core"),
    });

    return interaction.reply({
      ...successPayload,
      flags: MessageFlags.Ephemeral,
    });
  },
};
