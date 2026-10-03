"use strict";

/**
 * @file genreClassifier.js
 * @description Engine klasifikasi genre dan suasana musik secara heuristik (tanpa AI).
 * Membaca metadata Poru/Lavalink (judul, musisi, durasi, status streaming) dan
 * mengelompokkannya ke dalam taksonomi tema musik deterministik dengan latensi 0ms.
 */

const GENRES = Object.freeze({
  LOFI: "LOFI",
  ANIME: "ANIME",
  ROCK: "ROCK",
  EDM: "EDM",
  KPOP: "KPOP",
  ACOUSTIC: "ACOUSTIC",
  GAMING: "GAMING",
  STREAM: "STREAM",
  POP_DEFAULT: "POP_DEFAULT",
});

const PATTERNS = [
  {
    genre: GENRES.STREAM,
    // Stream radio berkelanjutan atau durasi marathon
    matcher: (text, info) => Boolean(info.isStream) || (typeof info.length === "number" && info.length > 2700000), // > 45 menit
    mood: "fokus dan menemani aktivitas panjang",
    emoji: "📻",
  },
  {
    genre: GENRES.GAMING,
    regex: /\b(game ost|gaming|soundtrack|genshin|nier|final fantasy|persona|undertale|cyberpunk|touhou|orchestra|boss theme|zelda|pokemon|elden ring)\b/i,
    mood: "epik, imersif, dan penuh petualangan",
    emoji: "🎮",
  },
  {
    genre: GENRES.LOFI,
    regex: /\b(lofi|lo-fi|chill|chillhop|relax|sleep|sleeping|study|studying|coffee|cafe|rain|peaceful|ambient|cozy)\b/i,
    mood: "santai, hangat, dan menenangkan pikiran",
    emoji: "☕",
  },
  {
    genre: GENRES.ANIME,
    regex: /\b(anime|anime ost|opening|ending|\bop\b|\bed\b|vocaloid|miku|hatsune|yoasobi|ado|j-?pop|hololive|eve|radwimps|kano|aimer|lisa|yaosobi)\b/i,
    mood: "ceria, penuh warna, dan bernuansa anime",
    emoji: "🌸",
  },
  {
    genre: GENRES.ROCK,
    regex: /\b(rock|metal|punk|hardcore|deathcore|guitar|riff|screamo|heavy metal|alternative rock|emo|grunge)\b/i,
    mood: "enerjik, membara, dan penuh distorsi gitar",
    emoji: "⚡",
  },
  {
    genre: GENRES.EDM,
    regex: /\b(edm|dance|remix|club|house|techno|dubstep|electronic|bass|bassboost|drop|party|hardstyle|trap|nightcore)\b/i,
    mood: "pesta menghentak dan penuh dentuman bass",
    emoji: "🎧",
  },
  {
    genre: GENRES.KPOP,
    regex: /\b(k-?pop|bts|blackpink|twice|newjeans|aespa|ive|le sserafim|stray kids|exo|nct|seventeen|red velvet|itzy)\b/i,
    mood: "stylish, koreografi ritmis, dan memikat",
    emoji: "💖",
  },
  {
    genre: GENRES.ACOUSTIC,
    regex: /\b(acoustic|ballad|piano|guitar cover|unplugged|sad|tears|galau|kenangan|emotional|slowed|heartbreak)\b/i,
    mood: "lembut, melankolis, dan menyentuh hati",
    emoji: "🎸",
  },
  {
    genre: GENRES.GAMING,
    regex: /\b(game ost|soundtrack|genshin|nier|final fantasy|persona|undertale|cyberpunk|touhou|orchestra|boss theme)\b/i,
    mood: "epik, imersif, dan penuh petualangan",
    emoji: "🎮",
  },
];

/**
 * Mengklasifikasikan trek musik berdasarkan metadata tanpa model AI.
 *
 * @param {Object} [trackInfo={}] - Objek info trek dari Poru/Lavalink
 * @param {string} [trackInfo.title] - Judul trek
 * @param {string} [trackInfo.author] - Nama musisi / channel
 * @param {number} [trackInfo.length] - Durasi dalam milidetik
 * @param {boolean} [trackInfo.isStream] - Status siaran langsung
 * @returns {{ genre: string, mood: string, emoji: string }}
 */
function classifyTrack(trackInfo = {}) {
  const title = String(trackInfo.title || "");
  const author = String(trackInfo.author || "");
  const combinedText = `${title} ${author}`.toLowerCase();

  for (const item of PATTERNS) {
    if (typeof item.matcher === "function" && item.matcher(combinedText, trackInfo)) {
      return {
        genre: item.genre,
        mood: item.mood,
        emoji: item.emoji,
      };
    }

    if (item.regex && item.regex.test(combinedText)) {
      return {
        genre: item.genre,
        mood: item.mood,
        emoji: item.emoji,
      };
    }
  }

  return {
    genre: GENRES.POP_DEFAULT,
    mood: "harmonis, segar, dan menyenangkan didengar",
    emoji: "🎵",
  };
}

module.exports = {
  GENRES,
  classifyTrack,
};
