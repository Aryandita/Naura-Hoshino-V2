"use strict";

/**
 * Router interaksi Discord.
 * Mengimplementasikan:
 * - Law 1: Keep the main path easy to follow (Guard Clauses / Flat flow)
 * - Law 2: Name things by meaning (Intent-revealing Domain Naming)
 * - Law 6: Make errors useful (Dukungan DomainError)
 * - Law 7: Keep changes focused (Routing murni, delegasi ke safeExecute)
 */

const { Events, MessageFlags } = require("discord.js");
const { logger } = require("../managers/logger");
const languageManager = require("../managers/languageManager");
const rateLimiter = require("../utils/rateLimiter");
const registry = require("../interactions/registry");
const handleAutocomplete = require("../interactions/autocomplete");
const { safeExecute, respondError } = require("../interactions/safeExecute");
const { isDomainError } = require("../errors/DomainError");
const {
  buildErrorContainerV2,
  buildMaintenanceContainerV2,
} = require("../utils/NauraContainerBuilder");

// Batas laju perintah slash
const SLASH_LIMIT = Object.freeze({ max: 5, seconds: 5 });

// Batas laju komponen default
const COMPONENT_LIMIT = Object.freeze({ max: 8, seconds: 5 });

/**
 * Mendeteksi jenis interaksi berbasis komponen
 * @param {import('discord.js').Interaction} interaction
 * @returns {'buttons'|'modals'|'selects'|null}
 */
function resolveComponentKind(interaction) {
  if (interaction.isButton()) return "buttons";
  if (interaction.isModalSubmit()) return "modals";
  if (interaction.isAnySelectMenu()) return "selects";
  return null;
}

function translateText(lang, key, placeholders) {
  return languageManager.translateSync(lang, key, placeholders);
}

/**
 * Menangani routing Slash Command (ChatInputCommand)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleSlashCommand(interaction, client) {
  const targetCommand = client.commands.get(interaction.commandName);
  // Guard Clause: Command tidak terdaftar
  if (!targetCommand) return undefined;

  // Guard Clause: Rate limit per pengguna
  const isCommandRateLimited = await rateLimiter.isRateLimited(
    interaction.user.id,
    `slash_${interaction.commandName}`,
    SLASH_LIMIT.max,
    SLASH_LIMIT.seconds,
  );

  if (isCommandRateLimited) {
    return interaction
      .reply({
        ...buildErrorContainerV2({
          authorName: "Naura Rate Limit",
          title: "Slow Down!",
          errorMessage:
            "Kamu mengirim perintah terlalu cepat. Harap tunggu beberapa detik ya!",
          lang: interaction.localeLang,
          expression: "sleepy",
        }),
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }

  // Guard Clause: Periksa apakah fitur terkait dinonaktifkan di server
  const {
    COMMAND_FEATURE_MAP,
    isFeatureEnabled,
  } = require("../config/features");
  const featureId = COMMAND_FEATURE_MAP[interaction.commandName];
  if (featureId && interaction.guildId) {
    const isModuleEnabled = await isFeatureEnabled(
      interaction.guildId,
      featureId,
    );
    if (!isModuleEnabled) {
      return interaction
        .reply({
          ...buildErrorContainerV2({
            authorName: "Naura Feature Guard",
            title: "Fitur Dinonaktifkan",
            errorMessage: `Command ini adalah bagian dari modul **${featureId}**, yang saat ini dimatikan oleh Admin server.`,
            lang: interaction.localeLang,
            expression: "denied",
          }),
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  }

  try {
    // Metrik: Catat penggunaan command di Redis Hash tanpa memblokir
    try {
      const metricsManager = require("../managers/metricsManager");
      metricsManager.logCommand(interaction.commandName);
    } catch {
      // Abaikan bila modul metrik belum siap
    }

    await targetCommand.execute(interaction, client);
  } catch (error) {
    if (isDomainError(error)) {
      logger.warn(
        `[COMMAND DOMAIN ERROR] /${interaction.commandName}: [${error.code}] ${error.message}`,
        error.context,
      );
      await respondError(interaction, error.userMessage);
      return undefined;
    }

    logger.error(
      `[COMMAND ERROR] Galat saat mengeksekusi /${interaction.commandName}:`,
      error,
    );
    await respondError(
      interaction,
      "Terjadi kesalahan sistem saat memproses perintah ini.",
    );
  }

  return undefined;
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    // Guard Clause 1: Autocomplete didahulukan tanpa delay (batas keras 3 detik)
    if (interaction.isAutocomplete()) {
      return handleAutocomplete(interaction, client);
    }

    // Resolusi bahasa pengguna
    interaction.localeLang = await languageManager
      .getUserLanguage(interaction.user.id, interaction.guildId)
      .catch(() => "id");

    // Guard Clause 2: Bot sedang dalam proses shutdown/maintenance
    if (client.isShuttingDown) {
      return interaction
        .reply({
          ...buildMaintenanceContainerV2({
            authorName: "Naura System Status",
            title: "Sedang Restart / Pemeliharaan",
            maintenanceMessage:
              "Naura sedang dalam proses pemeliharaan atau restart server. Mohon tunggu beberapa saat ya!",
            lang: interaction.localeLang,
            withBanner: true,
          }),
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }

    // Guard Clause 3: Delegasi Slash Command
    if (interaction.isChatInputCommand()) {
      return handleSlashCommand(interaction, client);
    }

    // Guard Clause 4: Delegasi Context Menu Command
    if (interaction.isContextMenuCommand()) {
      const isContextRateLimited = await rateLimiter.isRateLimited(
        interaction.user.id,
        `ctx_${interaction.commandName}`,
        4,
        10,
      );
      if (isContextRateLimited) {
        return interaction
          .reply({
            ...buildErrorContainerV2({
              authorName: "Naura Rate Limit",
              title: "Slow Down!",
              errorMessage:
                "Kamu menggunakan context menu terlalu cepat. Harap tunggu beberapa detik ya!",
              lang: interaction.localeLang,
              expression: "sleepy",
            }),
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }

      const { resolveContextMenu } = require("../interactions/contextMenus");
      const contextMenuHandler = resolveContextMenu(interaction.commandName);
      if (!contextMenuHandler) return undefined;

      try {
        return await contextMenuHandler.execute(interaction, client);
      } catch (error) {
        logger.error(
          `[CONTEXT MENU ERROR] Galat saat mengeksekusi ${interaction.commandName}:`,
          error,
        );
        return await respondError(
          interaction,
          "Terjadi kesalahan saat memproses context menu ini.",
        );
      }
    }

    // Resolusi tipe interaksi komponen (button, modal, select)
    const componentKind = resolveComponentKind(interaction);
    if (!componentKind) return undefined;

    const registeredComponentHandler = registry.resolve(
      componentKind,
      interaction.customId,
    );

    // Guard Clause 5: Komponen dinamis yang dikelola oleh collector lokal (minigame, survival, NPC, dll.)
    const isManagedByLocalCollector =
      /^(mg_|mquiz_|duel_|ttt_|aki_|hangman_|memory_|wordle_|rps_|musicquiz_|trivia_|tod_|btn_|collect_|npc_|date_|roam_|tut_|bank_|dungeon_|gacha_|fish_|mine_|chop_|hunt_|explore_|shop_|casino_|trade_|profile_|pet_|pvp_|quiz_|quest_|story_|craft_|inv_|card_|music_|mm_|naura_)/.test(
        interaction.customId,
      );
    if (!registeredComponentHandler && isManagedByLocalCollector) {
      return undefined;
    }

    // Guard Clause 6: Komponen basi dari pesan lama tanpa penangan aktif
    if (!registeredComponentHandler) {
      logger.warn(
        `[INTERAKSI] Tidak ada penangan untuk ${componentKind}:${interaction.customId}`,
      );
      return interaction
        .reply({
          ...buildErrorContainerV2({
            lang: interaction.localeLang,
            title: translateText(
              interaction.localeLang,
              "interaction.stale_component.title",
            ),
            errorMessage: translateText(
              interaction.localeLang,
              "interaction.stale_component.body",
            ),
            expressionImage: false,
          }),
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }

    // Guard Clause 7: Rate limit komponen tombol/select/modal
    const componentRateLimitPolicy =
      registeredComponentHandler.cooldown || COMPONENT_LIMIT;
    const isComponentRateLimited = await rateLimiter.isRateLimited(
      interaction.user.id,
      `component_${registeredComponentHandler.label}`,
      componentRateLimitPolicy.max,
      componentRateLimitPolicy.seconds,
    );

    if (isComponentRateLimited) {
      return interaction
        .reply({
          ...buildErrorContainerV2({
            authorName: "Naura Action Guard",
            title: "Pelan-Pelan Ya!",
            errorMessage:
              "Kamu menekan tombol terlalu cepat. Harap berikan jeda sebentar ya!",
            lang: interaction.localeLang,
            expression: "sleepy",
          }),
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }

    // Jalur Utama (Happy Path): Eksekusi melalui wrapper safeExecute
    return safeExecute(interaction, registeredComponentHandler, client);
  },
};
