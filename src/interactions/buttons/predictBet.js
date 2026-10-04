"use strict";

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const predictionEngine = require("../../services/predictionEngine");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "pred_bet_",
    label: "predict-bet-button",
    defer: false,
    async handler(interaction) {
      const parts = interaction.customId.replace("pred_bet_", "").split("_");
      const marketId = parts[0];
      const optNum = parts[1] || "1";

      const market = await predictionEngine.getMarket(marketId);
      if (!market) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Pasar Tidak Ditemukan",
            errorMessage: "Pasar prediksi ini sudah tidak tersedia atau telah ditutup.",
            expression: "sad",
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (market.status !== "OPEN") {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Pasar Telah Ditutup",
            errorMessage: "Pasar prediksi ini sudah dikunci dan tidak lagi menerima taruhan.",
            expression: "warning",
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const options = Array.isArray(market.options)
        ? market.options
        : typeof market.options === "string"
          ? JSON.parse(market.options)
          : [];

      const targetOptIndex = parseInt(optNum, 10) - 1;
      const optLabel = options[targetOptIndex]?.label || `Opsi ${optNum}`;

      const modal = new ModalBuilder()
        .setCustomId(`pred_modal_bet_${marketId}_${optNum}`)
        .setTitle(`Pasang Prediksi: ${optLabel}`.slice(0, 45));

      const amountInput = new TextInputBuilder()
        .setCustomId("bet_amount")
        .setLabel(`Jumlah Star Fragments (NSF) [Maks: ${market.maxBetPerUser || 10000}]`)
        .setPlaceholder("Contoh: 100")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(8);

      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      await interaction.showModal(modal);
    },
  },
];
