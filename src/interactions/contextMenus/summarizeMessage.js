"use strict";

const { ApplicationCommandType, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const aiManager = require("../../managers/aiManager");

module.exports = {
  name: "🤖 Ringkas AI (TL;DR)",
  type: ApplicationCommandType.Message,
  integration_types: [0, 1],
  contexts: [0, 1, 2],

  async execute(interaction, client) {
    const targetMessage = interaction.targetMessage;
    const textToSummarize = targetMessage?.content;

    if (!textToSummarize || textToSummarize.trim().length < 20) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Teks Terlalu Pendek",
          errorMessage: "Pesan minimal harus memiliki 20 karakter agar dapat diringkas oleh AI.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const prompt = `Tolong berikan ringkasan poin-poin penting (TL;DR) yang padat, jelas, dan ramah dalam 2-3 poin dari teks berikut:\n\n"${textToSummarize}"`;
      const summary = await aiManager.chat(interaction.user.id, prompt, {
        authorName: interaction.user.username,
        isVision: false,
      });

      const container = buildContainerV2({
        title: "✨ Ringkasan AI Naura (TL;DR)",
        description: `**Pesan dari:** <@${targetMessage.author.id}>\n\n${summary}`,
        color: "#F9A8D4",
      });

      await interaction.editReply(container);
    } catch (error) {
      await interaction.editReply(
        buildErrorContainerV2({
          title: "Gagal Meringkas",
          errorMessage: "AI sedang sibuk atau mengalami gangguan saat meringkas teks.",
        }),
      );
    }
  },
};
