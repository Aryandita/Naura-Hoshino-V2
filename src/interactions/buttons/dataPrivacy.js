"use strict";

const { MessageFlags } = require("discord.js");
const {
  UserProfile,
  UserSurvival,
  UserCosmetic,
  UserPet,
  UserWarn,
} = require("../../models");
const cacheManager = require("../../managers/cacheManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");

module.exports = {
  async execute(interaction, customId, client) {
    if (!customId.startsWith("data_delete_")) return false;

    const actionParts = customId.split("_");
    const action = actionParts[2]; // 'confirm' atau 'cancel'
    const targetUserId = actionParts[3];

    if (interaction.user.id !== targetUserId) {
      await interaction.reply({
        ...buildErrorContainerV2({
          title: "Akses Ditolak",
          description: "❌ Ini bukan konfirmasi untukmu, kak!",
          footerText: ui.getFooter("core"),
        }),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (action === "cancel") {
      const cancelPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "Penghapusan Dibatalkan",
        description:
          "Syukurlah! Naura senang kakak memutuskan untuk tetap menyimpan datanya bersama Naura~ 🥰",
        footerText: ui.getFooter("core"),
      });
      await interaction.update(cancelPayload);
      return true;
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
        await interaction.update(successPayload);
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
        await interaction.update(errPayload);
      }
      return true;
    }

    return false;
  },
};
