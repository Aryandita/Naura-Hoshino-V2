"use strict";

/**
 * 🌐 Language Command - User Preference Settings - Naura Hoshino V2
 * -----------------------------------------------------------------
 * Allows users to change their preferred language for bot responses.
 * Updates database, cache, and language manager simultaneously.
 *
 * Supported Languages:
 * - id: Indonesian (Bahasa Indonesia)
 * - en: English
 * - ja: Japanese (日本語)
 * - es: Spanish (Español)
 *
 * @module plugin/core/subcommands/language
 */

const cacheManager = require("../../../src/managers/cacheManager");
const languageManager = require("../../../src/managers/languageManager");
const ui = require("../../../src/config/ui");
const { face, locales } = require("../helpers/coreShared");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Cache TTL for language preference (5 minutes in milliseconds) */
const LANGUAGE_CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle /core language command execution.
 * Updates user's language preference across all systems.
 * @param {object} interaction - Discord interaction
 * @param {object} client - Discord client
 * @param {object} currentLang - Current language dictionary
 * @returns {Promise<void>}
 */
async function handleLanguage(interaction, client, currentLang) {
  // Get selected language from options
  const newLang =
    interaction.options?.getString("lang") ||
    interaction.options?.getString("pilihan");

  // Validate language selection
  if (!newLang || !locales[newLang]) {
    const msg = `${face("warning", "⚠️")} Pilihan bahasa tidak valid. Pilih \`id\`, \`en\`, \`ja\`, atau \`es\`.`;
    if (interaction.reply && !interaction.deferred) {
      return interaction.reply({ content: msg });
    }
    return interaction.editReply({ content: msg });
  }

  // Update user profile in database
  const userId = interaction.user.id;
  await cacheManager.updateUserProfile(userId, { language: newLang });

  // Update language manager (handles its own cache)
  await languageManager.setUserLanguage(userId, newLang).catch(() => {});

  // Update UI cache if available
  if (ui.lang && ui.lang.userCache) {
    ui.lang.userCache.set(userId, {
      lang: newLang,
      expiresAt: Date.now() + LANGUAGE_CACHE_TTL_MS,
    });
  }

  // Send success message
  const successMsg = `${face("success", "✅")} ${locales[newLang].LANG_SUCCESS || "Pengaturan bahasa berhasil diperbarui."}`;

  if (interaction.reply && !interaction.deferred) {
    return interaction.reply({ content: successMsg });
  }
  return interaction.editReply({ content: successMsg });
}

module.exports = handleLanguage;
