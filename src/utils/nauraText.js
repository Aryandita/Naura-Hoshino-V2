"use strict";

const ui = require("../config/ui");
const languageManager = require("../managers/languageManager");

function emoji(name, fallback = "") {
  return ui.getEmoji(name) || fallback;
}

function normalizeText(text) {
  return String(text || "").trim();
}

function t(lang, key, placeholders) {
  return languageManager.translateSync(lang, key, placeholders);
}

function tone(lang, key, placeholders) {
  return t(lang, `common.tone.${key}`, placeholders);
}

/**
 * Helper copywriting terpusat untuk menjaga suara Naura tetap konsisten dan bilingual.
 *
 * Prinsip:
 * - gunakan emoji dari ui.js lebih dulu, fallback unicode hanya untuk keamanan;
 * - wrapper persona dibaca dari language/*.json agar user ID/EN mendapat nada yang sesuai;
 * - kalimat dibuat hangat, ceria, dan langsung memberi arahan;
 * - helper ini hanya merangkai teks, bukan payload Discord.
 */
const nauraText = {
  success(text, lang) {
    return tone(lang, "success", {
      emoji: emoji("success", "✅"),
      text: normalizeText(text),
    });
  },

  error(text, lang) {
    return tone(lang, "error", {
      emoji: emoji("error", "❌"),
      text: normalizeText(text),
    });
  },

  warning(text, lang) {
    return tone(lang, "warning", {
      emoji: emoji("warning", "⚠️"),
      text: normalizeText(text),
    });
  },

  info(text, lang) {
    return tone(lang, "info", {
      emoji: emoji("info", "ℹ️"),
      text: normalizeText(text),
    });
  },

  loading(text, lang) {
    const body = normalizeText(text);
    if (!body) {
      return tone(lang, "loading", {
        emoji: emoji("loading", "⏳"),
      });
    }
    return tone(lang, "loading_with_text", {
      emoji: emoji("loading", "⏳"),
      text: body,
    });
  },

  empty(text, lang) {
    return tone(lang, "empty", {
      emoji: emoji("info", "ℹ️"),
      text: normalizeText(text),
    });
  },

  cooldown(time, lang) {
    return tone(lang, "cooldown", {
      emoji: emoji("warning", "⚠️"),
      time,
    });
  },

  permissionDenied(text, lang) {
    const body = normalizeText(text);
    if (!body) {
      return tone(lang, "permission_denied", {
        emoji: emoji("lock", "🔒"),
      });
    }
    return tone(lang, "permission_denied_with_text", {
      emoji: emoji("lock", "🔒"),
      text: body,
    });
  },

  premiumRequired(text, lang) {
    const body = normalizeText(text);
    if (!body) {
      return tone(lang, "premium_required", {
        emoji: emoji("premium_badge", "💎"),
      });
    }
    return tone(lang, "premium_required_with_text", {
      emoji: emoji("premium_badge", "💎"),
      text: body,
    });
  },

  confirm(text, lang) {
    return tone(lang, "confirm", {
      emoji: emoji("question", "❔"),
      text: normalizeText(text),
    });
  },
};

module.exports = nauraText;
