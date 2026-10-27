"use strict";

/**
 * 🔍 Search Subcommand - AI Web Search - Naura Hoshino V2
 * --------------------------------------------------------
 * Performs web search using Google and displays formatted results.
 * Returns top 3 results with titles, URLs, and descriptions.
 *
 * Features:
 * - Google search integration via googlethis package
 * - Top 3 results display with clickable links
 * - Formatted output with descriptions
 * - Empty result handling with friendly message
 *
 * @module plugin/ai/subcommands/search
 */

const google = require("googlethis");

const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of search results to display */
const MAX_RESULTS = 3;

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
 * Execute search subcommand.
 * Searches the web for user query and displays formatted results.
 * @param {object} interaction - Discord interaction
 * @returns {Promise<void>}
 */
module.exports = async function search(interaction) {
  // Extract search query
  const query = interaction.options.getString("kueri");

  // Perform Google search
  const hasil = await google.search(query, { safe: false });
  const results = hasil.results || [];

  // Build response based on results
  let description;
  if (results.length > 0) {
    const lines = results
      .slice(0, MAX_RESULTS)
      .map(
        (res, index) =>
          `**${index + 1}. [${res.title}](${res.url})**\n> ${res.description}`,
      );
    description = `Naura sudah keliling internet sebentar, ini yang Naura temukan buat kamu!\n\n${lines.join("\n\n")}`;
  } else {
    description = `${e("akward", "😢")} Aduh, Naura nggak menemukan apa pun soal itu. Coba pakai kata kunci yang lain, yaa?`;
  }

  // Build and send response
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura Search Protocol",
    title: `${e("read", "🔍")} Hasil pencarian: ${query}`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description,
    footerText: `Naura Search Protocol • Diminta oleh ${interaction.user.username}`,
  });

  return interaction.editReply(payload);
};
