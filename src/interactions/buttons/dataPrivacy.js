"use strict";

const { MessageFlags } = require("discord.js");
const UserProfile = require("../../models/UserProfile");
const UserSurvival = require("../../models/UserSurvival");
const UserCosmetic = require("../../models/UserCosmetic");
const UserPet = require("../../models/UserPet");
const UserWarn = require("../../models/UserWarn");
const cacheManager = require("../../managers/cacheManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");

module.exports = [
  {
    prefix: "data_delete_",
    label: "data-privacy-delete",
    async handler(interaction) {
      const customId = interaction.customId;
      const actionParts = customId.split("_");
      const action = actionParts[2]; // 'confirm' atau 'cancel'
      const targetUserId = actionParts[3];

      if (interaction.user.id !== targetUserId) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Akses Ditolak",
            description: "❌ Ini bukan konfirmasi untukmu, kak!",
            footerText: ui.getFooter("core"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (action === "cancel") {
        const cancelPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          title: "Penghapusan Dibatalkan",
          description:
            "Syukurlah! Naura senang kakak memutuskan untuk tetap menyimpan datanya bersama Naura~ 🥰",
          footerText: ui.getFooter("core"),
        });
        return interaction.update(cancelPayload);
      }

      if (action === "confirm") {
        try {
          // Hapus data dari Database
          await UserSurvival.destroy({ where: { userId: targetUserId } });
          await UserProfile.destroy({ where: { id: targetUserId } });
          await UserCosmetic.destroy({ where: { userId: targetUserId } });
          await UserPet.destroy({ where: { userId: targetUserId } });
          await UserWarn.destroy({ where: { userId: targetUserId } });

          // Invalidasi Cache
          await cacheManager.invalidateUserProfile(targetUserId);
          await cacheManager.invalidateUserSurvival(targetUserId);

          const successPayload = buildContainerV2({
            accentColorHex: ui.getColor("success") || "#22c55e",
            title: "✅ Data Dihapus",
            description:
              "Selesai... Naura sudah menghapus seluruh data kakak. Terima kasih sudah bermain bersama Naura ya, kak! Sampai jumpa lagi... 🥺👋",
            footerText: ui.getFooter("core"),
          });
          return interaction.update(successPayload);
        } catch (err) {
          logger.error(
            `[DATA DELETE] Gagal menghapus data user ${targetUserId}:`,
            err,
          );
          const errPayload = buildErrorContainerV2({
            title: "Gagal Menghapus Data",
            description:
              "❌ Maaf kak, terjadi kesalahan saat mencoba menghapus datamu. Tolong lapor ke developer ya!",
            footerText: ui.getFooter("core"),
          });
          return interaction.update(errPayload);
        }
      }
    },
  },
];
