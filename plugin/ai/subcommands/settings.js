"use strict";

/**
 * ⚙️ Settings Subcommand - AI Configuration - Naura Hoshino V2
 * --------------------------------------------------------------
 * Manages server-specific AI settings including custom persona and knowledge base.
 * Requires ManageGuild or Administrator permissions.
 *
 * Features:
 * - Custom persona configuration (max 500 chars)
 * - Server knowledge base/FAQ (max 1000 chars)
 * - Permission validation (ManageGuild/Administrator)
 * - Overview display when no changes requested
 * - Empty string handling (clears setting)
 * - Guild-scoped settings storage
 *
 * @module plugin/ai/subcommands/settings
 */

const { PermissionsBitField } = require("discord.js");

const ui = require("../../../src/config/ui");
const guildSettingsService = require("../../../src/managers/guildSettingsService");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum character limit for custom persona */
const MAX_PERSONA = 500;

/** Maximum character limit for server knowledge base */
const MAX_KNOWLEDGE = 1000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get emoji by name with fallback.
 * @param {string} name - Emoji key
 * @param {string} fallback - Fallback emoji
 * @returns {string} Resolved emoji
 */
function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/**
 * Build standardized error card.
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {object} Error payload
 */
function failCard(title, description) {
  return buildErrorContainerV2({
    title: `${e("hmph", "❌")} ${title}`,
    description,
    footerText: ui.getFooter("core"),
  });
}

/**
 * Check if member has permission to manage AI settings.
 * @param {object} member - Guild member object
 * @returns {boolean} True if has ManageGuild or Administrator
 */
function canManage(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

/**
 * Format value as code block or empty placeholder.
 * @param {string|null} value - Value to format
 * @param {string} emptyText - Text to show if value is null/empty
 * @returns {string} Formatted string
 */
function asBlock(value, emptyText) {
  return value ? `\`\`\`${value}\`\`\`` : `*${emptyText}*`;
}

/**
 * Build overview card showing current AI configuration.
 * @param {object} interaction - Discord interaction
 * @param {object} ai - AI settings object
 * @returns {object} Overview payload
 */
function overviewCard(interaction, ai) {
  const description = [
    "Ini pengaturan AI yang sedang Naura pakai di server kamu:",
    "",
    "**Sifat kustom (persona):**",
    asBlock(ai?.customPersona, "Belum diatur, jadi Naura tampil apa adanya"),
    "",
    "**FAQ / basis pengetahuan server:**",
    asBlock(
      ai?.serverKnowledge,
      "Belum diatur, Naura belum punya catatan khusus",
    ),
  ].join("\n");

  return buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: `Pengaturan AI - ${interaction.guild.name}`,
    title: `${e("read", "⚙️")} Konfigurasi AI Naura`,
    iconURL:
      interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
    description,
    footerText: "Isi opsi persona atau knowledge kalau mau memperbaruinya.",
  });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Execute settings subcommand.
 * Displays or updates server-specific AI configuration.
 * @param {object} interaction - Discord interaction
 * @returns {Promise<void>}
 */
module.exports = async function settings(interaction) {
  // Validate guild context
  if (!interaction.guild) {
    return interaction.editReply(
      failCard(
        "Khusus di dalam server",
        "Perintah ini cuma bisa dipakai di dalam server Discord yaa, bukan lewat pesan pribadi.",
      ),
    );
  }

  // Validate permissions
  if (!canManage(interaction.member)) {
    return interaction.editReply(
      failCard(
        "Naura belum bisa menuruti",
        "Hanya Administrator atau Pengelola Server yang boleh mengubah pengaturan AI Naura.",
      ),
    );
  }

  // Extract options
  const newPersona = interaction.options.getString("persona");
  const newKnowledge = interaction.options.getString("knowledge");

  // Show overview if no changes requested
  if (newPersona === null && newKnowledge === null) {
    const settingsData =
      (await guildSettingsService.getGuildSetting(interaction.guild.id)) || {};
    return interaction.editReply(overviewCard(interaction, settingsData.ai));
  }

  // Validate persona length
  if (newPersona !== null && newPersona.length > MAX_PERSONA) {
    return interaction.editReply(
      failCard(
        "Personanya kepanjangan",
        `Naura cuma sanggup mengingat sampai **${MAX_PERSONA} karakter**. Coba diringkas sedikit yaa?`,
      ),
    );
  }

  // Validate knowledge length
  if (newKnowledge !== null && newKnowledge.length > MAX_KNOWLEDGE) {
    return interaction.editReply(
      failCard(
        "Catatannya kepanjangan",
        `FAQ server maksimal **${MAX_KNOWLEDGE} karakter** yaa. Ambil bagian yang paling penting saja.`,
      ),
    );
  }

  // Apply changes
  const changes = [];

  await guildSettingsService.updateGuildSetting(
    interaction.guild.id,
    (settingsData) => {
      if (!settingsData.ai) settingsData.ai = {};

      if (newPersona !== null) {
        settingsData.ai.customPersona =
          newPersona.trim() === "" ? null : newPersona.trim();
        changes.push(
          `${e("cheers", "✅")} Sifat khusus Naura sudah diperbarui.`,
        );
      }

      if (newKnowledge !== null) {
        settingsData.ai.serverKnowledge =
          newKnowledge.trim() === "" ? null : newKnowledge.trim();
        changes.push(
          `${e("cheers", "✅")} Catatan khusus server sudah Naura simpan.`,
        );
      }
    },
  );

  // Send success response
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("success") || "#22c55e",
    authorName: `Pengaturan AI - ${interaction.guild.name}`,
    title: `${e("impressed", "⚙️")} Sudah Naura catat!`,
    iconURL:
      interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
    description: `${changes.join("\n")}\n\nMulai sekarang Naura akan mengikuti pengaturan ini di server kamu.`,
    footerText: ui.getFooter("core"),
  });

  return interaction.editReply(payload);
};
