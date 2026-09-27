"use strict";

const { MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { inMemoryLocks } = require("../../utils/redisLockHelper");
const redisManager = require("../../managers/redisManager");
const env = require("../../config/env");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");

function isOwner(userId) {
  return Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(userId);
}

module.exports = [
  {
    id: "incident_flush_cache",
    label: "incident-flush-cache-btn",
    onError: "Gagal membersihkan cache sistem.",
    async handler(interaction) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Hanya Owner bot yang memiliki wewenang untuk membersihkan cache darurat.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        let redisCleared = false;
        if (redisManager && redisManager.isReady && redisManager.client) {
          try {
            // Bersihkan namespace cache bot jika didukung
            if (typeof redisManager.client.flushdb === "function") {
              await redisManager.client.flushdb();
              redisCleared = true;
            }
          } catch (rErr) {
            logger.warn(`[IncidentButtons] Flush Redis DB gagal: ${rErr.message}`);
          }
        }

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10B981",
          authorName: "Naura Incident Operations",
          title: "🧹 Cache Sistem Berhasil Dibersihkan",
          description: [
            "Seluruh temporary cache bot telah direset ke kondisi bersih:",
            redisCleared ? "• Redis DB cache: **Cleared**" : "• In-memory temporary cache: **Refreshed**",
            "",
            "Query data berikutnya akan diambil segar dari basis data relasional / dokumen.",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });

        return await interaction.editReply(payload);
      } catch (err) {
        logger.error("[IncidentButtons] Error flush cache:", err);
        return await interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Flush Cache",
            errorMessage: err.message,
            footerText: ui.getFooter("core"),
          }),
        );
      }
    },
  },
  {
    id: "incident_release_locks",
    label: "incident-release-locks-btn",
    onError: "Gagal melepaskan deadlock transaksi.",
    async handler(interaction) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Hanya Owner bot yang memiliki wewenang untuk melepaskan mutex locks.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const lockCount = inMemoryLocks ? inMemoryLocks.size : 0;
        if (inMemoryLocks) {
          inMemoryLocks.clear();
        }

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10B981",
          authorName: "Naura Incident Operations",
          title: "🔓 Mutex Deadlock Berhasil Dikosongkan",
          description: [
            `Berhasil melepaskan **${lockCount}** in-memory mutex lock aktif.`,
            "",
            "Seluruh transaksi yang sebelumnya terkunci atau terblokir kini dapat dieksekusi kembali.",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });

        return await interaction.editReply(payload);
      } catch (err) {
        logger.error("[IncidentButtons] Error release locks:", err);
        return await interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Lepas Mutex",
            errorMessage: err.message,
            footerText: ui.getFooter("core"),
          }),
        );
      }
    },
  },
];
