"use strict";

const { MessageFlags } = require("discord.js");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "pvp_decline_",
    label: "pvp-duel-decline",
    defer: "update",
    async handler(interaction) {
      const parts = interaction.customId.replace("pvp_decline_", "").split("_");
      const challengerId = parts[0];
      const targetId = parts[1];

      if (interaction.user.id !== targetId && interaction.user.id !== challengerId) {
        return interaction.followUp({
          ...buildErrorContainerV2({
            title: "Akses Ditolak",
            errorMessage: "Tantangan duel ini bukan ditujukan untukmu.",
            expression: "warning",
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const isCancelling = interaction.user.id === challengerId;
      const declinePayload = buildContainerV2({
        accentColorHex: ui.getColor("neutral") || "#64748B",
        title: isCancelling ? "🏳️ Tantangan Dibatalkan" : "🏳️ Tantangan Ditolak",
        expression: "neutral",
        description: isCancelling
          ? `<@${challengerId}> telah membatalkan tantangan duel kepada <@${targetId}>.`
          : `<@${targetId}> telah menolak tantangan duel dari <@${challengerId}>. Lain kali coba ajak duel lagi ya!`,
        buttonsRow: [],
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...declinePayload, components: [] });
    },
  },
  {
    prefix: "pvp_accept_",
    label: "pvp-duel-accept",
    defer: "update",
    async handler(interaction) {
      const parts = interaction.customId.replace("pvp_accept_", "").split("_");
      const challengerId = parts[0];
      const targetId = parts[1];

      if (interaction.user.id !== targetId) {
        return interaction.followUp({
          ...buildErrorContainerV2({
            title: "Bukan Giliranmu",
            errorMessage: `Hanya <@${targetId}> yang berhak menerima tantangan duel ini.`,
            expression: "warning",
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        const challengerSurvival =
          (await cacheManager.getUserSurvival(challengerId)) || {};
        const targetSurvival =
          (await cacheManager.getUserSurvival(targetId)) || {};

        const chPower = (challengerSurvival.level || 1) * 10 + Math.floor(Math.random() * 50) + 10;
        const tgPower = (targetSurvival.level || 1) * 10 + Math.floor(Math.random() * 50) + 10;

        const challengerWins = chPower >= tgPower;
        const winnerId = challengerWins ? challengerId : targetId;
        const loserId = challengerWins ? targetId : challengerId;
        const winPower = challengerWins ? chPower : tgPower;
        const losePower = challengerWins ? tgPower : chPower;

        // Hadiah partisipasi persahabatan duel
        await cacheManager.incrementUserSurvival(winnerId, "starFragments", 25).catch(() => {});
        await cacheManager.incrementUserSurvival(loserId, "starFragments", 5).catch(() => {});

        const resultPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10B981",
          title: "⚔️ Hasil Pertarungan PvP Arena!",
          expression: "celebrate",
          description: [
            `Pertarungan sengit antara <@${challengerId}> dan <@${targetId}> telah selesai!`,
            "",
            `💥 **Rincian Kekuatan Pertempuran:**`,
            `> <@${winnerId}>: **${winPower}** Combat Power`,
            `> <@${loserId}>: **${losePower}** Combat Power`,
            "",
            `🏆 **Pemenang:** <@${winnerId}> (+25 Star Fragments ⭐)`,
            `🛡️ **Penghargaan:** <@${loserId}> (+5 Star Fragments)`,
            "",
            "-# *Tingkatkan level survival dan perlengkapanmu di Naura Wilds untuk power duel yang lebih besar!*",
          ].join("\n"),
          buttonsRow: [],
          footerText: ui.getFooter("survival"),
        });

        return interaction.editReply({ ...resultPayload, components: [] });
      } catch (err) {
        logger.error("[PvPDuel] Gagal memproses duel: " + err.message);
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Memproses Duel",
            errorMessage: "Terjadi kesalahan sistem saat memproses pertarungan duel.",
            expression: "sad",
          }),
        );
      }
    },
  },
];
