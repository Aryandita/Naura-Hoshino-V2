"use strict";

// Lokasi: src/config/ui/customEmojis.template.js
// Template Konfigurasi Custom Emojis Naura Hoshino V2 (67 Custom Emojis)
// Petunjuk:
// 1. Unggah berkas emoji di assets/emojis/naura_custom/ ke Discord Server atau Developer Portal.
// 2. Salin tag emoji yang dihasilkan Discord (<:name:id> atau <a:name:id>) ke slot di bawah ini.
// 3. Selama ID masih berupa ID_PLACEHOLDER, fungsi getCustomEmoji() akan mengembalikan fallback Unicode.

/**
 * Pemetaan Custom Emoji Discord (67 item).
 * Ganti ID_PLACEHOLDER dengan ID emoji Discord sebenarnya setelah diunggah.
 */
const customEmojis = {
  // A. Core, Sistem & Navigasi (8 items)
  naura_core: "<:naura_core:ID_PLACEHOLDER>",
  naura_ping: "<a:naura_ping:ID_PLACEHOLDER>",
  naura_uptime: "<:naura_uptime:ID_PLACEHOLDER>",
  naura_cpu: "<:naura_cpu:ID_PLACEHOLDER>",
  naura_ram: "<:naura_ram:ID_PLACEHOLDER>",
  naura_shard: "<:naura_shard:ID_PLACEHOLDER>",
  naura_lang: "<:naura_lang:ID_PLACEHOLDER>",
  naura_donate: "<a:naura_donate:ID_PLACEHOLDER>",

  // B. AI Companion & Machine Learning (6 items)
  ai_sparkle: "<a:ai_sparkle:ID_PLACEHOLDER>",
  ai_thinking: "<:ai_thinking:ID_PLACEHOLDER>",
  ai_vision: "<:ai_vision:ID_PLACEHOLDER>",
  ai_voice: "<:ai_voice:ID_PLACEHOLDER>",
  ai_openrouter: "<:ai_openrouter:ID_PLACEHOLDER>",
  ai_vip_fast: "<a:ai_vip_fast:ID_PLACEHOLDER>",

  // C. Arcade, Minigame & Edukasi (9 items)
  arcade_hub: "<:arcade_hub:ID_PLACEHOLDER>",
  arcade_dice: "<a:arcade_dice:ID_PLACEHOLDER>",
  arcade_card: "<:arcade_card:ID_PLACEHOLDER>",
  arcade_duel: "<:arcade_duel:ID_PLACEHOLDER>",
  arcade_target: "<:arcade_target:ID_PLACEHOLDER>",
  edu_math: "<:edu_math:ID_PLACEHOLDER>",
  edu_map: "<:edu_map:ID_PLACEHOLDER>",
  edu_flag: "<:edu_flag:ID_PLACEHOLDER>",
  edu_word: "<:edu_word:ID_PLACEHOLDER>",

  // D. Ekonomi, Kas & Bisnis (6 items)
  eco_cash: "<a:eco_cash:ID_PLACEHOLDER>",
  eco_bank: "<:eco_bank:ID_PLACEHOLDER>",
  eco_shop: "<:eco_shop:ID_PLACEHOLDER>",
  eco_work: "<:eco_work:ID_PLACEHOLDER>",
  eco_heist: "<:eco_heist:ID_PLACEHOLDER>",
  eco_trade: "<:eco_trade:ID_PLACEHOLDER>",

  // E. Moderasi, Admin & Server (7 items)
  mod_shield: "<:mod_shield:ID_PLACEHOLDER>",
  mod_warn: "<a:mod_warn:ID_PLACEHOLDER>",
  mod_mute: "<:mod_mute:ID_PLACEHOLDER>",
  mod_kick: "<:mod_kick:ID_PLACEHOLDER>",
  mod_ban: "<a:mod_ban:ID_PLACEHOLDER>",
  mod_lock: "<:mod_lock:ID_PLACEHOLDER>",
  mod_ticket: "<:mod_ticket:ID_PLACEHOLDER>",

  // F. Musik & Media (6 items)
  music_play: "<a:music_play:ID_PLACEHOLDER>",
  music_pause: "<:music_pause:ID_PLACEHOLDER>",
  music_skip: "<:music_skip:ID_PLACEHOLDER>",
  music_queue: "<:music_queue:ID_PLACEHOLDER>",
  music_bass: "<a:music_bass:ID_PLACEHOLDER>",
  music_disc: "<a:music_disc:ID_PLACEHOLDER>",

  // G. Utility & Pihak Ketiga (8 items)
  mc_pickaxe: "<:mc_pickaxe:ID_PLACEHOLDER>",
  mc_steve: "<:mc_steve:ID_PLACEHOLDER>",
  mc_ping: "<:mc_ping:ID_PLACEHOLDER>",
  weather_sun: "<:weather_sun:ID_PLACEHOLDER>",
  weather_rain: "<a:weather_rain:ID_PLACEHOLDER>",
  media_anime: "<:media_anime:ID_PLACEHOLDER>",
  media_movie: "<:media_movie:ID_PLACEHOLDER>",
  dl_cobalt: "<a:dl_cobalt:ID_PLACEHOLDER>",

  // Core Character Expressions (17 items)
  naura_happy: "<a:naura_happy:ID_PLACEHOLDER>",
  naura_thinking: "<a:naura_thinking:ID_PLACEHOLDER>",
  naura_cry: "<a:naura_cry:ID_PLACEHOLDER>",
  naura_angry: "<a:naura_angry:ID_PLACEHOLDER>",
  naura_shy: "<:naura_shy:ID_PLACEHOLDER>",
  naura_sleepy: "<a:naura_sleepy:ID_PLACEHOLDER>",
  naura_shocked: "<:naura_shocked:ID_PLACEHOLDER>",
  naura_eat: "<:naura_eat:ID_PLACEHOLDER>",
  naura_cheers: "<a:naura_cheers:ID_PLACEHOLDER>",
  naura_chirping: "<a:naura_chirping:ID_PLACEHOLDER>",
  naura_annoy: "<:naura_annoy:ID_PLACEHOLDER>",
  naura_blow_kiss: "<a:naura_blow_kiss:ID_PLACEHOLDER>",
  naura_akward: "<:naura_akward:ID_PLACEHOLDER>",
  naura_confused: "<:naura_confused:ID_PLACEHOLDER>",
  naura_hmph: "<:naura_hmph:ID_PLACEHOLDER>",
  naura_impressed: "<:naura_impressed:ID_PLACEHOLDER>",
  naura_read: "<:naura_read:ID_PLACEHOLDER>",

};

/**
 * Pemetaan Unicode Fallback Emoji (67 item).
 * Digunakan jika custom emoji belum diunggah atau ID masih berupa placeholder.
 */
const fallbackEmojis = {
  // A. Core, Sistem & Navigasi (8 items)
  naura_core: "🔮",
  naura_ping: "📶",
  naura_uptime: "⏳",
  naura_cpu: "💻",
  naura_ram: "💾",
  naura_shard: "💎",
  naura_lang: "🌐",
  naura_donate: "☕",

  // B. AI Companion & Machine Learning (6 items)
  ai_sparkle: "✨",
  ai_thinking: "🧠",
  ai_vision: "👁️",
  ai_voice: "🎙️",
  ai_openrouter: "🔀",
  ai_vip_fast: "⚡",

  // C. Arcade, Minigame & Edukasi (9 items)
  arcade_hub: "🕹️",
  arcade_dice: "🎲",
  arcade_card: "🃏",
  arcade_duel: "⚔️",
  arcade_target: "🎯",
  edu_math: "📐",
  edu_map: "🗺️",
  edu_flag: "🚩",
  edu_word: "📖",

  // D. Ekonomi, Kas & Bisnis (6 items)
  eco_cash: "🪙",
  eco_bank: "🏦",
  eco_shop: "🏪",
  eco_work: "💼",
  eco_heist: "🕵️",
  eco_trade: "🤝",

  // E. Moderasi, Admin & Server (7 items)
  mod_shield: "🛡️",
  mod_warn: "⚠️",
  mod_mute: "🔇",
  mod_kick: "👢",
  mod_ban: "🔨",
  mod_lock: "🔒",
  mod_ticket: "🎫",

  // F. Musik & Media (6 items)
  music_play: "▶️",
  music_pause: "⏸️",
  music_skip: "⏭️",
  music_queue: "📑",
  music_bass: "🔊",
  music_disc: "💿",

  // G. Utility & Pihak Ketiga (8 items)
  mc_pickaxe: "⛏️",
  mc_steve: "🧱",
  mc_ping: "📡",
  weather_sun: "☀️",
  weather_rain: "🌧️",
  media_anime: "🍿",
  media_movie: "🎬",
  dl_cobalt: "⚡",

  // Core Character Expressions (17 items)
  naura_happy: "😊",
  naura_thinking: "🤔",
  naura_cry: "😭",
  naura_angry: "😡",
  naura_shy: "😳",
  naura_sleepy: "😴",
  naura_shocked: "😲",
  naura_eat: "😋",
  naura_cheers: "🥂",
  naura_chirping: "🎵",
  naura_annoy: "😜",
  naura_blow_kiss: "😘",
  naura_akward: "😅",
  naura_confused: "🤨",
  naura_hmph: "😤",
  naura_impressed: "🤩",
  naura_read: "📚",

};

/**
 * Memeriksa apakah format string adalah custom emoji Discord yang valid dengan ID numerik.
 * Regex: ^<(a)?:[a-zA-Z0-9_]{2,32}:(\d+)>$
 * @param {string} emojiStr
 * @returns {boolean}
 */
function isCustomEmojiConfigured(emojiStr) {
  if (typeof emojiStr !== "string") return false;
  return /^<(a)?:[a-zA-Z0-9_]{2,32}:(\d+)>$/.test(emojiStr.trim());
}

/**
 * Mengambil emoji berdasarkan key:
 * - Mengembalikan custom emoji jika sudah memiliki Discord ID numerik valid.
 * - Mengembalikan fallback Unicode jika masih placeholder atau belum terpasang.
 * - Kompatibel langsung dengan parseEmoji() di src/config/ui/helpers.js.
 * @param {string} key
 * @returns {string|null}
 */
function getCustomEmoji(key) {
  if (!key) return null;
  const custom = customEmojis[key];
  if (isCustomEmojiConfigured(custom)) {
    return custom;
  }
  if (fallbackEmojis[key]) {
    return fallbackEmojis[key];
  }
  if (isCustomEmojiConfigured(key)) {
    return key;
  }
  return custom || key;
}

module.exports = {
  ...customEmojis,
  customEmojis,
  fallbackEmojis,
  getCustomEmoji,
  isCustomEmojiConfigured,
};
