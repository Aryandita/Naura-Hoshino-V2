/**
 * @namespace: plugin/utility/faq.js
 * @type: Command
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.0.0
 * @description AI Server FAQ & Knowledge Base Assistant
 */

const { SlashCommandBuilder } = require("discord.js");
const cacheManager = require("../../src/managers/cacheManager");
const geminiClient = require("../../src/ai/geminiClient");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("faq")
    .setDescription(
      "Tanya asisten AI Naura tentang aturan & informasi server ini",
    )
    .addSubcommand((sub) =>
      sub
        .setName("ask")
        .setDescription(
          "Tanyakan apa pun tentang panduan, aturan, atau info server",
        )
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription("Pertanyaan yang ingin kamu tanyakan ke Naura")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription(
          "Lihat topik FAQ dan panduan yang tersedia di server ini",
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Khusus Server",
          description: `${ui.getEmoji("error") || "❌"} Perintah ini hanya dapat digunakan di dalam server Discord.`,
          footerText: ui.getFooter("utility"),
        }),
      );
    }

    const settingsData = await cacheManager.getGuildSettings(guildId);
    const serverFaqs = settingsData?.settings?.faq || [];

    if (subcommand === "list") {
      if (serverFaqs.length === 0) {
        const payload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: "Naura Knowledge Assistant",
          title: `${ui.getEmoji("book") || "📚"} Basis Pengetahuan Server`,
          description:
            "Server ini belum mendaftarkan FAQ resmi. Admin server dapat menambahkannya melalui `/setup faq`!",
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(payload);
      }

      const fields = serverFaqs.map((item, idx) => ({
        name: `${idx + 1}. ${item.question}`,
        value:
          item.answer.length > 250
            ? item.answer.slice(0, 247) + "..."
            : item.answer,
      }));

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Knowledge Assistant",
        title: `${ui.getEmoji("book") || "📚"} Daftar FAQ ${interaction.guild.name}`,
        description:
          "Berikut adalah ringkasan topik panduan & aturan server yang telah diajarkan ke Naura:",
        fields: fields.slice(0, 10),
        footerText: "Gunakan /faq ask <pertanyaan> untuk bertanya lebih lanjut",
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "ask") {
      const query = interaction.options.getString("pertanyaan");
      const { service: semanticMemoryService } = require("../../src/ai/semanticMemoryService");

      const relevantMemories = await semanticMemoryService.searchMemories(
        query,
        { guildId, limit: 3, minSimilarity: 0.35 },
      );

      const contextPieces = [];
      if (serverFaqs.length > 0) {
        contextPieces.push(
          serverFaqs
            .map(
              (f, i) =>
                `[FAQ ${i + 1}]: Pertanyaan: ${f.question}\nJawaban/Panduan: ${f.answer}`,
            )
            .join("\n\n"),
        );
      }
      if (relevantMemories.length > 0) {
        contextPieces.push(
          relevantMemories
            .map((m, i) => {
              const meta = m.metadata || {};
              const src = meta.fileName ? ` (Sumber: ${meta.fileName})` : "";
              return `[Kutipan Dokumen ${i + 1}${src}]:\n${m.content}`;
            })
            .join("\n\n"),
        );
      }

      let prompt;
      if (contextPieces.length > 0) {
        const fullContext = contextPieces.join("\n\n");
        prompt = [
          "Kamu adalah Naura Hoshino, asisten virtual anime yang cerdas, imut, hangat, dan ramah di Discord.",
          `Kamu sedang membantu member di server '${interaction.guild.name}'.`,
          "Berikut adalah basis pengetahuan, FAQ, dan dokumen resmi server:",
          "--- DOKUMEN SERVER ---",
          fullContext,
          "--- AKHIR DOKUMEN ---",
          `Pertanyaan Member (${interaction.user.username}): "${query}"`,
          "Instruksi Jawaban:",
          "1. Jawablah secara akurat dan tepat berdasarkan dokumen di atas dengan gaya bahasa santai, ceria, dan sopan.",
          "2. Jika jawaban tidak ada di dokumen, sampaikan dengan jujur bahwa informasi tersebut belum terdaftar dan sarankan member untuk bertanya ke staf atau admin server.",
          "3. Maksimal 3-4 paragraf singkat.",
        ].join("\n");
      } else {
        prompt = [
          "Kamu adalah Naura Hoshino, asisten virtual anime yang imut dan ramah di Discord.",
          `Member (${interaction.user.username}) di server '${interaction.guild.name}' bertanya: "${query}".`,
          "Server ini belum memasukkan dokumen FAQ resmi.",
          "Jawab pertanyaan umum ini dengan sopan dan ramah, serta ingatkan bahwa untuk aturan spesifik server bisa konfirmasi ke staf.",
        ].join("\n");
      }

      try {
        const aiResponse = await geminiClient.generate({
          parts: [{ text: prompt }],
        });

        const replyText =
          aiResponse ||
          `Aduh, maaf yaa... Naura lagi sedikit pusing dan belum bisa menjawab pertanyaanmu sekarang. Coba tanyakan ke staf server yaa~ ${ui.getEmoji("sakura") || "🌸"}`;

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: "Naura Knowledge Assistant",
          title: `${ui.getEmoji("intelligence") || "🧠"} Jawaban Naura FAQ`,
          description: `**Pertanyaan:** *${query}*\n\n${replyText}`,
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      } catch (err) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Menjawab",
            description: `${ui.getEmoji("error") || "❌"} Terjadi kendala saat memproses jawaban AI. Silakan coba sesaat lagi.`,
            footerText: ui.getFooter("utility"),
          }),
        );
      }
    }
  },
};
