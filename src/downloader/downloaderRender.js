"use strict";

// ==========================================
// TAMPILAN KARTU DOWNLOADER (COMPONENTS V2)
// ==========================================
// Menggunakan desain sistem Cyber-Anime Glassmorphism, ekspresi Naura,
// emoji terpusat dari src/config/ui.js, dan banner animasi resmi.

const ui = require("../config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
} = require("../utils/NauraContainerBuilder");

const e = (name, fallback = "") => ui.getEmoji(name) || fallback;

const PLATFORM_ICONS = {
  tiktok: "🎵",
  twitter: "🐦",
  instagram: "📸",
  facebook: "📘",
  youtube: "🎬",
  pinterest: "📌",
  reddit: "🤖",
  threads: "🧵",
  linkedin: "💼",
  vk: "🌐",
  douyin: "🎵",
  bilibili: "📺",
  other: "🌐",
};

const FAILURE_HINT = {
  instagram:
    "Pastikan postingannya **Publik**, ya. Kalau akunnya digembok, Naura tidak bisa mengintip ke dalam.",
  twitter:
    "Server Twitter/X sedang rewel. Coba lagi beberapa menit lagi, Naura tunggu bareng kamu.",
  tiktok: "Server TikTok sedang gangguan. Sabar sebentar, lalu coba lagi ya.",
  youtube: "Pastikan videonya **Publik** dan tidak ada batasan usia.",
  facebook:
    "Pastikan postingannya **Publik** dulu, baru Naura bisa mengambilnya.",
  pinterest: "Pastikan tautannya menuju satu pin tunggal, bukan seluruh papan.",
  reddit: "Pastikan subreddit-nya publik dan postingannya belum dihapus.",
  threads: "Pastikan akun atau postingannya bersifat **Publik**.",
  linkedin:
    "Pastikan postingannya **Publik** dan memang berisi video atau gambar.",
  vk: "Pastikan videonya **Publik**, bukan yang privat.",
  douyin: "Kontennya mungkin dibatasi region atau butuh login.",
  bilibili:
    "Sebagian konten Bilibili butuh akun premium atau hanya tersedia di region tertentu.",
};

const platformEmojiOf = (platform) => {
  const custom = e(`platform_${platform}`);
  if (custom) return custom;
  return PLATFORM_ICONS[platform] || "🌐";
};

const platformNameOf = (platform) =>
  platform.charAt(0).toUpperCase() + platform.slice(1);

/** Kartu ketika tautan yang dikirim bukan http/https. */
const invalidUrlCard = () =>
  buildErrorContainerV2({
    title: "Tautannya Belum Benar",
    description: `${e("error", "❌")} Hmm, Naura belum bisa membaca tautan itu. Coba kirim ulang link lengkap yang diawali **http** atau **https**, ya.`,
    expression: "akward",
    withBanner: true,
    footerText: ui.getFooter("utility"),
  });

/** Kartu ketika seluruh provider gagal. */
const failureCard = (platform) =>
  buildErrorContainerV2({
    title: "Naura Belum Berhasil Mengambilnya",
    description: `${e("naura_cry", "😢")} Maaf ya, Naura sudah mencoba semua jalur tapi medianya belum bisa diambil.\n\n${FAILURE_HINT[platform] || "Semua server sedang sibuk. Coba lagi dalam beberapa menit, ya."}`,
    expression: "cry",
    withBanner: true,
    footerText: ui.getFooter("utility"),
  });

/** Kartu ketika platform tidak dikenali sama sekali. */
const unsupportedCard = () =>
  buildErrorContainerV2({
    title: "Platformnya Belum Naura Kenal",
    description: `${e("naura_akward", "😅")} Naura belum mengenali platform ini, atau postingannya bersifat privat. Coba tautan dari platform yang didukung, ya.`,
    expression: "akward",
    withBanner: true,
    footerText: ui.getFooter("utility"),
  });

const loadingCard = ({ client, title, description, expression = "thinking" }) =>
  buildLoadingContainerV2({
    authorName: "Naura Media Downloader Engine",
    title: title || "Sedang Menyiapkan Media...",
    iconURL: client.user.displayAvatarURL(),
    description,
    expression,
    withBanner: true,
    footerText: ui.getFooter("utility"),
  });

/** Kartu "sedang memeriksa media". */
const inspectingCard = (client) =>
  loadingCard({
    client,
    title: "Memeriksa Tautan Postingan...",
    expression: "thinking",
    description: `${e("loading", "⏳")} ${e("naura_thinking")} *Sebentar ya, Naura sedang memeriksa dan mengambil resolusi media terbaik...*`,
  });

/** Kartu "sedang mengunduh". */
const fetchingCard = (client, sizeText) =>
  loadingCard({
    client,
    title: "Mengunduh Berkas Media...",
    expression: "cheers",
    description: `${e("loading", "⏳")} ${e("naura_cheers")} *Naura lagi membawakan medianya (${sizeText}) buat kamu. Tunggu sebentar ya!*`,
  });

/** Kartu "sedang mengompresi". */
const compressingCard = (client, sizeText, targetText) =>
  loadingCard({
    client,
    title: "Naura Compression Engine",
    expression: "read",
    description: `${e("loading", "⏳")} ${e("naura_read")} *Medianya cukup besar (${sizeText}), jadi Naura kecilkan dulu ${targetText} menggunakan two-pass encoding agar tetap jernih.*`,
  });

/**
 * Kartu hasil akhir unduhan media tunggal.
 */
const resultCard = ({
  client,
  platform,
  sourceUrl,
  resolutionText,
  extraText = "",
  mediaNames = [],
  fileNames = [],
  rows = null,
}) =>
  buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura Media Downloader Engine",
    title: `${e("core", "🌸")} Medianya Berhasil Naura Ambil!`,
    iconURL: client.user.displayAvatarURL(),
    expression: "happy",
    description:
      `${platformEmojiOf(platform)} **Platform:** ${platformNameOf(platform)}\n` +
      `🔗 **Sumber:** [Lihat postingan aslinya](${sourceUrl})\n` +
      `🎬 **Kualitas:** ${resolutionText}${extraText}\n\n` +
      `> ${e("naura_happy", "✨")} *Medianya sudah siap dan bisa langsung kamu simpan atau putar di atas!*`,
    mediaAttachmentNames: mediaNames,
    fileAttachmentNames: fileNames,
    buttonsRow: rows && rows.length > 0 ? rows : null,
    footerText: ui.getFooter("utility"),
  });

/**
 * Kartu hasil unduhan album multi-foto (dibagi per fase pengiriman).
 */
const multiPhotoPhaseCard = ({
  client,
  platform,
  sourceUrl,
  phase = 1,
  totalPhases = 1,
  startIdx = 1,
  endIdx = 10,
  totalPhotos = 10,
  mediaNames = [],
  rows = null,
}) => {
  if (totalPhases === 1) {
    return buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Media Downloader Engine",
      title: `${e("core", "🌸")} Galeri Foto Berhasil Diunduh!`,
      iconURL: client.user.displayAvatarURL(),
      expression: "happy",
      description:
        `${platformEmojiOf(platform)} **Platform:** ${platformNameOf(platform)}\n` +
        `🔗 **Sumber:** [Lihat postingan aslinya](${sourceUrl})\n` +
        `✨ **Kualitas:** Asli, kualitas terbaik (HD)\n` +
        `🖼️ **Total Foto:** \`${totalPhotos} foto\`\n\n` +
        `> ${e("naura_happy", "🌸")} *Semua foto dari album telah Naura kumpulkan dengan rapi untuk kamu!*`,
      mediaAttachmentNames: mediaNames,
      buttonsRow: rows && rows.length > 0 ? rows : null,
      footerText: ui.getFooter("utility"),
    });
  }

  if (phase === 1) {
    return buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Media Downloader Engine",
      title: `${e("core", "🌸")} Galeri Foto Berhasil Diunduh! (Bagian 1/2)`,
      iconURL: client.user.displayAvatarURL(),
      expression: "cheers",
      description:
        `${platformEmojiOf(platform)} **Platform:** ${platformNameOf(platform)}\n` +
        `🔗 **Sumber:** [Lihat postingan aslinya](${sourceUrl})\n` +
        `✨ **Kualitas:** Asli, kualitas terbaik (HD)\n` +
        `🖼️ **Koleksi Album:** Menampilkan **${endIdx}** dari total **${totalPhotos} foto**\n\n` +
        `> ${e("sparkles", "✨")} *Fotonya banyak banget! Biar tidak terpotong oleh batas Discord, Naura bagi jadi 2 pengiriman ya. Sisa fotonya ada di pesan berikutnya di bawah ini~*`,
      mediaAttachmentNames: mediaNames,
      buttonsRow: rows && rows.length > 0 ? rows : null,
      footerText: ui.getFooter("utility"),
    });
  }

  // Phase 2
  const limitNote =
    totalPhotos > 20
      ? `\n> ${e("info", "ℹ️")} *Catatan: Menampilkan batas maksimal 20 foto dari total ${totalPhotos} foto agar tidak spam.*\n`
      : "";

  return buildContainerV2({
    accentColorHex: ui.getColor("accent-pink") || "#F9A8D4",
    authorName: "Naura Media Downloader Engine",
    title: `🌸 Kelanjutan Foto Album (Bagian 2/2)`,
    iconURL: client.user.displayAvatarURL(),
    expression: "love",
    description:
      `📸 **Lanjutan Galeri:** Foto ke-**${startIdx}** sampai **${endIdx}** dari total **${totalPhotos} foto**` +
      limitNote +
      `\n> ${e("success", "💖")} *Taraa~! Semua fotonya sudah lengkap Naura kirimkan untuk kamu. Selamat menikmati!*`,
    mediaAttachmentNames: mediaNames,
    buttonsRow: rows && rows.length > 0 ? rows : null,
    footerText: ui.getFooter("utility"),
  });
};

/** Kartu kegagalan kompresi manual. */
const compressFailedCard = ({ client, title, description }) =>
  buildErrorContainerV2({
    authorName: "Naura Compression Engine",
    title: title || "Gagal Mengompresi Media",
    iconURL: client.user.displayAvatarURL(),
    expression: "cry",
    withBanner: true,
    description:
      description ||
      "Berkas tidak dapat dikompresi ke batas ukuran yang diminta.",
    footerText: ui.getFooter("utility"),
  });

module.exports = {
  e,
  platformEmojiOf,
  platformNameOf,
  invalidUrlCard,
  failureCard,
  unsupportedCard,
  inspectingCard,
  fetchingCard,
  compressingCard,
  resultCard,
  multiPhotoPhaseCard,
  compressFailedCard,
};
