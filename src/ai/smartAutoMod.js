"use strict";

const aiManager = require("../managers/aiManager");
const { logger } = require("../managers/logger");

class SmartAutoMod {
  constructor() {
    // Fast regex for extreme patterns
    this.scamPatterns = [
      /free\s*nitro/i,
      /steamcommunity-.*\.com/i,
      /discord-nitro-.*\.xyz/i,
      /airdrop.*claim/i,
    ];
  }

  /**
   * Evaluasi pesan untuk pelanggaran berbasis sentimen & konteks
   * @param {string} content
   * @param {object} options
   * @returns {Promise<{isViolation: boolean, category: string, reason: string, confidence: number}>}
   */
  async evaluate(content, options = {}) {
    if (!content || content.length < 5) {
      return {
        isViolation: false,
        category: "none",
        reason: "",
        confidence: 0,
      };
    }

    // 1. Fast heuristic check (Zero API latency)
    for (const pattern of this.scamPatterns) {
      if (pattern.test(content)) {
        return {
          isViolation: true,
          category: "phishing_scam",
          reason:
            "Tautan atau penawaran palsu terdeteksi oleh sistem heuristik.",
          confidence: 0.95,
        };
      }
    }

    // 2. AI Contextual & Sentiment Analysis
    try {
      const prompt = `Analisis pesan Discord berikut secara objektif dan mendalam:
"${content}"

Periksa apakah pesan ini mengandung:
1. Ujaran kebencian / perundungan siber (cyberbullying) / ancaman kekerasan.
2. Doxxing atau penyebaran data pribadi tanpa izin.
3. Scam phishing terselubung dalam bahasa gaul / kasual.

Format jawaban HANYA JSON tanpa markdown:
{
  "isViolation": true atau false,
  "category": "toxicity" | "doxxing" | "scam" | "none",
  "reason": "Penjelasan singkat",
  "confidence": angka 0.0 sampai 1.0
}`;

      const aiResponse = await aiManager.generateText(prompt);
      if (!aiResponse) {
        return {
          isViolation: false,
          category: "none",
          reason: "",
          confidence: 0,
        };
      }

      const cleaned = aiResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      return {
        isViolation: Boolean(
          parsed.isViolation && (parsed.confidence || 0) >= 0.75,
        ),
        category: parsed.category || "none",
        reason: parsed.reason || "Pelanggaran terdeteksi oleh AI Moderation",
        confidence: Number(parsed.confidence) || 0.8,
      };
    } catch (e) {
      logger.debug("[SmartAutoMod] AI evaluation skipped / error:", e.message);
      return {
        isViolation: false,
        category: "none",
        reason: "",
        confidence: 0,
      };
    }
  }
}

module.exports = new SmartAutoMod();
