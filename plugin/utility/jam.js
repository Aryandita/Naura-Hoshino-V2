"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ui = require("../../src/config/ui");
const env = require("../../src/config/env");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("jam")
    .setDescription("🎹 Buka Collaborative Live Jam Room (Synthesizer & 16-Step Drum Sequencer).")
    .addStringOption((opt) =>
      opt
        .setName("room")
        .setDescription("Nama room jam sesi bersama teman (opsional)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const room = interaction.options.getString("room") || "global";
    const baseUrl = env.DASHBOARD_URL || "http://localhost:3070";
    const jamUrl = `${baseUrl.replace(/\/$/, "")}/jam?room=${encodeURIComponent(room)}`;

    const openBtn = new ButtonBuilder()
      .setLabel("Buka Naura Jam Studio")
      .setStyle(ButtonStyle.Link)
      .setURL(jamUrl)
      .setEmoji("🎹");

    const row = new ActionRowBuilder().addComponents(openBtn);

    const payload = buildContainerV2({
      accentColorHex: "#00F0FF",
      authorName: "Naura Music Studio",
      title: "🎹 Collaborative Live Jam Room",
      description: [
        `Ruang sesi musik kolaboratif real-time telah dibuka untuk room **${room}**!`,
        "",
        "> 🥁 **16-Step Drum Machine:** Kick, Snare, Hi-Hat, dan Clap sinkron instan.",
        "> 🎹 **Pentatonic Synthesizer:** 8 tuts chiptune, 4 pilihan waveform (Square, Sine, Saw, Triangle).",
        "> ⚡ **Live Collaborative Sync:** Perubahan ketukan dan melodi terdengar bersama seluruh anggota voice channel.",
        "",
        "Klik tombol di bawah untuk langsung bergabung ke sesi aransemen musik!",
      ].join("\n"),
      footerText: ui.getFooter("music"),
    });

    await interaction.reply({
      ...payload,
      components: [row],
    });
  },
};
