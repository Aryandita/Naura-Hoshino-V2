"use strict";
const { ExternalAPIError } = require("../errors/DomainError");

const translationCache = new Map();
const CACHE_MAX_SIZE = 500;

/**
 * Helper untuk menerjemahkan teks menggunakan Google Translate API
 * @param {string} text - Teks yang akan diterjemahkan
 * @param {string} targetLang - Kode bahasa tujuan (id, en, ja, ko, dll)
 * @returns {Promise<string>}
 */
async function translateText(text, targetLang = "id") {
  if (!text || typeof text !== "string") return "";

  const cacheKey = `${text}:${targetLang}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new ExternalAPIError(`Translation HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const translatedText = data[0].map((item) => item[0]).join("");
    const result = translatedText || text;

    if (translationCache.size >= CACHE_MAX_SIZE) {
      const firstKey = translationCache.keys().next().value;
      translationCache.delete(firstKey);
    }
    translationCache.set(cacheKey, result);

    return result;
  }

  return text;
}

/**
 * Translate with context-aware gaming terminology preservation
 * Enhancement from pending_plugin/realtimeTranslator
 * @param {string} text
 * @param {string} targetLang
 * @param {object} contextData - { channelName, preserveTerms }
 * @returns {Promise<{ translatedText: string, detectedSource: string, confidence: number, fromCache: boolean }>}
 */
async function translateWithContext(text, targetLang = "id", contextData = {}) {
  const preserveTerms = contextData.preserveTerms || ["NPC", "RPG", "AFK", "GG", "LOL", "HP", "MP", "ATK", "DEF"];

  const cacheKey = `${text}:${targetLang}:ctx`;
  const fromCache = translationCache.has(cacheKey);

  if (fromCache) {
    return {
      translatedText: translationCache.get(cacheKey),
      detectedSource: "cached",
      confidence: 1.0,
      fromCache: true,
    };
  }

  try {
    const translated = await translateText(text, targetLang);

    let finalText = translated;
    for (const term of preserveTerms) {
      const regex = new RegExp(term, "gi");
      if (regex.test(text)) {
        finalText = finalText.replace(regex, term);
      }
    }

    if (translationCache.size >= CACHE_MAX_SIZE) {
      const firstKey = translationCache.keys().next().value;
      translationCache.delete(firstKey);
    }
    translationCache.set(cacheKey, finalText);

    return {
      translatedText: finalText,
      detectedSource: "auto",
      confidence: 0.85,
      fromCache: false,
    };
  } catch (error) {
    return {
      translatedText: text,
      detectedSource: "unknown",
      confidence: 0,
      fromCache: false,
    };
  }
}

function clearTranslationCache() {
  translationCache.clear();
}

module.exports = {
  translateText,
  translateWithContext,
  clearTranslationCache,
};
