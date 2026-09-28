// Orkestrator /rpg. Definisi command ada di rpgData.js, sedangkan
// interceptor balasan dan objek tiruan prefix ada di survivalContext.js.
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

// Pemuat dinamis untuk seluruh subcommand di folder subcommands/.
const subcommands = new Map();
const subCommandFiles = fs
  .readdirSync(path.join(__dirname, "subcommands"))
  .filter((file) => file.endsWith(".js"));
for (const file of subCommandFiles) {
  const subCmd = require(`./subcommands/${file}`);
  subcommands.set(file.replace(".js", ""), subCmd);
}

module.exports = {
  data,

  async autocomplete(interaction, client) {
    const subCommandName = interaction.options.getSubcommand(false);
    if (!subCommandName) return interaction.respond([]).catch(() => {});
    const cmd = subcommands.get(subCommandName);
    if (cmd && typeof cmd.autocomplete === "function") {
      try {
        return await cmd.autocomplete(interaction, client);
      } catch (error) {
        // Fallback ke choices dinamis bila terjadi kesalahan
      }
    }
    if (typeof data.handleDynamicAutocomplete === "function") {
      return await data.handleDynamicAutocomplete(interaction);
    }
    return interaction.respond([]).catch(() => {});
  },

  async execute(interaction) {
    const subCommandName = interaction.options.getSubcommand();
    const cmd = subcommands.get(subCommandName);

    attachAutoDelete(interaction);

    await interaction.deferReply().catch(() => {});

    const lang =
      typeof interaction.fetchLang === "function"
        ? await interaction.fetchLang()
        : interaction.localeLang;

    // Pengecekan pendaftaran (starter kit).
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

    if (!cmd) {
      return ui.sendError(
        interaction,
        languageManager.translateSync(lang, "survival_not_implemented"),
        true,
      );
    }

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

  // --- DUKUNGAN PREFIX (LEGACY) ---
  async executePrefix(message, args, client) {
    const inputSubCmd = args[0] ? args[0].toLowerCase() : "start";
    const cmd = subcommands.get(inputSubCmd);

    const lang = await languageManager.getUserLanguage(message.author.id);
    if (!cmd)
      return ui.sendError(
        message,
        languageManager.translateSync(lang, "err_sys_27"),
      );

    const mockInteraction = createMockInteraction({
      message,
      client,
      subCmdName: inputSubCmd,
      args,
    });

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
