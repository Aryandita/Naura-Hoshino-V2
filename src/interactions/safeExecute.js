"use strict";

/**
 * Pembungkus eksekusi tunggal untuk seluruh komponen interaksi.
 * Mengimplementasikan Law 1 (Guard Clauses), Law 2 (Intent-revealing Names),
 * dan Law 6 (Make errors useful dengan integrasi DomainError).
 */

const { MessageFlags } = require("discord.js");
const { logger } = require("../managers/logger");
const { buildErrorContainerV2 } = require("../utils/NauraContainerBuilder");
const { isDomainError } = require("../errors/DomainError");

/**
 * Galat Discord yang tidak berguna untuk dilaporkan:
 *   10062 Unknown interaction  - token interaksi kedaluwarsa (batas 3 detik)
 *   40060 Already acknowledged - interaksi sudah dijawab di tempat lain
 *   10008 Unknown message      - pesan sudah dihapus
 *   50027 Invalid webhook token- token balasan kedaluwarsa (batas 15 menit)
 */
const IGNORED_CODES = new Set([10062, 40060, 10008, 50027]);

// Batas keras Discord untuk membalas interaksi adalah 3 detik.
const ACK_WARNING_MS = 2500;

const DEFAULT_ERROR =
  "Terjadi kesalahan saat memproses aksi ini. Coba lagi sebentar lagi ya.";

function isIgnorable(error) {
  return Boolean(error && IGNORED_CODES.has(error.code));
}

/** Kirim pesan galat ke pengguna, apa pun keadaan interaksinya. */
async function respondError(interaction, message) {
  const containerPayload = buildErrorContainerV2({
    errorMessage: message,
    lang: interaction.localeLang || "id",
    withBanner: true,
  });

  try {
    const finalFlags =
      (containerPayload.flags || MessageFlags.IsComponentsV2) |
      MessageFlags.Ephemeral;

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        ...containerPayload,
        flags: finalFlags,
      });
      return;
    }

    await interaction.reply({
      ...containerPayload,
      flags: finalFlags,
    });
  } catch (error) {
    if (!isIgnorable(error)) {
      logger.warn(
        `[INTERAKSI] Tidak bisa mengirim pesan galat: ${error.message}`,
      );
    }
  }
}

/**
 * Jalankan satu penangan komponen dengan jaring pengaman dan guard clauses.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {Object} componentEntry - entri dari registry
 * @param {import('discord.js').Client} client
 */
async function safeExecute(interaction, componentEntry, client) {
  // Guard Clause: Pastikan entri dan fungsi penangan valid
  if (!componentEntry || typeof componentEntry.handler !== "function") {
    logger.warn(
      "[INTERAKSI] Handler komponen tidak valid atau tidak ditemukan.",
    );
    return;
  }

  const {
    label = "unknown",
    source = "unknown",
    defer,
    ephemeral,
    onError,
  } = componentEntry;

  // Watchdog batas interaksi 3 detik
  const interactionWatchdog = setTimeout(() => {
    if (!interaction.replied && !interaction.deferred) {
      logger.warn(
        `[INTERAKSI] "${label}" belum membalas setelah ${ACK_WARNING_MS} ms. ` +
          "Pertimbangkan menambahkan defer pada entri registry-nya.",
      );
    }
  }, ACK_WARNING_MS);

  try {
    // Tangani auto-defer secara datar (flat structure)
    if (!interaction.replied && !interaction.deferred) {
      if (defer === "reply") {
        await interaction.deferReply({ ephemeral: ephemeral !== false });
      } else if (defer === "update") {
        await interaction.deferUpdate();
      }
    }

    // Metrik: Catat penggunaan komponen di Redis Hash tanpa memblokir
    try {
      const metricsManager = require("../managers/metricsManager");
      metricsManager.logComponent(label);
    } catch {
      // Abaikan bila modul metrik belum siap
    }

    await componentEntry.handler(interaction, client);
  } catch (error) {
    // Guard Clause 1: Abaikan error jaringan/token kedaluwarsa Discord
    if (isIgnorable(error)) {
      logger.debug?.(`[INTERAKSI] "${label}" diabaikan: ${error.message}`);
      return;
    }

    // Guard Clause 2: Tangani DomainError terstruktur (Law 6)
    if (isDomainError(error)) {
      logger.warn(
        `[INTERAKSI] DomainError pada "${label}": [${error.code}] ${error.message}`,
        error.context,
      );
      await respondError(interaction, error.userMessage);
      return;
    }

    // Fallback: Error tak terduga
    logger.error(
      `[INTERAKSI] Galat tak terduga pada "${label}" (${source}):`,
      error,
    );
    await respondError(interaction, onError || DEFAULT_ERROR);
  } finally {
    clearTimeout(interactionWatchdog);
  }
}

module.exports = { safeExecute, respondError, isIgnorable, IGNORED_CODES };
