"use strict";

const { ApplicationCommandType, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { translateText } = require("../../utils/translateHelper");

module.exports = {
  name: "🤖 Terjemahkan Teks",
  type: ApplicationCommandType.Message,
  integration_types: [0, 1], // GuildInstall & UserInstall
  contexts: [0, 1, 2], // Guild, BotDM, PrivateChannel

  async execute(interaction, client) {
    const targetMessage = interaction.targetMessage;
    const textToTranslate = targetMessage?.content;

    if (!textToTranslate || textToTranslate.trim().length === 0) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Pesan Kosong",
          errorMessage: "Pesan ini tidak berisi teks yang dapat diterjemahkan.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const targetLang = (interaction.localeLang === "en") ? "en" : "id";
      const result = await translateText(textToTranslate, targetLang);

      const container = buildContainerV2({
        title: "🌐 Hasil Terjemahan Pesan",
        description: `**Teks Asli:**\n> ${textToTranslate.slice(0, 1000)}\n\n**Terjemahan (${targetLang.toUpperCase()}):**\n${result}`,
        color: "#93C5FD",
      });

      await interaction.editReply(container);
    } catch (error) {
      await interaction.editReply(
        buildErrorContainerV2({
          title: "Gagal Menerjemahkan",
          errorMessage: "Terjadi kesalahan saat memproses terjemahan pesan.",
        }),
      );
    }
  },
};
