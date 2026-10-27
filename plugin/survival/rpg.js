"use strict";

/**
 * 🏕️ RPG Command Router - Naura Wilds Survival - Naura Hoshino V2
 * -----------------------------------------------------------------
 * Main router for Naura Wilds RPG survival commands.
 * Handles subcommand routing, player onboarding checks, and prefix compatibility.
 *
 * Features:
 * - Dynamic subcommand loading from subcommands/ directory
 * - Player registration check (starter kit validation)
 * - Autocomplete support for subcommands
 * - Prefix command compatibility with mock interaction
 * - Error handling with localized messages
 *
 * @module plugin/survival/rpg
 */

const fs = require("fs");
const path = require("path");
const { logger } = require("../../src/managers/logger");
const {
  safeParseInventory,
} = require("../../src/survival/engines/inventoryHelper");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const languageManager = require("../../src/managers/languageManager");
const data = require("../../src/survival/data/rpgData");
const {
  attachAutoDelete,
  createMockInteraction,
} = require("../../src/survival/helpers/survivalContext");

// ============================================================================
// DYNAMIC SUBCOMMAND LOADING
// ============================================================================

/** @type {Map<string, object>} Loaded subcommand handlers */
const subcommands = new Map();

// Load all subcommand files dynamically
const subCommandFiles = fs
  .readdirSync(path.join(__dirname, "subcommands"))
  .filter((file) => file.endsWith(".js"));

for (const file of subCommandFiles) {
  const subCmd = require(`./subcommands/${file}`);
  subcommands.set(file.replace(".js", ""), subCmd);
}

// ============================================================================
// COMMAND EXPORT
// ============================================================================

module.exports = {
  /** Command definition from rpgData.js */
  data,

  // ============================================================================
  // AUTOCOMPLETE HANDLER
  // ============================================================================

  /**
   * Handle autocomplete for RPG subcommands.
   * Delegates to specific subcommand autocomplete or falls back to dynamic handler.
   * @param {object} interaction - Discord interaction
   * @param {object} client - Discord client
   * @returns {Promise<void>}
   */
  async autocomplete(interaction, client) {
    const subCommandName = interaction.options.getSubcommand(false);
    if (!subCommandName) return interaction.respond([]).catch(() => {});

    // Try subcommand-specific autocomplete
    const cmd = subcommands.get(subCommandName);
    if (cmd && typeof cmd.autocomplete === "function") {
      try {
        return await cmd.autocomplete(interaction, client);
      } catch (error) {
        logger.debug(`[rpg:autocomplete] Error in autocomplete routine: ${error?.message || error}`);
      }
    }

    // Fall back to dynamic autocomplete from data
    if (typeof data.handleDynamicAutocomplete === "function") {
      return await data.handleDynamicAutocomplete(interaction);
    }

    return interaction.respond([]).catch(() => {});
  },

  // ============================================================================
  // SLASH COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute RPG slash command with onboarding check.
   * Validates player registration before allowing subcommand execution.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const subCommandName = interaction.options.getSubcommand();
    const cmd = subcommands.get(subCommandName);

    // Attach auto-delete handler
    attachAutoDelete(interaction);

    // Defer reply for processing
    await interaction.deferReply().catch(() => {});

    // Resolve language
    const lang =
      typeof interaction.fetchLang === "function"
        ? await interaction.fetchLang()
        : interaction.localeLang;

    // Check player registration (except for /start command)
    if (subCommandName !== "start") {
      const profile = await cacheManager.getUserProfile(interaction.user.id);
      const inv = safeParseInventory(profile.inventory);
      const hasStarted = inv.some(
        (item) => item && item.id === "survival_started",
      );

      if (!hasStarted) {
        const {
          renderOnboardingPrompt,
        } = require("../../src/survival/engines/playerOnboardingEngine");
        const onboardingPayload = renderOnboardingPrompt(
          interaction.user,
          lang,
        );
        return interaction.editReply(onboardingPayload);
      }
    }

    // Validate subcommand exists
    if (!cmd) {
      return ui.sendError(
        interaction,
        languageManager.translateSync(lang, "survival_not_implemented"),
        true,
      );
    }

    // Execute subcommand with error handling
    try {
      await cmd.execute(interaction, interaction.client);
    } catch (error) {
      logger.error(`[RPG] Error executing ${subCommandName}:`, error);
      await ui.sendError(
        interaction,
        languageManager.translateSync(lang, "survival_sys_error"),
        true,
      );
    }
  },

  // ============================================================================
  // PREFIX COMMAND EXECUTION (LEGACY)
  // ============================================================================

  /**
   * Execute RPG prefix command (legacy support).
   * Creates mock interaction for unified handling with slash commands.
   * @param {object} message - Discord message
   * @param {Array<string>} args - Command arguments
   * @param {object} client - Discord client
   * @returns {Promise<void>}
   */
  async executePrefix(message, args, client) {
    // Parse subcommand from arguments
    let inputSubCmd = args[0] ? args[0].toLowerCase() : "start";

    // Handle special case for combat subcommand
    if (inputSubCmd === "combat" && args[1]) {
      args.shift();
      inputSubCmd = args[0] ? args[0].toLowerCase() : "start";
    }

    const cmd = subcommands.get(inputSubCmd);

    // Resolve language
    const lang = await languageManager.getUserLanguage(message.author.id);

    // Validate subcommand exists
    if (!cmd) {
      return ui.sendError(
        message,
        languageManager.translateSync(lang, "err_sys_27"),
      );
    }

    // Create mock interaction for unified handling
    const mockInteraction = createMockInteraction({
      message,
      client,
      subCmdName: inputSubCmd,
      args,
    });

    // Execute with error handling
    try {
      await cmd.execute(mockInteraction, client);
    } catch (error) {
      logger.error(`[RPG Prefix Error] ${inputSubCmd}:`, error);
      await ui.sendError(
        message,
        languageManager.translateSync(lang, "err_sys_28"),
      );
    }
  },
};
