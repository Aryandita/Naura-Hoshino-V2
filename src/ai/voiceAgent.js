"use strict";

const { logger } = require("../managers/logger");
const aiManager = require("../managers/aiManager");

class VoiceAgent {
  constructor() {
    this.activeVoiceSessions = new Map(); // guildId -> { connection, receiver, state, history }
  }

  /**
   * Status apakah Voice Agent aktif di guild
   * @param {string} guildId
   * @returns {boolean}
   */
  isActive(guildId) {
    return this.activeVoiceSessions.has(guildId);
  }

  /**
   * Daftarkan sesi Voice Agent untuk sebuah guild
   * @param {string} guildId
   * @param {object} session
   */
  startSession(guildId, session = {}) {
    const gId = String(guildId);
    let nativeConnection = null;

    if (session.voiceChannel) {
      const VoiceManager = require("../managers/voiceManager");
      nativeConnection = VoiceManager.acquireConnection({
        voiceChannel: session.voiceChannel,
        mode: "persistent",
      });
    }

    this.activeVoiceSessions.set(gId, {
      ...session,
      connection: nativeConnection?.connection || session.connection || null,
      startedAt: Date.now(),
      history: [],
      isSpeaking: false,
    });
    logger.info(
      `[VoiceAgent] Sesi Cyber Waifu Voice AI dimulai di guild ${gId}`,
    );
  }

  /**
   * Hentikan sesi Voice Agent
   * @param {string} guildId
   */
  stopSession(guildId) {
    const gId = String(guildId);
    const session = this.activeVoiceSessions.get(gId);
    if (session) {
      try {
        const VoiceManager = require("../managers/voiceManager");
        VoiceManager.disconnect(gId);
      } catch (e) {
        logger.debug("[voiceAgent:stopSession] Pembersihan koneksi/collector gagal: " + (e?.message || e));
      }
      this.activeVoiceSessions.delete(gId);
      logger.info(
        `[VoiceAgent] Sesi Cyber Waifu Voice AI dihentikan di guild ${gId}`,
      );
    }
  }

  /**
   * Proses transkrip suara pengguna dan hasilkan balasan suara
   * @param {string} guildId
   * @param {string} userId
   * @param {string} speechText
   * @returns {Promise<string>}
   */
  async processSpeechInput(guildId, userId, speechText) {
    const session = this.activeVoiceSessions.get(guildId);
    if (!session || !speechText || speechText.trim().length === 0) return "";

    try {
      const prompt = `[Transkrip Suara Pengguna di Voice Channel]: "${speechText}"\nBerikan balasan suara yang singkat, ramah, dan imut (maksimal 2 kalimat) sebagai Naura Hoshino.`;
      const response = await aiManager.chat(userId, prompt, {
        authorName: "Voice User",
        guildId,
      });

      session.history.push({ user: speechText, bot: response });
      if (session.history.length > 10) session.history.shift();

      return response;
    } catch (e) {
      logger.error(
        `[VoiceAgent] Gagal memproses input suara di guild ${guildId}:`,
        e,
      );
      return "Naura mendengarmu, tapi sinyalnya agak putus-putus nih!";
    }
  }
}

module.exports = new VoiceAgent();
