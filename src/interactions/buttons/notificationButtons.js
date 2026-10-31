"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const notificationCenter = require("../../services/notificationCenter");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

function renderNotificationPanel(displayName, currentPrefs) {
  const eGreen = ui.getEmoji("greenping") || "🟢";
  const eRed = ui.getEmoji("redping") || "🔴";
  const eFlash = ui.getEmoji("stamina") || "⚡";
  const eFire = ui.getEmoji("fire") || "🔥";
  const eChart = ui.getEmoji("chart") || "📈";
  const eCafe = ui.getEmoji("cafe") || "🎪";
  const eVote = ui.getEmoji("topgg") || "🗳️";
  const eBell = ui.getEmoji("bell") || "🔔";

  const statusIcon = (val) => (val ? `${eGreen} **Aktif**` : `${eRed} **Nonaktif**`);

  const desc =
    `Halo Kak **${displayName}**! Di sini kamu bisa mengatur notifikasi otomatis apa saja yang ingin dikirimkan Naura ke DM pribadimu secara real-time:\n\n` +
    `${eFlash} **Stamina Survival Penuh:** ${statusIcon(currentPrefs.stamina_full)}\n` +
    `${eFire} **Pengingat Daily Streak:** ${statusIcon(currentPrefs.daily_streak)}\n` +
    `${eChart} **Peringatan Saham $NRA:** ${statusIcon(currentPrefs.stock_alert)}\n` +
    `${eCafe} **Panen Kafe & Vivarium:** ${statusIcon(currentPrefs.idle_revenue)}\n` +
    `${eVote} **Pengingat Vote Cooldown:** ${statusIcon(currentPrefs.vote_reminder)}\n` +
    `🧭 **Adventure Digest:** ${statusIcon(currentPrefs.adventure_digest)}\n` +
    `🎯 **Reset Misi Harian:** ${statusIcon(currentPrefs.quest_reset)}\n\n` +
    "*Klik tombol di bawah ini untuk mengubah status notifikasi secara instan:*";

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("toggle_notif_stamina_full")
      .setLabel(`Stamina: ${currentPrefs.stamina_full ? "ON" : "OFF"}`)
      .setStyle(currentPrefs.stamina_full ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji(ui.getEmoji("stamina")) || { name: "⚡" }),
    new ButtonBuilder()
      .setCustomId("toggle_notif_daily_streak")
      .setLabel(`Daily: ${currentPrefs.daily_streak ? "ON" : "OFF"}`)
      .setStyle(currentPrefs.daily_streak ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji(ui.getEmoji("fire")) || { name: "🔥" }),
    new ButtonBuilder()
      .setCustomId("toggle_notif_stock_alert")
      .setLabel(`Saham: ${currentPrefs.stock_alert ? "ON" : "OFF"}`)
      .setStyle(currentPrefs.stock_alert ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji(ui.getEmoji("chart")) || { name: "📈" }),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("toggle_notif_idle_revenue")
      .setLabel(`Kafe/Vivarium: ${currentPrefs.idle_revenue ? "ON" : "OFF"}`)
      .setStyle(currentPrefs.idle_revenue ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji(ui.getEmoji("cafe")) || { name: "🎪" }),
    new ButtonBuilder()
      .setCustomId("toggle_notif_vote_reminder")
      .setLabel(`Vote: ${currentPrefs.vote_reminder ? "ON" : "OFF"}`)
      .setStyle(currentPrefs.vote_reminder ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji(ui.getEmoji("topgg")) || { name: "🗳️" }),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("toggle_notif_adventure_digest")
      .setLabel(`Digest: ${currentPrefs.adventure_digest ? "ON" : "OFF"}`)
      .setStyle(currentPrefs.adventure_digest ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji("🧭") || { name: "🧭" }),
    new ButtonBuilder()
      .setCustomId("toggle_notif_quest_reset")
      .setLabel(`Misi: ${currentPrefs.quest_reset ? "ON" : "OFF"}`)
      .setStyle(currentPrefs.quest_reset ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(ui.parseEmoji("🎯") || { name: "🎯" }),
  );

  return buildContainerV2({
    accentColorHex: "#38BDF8",
    title: `${eBell} Pusat Notifikasi Pribadi`,
    description: desc,
    expression: "smile",
    buttonsRow: [row1, row2, row3],
    footerText: ui.getFooter("utility"),
  });
}

module.exports = [
  {
    id: "btn_notif_manage",
    label: "notif-manage-digest",
    defer: "update",
    async handler(interaction) {
      const userId = interaction.user.id;
      const displayName = ui.ux.resolveUserName(interaction);
      const prefs = await notificationCenter.getUserPreferences(userId);
      const payload = renderNotificationPanel(displayName, prefs);
      return interaction.editReply(payload);
    },
  },
  {
    id: "digest_btn_notif_manage",
    label: "notif-manage-digest-alias",
    defer: "update",
    async handler(interaction) {
      const userId = interaction.user.id;
      const displayName = ui.ux.resolveUserName(interaction);
      const prefs = await notificationCenter.getUserPreferences(userId);
      const payload = renderNotificationPanel(displayName, prefs);
      return interaction.editReply(payload);
    },
  },
  {
    prefix: "toggle_notif_",
    label: "notif-toggle-preference",
    defer: "update",
    async handler(interaction) {
      const userId = interaction.user.id;
      const displayName = ui.ux.resolveUserName(interaction);
      const key = interaction.customId.replace("toggle_notif_", "");

      const currentPrefs = await notificationCenter.getUserPreferences(userId);
      const newStatus = !currentPrefs[key];
      const updatedPrefs = await notificationCenter.setUserPreference(userId, key, newStatus);

      const payload = renderNotificationPanel(displayName, updatedPrefs);
      return interaction.editReply(payload);
    },
  },
];
