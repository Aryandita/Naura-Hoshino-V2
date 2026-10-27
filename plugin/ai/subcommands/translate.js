"use strict";

/**
 * 🌐 Translate Subcommand - AI Translation Service - Naura Hoshino V2
 * -------------------------------------------------------------------
 * Translates text between languages using Google Translate API.
 * Provides formatted output with original and translated text display.
 *
 * Features:
 * - Multi-language translation support
 * - Formatted code block display for clarity
 * - Emoji-enhanced UI presentation
 * - User attribution in footer
 *
 * @module plugin/ai/subcommands/translate
 */

const translate = require("@iamtraction/google-translate");

const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

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

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Execute translate subcommand.
 * Translates user-provided text to target language and displays result.
 * @param {object} interaction - Discord interaction
 * @returns {Promise<void>}
 */
module.exports = async function translateText(interaction) {
  // Extract options
  const teks = interaction.options.getString("teks");
  const targetLang = interaction.options.getString("ke_bahasa").toLowerCase();

  // Perform translation
  const hasil = await translate(teks, { to: targetLang });

  // Build formatted description with code blocks
  const description = [
    `Sudah Naura terjemahkan ke **${targetLang.toUpperCase()}**, semoga pas yaa!`,
    "",
    `**${e("read", "📝")} Teks asli:**`,
    "```",
    teks,
    "```",
    "",
    `**${e("cheers", "✅")} Hasil terjemahan:**`,
    "```",
    hasil.text,
    "```",
  ].join("\n");

  // Build and send response
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura Global Translator",
    title: `${e("read", "🌐")} Terjemahan selesai`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description,
    footerText: `Powered by Advanced Neural Translation • Diminta oleh ${interaction.user.username}`,
  });

  return interaction.editReply(payload);
};
