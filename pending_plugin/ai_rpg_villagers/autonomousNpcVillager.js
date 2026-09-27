"use strict";

/**
 * @file autonomousNpcVillager.js
 * @description Blueprint NPC Desa Otonom bertenaga Semantic Memory & Dynamic Sentiment.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class AutonomousNpcVillager {
  constructor(npcId, baseConfig = {}) {
    this.npcId = npcId;
    this.name = baseConfig.name || "Warga Desa";
    this.personality = baseConfig.personality || "Ramah, pekerja keras, dan suka bercerita";
    this.dialogueTone = baseConfig.dialogueTone || "santai";
    this.currentMood = "neutral";
  }

  /**
   * Menghasilkan sapaan atau tanggapan dinamis berdasarkan histori pemain
   * @param {string} userId - ID Pengguna Discord
   * @param {string} playerAction - Aksi pemain (misal: "greet", "gift", "bargain", "lie")
   * @param {object} contextData - Konteks tambahan seperti cuaca dan reputasi
   * @returns {Promise<{ replyText: string, moodChange: number, rewardGranted: boolean }>}
   */
  async generateDynamicInteraction(userId, playerAction, contextData = {}) {
    try {
      logger.info(`[AutonomousNPC:${this.npcId}] Menyiapkan interaksi dengan user ${userId}`);

      // Placeholder simulasi logika saat AI belum diaktifkan
      const weather = contextData.weather || "Cerah";
      const reputation = contextData.reputation || 0;

      let promptTemplate = `Kamu adalah ${this.name}, seorang NPC di Naura Wilds dengan kepribadian: ${this.personality}.\n`;
      promptTemplate += `Cuaca saat ini: ${weather}. Reputasi pemain: ${reputation}.\n`;
      promptTemplate += `Pemain melakukan aksi: "${playerAction}".\n`;
      promptTemplate += `Berikan respon singkat (maksimal 2 kalimat) dalam bahasa Indonesia yang sesuai dengan mood-mu.`;

      // Catatan: Saat diaktifkan, panggil aiEnsembleRouter.routeTask("FAST_RESPONSE", promptTemplate)
      return {
        npcId: this.npcId,
        npcName: this.name,
        promptPrepared: promptTemplate,
        simulatedResponse: `Halo petualang! Hari yang cukup ${weather.toLowerCase()} di desa kita. Ada yang bisa kubantu?`,
        mood: this.currentMood,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[AutonomousNPC] Galat pada interaksi ${this.npcId}:`, error);
      return {
        npcId: this.npcId,
        npcName: this.name,
        simulatedResponse: "Halo, selamat datang di desa!",
        mood: "neutral",
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Memperbarui sentimen relasi NPC terhadap perlakuan pemain
   * @param {string} userId
   * @param {number} deltaSentiment
   */
  updateSentiment(userId, deltaSentiment) {
    if (deltaSentiment > 5) this.currentMood = "happy";
    else if (deltaSentiment < -5) this.currentMood = "annoyed";
    else this.currentMood = "neutral";
    return this.currentMood;
  }
}

module.exports = {
  AutonomousNpcVillager,
};
