"use strict";

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const typeRaceEngine = require("../../services/typeRaceEngine");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "typerace_start_",
    label: "typerace-start-button",
    defer: false,
    async handler(interaction) {
      const raceId = interaction.customId.replace("typerace_start_", "");
      const session = typeRaceEngine.getRaceSession(raceId);

      if (!session) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Sesi Tidak Ditemukan",
            errorMessage: "Sesi balapan ketik ini telah kedaluwarsa atau sudah selesai.",
            expression: "warning",
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.user.id !== session.userId) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Akses Ditolak",
            errorMessage: "Hanya pemain yang memulai sesi yang dapat mengikuti balapan ini.",
            expression: "sad",
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Record start timestamp upon opening modal
      typeRaceEngine.startRaceSession(raceId);

      const modal = new ModalBuilder()
        .setCustomId(`typerace_modal_${raceId}`)
        .setTitle("⌨️ TypeRacer Speed Arena");

      const textInput = new TextInputBuilder()
        .setCustomId("typed_text")
        .setLabel("Ketik Teks Target Seakurat Mungkin:")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(session.quote.slice(0, 80) + "...")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4000);

      modal.addComponents(new ActionRowBuilder().addComponents(textInput));
      await interaction.showModal(modal);
    },
  },
];
