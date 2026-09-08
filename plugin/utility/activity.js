"use strict";

/**
 * @file activity.js
 * @description Slash command untuk meluncurkan Discord Activity (Embedded App) Naura World
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const env = require("../../src/config/env");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("activity")
    .setDescription("🎮 Luncurkan Discord Activity Mini-App Naura World di Voice Channel.")
    .addSubcommand((sub) =>
      sub
        .setName("launch")
        .setDescription("🚀 Buka mini-app Naura World bersama teman di voice channel."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("ℹ️ Informasi seputar integrasi Discord Embedded App SDK."),
    ),
  aliases: ["miniapp", "app"],

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand() || "launch";
    const displayName = ui.ux.resolveUserName(interaction);

    const dashboardOrigin =
      env.DASHBOARD_ORIGIN ||
      `http://localhost:${env.DASHBOARD_PORT || 3000}`;
    const activityUrl = `${dashboardOrigin}/pages/activity.html`;

    const eGamepad = ui.getEmoji("gamepad") || "🎮";
    const eStar = ui.getEmoji("star") || "🌟";
    const eRocket = ui.getEmoji("rocket") || "🚀";
    const eInfo = ui.getEmoji("info") || "ℹ️";

    if (subcommand === "info") {
      const infoContainer = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: `${eStar} Discord Embedded App SDK v2`,
        title: `${eGamepad} Tentang Naura World Activity`,
        iconURL: interaction.client.user.displayAvatarURL(),
        description: [
          `Halo Kak **${displayName}**! ${eStar}`,
          "",
          "**Naura World Activity** adalah game web mini interaktif yang berjalan langsung di dalam Discord client via iframe aman.",
          "",
          "✨ **Fitur Utama Activity:**",
          "• **TCG Card Battle:** Pertarungan kartu anime multiplayer real-time di voice channel.",
          "• **Interactive Survival Map:** Jelajahi 6 wilayah Naura Wilds secara visual.",
          "• **Synchronized Music Controller:** Kendali playlist musik bersama teman satu voice channel.",
          "",
          `> ${eInfo} **Cara Akses:** Buka Voice Channel di server ini, lalu klik ikon Roket (**Start an Activity**) atau gunakan tombol di bawah.`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({
        ...infoContainer,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Subcommand: launch
    const memberVoice = interaction.member?.voice?.channel;
    const voiceNote = memberVoice
      ? `🔊 **Voice Channel Aktif:** <#${memberVoice.id}> (Siap diluncurkan!)`
      : `⚠️ *Kamu belum bergabung ke Voice Channel. Masuk ke Voice Channel untuk bermain bersama teman!*`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Buka Naura World Activity")
        .setStyle(ButtonStyle.Link)
        .setURL(activityUrl)
        .setEmoji(ui.parseEmoji(eGamepad) || { name: "🎮" }),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://dsc.gg/naura-hoshino")
        .setEmoji(ui.parseEmoji(ui.getEmoji("support") || "💬")),
    );

    const launchContainer = buildContainerV2({
      accentColorHex: "#38BDF8",
      authorName: `${eRocket} Peluncuran Activity Discord`,
      title: `${eGamepad} Naura World: Discord Mini-App`,
      iconURL: interaction.client.user.displayAvatarURL(),
      description: [
        `Halo Kak **${displayName}**! Naura World Activity siap dimainkan langsung di Discord!`,
        "",
        voiceNote,
        "",
        "🕹️ **Langkah Menjalankan di Discord Voice Channel:**",
        "1. Masuk ke Voice Channel bersama teman-temanmu.",
        "2. Klik tombol roket 🚀 (**Start an Activity**) di pojok kiri bawah voice channel.",
        "3. Pilih **Naura World Activity** atau gunakan tombol webview di bawah ini.",
        "",
        "- # *Nikmati pengalaman visual RPG dan Card Battle tanpa keluar dari Discord!*",
      ].join("\n"),
      buttonsRow: row,
      footerText: ui.getFooter("utility"),
    });

    return interaction.reply(launchContainer);
  },
};
