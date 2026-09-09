"use strict";

const { ApplicationCommandType, MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");
const aiManager = require("../../managers/aiManager");

module.exports = {
  name: "👁️ Tanya Naura (Vision AI)",
  type: ApplicationCommandType.Message,
  integration_types: [0, 1],
  contexts: [0, 1, 2],

  async execute(interaction, client) {
    const targetMessage = interaction.targetMessage;
    let targetImageUrl = null;
    let mimeType = "image/png";

    // 1. Cek dari lampiran gambar (attachments)
    const attachment = targetMessage?.attachments?.find(
      (a) => a.contentType && a.contentType.startsWith("image/"),
    );

    if (attachment) {
      targetImageUrl = attachment.url;
      mimeType = attachment.contentType;
    } else if (targetMessage?.embeds && targetMessage.embeds.length > 0) {
      // 2. Cek dari embed image atau thumbnail jika ada
      const imageEmbed = targetMessage.embeds.find(
        (e) => e.image?.url || e.thumbnail?.url,
      );
      if (imageEmbed) {
        targetImageUrl = imageEmbed.image?.url || imageEmbed.thumbnail?.url;
      }
    }

    if (!targetImageUrl) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Gambar Tidak Ditemukan",
          errorMessage:
            "Pesan yang kamu pilih tidak memiliki lampiran gambar yang dapat dianalisis oleh Vision AI Naura.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const response = await fetch(targetImageUrl);
      if (!response.ok) {
        throw new Error(`Gagal mengunduh gambar: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      const promptText =
        targetMessage.content && targetMessage.content.trim().length > 0
          ? `Konteks pesan dari pengirim: "${targetMessage.content.trim()}". Tolong periksa dan berikan ulasan cerdas mengenai gambar ini!`
          : "Tolong periksa, jelaskan detail penting, dan berikan ulasan cerdas mengenai gambar ini!";

      const displayName =
        interaction.member?.displayName || interaction.user.username;

      const analysisResult = await aiManager.chatVision({
        userId: interaction.user.id,
        prompt: promptText,
        imageBuffer,
        mimeType,
        mode: "general",
        authorName: displayName,
      });

      const container = buildContainerV2({
        title: "👁️ Analisis Visual Naura (Cyber-Eye)",
        authorName: `Pengguna: ${displayName}`,
        description: `**Gambar dari:** <@${targetMessage.author.id}>\n\n${analysisResult}`,
        color: "#F9A8D4",
        footerText: "Naura Cyber-Eye Multimodal • Bertenaga Gemini Flash",
      });

      await interaction.editReply(container);
    } catch (error) {
      await interaction.editReply(
        buildErrorContainerV2({
          title: "Gagal Menganalisis Gambar",
          errorMessage:
            error.message ||
            "Vision AI sedang sibuk atau mengalami gangguan saat membaca gambar.",
        }),
      );
    }
  },
};
