"use strict";

/**
 * @file worldEventNarrator.js
 * @description Blueprint Narator Peristiwa Dunia yang Mengubah Log Server Menjadi Narasi Sinematik.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class WorldEventNarrator {
  constructor(narratorId, baseConfig = {}) {
    this.narratorId = narratorId;
    this.name = baseConfig.name || "AI Lore Narrator";
    this.narrativeStyles = {
      epic: "Gaya epik seperti kronik kerajaan kuno",
      mysterious: "Gaya misterius dengan nuansa gelap dan teka-teki",
      cheerful: "Gaya ceria untuk perayaan dan festival",
      dramatic: "Gaya dramatis untuk konflik dan pertempuran besar",
      poetic: "Gaya puitis dengan metafora dan rima",
    };
    this.eventTemplates = new Map();
  }

  /**
   * Menghasilkan narasi sinematik dari log peristiwa server
   * @param {string} guildId - ID Guild Discord
   * @param {object} eventData - Data peristiwa (type, participants, outcome, timestamp)
   * @param {string} narrativeStyle - Gaya narasi yang diinginkan
   * @returns {Promise<{ narration: string, title: string, style: string, embedReady: boolean }>}
   */
  async narrateWorldEvent(guildId, eventData = {}, narrativeStyle = "epic") {
    try {
      logger.info(`[WorldNarrator:${this.narratorId}] Narrating event for guild ${guildId}`);

      const eventType = eventData.type || "generic";
      const participants = eventData.participants || [];
      const outcome = eventData.outcome || "unknown";
      const location = eventData.location || "Naura Wilds";
      const timestamp = eventData.timestamp || Date.now();

      const selectedStyle = this.narrativeStyles[narrativeStyle] || this.narrativeStyles.epic;

      let promptTemplate = `Ubah log peristiwa berikut menjadi narasi sinematik RPG:\n`;
      promptTemplate += `Gaya narasi: ${selectedStyle}.\n`;
      promptTemplate += `Tipe event: ${eventType}. Lokasi: ${location}.\n`;
      promptTemplate += `Partisipan (${participants.length}): ${participants.slice(0, 5).join(', ')}${participants.length > 5 ? ', dkk.' : ''}.\n`;
      promptTemplate += `Hasil: ${outcome}.\n`;
      promptTemplate += `Buat narasi 2-3 paragraf dalam bahasa Indonesia. Sertakan judul dramatis.`;

      const narration = this._generateSimulatedNarration(eventType, participants, outcome, narrativeStyle, location);

      return {
        narratorId: this.narratorId,
        narratorName: this.name,
        promptPrepared: promptTemplate,
        narration: narration.text,
        title: narration.title,
        style: narrativeStyle,
        embedReady: true,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[WorldNarrator] Galat pada narrator ${this.narratorId}:`, error);
      return {
        narratorId: this.narratorId,
        narratorName: this.name,
        narration: "Sebuah peristiwa telah terjadi di Naura Wilds...",
        title: "Peristiwa Dunia",
        style: "epic",
        embedReady: false,
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Mendaftarkan template narasi khusus untuk tipe event tertentu
   * @param {string} eventType
   * @param {string} template
   */
  registerEventTemplate(eventType, template) {
    this.eventTemplates.set(eventType, template);
    logger.info(`[WorldNarrator:${this.narratorId}] Template registered for: ${eventType}`);
  }

  _generateSimulatedNarration(type, participants, outcome, style, location) {
    const participantList = participants.length > 0
      ? participants.slice(0, 3).join(", ")
      : "para petualang pemberani";

    const narratives = {
      boss_defeat: {
        epic: {
          title: "Kemenangan Gemilang di " + location,
          text: `Di bawah langit kelam ${location}, ${participantList} berdiri tegak menghadapi sang tiran. Dengan tekad membara dan pedang berkilau, mereka menumbangkan musuh yang telah lama meneror desa. Sejarah akan mencatat hari ini sebagai awal era baru.`,
        },
        dramatic: {
          title: "Pertarungan Terakhir di " + location,
          text: `Darah dan keringat membasahi tanah ${location}. ${participantList} hampir kehilangan harapan ketika monster itu bangkit kembali. Namun dengan serangan terakhir yang menentukan, kegelapan pun sirna. Kemenangan diraih dengan harga yang mahal.`,
        },
      },
      festival: {
        cheerful: {
          title: "Kegembiraan Melanda " + location,
          text: `Sorak sorai terdengar di seluruh penjuru ${location}! ${participantList} memimpin perayaan dengan tarian dan nyanyian. Makanan lezat tersaji, hadiah dibagikan, dan senyum menghiasi wajah setiap warga. Hari yang takkan terlupakan!`,
        },
      },
      trade_milestone: {
        epic: {
          title: "Era Kemakmuran Ekonomi",
          text: `Pasar ${location} kini lebih hidup dari sebelumnya. ${participantList} telah mencapai tonggak perdagangan yang mengesankan. Emas mengalir, barang langka berpindah tangan, dan ekonomi desa memasuki babak baru yang menjanjikan.`,
        },
      },
      generic: {
        epic: {
          title: "Catatan dari " + location,
          text: `Di ${location}, sebuah peristiwa penting telah tercatat. ${participantList} terlibat dalam kejadian yang akan mengubah jalannya sejarah. Apa yang terjadi selanjutnya masih menjadi misteri...`,
        },
      },
    };

    const typeNarratives = narratives[type] || narratives.generic;
    const styleNarrative = typeNarratives[style] || typeNarratives.epic || Object.values(typeNarratives)[0];

    return styleNarrative || {
      title: "Peristiwa di " + location,
      text: `${participantList} mengalami sesuatu yang luar biasa di ${location}.`,
    };
  }
}

module.exports = {
  WorldEventNarrator,
};
