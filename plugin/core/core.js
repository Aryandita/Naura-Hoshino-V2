"use strict";

/**
 * ⚙️ Core Command Router - Naura Hoshino V2
 * ------------------------------------------
 * Main router for core system commands and subcommands.
 * Handles both slash commands and prefix commands with unified logic.
 *
 * Subcommands:
 * - /core ping     : System latency diagnostics
 * - /core stats    : Server specifications and telemetry
 * - /core info     : Server or bot information
 * - /core about    : Bot identity and developer info
 * - /core help     : Interactive command guide
 * - /core language : Change user language preference
 * - /core partner  : Partnership program information
 *
 * Features:
 * - Dynamic subcommand registration
 * - Prefix command compatibility with aliases
 * - Autocomplete support for help command
 * - Language resolution per guild/user
 * - Mock interaction creation for prefix commands
 *
 * @module plugin/core/core
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const env = require("../../src/config/env");
const {
  resolveGuildLanguage,
  createMockInteraction,
  face,
} = require("./helpers/coreShared");

// ============================================================================
// SUBCOMMAND REGISTRATION
// ============================================================================

// Import all subcommand handlers
const ping = require("./subcommands/ping");
const stats = require("./subcommands/stats");
const info = require("./subcommands/info");
const about = require("./subcommands/about");
const partner = require("./subcommands/partner");
const language = require("./subcommands/language");
const help = require("./subcommands/help");

/** @type {Object.<string, Function>} Subcommand handler map */
const SUBCOMMANDS = {
  ping,
  stats,
  info,
  about,
  partner,
  partnership: partner, // Alias for backward compatibility
  language,
  help,
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("core")
    .setDescription("Pusat Informasi & Sistem Inti Naura Hoshino / Core System")
    .addSubcommand((s) => s.setName("ping").setDescription("Cek respons latensi Discord, Supabase, & Lavalink."))
    .addSubcommand((s) => s.setName("stats").setDescription("Lihat diagnostik spesifikasi server, RAM, dan OS Naura."))
    .addSubcommand((s) => s.setName("info").setDescription("Tampilkan info spesifik server saat ini atau info bot."))
    .addSubcommand((s) => s.setName("about").setDescription("Kenalan lebih dekat dengan Naura dan Aryandita!"))
    .addSubcommand((s) =>
      s.setName("help").setDescription("Buka panduan perintah interaktif Naura.")
        .addStringOption((o) => o.setName("command").setDescription("Cari nama command spesifik").setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s.setName("language").setDescription("Ubah bahasa bot di server ini / Change bot language")
        .addStringOption((o) =>
          o.setName("lang").setDescription("Pilih bahasa / Select language").setRequired(true)
            .addChoices({ name: "Indonesian", value: "id" }, { name: "English", value: "en" }, { name: "日本語", value: "ja" }, { name: "Español", value: "es" }),
        ),
    )
    .addSubcommand((s) => s.setName("partner").setDescription("Informasi program partnership komunitas resmi.")),

  /** Command aliases for prefix mode */
  aliases: ["ping", "stats", "info", "about", "help", "partner", "partnership"],

  // ============================================================================
  // AUTOCOMPLETE HANDLER
  // ============================================================================

  /**
   * Handle autocomplete interactions for help subcommand.
   * @param {object} interaction - Discord interaction
   * @param {object} client - Discord client
   * @returns {Promise<void>}
   */
  async autocomplete(interaction, client) {
    if (interaction.options.getSubcommand() === "help") {
      return help.autocomplete(interaction, client);
    }
  },

  // ============================================================================
  // PREFIX COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute prefix command (e.g., n!ping, n!stats).
   * Creates mock interaction to unify with slash command handling.
   * @param {object} message - Discord message
   * @param {Array<string>} args - Command arguments
   * @param {object} client - Discord client
   * @returns {Promise<any>}
   */
  async executePrefix(message, args, client) {
    const prefix = env.PREFIX || "n!";
    const cmdName = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

    // Determine subcommand from message
    let subcommand = cmdName === "core" ? (args[0]?.toLowerCase() || null) : cmdName;

    // Handle aliases
    if (subcommand === "lang") subcommand = "language";
    if (subcommand === "partnership") subcommand = "partner";

    // Resolve language for response
    const languageManager = require("../../src/managers/languageManager");
    const lang = message.localeLang
      ? (languageManager.getLanguageSync(message.localeLang) || await resolveGuildLanguage(message.guild?.id))
      : await resolveGuildLanguage(message.guild?.id);

    // Get handler
    const handler = SUBCOMMANDS[subcommand];
    if (!handler) {
      return message.reply(
        lang.ERROR_INVALID_SUBCOMMAND ||
          `${face("error", "❌")} Aduh, Naura belum kenal perintah itu. Coba cek lewat menu help yaa~`,
      );
    }

    // Create mock interaction for unified handling
    const val = cmdName === "core" ? args[1] : args[0];
    const mockInteraction = createMockInteraction(message, client, {
      lang: val?.toLowerCase() || null,
      pilihan: val?.toLowerCase() || null,
      command: (cmdName === "core" ? args.slice(1).join(" ") : args.join(" ")) || null,
      subcommand,
    });

    return handler(mockInteraction, client, lang);
  },

  // ============================================================================
  // SLASH COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute slash command.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<any>}
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const handler = SUBCOMMANDS[subcommand];

    // Resolve language for response
    const languageManager = require("../../src/managers/languageManager");
    const lang = interaction.localeLang
      ? (languageManager.getLanguageSync(interaction.localeLang) || await resolveGuildLanguage(interaction.guild?.id))
      : await resolveGuildLanguage(interaction.guild?.id);

    // Handle invalid subcommand
    if (!handler) {
      return interaction.reply({
        content:
          lang.ERROR_INVALID_SUBCOMMAND ||
          `${face("error", "❌")} Aduh, Naura belum kenal perintah itu. Coba cek lewat menu help yaa~`,
        flags: MessageFlags.Ephemeral,
      });
    }

    return handler(interaction, interaction.client, lang);
  },
};
