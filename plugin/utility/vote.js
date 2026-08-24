"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("🗳️ Vote Naura Hoshino dan dapatkan Trial V.I.P 12 Jam + Milestone Rewards!"),

  async execute(interaction) {
    const topGgLink = "https://top.gg/bot/1483665745727721543?s=00487c531de33";
    const displayName = ui.ux.resolveUserName(interaction);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Vote di Top.gg")
        .setStyle(ButtonStyle.Link)
        .setURL(topGgLink)
        .setEmoji(ui.parseEmoji(ui.getEmoji("heart") || "💖")),
      new ButtonBuilder()
        .setCustomId("btn_vote_claim")
        .setLabel("Klaim Hadiah Vote")
        .setStyle(ButtonStyle.Success)
        .setEmoji(ui.parseEmoji(ui.getEmoji("gift") || "🎁")),
      new ButtonBuilder()
        .setLabel("Bantuan / Support")
        .setStyle(ButtonStyle.Link)
        .setURL("https://dsc.gg/naura-hoshino")
        .setEmoji(ui.parseEmoji(ui.getEmoji("support") || "💬"))
    );

    const eGift = ui.getEmoji("gift") || "🎁";
    const eFire = ui.getEmoji("fire") || "🔥";
    const eTrophy = ui.getEmoji("trophy") || "🏆";
    const eMail = ui.getEmoji("envelope") || "📧";
    const eStar = ui.getEmoji("star") || "🌟";
    const eVote = ui.getEmoji("topgg") || "🗳️";

    const desc =
      `Halo Kak **${displayName}**! Bantu Naura untuk terus berkembang dan menjangkau lebih banyak teman baru dengan memberikan **Vote** di Top.gg setiap 12 Jam sekali!\n\n` +
      `${eGift} **HADIAH INSTAN SETIAP VOTE:**\n` +
      `• **🗳️ Paket Premium Voter 12 Jam** (1.15x XP Boost, +10% Gaji Survival, 1.15x Minigame Reward)\n` +
      `• **1-2 Naura Coupons** & **+1.500 Naura Coins**\n` +
      `• ${eFire} **Weekend Multiplier:** 2x Kupon & 24 Jam Durasi setiap Jumat s/d Minggu!\n\n` +
      `${eTrophy} **PENCAPAIAN EKSKLUSIF 30 HARI:**\n` +
      `• **30 Hari Vote Berturut-turut:** Dapatkan Achievement **"Naura Biggest Fan"** + Gratis **🌱 Starter Plan (7 Hari)**!\n\n` +
      `${eMail} **Pertanyaan / Kendala Vote:** Hubungi kami via Email Resmi \`naurahoshino@gmail.com\` atau join [Support Server](https://dsc.gg/naura-hoshino).\n` +
      `- # *Tips: Aktifkan pengingat vote DM di \`/notifications\` agar kamu tidak lupa vote setiap 12 jam.*`;

    const container = buildContainerV2({
      accentColorHex: ui.getColor("premium_voter") || "#F43F5E",
      authorName: `${eStar} Dukung Naura Hoshino!`,
      title: `${eVote} Vote & Dapatkan Paket Premium Voter`,
      iconURL: interaction.client.user.displayAvatarURL(),
      description: desc,
      buttonsRow: row,
      footerText: ui.getFooter("utility"),
    });

    await interaction.reply(container);
  },

  async executePrefix(message) {
    const topGgLink = "https://top.gg/bot/1483665745727721543?s=00487c531de33";
    const displayName = message.author.displayName || message.author.username;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Vote di Top.gg")
        .setStyle(ButtonStyle.Link)
        .setURL(topGgLink)
        .setEmoji(ui.parseEmoji(ui.getEmoji("heart") || "💖")),
      new ButtonBuilder()
        .setCustomId("btn_vote_claim")
        .setLabel("Klaim Hadiah Vote")
        .setStyle(ButtonStyle.Success)
        .setEmoji(ui.parseEmoji(ui.getEmoji("gift") || "🎁")),
      new ButtonBuilder()
        .setLabel("Bantuan / Support")
        .setStyle(ButtonStyle.Link)
        .setURL("https://dsc.gg/naura-hoshino")
        .setEmoji(ui.parseEmoji(ui.getEmoji("support") || "💬"))
    );

    const eGift = ui.getEmoji("gift") || "🎁";
    const eFire = ui.getEmoji("fire") || "🔥";
    const eTrophy = ui.getEmoji("trophy") || "🏆";
    const eMail = ui.getEmoji("envelope") || "📧";
    const eStar = ui.getEmoji("star") || "🌟";
    const eVote = ui.getEmoji("topgg") || "🗳️";

    const desc =
      `Halo Kak **${displayName}**! Bantu Naura untuk terus berkembang dan menjangkau lebih banyak teman baru dengan memberikan **Vote** di Top.gg setiap 12 Jam sekali!\n\n` +
      `${eGift} **HADIAH INSTAN SETIAP VOTE:**\n` +
      `• **🗳️ Paket Premium Voter 12 Jam** (1.15x XP Boost, +10% Gaji Survival, 1.15x Minigame Reward)\n` +
      `• **1-2 Naura Coupons** & **+1.500 Naura Coins**\n` +
      `• ${eFire} **Weekend Multiplier:** 2x Kupon & 24 Jam Durasi setiap Jumat s/d Minggu!\n\n` +
      `${eTrophy} **PENCAPAIAN EKSKLUSIF 30 HARI:**\n` +
      `• **30 Hari Vote Berturut-turut:** Dapatkan Achievement **"Naura Biggest Fan"** + Gratis **🌱 Starter Plan (7 Hari)**!\n\n` +
      `${eMail} **Pertanyaan / Kendala Vote:** Hubungi kami via Email Resmi \`naurahoshino@gmail.com\` atau join [Support Server](https://dsc.gg/naura-hoshino).\n` +
      `- # *Tips: Aktifkan pengingat vote DM di \`/notifications\` agar kamu tidak lupa vote setiap 12 jam.*`;

    const container = buildContainerV2({
      accentColorHex: ui.getColor("premium_voter") || "#F43F5E",
      authorName: `${eStar} Dukung Naura Hoshino!`,
      title: `${eVote} Vote & Dapatkan Paket Premium Voter`,
      iconURL: message.client.user.displayAvatarURL(),
      description: desc,
      buttonsRow: row,
      footerText: ui.getFooter("utility"),
    });

    await message.reply(container);
  },
};
