"use strict";

const { MessageFlags } = require("discord.js");
const { buildErrorContainerV2, buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const { isOwner, buildOwnerPanelPayload } = require("../../utils/ownerPanelHelper");
const cacheManager = require("../../managers/cacheManager");
const leveling = require("../../survival/engines/survivalLeveling");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");

module.exports = [
  {
    id: "owner_profile_panel",
    label: "owner-profile-panel-btn",
    onError: "Gagal membuka panel kontrol owner.",
    async handler(interaction) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Panel ini eksklusif untuk Bot Owner.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const payload = buildOwnerPanelPayload();
      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
  {
    id: "owner_profile_heal_self",
    label: "owner-profile-heal-self-btn",
    onError: "Gagal memulihkan status vital.",
    async handler(interaction) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Perintah pemulihan instan hanya dapat digunakan oleh Bot Owner.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const userId = interaction.user.id;
        const survival = await cacheManager.getUserSurvival(userId);
        if (!survival) {
          return interaction.editReply(
            buildErrorContainerV2({
              title: "Gagal Memulihkan",
              errorMessage: "Data petualang tidak ditemukan.",
              footerText: ui.getFooter("core"),
            }),
          );
        }

        const maxHp = leveling.calculateMaxHp(survival, survival.rpg_state?.class_bonus?.hp || 0);
        const updatedRpgState = {
          ...(survival.rpg_state || {}),
          sick: false,
        };

        const patch = {
          hp: maxHp,
          hunger: 100,
          thirst: 100,
          stamina: 100,
          rpg_state: updatedRpgState,
        };

        await cacheManager.updateUserSurvival(userId, patch);
        await cacheManager.flushUser(userId);

        const successPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#10B981",
          authorName: "Naura Medical Ops",
          title: "💖 Vitalitas Berhasil Dipulihkan 100%",
          description: [
            `Seluruh status vital petualang **${interaction.user.username}** telah dipulihkan secara penuh:`,
            "",
            `• **HP:** \`${maxHp} / ${maxHp}\``,
            "• **Lapar (Hunger):** `100 / 100`",
            "• **Haus (Thirst):** `100 / 100`",
            "• **Stamina:** `100 / 100`",
            "• **Status Sakit:** `Sembuh (Normal)`",
            "",
            "Data telah disinkronkan ke cache Redis dan database Supabase.",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });

        return interaction.editReply(successPayload);
      } catch (err) {
        logger.error("[OwnerProfileButton] Error heal self:", err);
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Memulihkan",
            errorMessage: err.message,
            footerText: ui.getFooter("core"),
          }),
        );
      }
    },
  },
];
