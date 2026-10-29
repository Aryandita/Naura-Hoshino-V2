"use strict";

/**
 * 🐌 Slowmode Command - Channel Rate Limiting - Naura Hoshino V2
 * ---------------------------------------------------------------
 * Sets slowmode (rate limit per user) for the current channel.
 * Supports duration parsing and maximum limit enforcement.
 *
 * Features:
 * - Flexible duration format (5s, 10s, 1m, 1h, off)
 * - Maximum limit enforcement (6 hours / 21600 seconds)
 * - Reason logging for audit trail
 * - Permission validation (ManageChannels required)
 * - Disable option ("off" or "0")
 *
 * @module plugin/admin/slowmode
 */

const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const parseDuration = require("parse-duration");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum slowmode duration in seconds (6 hours) */
const MAX_SLOWMODE_SECONDS = 21600;

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("🐌 Atur mode lambat (slowmode) di channel ini.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName("durasi")
        .setDescription("Durasi slowmode (contoh: 5s, 10s, 1m, 1h, off)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("alasan")
        .setDescription("Alasan mengatur slowmode")
        .setRequired(false),
    ),

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute slowmode command.
   * Sets rate limit per user for current channel.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const durasiStr = interaction.options.getString("durasi").toLowerCase();
    const alasan =
      interaction.options.getString("alasan") || "Tidak ada alasan diberikan";

    let seconds = 0;

    // Parse duration if not disabling
    if (durasiStr !== "off" && durasiStr !== "0") {
      const ms = parseDuration(durasiStr);
      if (!ms) {
        const errPayload = buildErrorContainerV2({
          title: "Format Salah",
          description: `${ui.getEmoji("error") || "❌"} Format durasi tidak valid. Gunakan format seperti \`5s\`, \`10s\`, \`1m\`, \`1h\`, atau \`off\`.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }
      seconds = Math.floor(ms / 1000);

      // Enforce maximum limit
      if (seconds > MAX_SLOWMODE_SECONDS) {
        const errPayload = buildErrorContainerV2({
          title: "Batas Maksimum",
          description: `${ui.getEmoji("error") || "❌"} Durasi maksimum untuk slowmode adalah 6 jam (${MAX_SLOWMODE_SECONDS} detik).`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    try {
      // Apply slowmode to channel
      await interaction.channel.setRateLimitPerUser(seconds, alasan);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: `${ui.getEmoji("clock") || "🐌"} Slowmode Diperbarui`,
        iconURL: interaction.user.displayAvatarURL(),
        description: `Slowmode di channel ini telah disetel ke **${seconds === 0 ? "Mati (Off)" : `${seconds} detik`}**.\n> **Alasan:** ${alasan}`,
        footerText: ui.getFooter("core"),
      });

      await interaction.reply(payload);
    } catch (error) {
      logger.error("[Slowmode Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Set Slowmode",
        description: `${ui.getEmoji("error") || "❌"} Gagal mengatur slowmode. Pastikan bot memiliki izin Manage Channels.`,
        footerText: ui.getFooter("core"),
      });
      await interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
    }
  },
};
