"use strict";

const {
  ApplicationCommandType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = {
  name: "⚔️ Tantang Duel",
  type: ApplicationCommandType.User,
  integration_types: [0], // Guild only
  contexts: [0], // Guild only

  async execute(interaction, client) {
    const targetUser = interaction.targetUser;

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Tantangan Tidak Valid",
          errorMessage: "Kamu tidak bisa menantang dirimu sendiri untuk berduel!",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Tantangan Tidak Valid",
          errorMessage: "Kamu tidak bisa menantang bot untuk duel PvP.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_accept_${interaction.user.id}_${targetUser.id}`)
        .setLabel("⚔️ Terima Tantangan")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`pvp_decline_${interaction.user.id}_${targetUser.id}`)
        .setLabel("🏳️ Tolak")
        .setStyle(ButtonStyle.Secondary),
    );

    const container = buildContainerV2({
      title: "⚔️ Tantangan Duel PvP Arena!",
      description: `<@${interaction.user.id}> secara resmi menantang <@${targetUser.id}> untuk bertarung di PvP Arena!\n\nApakah <@${targetUser.id}> berani menerima tantangan ini?`,
      color: "#F87171",
      buttonsRow: row,
    });

    await interaction.reply(container);
  },
};
