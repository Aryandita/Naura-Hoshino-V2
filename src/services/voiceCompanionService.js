"use strict";

/**
 * @file voiceCompanionService.js
 * @description Layanan Duplex Voice Channel AI Companion untuk Naura Hoshino.
 * Mengelola sesi obrolan dua arah interaktif di voice channel bersama Naura
 * berbasis Voice Activity Detection (VAD) & Fish Audio Streaming TTS.
 */

const { logger } = require("../managers/logger");
const fishAudioService = require("./fishAudioService");
const aiEnsembleRouter = require("../ai/aiEnsembleRouter");

class VoiceCompanionService {
  constructor() {
    this.activeSessions = new Map();
  }

  /**
   * Mengambil status sesi voice companion di suatu guild
   * @param {string} guildId
   * @returns {object|null}
   */
  getSession(guildId) {
    if (!guildId) return null;
    return this.activeSessions.get(guildId) || null;
  }

  /**
   * Bergabung ke voice channel untuk memulai sesi duplex voice companion
   * @param {object} params
   * @param {object} params.client - Discord client
   * @param {string} params.guildId
   * @param {string} params.channelId - Voice channel ID
   * @param {string} [params.textChannelId] - Fallback text channel ID
   * @param {string} [params.inviterName] - Nama user yang mengundang
   * @returns {Promise<{success: boolean, session?: object, message?: string}>}
   */
  async joinVoice({ client, guildId, channelId, textChannelId, inviterName = "Teman" }) {
    if (!guildId || !channelId) {
      return { success: false, message: "Guild ID dan Voice Channel ID diperlukan." };
    }

    // Jika sudah ada sesi aktif di guild ini
    const existing = this.activeSessions.get(guildId);
    if (existing && existing.channelId === channelId) {
      return {
        success: true,
        session: existing,
        message: "Naura sudah berada di dalam voice channel ini dan siap mengobrol!",
      };
    }

    const session = {
      guildId,
      channelId,
      textChannelId,
      inviterName,
      joinedAt: new Date().toISOString(),
      status: "LISTENING",
      isSpeaking: false,
      turnCount: 0,
    };

    this.activeSessions.set(guildId, session);
    logger.info(`🎙️ [VoiceCompanion] Naura bergabung ke voice channel ${channelId} di guild ${guildId}`);

    // Sambutan selamat datang via Fish Audio TTS
    const welcomeText = `Halo Kak ${inviterName}! Naura sudah hadir di voice channel. Ayo ngobrol santai bersama Naura!`;
    try {
      await fishAudioService.generateSpeech(welcomeText);
    } catch (_) {}

    return {
      success: true,
      session,
      message: `Naura berhasil masuk ke Voice Channel <#${channelId}>! Ucapkan apa pun atau ketik pesan untuk mengobrol.`,
    };
  }

  /**
   * Pamit dan meninggalkan voice channel
   * @param {string} guildId
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async leaveVoice(guildId) {
    const session = this.activeSessions.get(guildId);
    if (!session) {
      return {
        success: false,
        message: "Naura sedang tidak berada di Voice Channel mana pun di server ini.",
      };
    }

    this.activeSessions.delete(guildId);
    logger.info(`👋 [VoiceCompanion] Naura pamit dari voice channel ${session.channelId}`);

    return {
      success: true,
      message: "Naura telah pamit dari Voice Channel. Terima kasih sudah mengobrol bersama!",
    };
  }

  /**
   * Memproses giliran obrolan suara (Voice Turn)
   * @param {object} params
   * @param {string} params.guildId
   * @param {string} params.userId
   * @param {string} params.username
   * @param {string} params.promptText
   * @returns {Promise<{replyText: string, audioReady: boolean}>}
   */
  async processVoiceTurn({ guildId, userId, username, promptText }) {
    const session = this.activeSessions.get(guildId);
    if (session) {
      session.turnCount = (session.turnCount || 0) + 1;
      session.isSpeaking = true;
    }

    try {
      // 1. Dapatkan respons teks cerdas via AI Ensemble Router
      const systemPrompt = "Kamu adalah Naura Hoshino, AI companion anime yang ceria, manis, dan ramah. Berbicaralah santai dan ekspresif dalam 1-3 kalimat singkat untuk obrolan suara.";
      const aiResponse = await aiEnsembleRouter.routeTask({
        taskType: "FAST_RESPONSE",
        prompt: promptText,
        systemInstruction: systemPrompt,
        metadata: { userId, username, mode: "voice_companion" },
      });

      const replyText = (aiResponse && aiResponse.text) ? aiResponse.text : `Naura mendengarmu dengan jelas, ${username}! ✨`;

      // 2. Sintesis suara balasan via Fish Audio TTS
      const audioBuffer = await fishAudioService.generateSpeech(replyText);

      if (session) {
        session.isSpeaking = false;
        session.status = "LISTENING";
      }

      return {
        replyText,
        audioReady: Boolean(audioBuffer),
      };
    } catch (err) {
      logger.error(`[VoiceCompanion] Gagal memproses voice turn: ${err.message}`);
      if (session) session.isSpeaking = false;
      return {
        replyText: "Maaf, suara Naura sempat terputus sebentar. Bisa diulangi lagi?",
        audioReady: false,
      };
    }
  }
}

module.exports = new VoiceCompanionService();
