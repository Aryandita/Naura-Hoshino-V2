"use strict";

// ==========================================
// TAMPILAN KARTU DOWNLOADER
// ==========================================
// Semua kalimat yang dibaca pengguna dikumpulkan di sini supaya nada bicara
// Naura konsisten dan mudah diterjemahkan nanti.

const ui = require("../config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
} = require("../utils/NauraContainerBuilder");

const e = (name, fallback) => ui.getEmoji(name) || fallback;

const PLATFORM_EMOJI = {
  tiktok: "music_note",
  twitter: "bird",
  instagram: "camera_with_flash",
  facebook: "blue_book",
  youtube: "clapper",
  pinterest: "pushpin",
  reddit: "robot",
  threads: "thread",
  linkedin: "briefcase",
  vk: "globe_with_meridians",
  douyin: "music_note",
  bilibili: "tv",
  other: "globe_with_meridians",
};

const PLATFORM_FALLBACK_EMOJI = {
  tiktok: "\uD83C\uDFB5",
  twitter: "\uD83D\uDC26",
  instagram: "\uD83D\uDCF8",
  facebook: "\uD83D\uDCD8",
  youtube: "\uD83C\uDFAC",
  pinterest: "\uD83D\uDCCC",
  reddit: "\uD83E\uDD16",
  threads: "\uD83E\uDDF5",
  linkedin: "\uD83D\uDCBC",
  vk: "\uD83C\uDF10",
  douyin: "\uD83C\uDFB5",
  bilibili: "\uD83D\uDCFA",
  other: "\uD83C\uDF10",
};

const FAILURE_HINT = {
  instagram:
    "Pastikan postingannya **Publik**, ya. Kalau akunnya digembok, Naura tidak bisa mengintip ke dalam.",
  twitter:
    "Servernya lagi rewel. Coba lagi beberapa menit lagi, Naura tunggu bareng kamu.",
  tiktok: "Server TikTok sedang gangguan. Sabar sebentar, lalu coba lagi ya.",
  youtube: "Pastikan videonya **Publik** dan tidak ada pembatasan usia.",
  facebook:
    "Pastikan postingannya **Publik** dulu, baru Naura bisa mengambilnya.",
  pinterest: "Pastikan tautannya menuju satu pin, bukan seluruh papan.",
  reddit: "Pastikan subreddit-nya publik dan postingannya belum dihapus.",
  threads: "Pastikan akun atau postingannya bersifat **Publik**.",
  linkedin:
    "Pastikan postingannya **Publik** dan memang berisi video atau gambar.",
  vk: "Pastikan videonya **Publik**, bukan yang privat.",
  douyin: "Kontennya mungkin dibatasi region atau butuh login.",
  bilibili:
    "Sebagian konten Bilibili butuh akun premium atau hanya tersedia di China.",
};

const platformEmojiOf = (platform) =>
  e(
    PLATFORM_EMOJI[platform] || "globe_with_meridians",
    PLATFORM_FALLBACK_EMOJI[platform] || "\uD83C\uDF10",
  );

const platformNameOf = (platform) =>
  platform.charAt(0).toUpperCase() + platform.slice(1);

/** Kartu ketika tautan yang dikirim bukan http/https. */
const invalidUrlCard = () =>
  buildErrorContainerV2({
    title: "Tautannya Belum Benar",
    description: `${e("error", "\u274C")} Hmm, Naura belum bisa membaca tautan itu. Coba kirim ulang link lengkapnya yang diawali **http** atau **https**, ya.`,
    footerText: ui.getFooter("utility"),
  });

/** Kartu ketika seluruh provider gagal. */
const failureCard = (platform) =>
  buildErrorContainerV2({
    title: "Naura Belum Berhasil Mengambilnya",
    description: `${e("cry", "\uD83D\uDE22")} Maaf ya, Naura sudah mencoba semua jalur tapi medianya belum bisa diambil.\n\n${FAILURE_HINT[platform] || "Semua server sedang sibuk. Coba lagi dalam beberapa menit, ya."}`,
    footerText: ui.getFooter("utility"),
  });

/** Kartu ketika platform tidak dikenali sama sekali. */
const unsupportedCard = () =>
  buildErrorContainerV2({
    title: "Platformnya Belum Naura Kenal",
    description: `${e("akward", "\uD83D\uDE05")} Naura belum mengenali platform ini, atau postingannya bersifat privat. Coba tautan lain, ya.`,
    footerText: ui.getFooter("utility"),
  });

const loadingCard = ({ client, title, description }) =>
  buildLoadingContainerV2({
    authorName: title || "Naura Loading System",
    iconURL: client.user.displayAvatarURL(),
    description,
    footerText: ui.getFooter("utility"),
  });

/** Kartu "sedang memeriksa media". */
const inspectingCard = (client) =>
  loadingCard({
    client,
    description: `${e("thinking", "\u23F3")} Sebentar ya, Naura periksa dulu medianya biar yang sampai ke kamu benar-benar yang kamu mau.`,
  });

/** Kartu "sedang mengunduh". */
const fetchingCard = (client, sizeText) =>
  loadingCard({
    client,
    description: `${e("cheers", "\uD83D\uDE96")} Naura lagi membawakan medianya (${sizeText}) buat kamu. Tunggu sebentar ya!`,
  });

/** Kartu "sedang mengompresi". */
const compressingCard = (client, sizeText, targetText) =>
  loadingCard({
    client,
    title: "Naura Compression Engine",
    description: `${e("thinking", "\u23F3")} Medianya kebesaran (${sizeText}), jadi Naura kecilkan dulu ${targetText}.\n\n> Naura pakai **two-pass encoding** biar hasilnya tetap enak dilihat.`,
  });

/**
 * Kartu hasil akhir.
 * @returns {object} payload siap kirim (belum termasuk files)
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
    accentColorHex: ui.getColor("primary") || "#2b2d31",
    authorName: "Naura Media Downloader Engine",
    title: `${e("download", "\uD83D\uDCE5")} Medianya sudah Naura ambil!`,
    iconURL: client.user.displayAvatarURL(),
    expression: "success",
    description:
      `${platformEmojiOf(platform)} **Platform:** ${platformNameOf(platform)}\n` +
      `**Sumber:** [Lihat postingan aslinya](${sourceUrl})\n` +
      `**Kualitas:** ${resolutionText}${extraText}`,
    mediaAttachmentNames: mediaNames,
    fileAttachmentNames: fileNames,
    buttonsRow: rows && rows.length > 0 ? rows : null,
    footerText: ui.getFooter("utility"),
  });

/** Kartu kegagalan kompresi manual. */
const compressFailedCard = ({ client, title, description }) =>
  buildContainerV2({
    accentColorHex: ui.getColor("error") || "#FF0000",
    authorName: "Naura Compression Engine",
    title,
    iconURL: client.user.displayAvatarURL(),
    expression: "error",
    description,
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
  compressFailedCard,
};
