"use strict";

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bug")
    .setDescription("🐛 Laporkan kendala, galat, atau bug teknis kepada pengembang Naura Hoshino"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("modal_report_bug")
      .setTitle("Lapor Bug / Kendala Sistem");

    const titleInput = new TextInputBuilder()
      .setCustomId("bug_title")
      .setLabel("Judul Ringkas Masalah")
      .setPlaceholder("Contoh: Tombol lelang tidak merespons di iOS")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId("bug_desc")
      .setLabel("Detail Masalah & Langkah Reproduksi")
      .setPlaceholder("1. Buka menu lelang\n2. Klik tombol beli\n3. Muncul pesan error...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const deviceInput = new TextInputBuilder()
      .setCustomId("bug_device")
      .setLabel("Perangkat / Platform")
      .setPlaceholder("PC Windows / Mobile Android / iOS / Browser Web")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(50);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(deviceInput),
    );

    return interaction.showModal(modal);
  },
};
