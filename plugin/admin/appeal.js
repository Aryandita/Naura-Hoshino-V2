/**
 * ?? Appeal Command - Moderation Appeal System - Naura Hoshino V2
 * -----------------------------------------------------------------
 * Allows users to submit appeals for moderation actions (ban/mute/warn).
 * Appeals are stored in the database and await moderator review.
 *
 * Features:
 * - Server-only command (cannot be used in DMs)
 * - Validates appeal text length (10-1000 characters)
 * - Creates appeal record via appealService
 * - Returns ephemeral confirmation with appeal ID
 *
 * @module plugin/admin/appeal
 */

"use strict";

// ============================================================================
// DEPENDENCIES
// ============================================================================
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const appealService = require("../../src/services/appealService");

// ============================================================================
// CONSTANTS
// ============================================================================
/** Minimum appeal reason length */
const MIN_APPEAL_LENGTH = 10;
/** Maximum appeal reason length */
const MAX_APPEAL_LENGTH = 1000;
/** Appeal source type for manual user submissions */
const APPEAL_SOURCE_TYPE = "manual";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("appeal")
    .setDescription("Ajukan banding untuk tindakan moderasi (ban/mute/warn).")
    .addStringOption((opt) =>
      opt
        .setName("alasan")
        .setDescription("Jelaskan mengapa banding ini harus diterima.")
        .setRequired(true)
        .setMinLength(MIN_APPEAL_LENGTH)
        .setMaxLength(MAX_APPEAL_LENGTH),
    ),

  // ========================================================================
  // EXECUTION
  // ========================================================================
  /**
   * Execute the appeal command.
   * @param {import("discord.js").ChatInputCommandInteraction} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lang = interaction.localeLang || "id";
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: `${ui.getEmoji("hmph", "?")} ${lang === "id" ? "Khusus Server" : "Server Only"}`,
          description: lang === "id" 
            ? "Banding hanya bisa diajukan di dalam server."
            : "Appeals can only be submitted inside a server.",
          footerText: ui.getFooter("admin"),
        }),
      );
    }

    const appealText = interaction.options.getString("alasan");

    try {
      const result = await appealService.createAppeal(
        guildId,
        userId,
        userId,
        APPEAL_SOURCE_TYPE,
        "User-submitted appeal",
        appealText,
      );

      if (!result.success) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: `${ui.getEmoji("hmph", "?")} ${lang === "id" ? "Gagal" : "Failed"}`,
            description: result.error,
            footerText: ui.getFooter("admin"),
          }),
        );
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        authorName: lang === "id" ? "Sistem Banding Moderasi" : "Moderation Appeal System",
        title: `${ui.getEmoji("cheers", "?")} ${lang === "id" ? "Banding Terkirim" : "Appeal Submitted"}`,
        iconURL: interaction.user.displayAvatarURL(),
        description: lang === "id"
          ? `Bandingmu telah diterima dan menunggu review dari moderator.\n\n**ID Banding:** \`${result.appeal.id}\`\n**Status:** Menunggu Review\n\nMohon bersabar. Moderator akan meninjau kasusmu secepatnya.`
          : `Your appeal has been received and is pending moderator review.\n\n**Appeal ID:** \`${result.appeal.id}\`\n**Status:** Pending Review\n\nPlease be patient. Moderators will review your case as soon as possible.`,
        footerText: ui.getFooter("admin"),
      });

      await interaction.editReply(payload);
    } catch (err) {
      const payload = buildErrorContainerV2({
        title: `${ui.getEmoji("hmph", "?")} ${lang === "id" ? "Terjadi Kesalahan" : "Error Occurred"}`,
        description: err.message || (lang === "id" ? "Coba lagi nanti." : "Please try again later."),
        footerText: ui.getFooter("admin"),
      });
      await interaction.editReply(payload);
    }
  },
};