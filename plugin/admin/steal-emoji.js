"use strict";

/**
 * @module StealEmojiCommand
 * @description Mencuri emoji custom dari server lain untuk ditambahkan ke server ini.
 * 
 * Fitur Utama:
 * - Parse emoji custom dari input teks (format Discord <:name:id> atau <a:name:id>)
 * - Download dan upload ulang emoji ke server saat ini
 * - Support emoji statis (PNG) dan animasi (GIF)
 * - Opsional rename emoji saat import
 * 
 * Permission: ManageGuildExpressions
 * Subcommand: true (bagian dari /admin command group)
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  parseEmoji,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// SECTION 1: KONSTANTA
// ============================================================================

/** @constant {string} CDN_BASE_URL - Base URL untuk CDN emoji Discord */
const CDN_BASE_URL = "https://cdn.discordapp.com/emojis";

// ============================================================================
// SECTION 2: SLASH COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("steal")
    .setDescription("Mencuri emoji custom untuk dimasukkan ke server ini")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addStringOption((opt) =>
      opt
        .setName("emoji")
        .setDescription("Ketik atau paste emoji custom yang ingin dicuri")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("nama")
        .setDescription("Nama baru untuk emoji ini (Opsional)")
        .setRequired(false),
    ),

  /**
   * Main executor untuk command /admin steal
   * Mem-parse emoji input, mendownload dari CDN Discord, lalu mengupload ke guild.
   * 
   * @param {import("discord.js").ChatInputCommandInteraction} interaction - Discord interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const rawEmoji = interaction.options.getString("emoji");
    const customName = interaction.options.getString("nama");

    // Parse emoji string menjadi komponen {name, id, animated}
    const parsed = parseEmoji(rawEmoji);

    if (!parsed || !parsed.id) {
      const errPayload = buildErrorContainerV2({
        title: "Emoji Tidak Valid",
        description: `${ui.getEmoji("error") || "\u274c"} Itu bukan emoji custom yang valid!`,
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Tentukan ekstensi berdasarkan tipe animasi
    const extension = parsed.animated ? "gif" : "png";
    const emojiUrl = `${CDN_BASE_URL}/${parsed.id}.${extension}`;
    const emojiName = customName || parsed.name;

    await interaction.deferReply();

    try {
      // Upload emoji ke guild
      const newEmoji = await interaction.guild.emojis.create({
        attachment: emojiUrl,
        name: emojiName,
      });

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: `${ui.getEmoji("detective") || "\ud83d\udd75\ufe0f\u200d\u2642\ufe0f"} Pencurian Berhasil!`,
        iconURL: emojiUrl,
        description: `Berhasil menyusup dan mengambil aset! Emoji ${newEmoji} telah di-import ke server ini dengan nama **${newEmoji.name}**.\n\n> *Gunakan \`:${newEmoji.name}:\` untuk memanggilnya.*`,
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(successPayload);
    } catch (error) {
      logger.error("Gagal mencuri emoji:", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Import Emoji",
        description: `${ui.getEmoji("error") || "\u274c"} Gagal menambahkan emoji. Mungkin slot emoji server sudah penuh?`,
        footerText: ui.getFooter("core"),
      });
      await interaction.editReply(errPayload);
    }
  },
};