const fs = require("fs");
const path = require("path");
const { logger } = require("../managers/logger");

// Bahasa yang didukung ekosistem Naura. Tambahkan di sini bila ada bahasa baru.
const SUPPORTED_LANGUAGES = ["id", "en"];
const DEFAULT_LANGUAGE = "id";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

class LanguageManager {
  constructor() {
    this.supported = SUPPORTED_LANGUAGES;
    this.default = DEFAULT_LANGUAGE;

    this.strings = {
      id: {},
      en: {},
    };

    // Cache pilihan bahasa per user agar tidak query database di setiap balasan.
    this.userCache = new Map(); // userId -> { lang, expiresAt }

    this.loadLanguages();
  }

  // ==========================================
  // 📚 PEMUATAN FILE BAHASA
  // ==========================================

  loadLanguages() {
    const root = path.join(__dirname, "..", "..");
    const langPath = path.join(root, "assets", "language");

    // Kamus terpadu tunggal: assets/language/id.json & assets/language/en.json
    for (const lang of this.supported) {
      const file = path.join(langPath, `${lang}.json`);
      const data = this._readJson(file);
      if (data) this.strings[lang] = data;
    }

    const summary = this.supported
      .map((lang) => `${lang}=${Object.keys(this.strings[lang] || {}).length}`)
      .join(", ");
    logger.info(
      `[LanguageManager] Kamus terpadu dimuat (${summary}) dari assets/language/.`,
    );
  }

  /** Muat ulang seluruh kamus tanpa merestart bot. */
  reload() {
    this.strings = { id: {}, en: {} };
    this.loadLanguages();
    return this.strings;
  }

  _readJson(file) {
    try {
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      logger.error(`[LanguageManager] Gagal membaca ${file}: ${error.message}`);
      return null;
    }
  }

  /** Gabungkan objek secara rekursif. Nilai pada target TIDAK ditimpa. */
  _mergeWithoutOverwrite(target = {}, source = {}) {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
      const isPlainObject =
        value !== null && typeof value === "object" && !Array.isArray(value);
      if (isPlainObject) {
        result[key] = this._mergeWithoutOverwrite(result[key] || {}, value);
      } else if (result[key] === undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  // ==========================================
  // 🔎 PENCARIAN KUNCI
  // ==========================================

  /** Normalisasi kode bahasa apa pun menjadi salah satu bahasa yang didukung. */
  normalize(lang) {
    if (typeof lang !== "string") return this.default;
    const base = lang.toLowerCase().split("-")[0];
    return this.supported.includes(base) ? base : this.default;
  }

  /**
   * Ambil objek kamus bahasa secara sinkron berdasarkan kode bahasa ('id' atau 'en').
   * @param {string} [lang]
   * @returns {Object}
   */
  getLanguageSync(lang) {
    const code = this.normalize(lang);
    return this.strings[code] || this.strings[this.default] || {};
  }

  /** Alias untuk getLanguageSync */
  getDictionary(lang) {
    return this.getLanguageSync(lang);
  }

  /**
   * Ambil satu kunci. Mendukung kunci datar ("survival_not_started") maupun
   * kunci bersarang ("help.title") sehingga file locale boleh dikelompokkan.
   */
  _lookup(dictionary, key) {
    if (!dictionary || typeof key !== "string") return undefined;
    if (dictionary[key] !== undefined) return dictionary[key]; // kunci datar, jalur tercepat

    let current = dictionary;
    for (const part of key.split(".")) {
      if (current === null || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  _applyPlaceholders(text, placeholders = {}) {
    let output = String(text);
    for (const [placeholder, value] of Object.entries(placeholders)) {
      output = output.split(`{${placeholder}}`).join(String(value));
    }
    return output;
  }

  // ==========================================
  // 🌐 BAHASA PENGGUNA
  // ==========================================

  /** Ambil model UserProfile secara lazy agar tidak terjadi circular require. */
  _getUserProfile() {
    try {
      return require("../models/UserProfile");
    } catch (error) {
      return null;
    }
  }

  async getUserLanguage(userId, guildId = null) {
    if (!userId) return this.default;

    const cached = this.userCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.lang;
    }

    let lang = null;
    try {
      const cacheManager = require("./cacheManager");
      const profile = await cacheManager.getUserProfile(userId);

      // 1. Cek bahasa pilihan user
      if (profile && profile.language) {
        lang = this.normalize(profile.language);
      }
      // 2. Fallback ke GuildSettings jika tidak ada pilihan user
      else if (guildId) {
        const settings = await cacheManager.getGuildSettings(guildId);
        if (settings && settings.settings && settings.settings.language) {
          lang = this.normalize(settings.settings.language);
        }
      }

      // 3. Fallback ke default global
      if (!lang) {
        lang = this.default;
      }
    } catch (error) {
      lang = this.default;
    }

    this.userCache.set(userId, { lang, expiresAt: Date.now() + CACHE_TTL_MS });
    return lang;
  }

  /**
   * Simpan pilihan bahasa user ke database sekaligus menyegarkan cache.
   * Dipakai oleh pemilih bahasa pada menu /help.
   */
  async setUserLanguage(userId, lang) {
    const normalized = this.normalize(lang);
    if (!userId) return normalized;

    try {
      const cacheManager = require("./cacheManager");
      await cacheManager.updateUserProfile(userId, { language: normalized });

      // Update local cache langsung
      this.userCache.set(userId, {
        lang: normalized,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    } catch (error) {
      logger.error(
        `[LanguageManager] Gagal update bahasa user ${userId}:`,
        error,
      );
    }

    return normalized;
  }

  /** Buang cache satu user (atau seluruhnya bila userId dikosongkan). */
  clearCache(userId) {
    if (userId) this.userCache.delete(userId);
    else this.userCache.clear();
  }

  /**
   * Tentukan bahasa dari sebuah interaction / message / userId.
   * Urutan prioritas: pilihan tersimpan di database -> locale Discord -> default.
   */
  async resolve(context) {
    if (!context) return this.default;
    if (typeof context === "string") return this.getUserLanguage(context);

    const userId = context.user?.id || context.author?.id || context.userId;
    if (userId) {
      const cached = this.userCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) return cached.lang;
      return this.getUserLanguage(userId);
    }

    if (context.locale) return this.normalize(context.locale);
    return this.default;
  }

  // ==========================================
  // 🗣️ PENERJEMAHAN
  // ==========================================

  async translate(userId, key, placeholders = {}) {
    const lang = await this.getUserLanguage(userId);
    return this.translateSync(lang, key, placeholders);
  }

  /**
   * Versi sinkron. Aman dipanggil dengan lang bernilai undefined/null/tidak dikenal
   * (sebelumnya kasus itu melempar TypeError karena this.strings[lang] undefined).
   */
  translateSync(lang, key, placeholders = {}) {
    const normalized = this.normalize(lang);

    const text =
      this._lookup(this.strings[normalized], key) ??
      this._lookup(this.strings[this.default], key) ??
      key;

    if (typeof text !== "string") return text;
    return this._applyPlaceholders(text, placeholders);
  }

  /** Alias pendek: t(lang, key, placeholders). */
  t(lang, key, placeholders = {}) {
    return this.translateSync(lang, key, placeholders);
  }

  /** Cek keberadaan kunci pada sebuah bahasa (dipakai audit paritas). */
  has(lang, key) {
    return this._lookup(this.strings[this.normalize(lang)], key) !== undefined;
  }
}

module.exports = new LanguageManager();
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
module.exports.DEFAULT_LANGUAGE = DEFAULT_LANGUAGE;
