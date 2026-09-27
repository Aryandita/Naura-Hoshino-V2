"use strict";

/**
 * @file visionLootAppraiser.js
 * @description Blueprint Penilai Barang Multimodal AI (Vision Loot Appraiser).
 * Menganalisis gambar dari pemain dan mengonversinya menjadi item RPG Naura Wilds.
 */

const { logger } = require("../../src/managers/logger");

class VisionLootAppraiser {
  /**
   * Menyiapkan payload appraisal untuk model multimodal AI
   * @param {string} imageUrl - URL gambar yang diunggah pengguna Discord
   * @param {string} userId - ID Pemain
   * @returns {object} Struktur data item RPG terkonversi
   */
  static prepareAppraisalPayload(imageUrl, userId) {
    logger.info(`[VisionLootAppraiser] Menyiapkan gambar untuk dianalisis: ${imageUrl}`);

    const systemInstruction = [
      "Kamu adalah Penilai Artefak Kuno (Artifact Appraiser) di Naura Wilds.",
      "Tugasmu adalah menganalisis foto benda yang dikirim pengguna dan mengubahnya menjadi item RPG.",
      "Keluarkan format JSON dengan skema:",
      "{",
      '  "itemName": string,',
      '  "itemTier": number (1 sampai 5),',
      '  "category": "material" | "consumable" | "relic" | "weapon",',
      '  "stats": { "atk": number, "def": number, "durability": number },',
      '  "loreDescription": string',
      "}",
    ].join("\n");

    return {
      userId,
      imageUrl,
      systemInstruction,
      status: "DORMANT_BLUEPRINT",
      note: "Hubungkan ke Gemini 2.5 Flash Multimodal saat kuota token siap.",
    };
  }

  /**
   * Fallback simulator saat mode offline / dormant aktif
   * @param {string} itemNameFallback
   * @returns {object} Item RPG simulasi
   */
  static simulateAppraisal(itemNameFallback = "Artefak Misterius") {
    return {
      itemName: itemNameFallback,
      itemTier: 2,
      category: "relic",
      stats: {
        atk: 5,
        def: 8,
        durability: 50,
      },
      loreDescription: "Benda unik dari dunia lain yang memancarkan energi kosmik samar.",
      estimatedValueNsf: 250,
    };
  }
}

module.exports = {
  VisionLootAppraiser,
};
