"use strict";

const { ApplicationCommandType, MessageFlags, AttachmentBuilder } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { renderInWorker } = require("../../canvas/canvasRuntime");
const UserProfile = require("../../models/UserProfile");
const UserLeveling = require("../../models/UserLeveling");
const UserSurvival = require("../../models/UserSurvival");

module.exports = {
  name: "🪪 Intip Naura ID",
  type: ApplicationCommandType.User,
  integration_types: [0, 1], // Guild & User Install
  contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel

  async execute(interaction, client) {
    const targetUser = interaction.targetUser;

    if (targetUser.bot) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Bot Tidak Memiliki Profil",
          errorMessage: "Bot tidak memiliki kartu profil RPG Naura ID.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const [profile] = await UserProfile.findOrCreate({ where: { userId: targetUser.id } });
      const [leveling] = await UserLeveling.findOrCreate({ where: { userId: targetUser.id } });
      const [survival] = await UserSurvival.findOrCreate({ where: { userId: targetUser.id } });

      const payload = {
        username: targetUser.username,
        avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256 }),
        level: leveling.level || 1,
        xp: leveling.xp || 0,
        wallet: profile.economy_wallet || 0,
        bank: profile.economy_bank || 0,
        starFragments: survival.starFragments || 0,
        coupons: survival.coupons || 0,
        title: profile.custom_title || "Adventurer",
        reputation: profile.reputation || 0,
      };

      const buffer = await renderInWorker("renderProfile", payload);
      const attachment = new AttachmentBuilder(buffer, { name: "naura_id_card.png" });

      const container = buildContainerV2({
        title: `🪪 Naura ID Card - ${targetUser.username}`,
        description: `Profil petualang untuk <@${targetUser.id}> di ekosistem Naura Hoshino.`,
        color: "#FFB6C1",
        bannerAttachmentName: "naura_id_card.png",
      });

      await interaction.editReply({ ...container, files: [attachment] });
    } catch (error) {
      await interaction.editReply(
        buildErrorContainerV2({
          title: "Gagal Memuat Profil",
          errorMessage: "Terjadi kesalahan saat merender kartu profil Naura ID.",
        }),
      );
    }
  },
};
