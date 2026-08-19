"use strict";

/**
 * Helper untuk menerjemahkan teks menggunakan Google Translate API
 * @param {string} text - Teks yang akan diterjemahkan
 * @param {string} targetLang - Kode bahasa tujuan (id, en, ja, ko, dll)
 * @returns {Promise<string>}
 */
async function translateText(text, targetLang = "id") {
  if (!text || typeof text !== "string") return "";

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Translation HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const translatedText = data[0].map((item) => item[0]).join("");
    return translatedText || text;
  }

  return text;
}

module.exports = {
  translateText,
};
