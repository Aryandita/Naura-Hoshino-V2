"use strict";

const { MessageFlags } = require("discord.js");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

module.exports = [
  {
    prefix: "info_cta_",
    label: "survival-profile-cta",
    defer: "update",
    async handler(interaction) {
      // Format customId: info_cta_<action> atau info_cta_<action>:<ownerId>
      const rawId = interaction.customId;
      const [actionPart, ownerId] = rawId.split(":");
      const action = actionPart.replace("info_cta_", "");

      // Jika ada ownerId di customId, cegah interupsi dari user lain
      if (ownerId && ownerId !== interaction.user.id) {
        return interaction.followUp({
          ...buildErrorContainerV2({
            authorName: "Naura Survival Guard",
            title: "Catatan Petualang Milik Pemain Lain",
            errorMessage:
              "Tombol ini tersambung ke profil petualang pemain lain. Gunakan perintah **/survival** untuk membuka catatan pribadimu ya!",
            lang: interaction.localeLang,
            expression: "denied",
          }),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }

      try {
        switch (action) {
          case "inventory": {
            const invSub = require("../../../plugin/survival/subcommands/inventory");
            return await invSub.execute(interaction);
          }
          case "shop": {
            const shopSub = require("../../../plugin/survival/subcommands/shop");
            return await shopSub.execute(interaction);
          }
          case "gather": {
            const collectSub = require("../../../plugin/survival/subcommands/collect");
            return await collectSub.execute(interaction);
          }
          case "farm": {
            const farmSub = require("../../../plugin/survival/subcommands/farm");
            return await farmSub.execute(interaction);
          }
          case "dungeon": {
            const dungeonSub = require("../../../plugin/survival/subcommands/dungeon");
            return await dungeonSub.execute(interaction);
          }
          case "skill": {
            const skillSub = require("../../../plugin/survival/subcommands/skill");
            return await skillSub.execute(interaction);
          }
          case "work": {
            const workSub = require("../../../plugin/survival/subcommands/work");
            return await workSub.execute(interaction);
          }
          default: {
            logger.warn(`[SURVIVAL CTA] Aksi tidak dikenal: ${action}`);
            return interaction.followUp({
              ...buildErrorContainerV2({
                title: "Fitur Sedang Disiapkan",
                errorMessage: "Sub-menu ini sedang dalam pemeliharaan berkala.",
                lang: interaction.localeLang,
              }),
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
          }
        }
      } catch (err) {
        logger.error(`[SURVIVAL CTA ERROR] Gagal mengeksekusi ${action}:`, err);
        return interaction.followUp({
          ...buildErrorContainerV2({
            title: `${ui.getEmoji("naura_cry") || "😭"} Gagal Membuka Menu`,
            errorMessage:
              "Terjadi kesalahan saat memuat menu ini. Coba buka kembali lewat perintah **/survival** ya!",
            lang: interaction.localeLang,
          }),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
    },
  },
];
