"use strict";

/**
 * @namespace: plugin/utility/knowledge.js
 * @type: Command
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 2.3.0
 * @description Server RAG Knowledge Base Engine (Upload PDF, DOCX, XLSX, TXT & Tanya Jawab AI)
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { parseDocument } = require("../../src/ai/documentParser");
const {
  service: semanticMemoryService,
} = require("../../src/ai/semanticMemoryService");
const geminiClient = require("../../src/ai/geminiClient");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildSuccessContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("knowledge")
    .setDescription(
      "Pusat basis pengetahuan Server RAG Naura (baca PDF, DOCX, XLSX, & Aturan Server)",
    )
    .addSubcommand((sub) =>
      sub
        .setName("upload")
        .setDescription(
          "Unggah berkas dokumen (PDF, Word, Excel, CSV, TXT) untuk dipelajari Naura",
        )
        .addAttachmentOption((opt) =>
          opt
            .setName("berkas")
            .setDescription("Berkas dokumen yang ingin diajarkan (maks. 10 MB)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("kategori")
            .setDescription("Kategori pengetahuan dokumen")
            .setRequired(false)
            .addChoices(
              { name: "Aturan Server", value: "SERVER_RULE" },
              { name: "Panduan & Lore", value: "LORE" },
              { name: "Tanya Jawab & FAQ", value: "FAQ" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription(
          "Lihat daftar dokumen pengetahuan yang tersimpan di server ini",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Hapus berkas dokumen pengetahuan dari memori server")
        .addStringOption((opt) =>
          opt
            .setName("nama_berkas")
            .setDescription(
              "Nama berkas yang ingin dihapus (contoh: aturan_server.pdf)",
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ask")
        .setDescription(
          "Tanyakan apa pun tentang isi dokumen dan panduan server kepada Naura",
        )
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription(
              "Pertanyaan yang ingin kamu cari jawabannya dari dokumen server",
            )
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Khusus Server",
          description: `${ui.getEmoji("cross") || "❌"} Perintah ini hanya dapat digunakan di dalam server Discord.`,
          footerText: ui.getFooter("utility"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    // Subcommand: UPLOAD (Khusus Admin / Staf dengan izin Kelola Server)
    if (subcommand === "upload") {
      if (
        !interaction.memberPermissions ||
        !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Izin Tidak Cukup",
            description: `${ui.getEmoji("cross") || "❌"} Kamu memerlukan izin **Kelola Server (Manage Server)** untuk mengunggah berkas pengetahuan.`,
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const attachment = interaction.options.getAttachment("berkas");
      const kategori =
        interaction.options.getString("kategori") || "SERVER_RULE";

      if (!attachment) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Berkas Tidak Ditemukan",
            description: "Silakan lampirkan berkas dokumen yang valid.",
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      try {
        const parsed = await parseDocument(attachment.url, {
          fileName: attachment.name,
        });

        const ingestRes = await semanticMemoryService.ingestDocument(
          guildId,
          interaction.user.id,
          parsed,
          kategori,
        );

        if (!ingestRes.success) {
          return interaction.editReply(
            buildErrorContainerV2({
              title: "Gagal Mempelajari Dokumen",
              description: `Terjadi kendala saat menyimpan pengetahuan: ${ingestRes.reason || "Format tidak valid"}.`,
              footerText: ui.getFooter("utility"),
            }),
          );
        }

        const payload = buildSuccessContainerV2({
          authorName: "Naura Knowledge Hub",
          title: `${ui.getEmoji("book") || "📚"} Dokumen Berhasil Dipelajari!`,
          description:
            `Naura telah selesai membaca dan memahami berkas pengetahuan server:\n\n` +
            `📄 **Nama Berkas:** \`${parsed.fileName}\`\n` +
            `📂 **Tipe Format:** \`${parsed.fileType.toUpperCase()}\`\n` +
            `🏷️ **Kategori:** \`${kategori}\`\n` +
            `🧩 **Jumlah Potongan:** \`${ingestRes.chunksIngested} chunks terindeks\`\n\n` +
            `💡 *Warga server sekarang bisa menanyakan isi dokumen ini via* \`/knowledge ask\` *atau* \`/faq ask\`!`,
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      } catch (err) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Membaca Dokumen",
            description: `${ui.getEmoji("cross") || "❌"} ${err.message}`,
            footerText: ui.getFooter("utility"),
          }),
        );
      }
    }

    // Subcommand: LIST
    if (subcommand === "list") {
      await interaction.deferReply();

      const docs = await semanticMemoryService.listDocuments(guildId);
      if (docs.length === 0) {
        const payload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: "Naura Knowledge Hub",
          title: `${ui.getEmoji("book") || "📚"} Dokumen Pengetahuan Server`,
          description:
            `Belum ada dokumen yang diunggah di server ini.\n` +
            `Admin dapat mengunggah buku aturan (PDF/Word/Excel) via \`/knowledge upload\`!`,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(payload);
      }

      const docList = docs
        .map(
          (d, idx) =>
            `**${idx + 1}.** 📄 **${d.fileName}** (\`${d.fileType.toUpperCase()}\`) - \`${d.chunkCount} chunks\``,
        )
        .join("\n");

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Knowledge Hub",
        title: `${ui.getEmoji("book") || "📚"} Dokumen Pengetahuan ${interaction.guild.name}`,
        description:
          `Berikut adalah daftar berkas yang telah dipelajari Naura di server ini:\n\n${docList}\n\n` +
          `*Gunakan \`/knowledge ask <pertanyaan>\` untuk bertanya berdasarkan dokumen di atas.*`,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    // Subcommand: REMOVE (Khusus Admin / Staf)
    if (subcommand === "remove") {
      if (
        !interaction.memberPermissions ||
        !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Izin Tidak Cukup",
            description: `${ui.getEmoji("cross") || "❌"} Kamu memerlukan izin **Kelola Server (Manage Server)** untuk menghapus berkas pengetahuan.`,
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const fileName = interaction.options.getString("nama_berkas");

      const res = await semanticMemoryService.purgeDocument(guildId, fileName);
      if (!res.success || res.deletedCount === 0) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Berkas Tidak Ditemukan",
            description: `Tidak ditemukan rekaman pengetahuan dengan nama berkas \`${fileName}\` di server ini. Cek daftar dokumen via \`/knowledge list\`.`,
            footerText: ui.getFooter("utility"),
          }),
        );
      }

      const payload = buildSuccessContainerV2({
        authorName: "Naura Knowledge Hub",
        title: "🗑️ Berkas Pengetahuan Dihapus",
        description: `Seluruh memori semantik (\`${res.deletedCount} chunks\`) untuk berkas **${fileName}** telah dihapus dari basis data server.`,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    // Subcommand: ASK
    if (subcommand === "ask") {
      await interaction.deferReply();
      const query = interaction.options.getString("pertanyaan");

      // Cari memori dokumen yang relevan di server ini
      const relevantMemories = await semanticMemoryService.searchMemories(
        query,
        {
          guildId,
          limit: 4,
          minSimilarity: 0.35,
        },
      );

      let contextBlock = "";
      const citedFiles = new Set();

      if (relevantMemories.length > 0) {
        contextBlock = relevantMemories
          .map((m, i) => {
            const meta = m.metadata || {};
            if (meta.fileName) citedFiles.add(meta.fileName);
            const src = meta.fileName ? ` (Sumber: ${meta.fileName})` : "";
            return `[Bagian ${i + 1}${src}]:\n${m.content}`;
          })
          .join("\n\n");
      }

      const prompt = [
        "Kamu adalah Naura Hoshino, asisten anime AI cerdas, ramah, dan teliti di Discord.",
        `Kamu sedang menjawab pertanyaan member (${interaction.user.username}) di server '${interaction.guild.name}'.`,
        contextBlock
          ? [
              "Berikut adalah kutipan dokumen resmi server yang relevan:",
              "--- DOKUMEN RESMI SERVER ---",
              contextBlock,
              "--- AKHIR DOKUMEN ---",
              `Pertanyaan: "${query}"`,
              "Instruksi:",
              "1. Jawablah secara akurat mengutip dokumen di atas.",
              "2. Gunakan nada bicara ramah, ceria, dan sopan khas Naura.",
              "3. Jika jawaban tidak ditemukan di dokumen, sampaikan dengan jujur dan sarankan bertanya ke staf.",
              "4. Ringkas, padat, dan jelas (maksimal 3 paragraf).",
            ].join("\n")
          : [
              `Member bertanya: "${query}".`,
              "Server ini belum memiliki dokumen panduan khusus terkait topik ini.",
              "Jawab dengan ramah secara umum dan sarankan konfirmasi ke admin atau staf server.",
            ].join("\n"),
      ].join("\n\n");

      try {
        const aiReply = await geminiClient.generate({
          parts: [{ text: prompt }],
        });

        const replyText =
          aiReply ||
          `Aduh, maaf yaa... Naura belum bisa menjawab sekarang. Coba tanyakan ke staf server yaa~ ${ui.getEmoji("sakura") || "🌸"}`;

        const citationText =
          citedFiles.size > 0
            ? `\n\n📌 *Sumber rujukan:* ${Array.from(citedFiles)
                .map((f) => `\`${f}\``)
                .join(", ")}`
            : "";

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: "Naura Knowledge Hub",
          title: `${ui.getEmoji("intelligence") || "🧠"} Jawaban Server Knowledge`,
          description: `**Pertanyaan:** *${query}*\n\n${replyText}${citationText}`,
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      } catch (err) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Menjawab",
            description: `${ui.getEmoji("cross") || "❌"} Terjadi kendala saat memproses jawaban AI: ${err.message}`,
            footerText: ui.getFooter("utility"),
          }),
        );
      }
    }
  },
};
