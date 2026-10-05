"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ui = require("../config/ui");
const env = require("../config/env");
const { buildContainerV2 } = require("./NauraContainerBuilder");

/**
 * Validasi apakah User ID adalah Owner bot resmi.
 * @param {string} userId
 * @returns {boolean}
 */
function isOwner(userId) {
  return Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(userId);
}

/**
 * Membangun container Discord Components V2 untuk direktori perintah khusus Owner.
 * Menegaskan pemisahan tegas antara kontrol arsitektur bot vs moderasi admin guild biasa.
 * @returns {import("./NauraContainerBuilder").ContainerV2Payload}
 */
function buildOwnerPanelPayload() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("owner_profile_heal_self")
      .setLabel("Pulihkan Vitalku (Heal 100%)")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🩹"),
    new ButtonBuilder()
      .setCustomId("incident_flush_cache")
      .setLabel("Flush Cache")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🧹"),
    new ButtonBuilder()
      .setCustomId("incident_release_locks")
      .setLabel("Lepas Deadlock")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔓"),
  );

  const container = buildContainerV2({
    accentColorHex: "#EF4444",
    authorName: "Naura OS Central Control Desk",
    title: "👑 Panel Operasi Khusus Owner (System Architect)",
    description: [
      "Berikut adalah direktori seluruh perintah yang **hanya dapat dieksekusi oleh Owner bot**.",
      "Perintah-perintah ini dipisahkan secara tegas dari command moderasi admin guild.",
    ].join("\n"),
    fields: [
      {
        name: "⚙️ 1. Mesin & Infrastruktur Bot (Kernel)",
        value: [
          "• `/owner maintenance [mode] [alasan]` : Aktifkan / nonaktifkan maintenance global.",
          "• `/owner killswitch [modul] [status]` : Matikan / hidupkan modul tanpa restart.",
          "• `/owner doctor` : Diagnostik kesehatan 6 pilar (DB, Mongo, Redis, Lavalink, AI, Canvas).",
          "• `/owner logs [limit]` : Tinjau log error terbaru bot langsung di DM.",
          "• `n!deploy [global]` : Deploy / sinkronisasi slash command ke Discord API.",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🩹 2. Pemulihan Darurat Pemain (God Mode)",
        value: [
          "• `/owner heal [user] [user_id] [tipe] [jumlah]` : Pulihkan status vital (Penuh/Parsial: stamina, HP, lapar, haus, sembuh) untuk diri sendiri atau member lain.",
          "• `/owner repair [user]` : Bebaskan status freeze / deadlock / unlock mutex pemain.",
          "• `/owner premium [aksi] [user] [durasi_hari]` : Suntik atau cabut status VIP Booster Premium member.",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔑 3. Kunci Akses Dev (Code Runner Sandbox)",
        value: [
          "• `/owner keygen [target] [max_uses] [jam]` : Terbitkan kunci akses skrip `/run`.",
          "• `/owner keylist` : Tinjau daftar kunci akses dev yang aktif.",
          "• `/owner keyrevoke [key]` : Cabut kunci akses dev seketika.",
        ].join("\n"),
        inline: false,
      },
      {
        name: "⚖️ 4. Pemisahan Hak Akses: Owner Bot vs Admin Guild",
        value: [
          "• **Owner Bot (Kamu):** Mengontrol kernel bot, database, cluster audio, dan deploy.",
          "• **Admin Guild (Staff Server):** Mengoperasikan `/setup`, `/moderation`, `/warn`, `/lockdown`, `/slowmode`, `/voicemod`, `/shield` yang cakupannya hanya terbatas di server guild lokal tanpa akses kernel bot.",
        ].join("\n"),
        inline: false,
      },
    ],
    buttonsRow: [row1],
    footerText: ui.getFooter("core"),
  });

  return container;
}

module.exports = {
  isOwner,
  buildOwnerPanelPayload,
};
