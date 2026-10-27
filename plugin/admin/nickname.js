"use strict";

/**
 * ✏️ Nickname Command - Member Nickname Management - Naura Hoshino V2
 * --------------------------------------------------------------------
 * Forces nickname change for server members with role hierarchy validation.
 * Supports reset to original username when empty string provided.
 *
 * Features:
 * - Force nickname change for any member
 * - Reset to original username (empty string)
 * - Role hierarchy validation (cannot modify higher/equal roles)
 * - Permission validation (ManageNicknames required)
 * - Audit trail with requester tag
 * - Before/after comparison display
 *
 * @module plugin/admin/nickname
 */

const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  isSubcommand: true,
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("✏️ Paksa ganti nama panggilan (nickname) member.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageNicknames)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User yang ingin diubah namanya")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("nama_baru")
        .setDescription("Nama baru (kosongkan untuk mereset ke nama asli)")
        .setRequired(false),
    ),

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute nickname command.
   * Changes or resets member nickname with validation.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const user = interaction.options.getUser("user");
    const newName = interaction.options.getString("nama_baru") || "";

    // Fetch member from guild
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    // Validate member exists
    if (!member) {
      const errPayload = buildErrorContainerV2({
        title: "User Tidak Ada",
        description: "❌ User tidak ditemukan di server.",
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Validate role hierarchy (bot cannot modify higher/equal roles)
    if (
      member.roles.highest.position >=
      interaction.guild.members.me.roles.highest.position
    ) {
      const errPayload = buildErrorContainerV2({
        title: "Role Lebih Tinggi",
        description:
          "❌ Aku tidak bisa mengubah nama user ini karena rolenya lebih tinggi atau sama dengan role-ku.",
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const oldName = member.displayName;

      // Apply nickname change with audit reason
      await member.setNickname(newName, `Diminta oleh ${interaction.user.tag}`);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: "✏️ Nickname Berhasil Diubah",
        iconURL: interaction.user.displayAvatarURL(),
        description: `Berhasil ${newName === "" ? "mereset" : "mengubah"} nama untuk **${user.username}**.\n\n**Sebelum:** \`${oldName}\`\n**Sesudah:** \`${newName === "" ? user.username : newName}\``,
        footerText: ui.getFooter("core"),
      });

      await interaction.reply(payload);
    } catch (error) {
      logger.error("[Nickname Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Ganti Nama",
        description:
          "❌ Gagal mengubah nama. Mungkin ada masalah dengan permission.",
        footerText: ui.getFooter("core"),
      });
      await interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
    }
  },
};
