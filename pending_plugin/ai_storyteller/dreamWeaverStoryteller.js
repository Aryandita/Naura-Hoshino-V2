"use strict";

/**
 * @file dreamWeaverStoryteller.js
 * @description Blueprint Pencerita Otonom (Server Dream Weaver & Interactive Storyteller).
 * Memicu skenario petualangan interaktif pendek ketika server dalam kondisi hening.
 */

const { logger } = require("../../src/managers/logger");

class DreamWeaverStoryteller {
  constructor(channelId, guildId) {
    this.channelId = channelId;
    this.guildId = guildId;
    this.activeStoryThread = null;
  }

  /**
   * Mengecek apakah channel memenuhi syarat untuk pemicuan cerita interaktif
   * @param {number} quietMinutes - Jumlah menit tidak ada pesan di channel
   * @returns {boolean}
   */
  shouldTriggerEncounter(quietMinutes) {
    // Hanya picu jika channel sepi lebih dari 45 menit
    return quietMinutes >= 45;
  }

  /**
   * Menghasilkan rancangan event cerita interaktif pendek
   * @param {string} theme - Tema cerita (misal: "misteri_hutan", "reruntuhan_kuno", "kabut_berbisik")
   * @returns {object} Struktur skenario cerita
   */
  generateStoryEncounter(theme = "reruntuhan_kuno") {
    logger.info(`[DreamWeaver] Mempersiapkan template event cerita dengan tema: ${theme}`);

    return {
      title: "🌌 Anomali Malam: Bisikan dari Reruntuhan",
      theme,
      prologue: [
        "Lonceng menara berdentang di kejauhan. Udara di sekitar channel tiba-tiba terasa dingin.",
        "Sebuah pintu portal ethereal bercahaya ungu terbuka perlahan di tengah ruangan...",
        "Siapakah petualang pemberani yang akan memeriksa anomali ini terlebih dahulu?",
      ].join("\n"),
      choices: [
        { id: "choice_investigate", label: "🔍 Masuki Portal", outcome: "reward_exploration" },
        { id: "choice_seal", label: "🛡️ Segel Portal", outcome: "reward_defense" },
        { id: "choice_ignore", label: "🏃 Menjauh Perlahan", outcome: "no_effect" },
      ],
      state: "STANDBY_BLUEPRINT",
      instructionForAi: "Saat diaktifkan, hasilkan konsekuensi naratif berdasarkan pilihan user dengan Groq LLaMA 3.3.",
    };
  }
}

module.exports = {
  DreamWeaverStoryteller,
};
