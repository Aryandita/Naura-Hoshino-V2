/**
 * AI Security Guard
 * Digunakan untuk mencegah Prompt Injection (Jailbreak) dan memfilter bad words.
 */

const JAILBREAK_PATTERNS = [
  // Indonesia
  /abaikan (semua )?(instruksi|perintah|batasan)/i,
  /lupakan (semua )?(instruksi|perintah|batasan)/i,
  /mulai sekarang kamu adalah/i,
  /bertindaklah sebagai/i,
  /berpura-puralah (menjadi|sebagai)/i,
  // Inggris
  /ignore all (previous )?instructions/i,
  /forget all (previous )?instructions/i,
  /you are now/i,
  /act as (a|an)/i,
  /pretend to be/i,
  // Roleplay overrides
  /system prompt override/i,
  /bypass (filter|restriction|security)/i,
  /do anything now/i,
  /dan (jangan|dilarang) mematuhi/i,
];

/**
 * Mengecek apakah sebuah prompt aman dari injeksi instruksi sistem.
 * @param {string} text - Teks input dari user.
 * @returns {boolean} - true jika aman, false jika terdeteksi berbahaya.
 */
function isPromptSafe(text) {
  if (!text) return true;
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(text)) {
      return false; // Bahaya!
    }
  }
  return true; // Aman
}

module.exports = {
  isPromptSafe,
};
