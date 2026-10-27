"use strict";

/**
 * 🌐 Language Manager - Naura Hoshino V2
 * ---------------------------------------
 * Manages internationalization (i18n) with support for multiple languages.
 * Provides synchronous and asynchronous translation with user preference caching.
 *
 * Features:
 * - Multi-language support (ID, EN, JA, ES)
 * - User language preference caching (5-minute TTL)
 * - Nested key lookup ("help.title" or "survival_not_started")
 * - Placeholder substitution ({username}, {amount})
 * - Lazy-loaded dependencies to avoid circular requires
 *
 * @module src/managers/languageManager
 * @example
 * const languageManager = require('./languageManager');
 *
 * // Synchronous translation (when language is known)
 * const text = languageManager.translateSync('id', 'welcome_message', { username: 'John' });
 *
 * // Asynchronous translation (auto-detects user preference)
 * const greeting = await languageManager.translate(userId, 'greeting');
 *
 * // Get full dictionary object
 * const lang = languageManager.getLanguageSync('en');
 */

const fs = require("fs");
const path = require("path");
const { logger } = require("../managers/logger");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Supported language codes in the ecosystem. Add new languages here. */
const SUPPORTED_LANGUAGES = ["id", "en", "ja", "es"];

/** Default fallback language when user preference unavailable */
const DEFAULT_LANGUAGE = "id";

/** Cache TTL for user language preferences (5 minutes in milliseconds) */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// LANGUAGE MANAGER CLASS
// ============================================================================

/**
 * Internationalization manager with user preference caching and nested key support.
 */
class LanguageManager {
  constructor() {
    /** @type {string[]} List of supported language codes */
    this.supported = SUPPORTED_LANGUAGES;

    /** @type {string} Default fallback language */
    this.default = DEFAULT_LANGUAGE;

    /** @type {Object.<string, Object>} Language dictionaries loaded from JSON files */
    this.strings = {
      id: {},
      en: {},
      ja: {},
      es: {},
    };

    /**
     * Cache for user language preferences to avoid repeated database queries.
     * @type {Map<string, {lang: string, expiresAt: number}>}
     */
    this.userCache = new Map();

    // Load all language dictionaries on initialization
    this.loadLanguages();
  }

  // ==========================================
  // 📚 LANGUAGE FILE LOADING
  // ==========================================

  /**
   * Load all language dictionaries from assets/language/ directory.
   * Called automatically during construction and can be called manually to reload.
   */
  loadLanguages() {
    const root = path.join(__dirname, "..", "..");
    const langPath = path.join(root, "assets", "language");

    // Load unified dictionaries: assets/language/id.json & assets/language/en.json
    for (const lang of this.supported) {
      const file = path.join(langPath, `${lang}.json`);
      const data = this._readJson(file);
      if (data) this.strings[lang] = data;
    }

    const summary = this.supported
      .map((lang) => `${lang}=${Object.keys(this.strings[lang] || {}).length}`)
      .join(", ");
    logger.info(
      `[LanguageManager] Unified dictionaries loaded (${summary}) from assets/language/.`,
    );
  }

  /**
   * Reload all language dictionaries without restarting the bot.
   * Useful after updating language files during development.
   * @returns {Object.<string, Object>} Reloaded dictionaries
   */
  reload() {
    this.strings = { id: {}, en: {}, ja: {}, es: {} };
    this.loadLanguages();
    return this.strings;
  }

  /**
   * Safely read and parse a JSON file.
   * @private
   * @param {string} file - Absolute path to JSON file
   * @returns {Object|null} Parsed object or null if file missing/invalid
   */
  _readJson(file) {
    try {
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      logger.error(`[LanguageManager] Failed to read ${file}: ${error.message}`);
      return null;
    }
  }

  /**
   * Recursively merge source into target without overwriting existing values.
   * Currently unused but kept for potential future use in dictionary merging.
   * @private
   * @param {Object} [target={}] - Target object
   * @param {Object} [source={}] - Source object to merge
   * @returns {Object} Merged object
   */
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
  // 🔎 KEY LOOKUP UTILITIES
  // ==========================================

  /**
   * Normalize any language code to one of the supported languages.
   * Handles formats like "en-US", "ID", "ja-JP" → "en", "id", "ja".
   * @param {string} lang - Raw language code
   * @returns {string} Normalized supported language code or default
   */
  normalize(lang) {
    if (typeof lang !== "string") return this.default;
    const base = lang.toLowerCase().split("-")[0];
    return this.supported.includes(base) ? base : this.default;
  }

  /**
   * Get language dictionary object synchronously by language code.
   * @param {string} [lang] - Language code ('id', 'en', etc.)
   * @returns {Object} Language dictionary or empty object if not found
   * @example
   * const lang = languageManager.getLanguageSync('id');
   * console.log(lang.welcome_message);
   */
  getLanguageSync(lang) {
    const code = this.normalize(lang);
    return this.strings[code] || this.strings[this.default] || {};
  }

  /**
   * Alias for getLanguageSync for backward compatibility.
   * @deprecated Use getLanguageSync() instead
   * @param {string} [lang] - Language code
   * @returns {Object} Language dictionary
   */
  getDictionary(lang) {
    return this.getLanguageSync(lang);
  }

  /**
   * Lookup a key in dictionary, supporting both flat and nested keys.
   * Flat key: "survival_not_started" → direct property access
   * Nested key: "help.title" → traverses obj.help.title
   * @private
   * @param {Object} dictionary - Language dictionary
   * @param {string} key - Key to lookup (flat or dot-separated)
   * @returns {any} Value or undefined if not found
   */
  _lookup(dictionary, key) {
    if (!dictionary || typeof key !== "string") return undefined;

    // Fast path: direct flat key
    if (dictionary[key] !== undefined) return dictionary[key];

    // Slow path: nested key traversal
    let current = dictionary;
    for (const part of key.split(".")) {
      if (current === null || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Replace placeholders in text with provided values.
   * Pattern: {placeholder} → replaced with value
   * @private
   * @param {string} text - Template text with placeholders
   * @param {Object} [placeholders={}] - Key-value pairs for substitution
   * @returns {string} Text with placeholders replaced
   * @example
   * _applyPlaceholders("Hello {name}!", { name: "John" }) → "Hello John!"
   */
  _applyPlaceholders(text, placeholders = {}) {
    let output = String(text);
    for (const [placeholder, value] of Object.entries(placeholders)) {
      output = output.split(`{${placeholder}}`).join(String(value));
    }
    return output;
  }

  // ==========================================
  // 🌐 USER LANGUAGE PREFERENCES
  // ==========================================

  /**
   * Lazy-load UserProfile model to avoid circular dependency at module load time.
   * @private
   * @returns {Object|null} UserProfile model or null if unavailable
   */
  _getUserProfile() {
    try {
      return require("../models/UserProfile");
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user's preferred language asynchronously with caching.
   * Priority: User DB preference → Guild settings → Default language
   * @param {string} userId - Discord user ID
   * @param {string} [guildId=null] - Optional guild ID for fallback
   * @returns {Promise<string>} Language code ('id', 'en', etc.)
   * @example
   * const lang = await languageManager.getUserLanguage('123456789');
   */
  async getUserLanguage(userId, guildId = null) {
    if (!userId) return this.default;

    // Check cache first (avoid DB query if fresh)
    const cached = this.userCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.lang;
    }

    let lang = null;
    try {
      // Lazy require to break circular dependency with cacheManager
      const cacheManager = require("./cacheManager");
      const profile = await cacheManager.getUserProfile(userId);

      // 1. Check user's explicit language preference
      if (profile && profile.language) {
        lang = this.normalize(profile.language);
      }
      // 2. Fallback to guild settings if no user preference
      else if (guildId) {
        const settings = await cacheManager.getGuildSettings(guildId);
        if (settings && settings.settings && settings.settings.language) {
          lang = this.normalize(settings.settings.language);
        }
      }

      // 3. Final fallback to global default
      if (!lang) {
        lang = this.default;
      }
    } catch (error) {
      // On any error, safely fall back to default
      lang = this.default;
    }

    // Cache the result for subsequent calls
    this.userCache.set(userId, { lang, expiresAt: Date.now() + CACHE_TTL_MS });
    return lang;
  }

  /**
   * Save user's language preference to database and update local cache.
   * Used by language selector in /help menu.
   * @param {string} userId - Discord user ID
   * @param {string} lang - Language code to set
   * @returns {Promise<string>} Normalized language code that was saved
   */
  async setUserLanguage(userId, lang) {
    const normalized = this.normalize(lang);
    if (!userId) return normalized;

    try {
      const cacheManager = require("./cacheManager");
      await cacheManager.updateUserProfile(userId, { language: normalized });

      // Update local cache immediately
      this.userCache.set(userId, {
        lang: normalized,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    } catch (error) {
      logger.error(
        `[LanguageManager] Failed to update language for user ${userId}:`,
        error,
      );
    }

    return normalized;
  }

  /**
   * Clear language cache for one user or all users.
   * @param {string} [userId] - User ID to clear, or omit to clear all
   */
  clearCache(userId) {
    if (userId) this.userCache.delete(userId);
    else this.userCache.clear();
  }

  /**
   * Resolve language from interaction/message/userId context.
   * Priority: Saved DB preference → Discord locale → Default
   * @param {string|Object} context - User ID, interaction, or message object
   * @returns {Promise<string>} Resolved language code
   */
  async resolve(context) {
    if (!context) return this.default;

    // Direct user ID string
    if (typeof context === "string") return this.getUserLanguage(context);

    // Extract user ID from various object shapes
    const userId = context.user?.id || context.author?.id || context.userId;
    if (userId) {
      const cached = this.userCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) return cached.lang;
      return this.getUserLanguage(userId);
    }

    // Fall back to Discord locale if available
    if (context.locale) return this.normalize(context.locale);

    return this.default;
  }

  // ==========================================
  // 🗣️ TRANSLATION METHODS
  // ==========================================

  /**
   * Translate a key asynchronously (auto-detects user language).
   * @param {string} userId - Discord user ID
   * @param {string} key - Translation key (flat or nested)
   * @param {Object} [placeholders={}] - Placeholder substitutions
   * @returns {Promise<string>} Translated text
   * @example
   * const msg = await languageManager.translate(userId, 'welcome', { name: 'John' });
   */
  async translate(userId, key, placeholders = {}) {
    const lang = await this.getUserLanguage(userId);
    return this.translateSync(lang, key, placeholders);
  }

  /**
   * Translate a key synchronously with explicit language.
   * Safe to call with undefined/null/unknown language (falls back gracefully).
   * @param {string} lang - Language code
   * @param {string} key - Translation key
   * @param {Object} [placeholders={}] - Placeholder substitutions
   * @returns {string} Translated text or key itself if not found
   * @example
   * const text = languageManager.translateSync('id', 'greeting', { name: 'Alice' });
   */
  translateSync(lang, key, placeholders = {}) {
    const normalized = this.normalize(lang);

    // Try requested language first, then default, then return key as-is
    const text =
      this._lookup(this.strings[normalized], key) ??
      this._lookup(this.strings[this.default], key) ??
      key;

    if (typeof text !== "string") return text;
    return this._applyPlaceholders(text, placeholders);
  }

  /**
   * Short alias for translateSync: t(lang, key, placeholders).
   * @param {string} lang - Language code
   * @param {string} key - Translation key
   * @param {Object} [placeholders={}] - Placeholder substitutions
   * @returns {string} Translated text
   */
  t(lang, key, placeholders = {}) {
    return this.translateSync(lang, key, placeholders);
  }

  /**
   * Alias getString(lang, key, placeholders) for legacy plugin compatibility.
   * @deprecated Use translateSync() instead
   * @param {string} lang - Language code
   * @param {string} key - Translation key
   * @param {Object} [placeholders={}] - Placeholder substitutions
   * @returns {string} Translated text
   */
  getString(lang, key, placeholders = {}) {
    return this.translateSync(lang, key, placeholders);
  }

  /**
   * Check if a translation key exists in a specific language.
   * Used by parity audit scripts to ensure all languages have same keys.
   * @param {string} lang - Language code
   * @param {string} key - Translation key to check
   * @returns {boolean} True if key exists
   */
  has(lang, key) {
    return this._lookup(this.strings[this.normalize(lang)], key) !== undefined;
  }
}

// ============================================================================
// GLOBAL INSTANCE & EXPORTS
// ============================================================================

/**
 * Global LanguageManager instance for application-wide i18n.
 * Use this singleton instead of creating new instances.
 * @type {LanguageManager}
 */
const languageManager = new LanguageManager();

// Expose constants for external use
module.exports = languageManager;
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
module.exports.DEFAULT_LANGUAGE = DEFAULT_LANGUAGE;
