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
const { logger } = require("../../managers/logger");

module.exports = {
  async execute(interaction, customId, client) {
    if (!customId.startsWith("data_delete_")) return false;

    const actionParts = customId.split("_");
    const action = actionParts[2]; // 'confirm' atau 'cancel'
    const targetUserId = actionParts[3];

    if (interaction.user.id !== targetUserId) {
      await interaction.reply({
        content: "❌ Ini bukan konfirmasi untukmu, kak!",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (action === "cancel") {
      await interaction.update({
        content:
          "Syukurlah! Naura senang kakak memutuskan untuk tetap menyimpan datanya bersama Naura~ 🥰",
        embeds: [],
        components: [],
      });
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

        await interaction.update({
          content:
            "✅ Selesai... Naura sudah menghapus seluruh data kakak. Terima kasih sudah bermain bersama Naura ya, kak! Sampai jumpa lagi... 🥺👋",
          embeds: [],
          components: [],
        });
      } catch (err) {
        logger.error(
          `[DATA DELETE] Gagal menghapus data user ${targetUserId}:`,
          err,
        );
        await interaction.update({
          content:
            "❌ Maaf kak, terjadi kesalahan saat mencoba menghapus datamu. Tolong lapor ke developer ya!",
          embeds: [],
          components: [],
        });
      }
      return true;
    }

    return false;
  },
};
