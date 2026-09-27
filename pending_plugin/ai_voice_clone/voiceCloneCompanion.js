"use strict";

/**
 * @file voiceCloneCompanion.js
 * @description Blueprint Layanan Integrasi Voice Cloning & Model TTS Kustom (Fish Audio).
 * Mengizinkan profil petualang menyematkan model suara custom untuk pembacaan teks bot.
 */

const { logger } = require("../../src/managers/logger");

class VoiceCloneCompanion {
  /**
   * Menyiapkan konfigurasi payload suara kustom
   * @param {string} userId - ID Pengguna Discord
   * @param {string} customModelId - ID Model suara kustom di Fish Audio
   * @param {string} textToSpeak - Kalimat yang hendak dibacakan
   * @returns {object} Payload siap kirim ke endpoint Fish Audio
   */
  static buildCloneRequestPayload(userId, customModelId, textToSpeak) {
    logger.info(`[VoiceCloneCompanion] Mempersiapkan payload TTS kustom untuk user: ${userId}`);

    return {
      reference_id: customModelId,
      text: textToSpeak,
      format: "mp3",
      sample_rate: 44100,
      latency: "normal",
      status: "STASHED_CONFIG",
      note: "Gunakan kredensial Fish Audio API resmi saat kuota langganan aktif.",
    };
  }

  /**
   * Validasi kelayakan model suara pengguna
   * @param {string} modelId
   * @returns {boolean}
   */
  static isValidModelId(modelId) {
    if (!modelId || typeof modelId !== "string") return false;
    // Format id model heksadesimal standar 32 karakter
    return /^[a-f0-9]{24,36}$/i.test(modelId);
  }
}

module.exports = {
  VoiceCloneCompanion,
};
