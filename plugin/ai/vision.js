"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const aiManager = require("../../src/managers/aiManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vision")
    .setDescription(
      "Analisis gambar, screenshot game, error koding, atau meme bertenaga Gemini Flash.",
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("image")
        .setDescription(
          "Unggah gambar atau tangkapan layar yang ingin dianalisis",
        )
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("prompt")
        .setDescription(
          "Pertanyaan spesifik atau hal yang ingin kamu ketahui dari gambar ini",
        )
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("Preset gaya analisis Naura")
        .setRequired(false)
        .addChoices(
          { name: "🔍 Umum (Penjelasan Lengkap)", value: "general" },
          {
            name: "🎮 Gaming Mentor (Analisis Build & Gear)",
            value: "game_build",
          },
          {
            name: "💻 Code Debugger (Bantu Analisis Error Koding)",
            value: "code_error",
          },
          {
            name: "🎭 Meme & Vibe Rater (Nilai Estetika / Kelucuan)",
            value: "rate_meme",
          },
        ),
    ),

  async execute(interaction) {
    const attachment = interaction.options.getAttachment("image");
    const userPrompt = interaction.options.getString("prompt") || "";
    const mode = interaction.options.getString("mode") || "general";

    if (
      !attachment ||
      !attachment.contentType ||
      !attachment.contentType.startsWith("image/")
    ) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Format Berkas Tidak Didukung",
          errorMessage:
            "Lampiran harus berupa file gambar yang valid (PNG, JPG, JPEG, WEBP).",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    // Defer reply karena operasi pengunduhan gambar dan AI vision butuh 2-4 detik
    await interaction.deferReply();

    try {
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(
          `Gagal mengunduh berkas gambar (HTTP ${response.status}).`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      const displayName =
        interaction.member?.displayName || interaction.user.username;

      const analysisResult = await aiManager.chatVision({
        userId: interaction.user.id,
        prompt: userPrompt,
        imageBuffer,
        mimeType: attachment.contentType,
        mode,
        authorName: displayName,
      });

      let modeBadge = "🔍 Analisis Visual Umum";
      let accentColor = "#F9A8D4";

      if (mode === "game_build") {
        modeBadge = "🎮 Analisis Gaming Build & Gear";
        accentColor = "#86EFAC";
      } else if (mode === "code_error") {
        modeBadge = "💻 Debugging Kode & Error";
        accentColor = "#93C5FD";
      } else if (mode === "rate_meme") {
        modeBadge = "🎭 Rating Humor & Estetika Meme";
        accentColor = "#FBBF24";
      }

      const container = buildContainerV2({
        title: `👁️ Cyber-Eye: ${modeBadge}`,
        authorName: `Diajukan oleh: ${displayName}`,
        description:
          (userPrompt ? `**Pertanyaan:** *"${userPrompt}"*\n\n` : "") +
          `${analysisResult}`,
        color: accentColor,
        footerText: "Naura Cyber-Eye • Multimodal Gemini Flash Engine",
      });

      await interaction.editReply(container);
    } catch (error) {
      await interaction.editReply(
        buildErrorContainerV2({
          title: "Gagal Memproses Gambar",
          errorMessage:
            error.message ||
            "Vision AI sedang sibuk atau kuota API sedang penuh. Silakan coba lagi sebentar.",
        }),
      );
    }
  },
};
