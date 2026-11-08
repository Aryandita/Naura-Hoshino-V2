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
  naura_core: "<:naura_core:1568829816243884043>",
  naura_ping: "<:naura_ping:1568829832672841890>",
  naura_uptime: "<:naura_uptime:1568829850087727195>",
  naura_cpu: "<:naura_cpu:1568829819335082064>",
  naura_ram: "<:naura_ram:1568829835340554270>",
  naura_shard: "<:naura_shard:1568829842151964713>",
  naura_lang: "<:naura_lang:1568829830340944092>",
  naura_donate: "<a:naura_donate:ID_PLACEHOLDER>",

  // B. AI Companion & Machine Learning (6 items)
  ai_sparkle: "<a:ai_sparkle:ID_PLACEHOLDER>",
  ai_thinking: "<:ai_thinking:1568829676808445962>",
  ai_vision: "<:ai_vision:1568829682676146307>",
  ai_voice: "<:ai_voice:1568829686174191688>",
  ai_openrouter: "<:ai_openrouter:1568829673499267112>",
  ai_vip_fast: "<:ai_vip_fast:1568829679757037689>",

  // C. Arcade, Minigame & Edukasi (9 items)
  arcade_hub: "<:arcade_hub:1568829700711911556>",
  arcade_dice: "<:arcade_dice:1568829694147821588>",
  arcade_card: "<:arcade_card:1568829689340895283>",
  arcade_duel: "<:arcade_duel:1568829696743837697>",
  arcade_target: "<:arcade_target:1568829703446466631>",
  edu_math: "<:edu_math:1568829732269596803>",
  edu_map: "<:edu_map:1568829729568722985>",
  edu_flag: "<:edu_flag:1568829726204633249>",
  edu_word: "<:edu_word:1568829735256195122>",

  // D. Ekonomi, Kas & Bisnis (6 items)
  eco_cash: "<:eco_cash:1568829712170492034>",
  eco_bank: "<:eco_bank:1568829709461098507>",
  eco_shop: "<:eco_shop:1568829717388468327>",
  eco_work: "<:eco_work:1568829723394441256>",
  eco_heist: "<:eco_heist:1568829714599256194>",
  eco_trade: "<:eco_trade:1568829720773009428>",

  // E. Moderasi, Admin & Server (7 items)
  mod_shield: "<:mod_shield:1568829763794239559>",
  mod_warn: "<:mod_warn:1568829769036996768>",
  mod_mute: "<:mod_mute:1568829760929538078>",
  mod_kick: "<:mod_kick:1568829754562318346>",
  mod_ban: "<:mod_ban:1568829752285077504>",
  mod_lock: "<:mod_lock:1568829757863235694>",
  mod_ticket: "<:mod_ticket:1568829766394454047>",

  // F. Musik & Media (6 items)
  music_play: "<:music_play:1568829780097376416>",
  music_pause: "<:music_pause:1568829777664802836>",
  music_skip: "<:music_skip:1568829784903913492>",
  music_queue: "<:music_queue:1568829782525874287>",
  music_bass: "<:music_bass:1568829771813756979>",
  music_disc: "<:music_disc:1568829774481330196>",

  // G. Utility & Pihak Ketiga (8 items)
  mc_pickaxe: "<:mc_pickaxe:1568829738158391376>",
  mc_steve: "<:mc_steve:1568829744236068864>",
  mc_ping: "<:mc_ping:1568829741270704238>",
  weather_sun: "<:weather_sun:1568829855133470751>",
  weather_rain: "<:weather_rain:1568829852562231348>",
  media_anime: "<:media_anime:1568829746970886164>",
  media_movie: "<:media_movie:1568829749835599912>",
  dl_cobalt: "<:dl_cobalt:1568829706407780482>",

  // Core Character Expressions (17 items)
  naura_happy: "<a:naura_happy:ID_PLACEHOLDER>",
  naura_thinking: "<a:naura_thinking:ID_PLACEHOLDER>",
  naura_cry: "<a:naura_cry:ID_PLACEHOLDER>",
  naura_angry: "<:naura_angry:1568829790666891335>",
  naura_shy: "<:naura_shy:1568829845159550976>",
  naura_sleepy: "<:naura_sleepy:1568829847600631899>",
  naura_shocked: "<:naura_shocked:ID_PLACEHOLDER>",
  naura_eat: "<:naura_eat:1568829822321557634>",
  naura_cheers: "<:naura_cheers:1568829802108948600>",
  naura_chirping: "<:naura_chirping:1568829807175667825>",
  naura_annoy: "<:naura_annoy:1568829793536057364>",
  naura_blow_kiss: "<:naura_blow_kiss:1568829796413079582>",
  naura_akward: "<:naura_akward:1568829787718418504>",
  naura_confused: "<:naura_confused:1568829812263489709>",
  naura_hmph: "<:naura_hmph:1568829825341456454>",
  naura_impressed: "<:naura_impressed:1568829828193460424>",
  naura_read: "<:naura_read:1568829839002304562>",
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
