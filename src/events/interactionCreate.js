"use strict";

/**
 * Router interaksi.
 *
 * Berkas ini dulu berisi 900+ baris logika fitur. Sekarang tugasnya hanya satu:
 * menentukan jenis interaksi, mencari penanganya di registry, lalu menyerahkan
 * eksekusinya ke safeExecute.
 *
 * Logika masing-masing tombol, select menu, dan modal ada di src/interactions/.
 */

const { Events, MessageFlags } = require("discord.js");
const { logger } = require("../managers/logger");
const languageManager = require("../managers/languageManager");
const rateLimiter = require("../utils/rateLimiter");
const registry = require("../interactions/registry");
const handleAutocomplete = require("../interactions/autocomplete");
const { safeExecute, respondError } = require("../interactions/safeExecute");
const {
  buildErrorContainerV2,
  buildMaintenanceContainerV2,
} = require("../utils/NauraContainerBuilder");

// Batas laju perintah slash (tidak berubah dari versi sebelumnya).
const SLASH_LIMIT = { max: 5, seconds: 5 };

// Batas laju komponen. Sebelumnya tidak ada sama sekali, sehingga tombol bisa
// ditekan secepat mungkin dan setiap tekanan memicu kueri database.
const COMPONENT_LIMIT = { max: 8, seconds: 5 };

function kindOf(interaction) {
  if (interaction.isButton()) return "buttons";
  if (interaction.isModalSubmit()) return "modals";
  if (interaction.isAnySelectMenu()) return "selects";
  return null;
}

function tr(lang, key, placeholders) {
  return languageManager.translateSync(lang, key, placeholders);
}

async function handleSlashCommand(interaction, client) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return undefined;

  const limited = await rateLimiter.isRateLimited(
    interaction.user.id,
    `slash_${interaction.commandName}`,
    SLASH_LIMIT.max,
    SLASH_LIMIT.seconds,
  );

  if (limited) {
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

  // Periksa apakah perintah terkait dengan fitur yang dimatikan
  const {
    COMMAND_FEATURE_MAP,
    isFeatureEnabled,
  } = require("../config/features");
  const featureId = COMMAND_FEATURE_MAP[interaction.commandName];
  if (featureId && interaction.guildId) {
    const enabled = await isFeatureEnabled(interaction.guildId, featureId);
    if (!enabled) {
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
    // Metrik: Catat penggunaan command di Redis Hash
    try {
      const metricsManager = require("../managers/metricsManager");
      metricsManager.logCommand(interaction.commandName);
    } catch (e) {
      // Abaikan gagal log metrik
    }

    await command.execute(interaction, client);
  } catch (error) {
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
    // Autocomplete didahulukan dan sengaja tidak menunggu apa pun. Discord
    // hanya memberi tiga detik, dan jalur ini tidak butuh bahasa maupun
    // pemeriksaan lain.
    if (interaction.isAutocomplete()) {
      return handleAutocomplete(interaction, client);
    }

    interaction.localeLang = await languageManager
      .getUserLanguage(interaction.user.id, interaction.guildId)
      .catch(() => "id");

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

    if (interaction.isChatInputCommand()) {
      return handleSlashCommand(interaction, client);
    }

    if (interaction.isContextMenuCommand()) {
      const { resolveContextMenu } = require("../interactions/contextMenus");
      const handler = resolveContextMenu(interaction.commandName);
      if (handler) {
        try {
          return await handler.execute(interaction, client);
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
      return undefined;
    }

    const kind = kindOf(interaction);
    if (!kind) return undefined;

    const entry = registry.resolve(kind, interaction.customId);

    // Komponen dinamis yang dikelola oleh collector lokal (minigame, survival, NPC, bank, dungeon, kuis, musik, dll.)
    const isLocalCollector =
      /^(mg_|mquiz_|duel_|ttt_|aki_|hangman_|memory_|wordle_|rps_|musicquiz_|trivia_|tod_|btn_|collect_|npc_|date_|roam_|tut_|bank_|dungeon_|gacha_|fish_|mine_|chop_|hunt_|explore_|shop_|casino_|trade_|profile_|pet_|pvp_|quiz_|quest_|story_|craft_|inv_|card_|music_|mm_|naura_)/.test(
        interaction.customId,
      );
    if (!entry && isLocalCollector) {
      return undefined;
    }

    // Komponen dari pesan lama yang penanganya sudah dihapus.
    // Teksnya memakai i18n agar user ID/EN mendapat pesan yang sesuai.
    if (!entry) {
      logger.warn(
        `[INTERAKSI] Tidak ada penangan untuk ${kind}:${interaction.customId}`,
      );
      return interaction
        .reply({
          ...buildErrorContainerV2({
            lang: interaction.localeLang,
            title: tr(
              interaction.localeLang,
              "interaction.stale_component.title",
            ),
            errorMessage: tr(
              interaction.localeLang,
              "interaction.stale_component.body",
            ),
            expressionImage: false,
          }),
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }

    const cooldown = entry.cooldown || COMPONENT_LIMIT;
    const limited = await rateLimiter.isRateLimited(
      interaction.user.id,
      `component_${entry.label}`,
      cooldown.max,
      cooldown.seconds,
    );

    if (limited) {
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

    return safeExecute(interaction, entry, client);
  },
};
