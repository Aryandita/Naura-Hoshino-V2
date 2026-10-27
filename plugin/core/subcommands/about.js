"use strict";

/**
 * 👧 About Command - Naura Hoshino Identity - Naura Hoshino V2
 * -------------------------------------------------------------
 * Displays comprehensive information about Naura Hoshino bot.
 * Includes ecosystem overview, privacy policy, and developer contact.
 *
 * Features:
 * - 6-pillar ecosystem overview
 * - Privacy & ToS compliance information
 * - Developer contact details
 * - Bilingual intro audio attachment
 * - Dynamic banner display
 *
 * @module plugin/core/subcommands/about
 */

const fs = require("node:fs");
const path = require("node:path");
const { AttachmentBuilder } = require("discord.js");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { e, face, createNavButtons } = require("../helpers/coreShared");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Audio file paths for intro greeting */
const AUDIO_FILES = {
  EN: "Intro (EN).mp3",
  ID: "Intro (ID).mp3",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect if language is English based on code or title content.
 * @param {object} lang - Language dictionary
 * @returns {boolean} True if English
 */
function isEnglishLanguage(lang) {
  return Boolean(lang && (lang.LANG_CODE === "en" || lang.ABOUT_TITLE?.includes("Meet")));
}

/**
 * Build intro audio attachment if file exists.
 * @param {boolean} isEn - Is English language
 * @returns {AttachmentBuilder|null} Audio attachment or null
 */
function buildAudioAttachment(isEn) {
  const fileName = isEn ? AUDIO_FILES.EN : AUDIO_FILES.ID;
  const filePath = path.join(__dirname, "../../../assets/audio", fileName);

  if (!fs.existsSync(filePath)) return null;

  const outputName = `Naura_Intro_${isEn ? "EN" : "ID"}.mp3`;
  return new AttachmentBuilder(filePath, { name: outputName });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle /core about command execution.
 * Displays bot identity, ecosystem pillars, and developer information.
 * @param {object} interaction - Discord interaction
 * @param {object} client - Discord client
 * @param {object} lang - Language dictionary
 * @returns {Promise<void>}
 */
async function handleAbout(interaction, client, lang) {
  // Defer reply for processing time
  if (!interaction.deferred) {
    await interaction.deferReply().catch(() => {});
    interaction.deferred = true;
  }

  // Get emojis
  const eHeart = e("favorite", "💖");
  const eSparkle = e("sparkle", "✨");
  const eDeveloper = e("admin", "👑");
  const eAbout = face("happy", "👧");

  // Clean title (remove leading ribbon emoji if present)
  const cleanTitle =
    (lang.ABOUT_TITLE || "Meet Naura Hoshino!").replace(/^\🎀\s*/, "") || "Meet Naura Hoshino!";

  // Get banner
  const aboutBanner = ui.getBanner("about");

  // Build main payload
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("accent") || "#C084FC",
    authorName: "Naura Hoshino Identity",
    title: `${eAbout} ${cleanTitle}`,
    iconURL: client.user?.displayAvatarURL?.() || null,
    description:
      `Konnichiwa! Namaku **Naura Hoshino** ${eHeart}. Aku asisten virtual generasi terbaru buatan **Aryandita** yang dirancang buat nemenin hari-harimu di Discord.\n\n` +
      `Aku dibuat dengan penuh perhatian supaya terasa hangat, ramah, dan menyenangkan selayaknya teman sungguhan! Dari mutar musik jernih 24/7, ngobrol seru bareng AI, petualangan RPG survival, sampai moderasi server, aku siap bantu kamu kapan pun! ${eSparkle}\n\n` +
      `*Tips: Ingin melihat spesifikasi telemetri shard & sistem? Jalankan \`/core stats\`. Tertarik bekerja sama memajukan server komunitas? Buka program \`/core partner\`.*`,
    fields: [
      {
        name: "🌟 6 PILAR EKOSISTEM UTAMA",
        value:
          "• **Bot Engine:** Discord Components V2 (5 Lapisan Mandiri)\n" +
          "• **Web Dashboard:** Vite MPA + 3D Three.js Avatar & Mascot Viewer\n" +
          "• **Audio & Smart DJ:** Poru v5 Lavalink + Fish Audio TTS Radio Host\n" +
          "• **Polyglot Database:** Supabase Postgres, MongoDB Atlas, Redis Cache\n" +
          "• **Survival RPG:** Naura Wilds 2.0 (Tri-Vital & Closed-Loop Economy)\n" +
          "• **Living AI:** Google Gemini 2.5 + Semantic Vector Memory",
      },
      {
        name: "📜 KETENTUAN LAYANAN & KEBIJAKAN PRIVASI (TOS & PRIVACY)",
        value:
          "• **Vision AI & Gambar:** Gambar dianalisis secara *ephemeral/in-memory* dan tidak pernah disimpan permanen di disk bot setelah analisis selesai.\n" +
          "• **Sentimen Cuaca Kosmik:** Analisis suasana obrolan hanya menyampel pesan publik sementara secara anonim untuk skor cuaca server, tanpa profiling pribadi atau penjualan data.\n" +
          "• **Penyimpanan Data:** Hanya menyimpan data gameplay yang diperlukan (saldo, inventaris, level XP) dan pengaturan server Discord.\n" +
          "• **Kepatuhan:** 100% mematuhi Discord Developer Terms of Service & Privacy Policy.",
      },
      {
        name: `${eDeveloper} DEVELOPER & KONTAK RESMI`,
        value:
          "**Aryandita** (Pencipta & Developer Utama Naura Hoshino)\n" +
          `${ui.getEmoji("email") || "📧"} **Email Resmi:** \`naurahoshino@gmail.com\`\n` +
          `${ui.getEmoji("translate") || "🌐"} **Support Server:** [dsc.gg/naura-hoshino](https://dsc.gg/naura-hoshino)`,
      },
    ],
    bannerAttachmentName: aboutBanner ? "banner.png" : null,
    buttonsRow: createNavButtons(),
    footerText: ui.getFooter("core"),
  });

  // Collect attachments
  const files = [];

  // Add banner if available
  if (aboutBanner) {
    files.push(new AttachmentBuilder(aboutBanner, { name: "banner.png" }));
  }

  // Add bilingual intro audio
  const isEn = isEnglishLanguage(lang);
  const audioAttachment = buildAudioAttachment(isEn);
  if (audioAttachment) {
    files.push(audioAttachment);
  }

  // Attach files to payload
  if (files.length > 0) {
    payload.files = files;
  }

  return interaction.editReply(payload);
}

module.exports = handleAbout;
