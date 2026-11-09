"use strict";

const { MessageFlags } = require("discord.js");
const { logger } = require("../../managers/logger");
const rateLimiter = require("../../utils/rateLimiter");
const { respondError } = require("../safeExecute");
const { isDomainError } = require("../../errors/DomainError");
const {
  buildErrorContainerV2,
  buildMaintenanceContainerV2,
} = require("../../utils/NauraContainerBuilder");
const env = require("../../config/env");
const {
  isGlobalMaintenanceActive,
  getGlobalMaintenance,
  isModuleKilled,
} = require("../../services/incidentService");
const { withEphemeralFlags } = require("./interactionGuards");

const SLASH_LIMIT = Object.freeze({ max: 5, seconds: 5 });

async function handleSlashCommand(interaction, client) {
  const targetCommand = client.commands.get(interaction.commandName);
  if (!targetCommand) return undefined;
  const isOwnerUser =
    Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(interaction.user.id);
  if (isGlobalMaintenanceActive() && !isOwnerUser) {
    let maintInfo;
    try {
      maintInfo = await getGlobalMaintenance();
    } catch (error) {
      logger.error(
        "[INTERAKSI] Gagal mengambil informasi pemeliharaan global:",
        error,
      );
      maintInfo = { reason: "Pemeliharaan sistem sedang berlangsung." };
    }
    return interaction
      .reply(
        withEphemeralFlags(
          buildMaintenanceContainerV2({
            title: "Pemeliharaan Sistem Terpadu",
            reason:
              maintInfo.reason ||
              "Pembaruan arsitektur dan penanganan keamanan berkala",
            lang: interaction.localeLang,
          }),
        ),
      )
      .catch(() => {});
  }
  if (isModuleKilled(interaction.commandName) && !isOwnerUser) {
    return interaction
      .reply(
        withEphemeralFlags(
          buildErrorContainerV2({
            authorName: "Naura Incident Guard",
            title: "Modul Dinonaktifkan Sementara",
            errorMessage: `Perintah **/${interaction.commandName}** sedang dinonaktifkan sementara oleh pengembang untuk investigasi kendala teknis.`,
            lang: interaction.localeLang,
            expression: "denied",
          }),
        ),
      )
      .catch(() => {});
  }
  let isCommandRateLimited = false;
  try {
    isCommandRateLimited = await rateLimiter.isRateLimited(
      interaction.user.id,
      `slash_${interaction.commandName}`,
      SLASH_LIMIT.max,
      SLASH_LIMIT.seconds,
    );
  } catch (error) {
    logger.error("[INTERAKSI] Gagal mengecek rate limit perintah:", error);
  }
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
  const {
    COMMAND_FEATURE_MAP,
    isFeatureEnabled,
  } = require("../../config/features");
  const featureId = COMMAND_FEATURE_MAP[interaction.commandName];
  if (featureId && interaction.guildId) {
    let isModuleEnabled = true;
    try {
      isModuleEnabled = await isFeatureEnabled(interaction.guildId, featureId);
    } catch (error) {
      logger.error("[INTERAKSI] Gagal mengecek status fitur command:", error);
    }
    if (!isModuleEnabled) {
      return interaction
        .reply(
          withEphemeralFlags(
            buildErrorContainerV2({
              authorName: "Naura Feature Guard",
              title: "Fitur Dinonaktifkan",
              errorMessage: `Command ini adalah bagian dari modul **${featureId}**, yang saat ini dimatikan oleh Admin server.`,
              lang: interaction.localeLang,
              expression: "denied",
            }),
          ),
        )
        .catch(() => {});
    }
  }
  try {
    try {
      const metricsManager = require("../../managers/metricsManager");
      metricsManager.logCommand(interaction.commandName);
      const trafficMonitor = require("../../managers/trafficMonitor");
      trafficMonitor.recordCommand(
        interaction.commandName,
        interaction.user.id,
      );
    } catch (err) {
      if (
        err?.code &&
        [10008, 40060, 50027, 50013, 50007, 10062].includes(err.code)
      ) {
        // Intentional: abaikan error lifecycle Discord tanpa balasan } else {
        logger.debug(
          "[interactionCreate:handleSlashCommand] Interaksi Discord lifecycle gagal: " +
            (err?.message || err),
        );
      }
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
      "Terjadi kesalahan saat memproses perintah ini.",
    );
  }
  return undefined;
}

module.exports = { handleSlashCommand, SLASH_LIMIT };
