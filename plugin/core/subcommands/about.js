"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { AttachmentBuilder } = require("discord.js");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { e, face, createNavButtons } = require("../helpers/coreShared");

async function handleAbout(interaction, client, lang) {
  if (!interaction.deferred) {
    await interaction.deferReply().catch(() => {});
    interaction.deferred = true;
  }

  const eHeart = e("favorite", "\uD83D\uDC96");
  const eSparkle = e("sparkle", "\u2728");
  const eDeveloper = e("admin", "\uD83D\uDC51");
  const eAbout = face("happy", "\uD83D\uDC67");

  const cleanTitle =
    (lang.ABOUT_TITLE || "Meet Naura Hoshino!").replace(/^\uD83C\uDF80\s*/, "") || "Meet Naura Hoshino!";

  const aboutBanner = ui.getBanner("about");

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
        name: `🌟 6 PILAR EKOSISTEM UTAMA`,
        value:
          "• **Bot Engine:** Discord Components V2 (5 Lapisan Mandiri)\n" +
          "• **Web Dashboard:** Vite MPA + 3D Three.js Avatar & Mascot Viewer\n" +
          "• **Audio & Smart DJ:** Poru v5 Lavalink + Fish Audio TTS Radio Host\n" +
          "• **Polyglot Database:** Supabase Postgres, MongoDB Atlas, Redis Cache\n" +
          "• **Survival RPG:** Naura Wilds 2.0 (Tri-Vital & Closed-Loop Economy)\n" +
          "• **Living AI:** Google Gemini 2.5 + Semantic Vector Memory",
      },
      {
        name: `📜 KETENTUAN LAYANAN & KEBIJAKAN PRIVASI (TOS & PRIVACY)`,
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

  const files = [];
  if (aboutBanner) {
    files.push(new AttachmentBuilder(aboutBanner, { name: "banner.png" }));
  }

  const isEn =
    lang && (lang.LANG_CODE === "en" || lang.ABOUT_TITLE?.includes("Meet"));
  const audioFileName = isEn ? "Intro (EN).mp3" : "Intro (ID).mp3";
  const audioFilePath = path.join(
    __dirname,
    "../../../assets/audio",
    audioFileName,
  );
  if (fs.existsSync(audioFilePath)) {
    files.push(
      new AttachmentBuilder(audioFilePath, {
        name: `Naura_Intro_${isEn ? "EN" : "ID"}.mp3`,
      }),
    );
  }

  if (files.length > 0) {
    payload.files = files;
  }

  return interaction.editReply(payload);
}

module.exports = handleAbout;
