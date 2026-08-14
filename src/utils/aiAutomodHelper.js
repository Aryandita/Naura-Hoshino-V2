// src/utils/aiAutomodHelper.js
// Helper untuk AI Auto-mod berbasis Gemini.
// TRIGGER: Context menu "⚑ Report Pesan", bukan per-pesan.
// AI hanya aktif saat ada laporan dari user Discord.

const gemini = require("../ai/geminiClient");
const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");

// Rate limiter per-guild untuk mencegah spam report (in-memory)
// Map<guildId, Map<reporterId, lastReportTimestamp>>
const reportCooldowns = new Map();
const REPORT_COOLDOWN_MS = 60 * 1000; // 60 detik per reporter per guild

// Cleanup rate limiter setiap 5 menit (Rule 1.8)
// unref() penting: tanpa itu timer ini menahan event loop tetap hidup dan
// membuat proses menggantung saat shutdown, persis masalah yang diperbaiki
// di PR #13 untuk timer lain.
const cooldownSweeper = setInterval(
  () => {
    const now = Date.now();
    for (const [guildId, reporters] of reportCooldowns.entries()) {
      for (const [reporterId, ts] of reporters.entries()) {
        if (now - ts > REPORT_COOLDOWN_MS * 2) reporters.delete(reporterId);
      }
      if (reporters.size === 0) reportCooldowns.delete(guildId);
    }
  },
  5 * 60 * 1000,
);
if (cooldownSweeper.unref) cooldownSweeper.unref();

/**
 * Cek apakah reporter sedang dalam cooldown.
 * @param {string} guildId
 * @param {string} reporterId
 * @returns {{ onCooldown: boolean, remainingMs: number }}
 */
function checkReportCooldown(guildId, reporterId) {
  if (!reportCooldowns.has(guildId)) reportCooldowns.set(guildId, new Map());
  const guildMap = reportCooldowns.get(guildId);
  const lastReport = guildMap.get(reporterId) || 0;
  const elapsed = Date.now() - lastReport;
  if (elapsed < REPORT_COOLDOWN_MS) {
    return { onCooldown: true, remainingMs: REPORT_COOLDOWN_MS - elapsed };
  }
  return { onCooldown: false, remainingMs: 0 };
}

/**
 * Tandai reporter sebagai baru saja melaporkan.
 */
function setReportCooldown(guildId, reporterId) {
  if (!reportCooldowns.has(guildId)) reportCooldowns.set(guildId, new Map());
  reportCooldowns.get(guildId).set(reporterId, Date.now());
}

/**
 * Prompt dasar untuk Gemini, berisi instruksi analisis pesan.
 * Menginstruksikan output JSON dengan skor dan kategori.
 */
function buildAnalysisPrompt(messageContent, authorUsername, guildName) {
  return `Kamu adalah sistem moderasi AI untuk server Discord bernama "${guildName}".
Tugasmu adalah menganalisis sebuah pesan yang dilaporkan oleh pengguna lain.

Pesan ditulis oleh: ${authorUsername}
Isi pesan (verbatim):
---
${messageContent}
---

Analisis pesan ini dan tentukan apakah melanggar aturan berikut:
1. Toxicity / Hate Speech, termasuk bahasa kasar, hinaan, ujaran kebencian, dalam bahasa Indonesia, Inggris, gaul, slang Jawa/Sunda.
2. Phishing / Spam Link Berbahaya, yaitu link yang mencurigakan, tautan unduhan, link palsu.
3. Doxxing, yaitu membocorkan informasi pribadi seseorang (nama asli, alamat, nomor HP, dll).
4. Konten NSFW, yaitu teks yang mengandung konten seksual eksplisit dalam konteks tidak pantas.

Berikan output HANYA dalam format JSON berikut (tanpa penjelasan tambahan di luar JSON):
{
  "score": <angka 0-100, tingkat pelanggaran>,
  "category": "<salah satu: toxicity|phishing|doxxing|nsfw|safe>",
  "subcategory": "<contoh: hate_speech|spam_link|personal_info|explicit_text|none>",
  "language_detected": "<bahasa terdeteksi: id|en|id-slang|mixed>",
  "reason": "<penjelasan singkat dalam Bahasa Indonesia, maks 100 kata>",
  "recommended_action": "<salah satu: none|warn|delete|delete_and_timeout>",
  "confidence": "<low|medium|high>"
}

Catatan penting:
- Skor 0-29 = pesan aman
- Skor 30-69 = pelanggaran ringan/ambigu (perlu review admin)
- Skor 70-100 = pelanggaran jelas (aksi otomatis)
- Gunakan konteks penuh, bukan hanya kata kunci
- Jangan hukum humor atau sarkasme yang jelas tidak berbahaya`;
}

/**
 * Analisis pesan yang dilaporkan menggunakan Gemini AI.
 * Hasil di-cache per messageId selama 5 menit di Redis untuk menghindari double-check.
 *
 * @param {import('discord.js').Message} reportedMessage - Pesan yang dilaporkan
 * @param {Object} aiAutomodSettings - Settings AI automod dari GuildSettings
 * @returns {Promise<{score, category, subcategory, language_detected, reason, recommended_action, confidence}|null>}
 */
async function analyzeMessageWithAI(reportedMessage, aiAutomodSettings) {
  if (!gemini.isAvailable()) {
    logger.warn(
      "[AI Automod] GEMINI_API tidak dikonfigurasi. AI Automod tidak aktif.",
    );
    return null;
  }

  // Cek cache Redis, hindari analisis berulang untuk pesan yang sama
  const cacheKey = `ai:automod:${reportedMessage.id}`;
  try {
    const cached = await redisManager.getCache(cacheKey);
    if (cached) {
      logger.info(
        `[AI Automod] Hasil analisis diambil dari cache untuk message ${reportedMessage.id}`,
      );
      return cached;
    }
  } catch (e) {
    // Redis error, lanjut tanpa cache
  }

  try {
    const messageContent =
      reportedMessage.content || "[Tidak ada teks, mungkin attachment/embed]";
    const authorUsername = reportedMessage.author?.username || "Unknown";
    const guildName = reportedMessage.guild?.name || "Unknown Server";

    const prompt = buildAnalysisPrompt(
      messageContent,
      authorUsername,
      guildName,
    );

    // Sebelumnya berkas ini memanggil `response.text?.()`. Di @google/genai,
    // `text` adalah getter bernilai string, bukan fungsi, sehingga panggilan
    // itu selalu gagal dan AI Automod tidak pernah menghasilkan apa pun.
    // Pengambilan teks sekarang ditangani geminiClient.extractText().
    const rawText = await gemini.generate({
      model: "gemini-2.0-flash",
      parts: [{ text: prompt }],
      config: {
        maxOutputTokens: 512,
        temperature: 0.1, // Rendah untuk hasil yang konsisten dan deterministik
      },
    });

    // Parse JSON dari respons Gemini
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn(
        "[AI Automod] Respons Gemini tidak mengandung JSON valid:",
        rawText.substring(0, 200),
      );
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);

    // Simpan ke cache Redis selama 5 menit
    try {
      await redisManager.setCache(cacheKey, result, 300);
    } catch (e) {
      // Redis error, tidak masalah, lanjut
    }

    return result;
  } catch (error) {
    logger.error("[AI Automod] Error saat analisis Gemini:", error.message);
    return null;
  }
}

/**
 * Handler utama untuk interaksi context menu report.
 * Dipanggil oleh plugin/admin/report.js.
 *
 * @param {import('discord.js').MessageContextMenuCommandInteraction} interaction
 * @param {Object} guildSettings - Data GuildSettings dari DB/cache
 */
async function handleAIReport(interaction, guildSettings) {
  const {
    buildContainerV2,
    buildErrorContainerV2,
  } = require("./NauraContainerBuilder");
  const ui = require("../config/ui");
  const { MessageFlags, PermissionFlagsBits } = require("discord.js");

  const reportedMessage = interaction.targetMessage;
  const guildId = interaction.guildId;

  // Jangan bisa report bot atau diri sendiri
  if (reportedMessage.author.bot) {
    return interaction.reply({
      ...buildErrorContainerV2({
        errorMessage: "Tidak bisa melaporkan pesan dari bot.",
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (reportedMessage.author.id === interaction.user.id) {
    return interaction.reply({
      ...buildErrorContainerV2({
        errorMessage: "Tidak bisa melaporkan pesanmu sendiri.",
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  // Cek cooldown reporter
  const cooldown = checkReportCooldown(guildId, interaction.user.id);
  if (cooldown.onCooldown) {
    const remaining = Math.ceil(cooldown.remainingMs / 1000);
    return interaction.reply({
      ...buildErrorContainerV2({
        errorMessage: `Tunggu ${remaining} detik sebelum melaporkan lagi.`,
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
  setReportCooldown(guildId, interaction.user.id);

  // Ambil settings AI automod
  const aiSettings = guildSettings?.settings?.aiAutomod || {};
  const threshold = aiSettings.toxicityThreshold ?? 70;
  const isLearningMode = aiSettings.learningMode ?? false;
  const auditChannelId = aiSettings.auditChannelId;

  // Defer untuk proses AI yang butuh waktu
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Analisis dengan Gemini
  const analysis = await analyzeMessageWithAI(reportedMessage, aiSettings);

  if (!analysis) {
    return interaction.editReply({
      ...buildErrorContainerV2({
        errorMessage:
          "AI Automod tidak dapat menganalisis pesan ini saat ini. Coba lagi nanti.",
      }),
    });
  }

  const score = analysis.score ?? 0;
  const isViolation = score >= threshold;
  const isMarginal = score >= 30 && score < threshold;

  // --- LOG KE AUDIT CHANNEL ---
  if (auditChannelId) {
    const auditChannel = interaction.guild.channels.cache.get(auditChannelId);
    if (auditChannel) {
      const scoreEmoji = score >= 70 ? "🔴" : score >= 30 ? "🟡" : "🟢";
      const auditPayload = buildContainerV2({
        accentColorHex:
          score >= 70 ? "#FF0000" : score >= 30 ? "#FFD700" : "#00FF00",
        authorName: "Naura AI Automod Report",
        title: `${scoreEmoji} Laporan Pesan: Skor ${score}/100`,
        description: [
          `**Dilaporkan oleh:** <@${interaction.user.id}>`,
          `**Penulis Pesan:** <@${reportedMessage.author.id}>`,
          `**Channel:** <#${reportedMessage.channel.id}>`,
          `**Link Pesan:** [Klik di sini](${reportedMessage.url})`,
          "",
          `**Kategori:** \`${analysis.category}\` (${analysis.subcategory})`,
          `**Bahasa:** ${analysis.language_detected}`,
          `**Keyakinan AI:** ${analysis.confidence}`,
          "",
          `**Alasan AI:**`,
          `> ${analysis.reason}`,
          "",
          isLearningMode
            ? "⚠️ **Mode Belajar aktif.** Tidak ada aksi otomatis."
            : isViolation
              ? "✅ **Aksi otomatis dijalankan.**"
              : "✅ **Tidak ada aksi otomatis (skor di bawah threshold).**",
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });
      await auditChannel.send(auditPayload).catch(() => {});
    }
  }

  // --- AKSI OTOMATIS (hanya jika tidak learning mode dan skor >= threshold) ---
  if (isViolation && !isLearningMode) {
    const targetMember = await interaction.guild.members
      .fetch(reportedMessage.author.id)
      .catch(() => null);

    // Hapus pesan
    await reportedMessage.delete().catch(() => {});

    // Timeout 10 menit jika bot punya permission
    if (
      targetMember &&
      interaction.guild.members.me?.permissions.has(
        PermissionFlagsBits.ModerateMembers,
      )
    ) {
      await targetMember
        .timeout(
          10 * 60 * 1000,
          `AI Automod: ${analysis.category} (skor ${score})`,
        )
        .catch(() => {});
    }

    return interaction.editReply(
      buildContainerV2({
        accentColorHex: "#FF0000",
        authorName: "Naura AI Automod, Aksi Diambil",
        title: "🚨 Pesan Dilaporkan & Ditindak",
        description: `Pesan dari <@${reportedMessage.author.id}> telah **dihapus** dan user di-**timeout** selama 10 menit.\n\n**Alasan:** ${analysis.reason}\n**Skor Pelanggaran:** ${score}/100`,
        footerText: ui.getFooter("core"),
      }),
    );
  }

  // --- RESPONS UNTUK SKOR AMAN ATAU MARGINAL ---
  if (isMarginal || isLearningMode) {
    return interaction.editReply(
      buildContainerV2({
        accentColorHex: "#FFD700",
        authorName: "Naura AI Automod, Perlu Review",
        title: "⚠️ Laporan Diteruskan ke Admin",
        description: `Pesan yang kamu laporkan memiliki skor **${score}/100** (batas: ${threshold}).\n\nLaporan telah diteruskan ke admin untuk ditinjau. Terima kasih sudah membantu menjaga server!`,
        footerText: ui.getFooter("core"),
      }),
    );
  }

  // Skor aman (<30)
  return interaction.editReply(
    buildContainerV2({
      accentColorHex: "#00FF00",
      authorName: "Naura AI Automod, Hasil Analisis",
      title: "✅ Pesan Tidak Melanggar",
      description: `AI tidak mendeteksi pelanggaran pada pesan tersebut (skor: **${score}/100**).\n\nJika kamu tetap merasa ada yang salah, hubungi admin server secara langsung.`,
      footerText: ui.getFooter("core"),
    }),
  );
}

module.exports = {
  analyzeMessageWithAI,
  handleAIReport,
  checkReportCooldown,
  setReportCooldown,
};
