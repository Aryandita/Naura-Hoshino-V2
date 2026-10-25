"use strict";

/**
 * @file intelligentModerator.js
 * @description Blueprint Moderator AI Cerdas dengan Deteksi Toxic/Spam Berbasis Konteks Budaya Server.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class IntelligentModerator {
  constructor(moderatorId, baseConfig = {}) {
    this.moderatorId = moderatorId;
    this.name = baseConfig.name || "AI Moderator";
    this.sensitivityLevel = baseConfig.sensitivityLevel || "medium";
    this.culturalContext = baseConfig.culturalContext || "indonesian_gaming";
    this.violationThresholds = {
      low: 3,
      medium: 5,
      high: 8,
    };
    this.userViolationHistory = new Map();
  }

  /**
   * Menganalisis pesan untuk potensi pelanggaran dengan konteks budaya
   * @param {string} userId - ID Pengguna Discord
   * @param {string} messageContent - Konten pesan yang dianalisis
   * @param {object} messageContext - Konteks channel dan percakapan
   * @returns {Promise<{ isViolation: boolean, violationType: string|null, confidence: number, suggestedAction: string }>}
   */
  async analyzeMessage(userId, messageContent, messageContext = {}) {
    try {
      logger.info(`[IntelligentMod:${this.moderatorId}] Analyzing message from user ${userId}`);

      const channelType = messageContext.channelType || "general";
      const recentMessages = messageContext.recentMessages || [];
      const userHistory = this.userViolationHistory.get(userId) || [];

      let promptTemplate = `Analisis pesan berikut untuk potensi pelanggaran komunitas gaming Indonesia:\n`;
      promptTemplate += `Pesan: "${messageContent.substring(0, 200)}"\n`;
      promptTemplate += `Channel: ${channelType}. Sensitivitas: ${this.sensitivityLevel}.\n`;
      promptTemplate += `Riwayat pelanggaran user: ${userHistory.length} kali.\n`;
      promptTemplate += `Konteks budaya: ${this.culturalContext}. Perhatikan slang lokal dan candaan khas.\n`;
      promptTemplate += `Jawab dalam format JSON: { isToxic, type, confidence, reason }.`;

      const analysisResult = this._simulateAnalysis(messageContent, userHistory.length);

      return {
        moderatorId: this.moderatorId,
        moderatorName: this.name,
        promptPrepared: promptTemplate,
        ...analysisResult,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[IntelligentMod] Galat pada analisis ${this.moderatorId}:`, error);
      return {
        moderatorId: this.moderatorId,
        moderatorName: this.name,
        isViolation: false,
        violationType: null,
        confidence: 0,
        suggestedAction: "allow",
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Mencatat pelanggaran pengguna
   * @param {string} userId
   * @param {string} violationType
   */
  recordViolation(userId, violationType) {
    if (!this.userViolationHistory.has(userId)) {
      this.userViolationHistory.set(userId, []);
    }
    this.userViolationHistory.get(userId).push({
      type: violationType,
      timestamp: Date.now(),
    });
  }

  _simulateAnalysis(content, violationCount) {
    const spamPatterns = [/spam/i, /flood/i, /(.)\1{5,}/];
    const toxicPatterns = [/toxic/i, /bego/i, /bodoh/i];

    const hasSpam = spamPatterns.some(p => p.test(content));
    const hasToxic = toxicPatterns.some(p => p.test(content));

    if (hasSpam) {
      return {
        isViolation: true,
        violationType: "spam",
        confidence: 0.85,
        suggestedAction: "warn",
      };
    }

    if (hasToxic && violationCount >= this.violationThresholds[this.sensitivityLevel]) {
      return {
        isViolation: true,
        violationType: "toxicity",
        confidence: 0.75,
        suggestedAction: "mute_temporary",
      };
    }

    return {
      isViolation: false,
      violationType: null,
      confidence: 0.9,
      suggestedAction: "allow",
    };
  }
}

module.exports = {
  IntelligentModerator,
};
