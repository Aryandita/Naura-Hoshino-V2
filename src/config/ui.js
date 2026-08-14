"use strict";

// ==========================================
// PUSAT KONFIGURASI TAMPILAN NAURA
// ==========================================
// Berkas ini dulunya menampung semuanya dan sudah melewati 33 KB, jadi setiap
// penambahan satu emoji berarti mengirim ulang seluruh berkas. Sekarang isinya
// dipecah ke src/config/ui/ dan berkas ini hanya merakitnya kembali.
//
// API publik TIDAK berubah: ui.colors, ui.emojis, ui.banners, ui.footers,
// ui.getEmoji(), ui.getColor(), ui.sendError(), dan seterusnya tetap sama.
//
// Ingin mengubah emoji? Sunting berkas kecil di src/config/ui/emojis_*.js.

const { colors, monsters, dividers, links, footers } = require("./ui/palette");
const {
  banners,
  characters,
  backgrounds,
  survivalBackgrounds,
} = require("./ui/assets");
const emojisBase = require("./ui/emojis_base");
const emojisGame = require("./ui/emojis_game");
const emojisMedia = require("./ui/emojis_media");
const helpers = require("./ui/helpers");
const { logger } = require("../managers/logger");

const DEFAULT_SURVIVAL_BG = "./assets/survival/background/desa_siang.jpeg";
const DEFAULT_MONSTER = "./assets/survival/monsters/slime.png";
const DEFAULT_DUNGEON_BG = "./assets/survival/background/tambang_malam.jpeg";

module.exports = {
  // --- Data tampilan ---
  colors,
  banners,
  characters,
  backgrounds,
  survivalBackgrounds,
  monsters,
  dividers,
  footers,

  // --- Tautan resmi (tetap di level atas seperti sebelumnya) ---
  ...links,

  // --- Emoji: dasar, permainan, lalu media.
  // Urutan penggabungan menentukan siapa yang menang bila ada kunci kembar.
  emojis: {
    ...emojisBase,
    ...emojisGame,
    ...emojisMedia,
  },

  // ==========================================
  // SMART SYSTEM GETTERS (ANTI-CRASH)
  // ==========================================

  getFooter(category = "core") {
    return this.footers[category] || this.footers.core;
  },

  getPremiumColor(tier) {
    const map = {
      supporter: this.colors.premium_supporter,
      friends: this.colors.premium_friends,
      vip: this.colors.premium_vip,
      1: this.colors.premium_supporter,
      2: this.colors.premium_friends,
      3: this.colors.premium_vip,
    };
    return map[tier] || this.colors.premium_vip;
  },

  getPremiumEmoji(tier) {
    const map = {
      supporter: this.emojis.premium_supporter,
      friends: this.emojis.premium_friends,
      vip: this.emojis.premium_vip,
      none: this.emojis.vip,
    };
    return map[tier] || this.emojis.premium_badge;
  },

  // Supporter: <= 30 hari, Friends: 31-90 hari, VIP: > 90 hari
  getPremiumTier(daysLeft, isPremium) {
    if (!isPremium || daysLeft <= 0) return "none";
    if (daysLeft > 90) return "vip";
    if (daysLeft > 30) return "friends";
    return "supporter";
  },

  stripCustomEmojis(text) {
    return helpers.stripCustomEmojis(text);
  },

  parseEmoji(emojiStr) {
    return helpers.parseEmoji(emojiStr);
  },

  // Mengembalikan null bila tidak ada, supaya pola fallback tetap jalan.
  getEmoji(name) {
    return this.emojis[name] || null;
  },

  // Emoji ekspresi Naura berdasarkan nama ekspresi atau mood.
  // Menerima 'Cheers', 'success', 'error', 'loading', 'afk', dan seterusnya.
  getExpressionEmoji(nameOrMood) {
    try {
      const nauraExpression = require("../utils/nauraExpression");
      return nauraExpression.getEmoji(nameOrMood);
    } catch (e) {
      logger.warn("[UI getExpressionEmoji]", e.message);
      return null;
    }
  },

  getColor(name) {
    return this.colors[name] || this.colors.primary;
  },

  getBanner(name) {
    return helpers.existingPath(this.banners[name]);
  },

  getBackground(name) {
    return helpers.existingPath(this.backgrounds[name]);
  },

  // Latar survival dinamis mengikuti lokasi dan jam dalam game.
  getSurvivalBackground(lokasi, hour) {
    const { key, fallbackKey } = helpers.survivalBackgroundKey(lokasi, hour);
    const candidate =
      this.survivalBackgrounds[key] ||
      this.survivalBackgrounds[fallbackKey] ||
      this.survivalBackgrounds.desa_siang;
    return helpers.existingPath(candidate) || DEFAULT_SURVIVAL_BG;
  },

  getMonsterSprite(monsterName) {
    const candidate = this.monsters[monsterName] || this.monsters.slime;
    return helpers.existingPath(candidate) || DEFAULT_MONSTER;
  },

  getDungeonBackground() {
    return (
      helpers.existingPath(this.survivalBackgrounds.tambang_malam) ||
      DEFAULT_DUNGEON_BG
    );
  },

  createProgressBar(current, max, length = 10) {
    return helpers.progressBar(
      current,
      max,
      length,
      this.emojis.bar_filled,
      this.emojis.bar_empty,
    );
  },

  async sendError(interaction, errorMessage, ephemeral = false) {
    return helpers.sendError(interaction, errorMessage, ephemeral);
  },

  hybrid(idText, enText) {
    return helpers.hybrid(idText, enText);
  },

  getLangText(interaction, idText, enText) {
    return helpers.getLangText(interaction, idText, enText);
  },

  getCharacterImagePath(imageFileName) {
    return helpers.characterImagePath(imageFileName);
  },
};
