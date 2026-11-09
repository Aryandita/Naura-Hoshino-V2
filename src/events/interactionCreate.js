"use strict";

const { Events } = require("discord.js");
const { logger } = require("../managers/logger");
const languageManager = require("../managers/languageManager");
const { respondError } = require("../interactions/safeExecute");
const {
  wrapInteractionSafe,
  attachAutoAcknowledgeGuard,
  resolveComponentKind,
  translateText,
  withEphemeralFlags,
} = require("../interactions/router/interactionGuards");
const { handleSlashCommand } = require("../interactions/router/slashRouter");
const {
  handleContextMenu,
} = require("../interactions/router/contextMenuRouter");
const { handleComponent } = require("../interactions/router/componentRouter");
const {
  routeAutocomplete,
} = require("../interactions/router/autocompleteRouter");
const { checkMaintenance } = require("../interactions/router/maintenanceGuard");

module.exports = {
  name: Events.InteractionCreate,
  attachAutoAcknowledgeGuard,
  wrapInteractionSafe,
  resolveComponentKind,
  translateText,
  withEphemeralFlags,
  handleSlashCommand,
  handleContextMenu,
  handleComponent,

  async execute(interaction, client) {
    if (interaction.isAutocomplete()) {
      return routeAutocomplete(interaction, client);
    }
    wrapInteractionSafe(interaction);
    const cleanupGuard = attachAutoAcknowledgeGuard(interaction);
    try {
      interaction.localeLang = await languageManager
        .getUserLanguage(interaction.user.id, interaction.guildId)
        .catch(() => "id");
      const maintResult = checkMaintenance(interaction, client);
      if (maintResult !== undefined) return maintResult;
      if (interaction.isChatInputCommand()) {
        return await handleSlashCommand(interaction, client);
      }
      if (interaction.isContextMenuCommand()) {
        return await handleContextMenu(interaction, client);
      }
      return await handleComponent(interaction, client);
    } catch (error) {
      logger.error(
        "[INTERAKSI CREATE] Galat tak tertangani pada interaksi:",
        error,
      );
      try {
        await respondError(
          interaction,
          "Terjadi kesalahan sistem saat memproses interaksi ini.",
        );
      } catch (respondErr) {
        logger.debug(
          "[INTERAKSI CREATE] Tidak dapat mengirim balasan galat: " +
            (respondErr?.message || respondErr),
        );
      }
    } finally {
      cleanupGuard();
    }
  },
};
