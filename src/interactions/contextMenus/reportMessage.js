"use strict";

const {
  ApplicationCommandType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = {
  name: "🛡️ Lapor ke Staff",
  type: ApplicationCommandType.Message,
  integration_types: [0], // GuildInstall
  contexts: [0], // Guild only

  async execute(interaction, client) {
    if (!interaction.guildId) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Khusus Server",
          errorMessage: "Fitur pelaporan hanya dapat digunakan di dalam server komunitas.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetMessage = interaction.targetMessage;
    const modal = new ModalBuilder()
      .setCustomId(`report_msg_${targetMessage.id}`)
      .setTitle("🛡️ Lapor Pesan ke Staff");

    const reasonInput = new TextInputBuilder()
      .setCustomId("report_reason")
      .setLabel("Alasan Pelaporan")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Jelaskan mengapa pesan ini melanggar peraturan server...")
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
  },
};
