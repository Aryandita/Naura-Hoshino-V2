"use strict";

const { MessageFlags } = require("discord.js");
const predictionEngine = require("../../services/predictionEngine");
const ui = require("../../config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "pred_modal_bet_",
    label: "predict-bet-modal-submit",
    defer: "reply",
    ephemeral: true,
    async handler(interaction) {
      const parts = interaction.customId
        .replace("pred_modal_bet_", "")
        .split("_");
      const marketId = parts[0];
      const optionId = parseInt(parts[1] || "1", 10);

      const rawAmount = interaction.fields.getTextInputValue("bet_amount").trim();
      const amount = parseInt(rawAmount, 10);

      if (isNaN(amount) || amount <= 0) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Jumlah Tidak Valid",
            errorMessage: "Harap masukkan angka nominal taruhan positif yang valid (misal: 100).",
            expression: "warning",
          }),
        );
      }

      const result = await predictionEngine.placeBet({
        marketId,
        guildId: interaction.guildId || "dm",
        userId: interaction.user.id,
        username: interaction.user.username,
        optionId,
        amount,
      });

      if (!result.success) {
        let msg = "Terjadi kesalahan saat memasang taruhan.";
        if (result.reason === "MARKET_NOT_FOUND")
          msg = "Pasar prediksi tidak ditemukan.";
        if (result.reason === "MARKET_LOCKED_OR_CLOSED")
          msg = "Pasar prediksi telah dikunci atau selesai.";
        if (result.reason === "INSUFFICIENT_FUNDS")
          msg = `Saldo Star Fragments kamu tidak mencukupi! (Saldumu: \`${(result.balance || 0).toLocaleString("id-ID")}\` ⭐)`;
        if (result.reason === "EXCEEDS_MAX_BET")
          msg = `Jumlah taruhan melebihi batas maksimal (\`${result.maxBet.toLocaleString("id-ID")}\` ⭐).`;

        return interaction.editReply(
          buildErrorContainerV2({
            title: "Taruhan Gagal",
            errorMessage: msg,
            expression: "sad",
          }),
        );
      }

      const eStar = ui.getEmoji("star") || "⭐";
      const payload = buildContainerV2({
        accentColorHex: "#22C55E",
        title: "🎟️ Taruhan Berhasil Dipasang!",
        expression: "celebrate",
        description: [
          `Kamu berhasil bertaruh **${result.amount.toLocaleString("id-ID")}** Star Fragments ${eStar} untuk opsi **"${result.chosenOption}"**.`,
          "",
          `🏷️ **ID Tiket:** \`${result.betId}\``,
          `📊 **Total Pool Saat Ini:** \`${result.totalPool.toLocaleString("id-ID")}\` ${eStar}`,
          `📈 **Pool Opsi Pilihanmu:** \`${result.optionPool.toLocaleString("id-ID")}\` ${eStar}`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    },
  },
];
