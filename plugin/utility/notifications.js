"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const notificationCenter = require("../../src/services/notificationCenter");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("notifications")
    .setDescription(
      "🔔 Atur preferensi notifikasi cerdas Naura ke Direct Message (DM) kamu.",
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;
    const displayName = ui.ux.resolveUserName(interaction);

    let prefs = await notificationCenter.getUserPreferences(userId);

    const renderPayload = (currentPrefs) => {
      const eGreen = ui.getEmoji("greenping") || "🟢";
      const eRed = ui.getEmoji("redping") || "🔴";
      const eFlash = ui.getEmoji("stamina") || "⚡";
      const eFire = ui.getEmoji("fire") || "🔥";
      const eChart = ui.getEmoji("chart") || "📈";
      const eCafe = ui.getEmoji("cafe") || "🎪";
      const eVote = ui.getEmoji("topgg") || "🗳️";
      const eBell = ui.getEmoji("bell") || "🔔";

      const statusIcon = (val) =>
        val ? `${eGreen} **Aktif**` : `${eRed} **Nonaktif**`;

      const desc =
        `Halo Kak **${displayName}**! Di sini kamu bisa mengatur notifikasi otomatis apa saja yang ingin dikirimkan Naura ke DM pribadimu secara real-time:\n\n` +
        `${eFlash} **Stamina Survival Penuh:** ${statusIcon(currentPrefs.stamina_full)}\n` +
        `${eFire} **Pengingat Daily Streak:** ${statusIcon(currentPrefs.daily_streak)}\n` +
        `${eChart} **Peringatan Saham $NRA:** ${statusIcon(currentPrefs.stock_alert)}\n` +
        `${eCafe} **Panen Kafe & Vivarium:** ${statusIcon(currentPrefs.idle_revenue)}\n` +
        `${eVote} **Pengingat Vote Cooldown:** ${statusIcon(currentPrefs.vote_reminder)}\n\n` +
        `*Klik tombol di bawah ini untuk mengubah status notifikasi secara instan:*`;

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_notif_stamina_full")
          .setLabel(`Stamina: ${currentPrefs.stamina_full ? "ON" : "OFF"}`)
          .setStyle(
            currentPrefs.stamina_full
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(ui.parseEmoji(ui.getEmoji("stamina")) || { name: "⚡" }),
        new ButtonBuilder()
          .setCustomId("toggle_notif_daily_streak")
          .setLabel(`Daily: ${currentPrefs.daily_streak ? "ON" : "OFF"}`)
          .setStyle(
            currentPrefs.daily_streak
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(ui.parseEmoji(ui.getEmoji("fire")) || { name: "🔥" }),
        new ButtonBuilder()
          .setCustomId("toggle_notif_stock_alert")
          .setLabel(`Saham: ${currentPrefs.stock_alert ? "ON" : "OFF"}`)
          .setStyle(
            currentPrefs.stock_alert
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(ui.parseEmoji(ui.getEmoji("chart")) || { name: "📈" }),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_notif_idle_revenue")
          .setLabel(
            `Kafe/Vivarium: ${currentPrefs.idle_revenue ? "ON" : "OFF"}`,
          )
          .setStyle(
            currentPrefs.idle_revenue
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(ui.parseEmoji(ui.getEmoji("cafe")) || { name: "🎪" }),
        new ButtonBuilder()
          .setCustomId("toggle_notif_vote_reminder")
          .setLabel(`Vote: ${currentPrefs.vote_reminder ? "ON" : "OFF"}`)
          .setStyle(
            currentPrefs.vote_reminder
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(ui.parseEmoji(ui.getEmoji("topgg")) || { name: "🗳️" }),
      );

      return {
        ...buildContainerV2({
          accentColorHex: "#38BDF8",
          title: `${eBell} Pusat Notifikasi Pribadi`,
          description: desc,
          expression: "smile",
          footerText: ui.getFooter("utility"),
        }),
        components: [row1, row2],
      };
    };

    const initialMsg = await interaction.editReply(renderPayload(prefs));

    const collector = initialMsg.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === userId && i.customId.startsWith("toggle_notif_"),
      time: 120000,
    });

    collector.on("collect", async (btnInt) => {
      const key = btnInt.customId.replace("toggle_notif_", "");
      const newStatus = !prefs[key];

      try {
        prefs = await notificationCenter.setUserPreference(
          userId,
          key,
          newStatus,
        );
        await btnInt.update(renderPayload(prefs));
      } catch (err) {
        await btnInt.reply({
          content: `❌ Gagal memperbarui pengaturan: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
