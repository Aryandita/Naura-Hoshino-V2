"use strict";

const { MessageFlags } = require("discord.js");
const CooldownRushHelper = require("../../survival/helpers/cooldownRushHelper");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    prefix: "rush_cd_",
    label: "rush-cooldown",
    onError: "Gagal memproses Rush Cooldown.",
    async handler(interaction) {
      const cooldownKey = interaction.customId.replace("rush_cd_", "");
      const userId = interaction.user.id;

      const result = await CooldownRushHelper.executeRush(userId, cooldownKey);

      if (!result.success) {
        return interaction.reply({
          content: `❌ ${result.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10B981",
        authorName: "Naura Survival Cooldown",
        title: "⚡ Rush Cooldown Berhasil!",
        description: [
          result.message,
          "",
          `Sekarang kamu sudah bisa langsung beraktivitas kembali tanpa jeda!`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...successPayload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
