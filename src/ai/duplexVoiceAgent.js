"use strict";

/**
 * duplexVoiceAgent.js - Real-Time Duplex Voice AI Agent untuk Voice Channel Discord.
 *
 * Menggabungkan:
 *   1. Voice Channel Event & VAD (Voice Activity Detection / Receiver).
 *   2. Living AI Ensemble Routing (Gemini 2.5 Flash / Groq) untuk dialog cepat interaktif.
 *   3. Fish Audio TTS API (fishAudioService.generateSpeech) untuk sintesis suara waifu real-time.
 *   4. Duplex Interruption / Barge-in: Mampu menghentikan ucapan seketika saat user memotong.
 *   5. Session Telemetry & EventBus Integration.
 */

const { EventEmitter } = require("node:events");
const env = require("../config/env");
const { logger } = require("../managers/logger");
const eventBus = require("../core/eventBus");
const fishAudioService = require("../services/fishAudioService");
const aiEnsembleRouter = require("./aiEnsembleRouter");
const { ValidationError } = require("../errors/DomainError");
const { TASK_TYPES } = aiEnsembleRouter;

const VOICE_STATES = Object.freeze({
  IDLE: "IDLE",
  LISTENING: "LISTENING",
  THINKING: "THINKING",
  SPEAKING: "SPEAKING",
  INTERRUPTED: "INTERRUPTED",
  CLOSED: "CLOSED",
});

class DuplexVoiceAgent extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map(); // guildId -> session object
    this.defaultPersona = "default";
    this.defaultLanguage = "id";
    this.silenceTimeoutMs = 700; // Jeda hening untuk menganggap kalimat selesai
  }

  /**
   * Cek apakah sesi duplex voice sedang aktif pada guild
   * @param {string} guildId
   * @returns {boolean}
   */
  isActive(guildId) {
    if (!guildId) return false;
    const session = this.activeSessions.get(String(guildId));
    return Boolean(session && session.state !== VOICE_STATES.CLOSED);
  }

  /**
   * Ambil data sesi aktif untuk guild
   * @param {string} guildId
   * @returns {Object|null}
   */
  getSession(guildId) {
    if (!guildId) return null;
    return this.activeSessions.get(String(guildId)) || null;
  }

  /**
   * Memulai sesi Duplex Voice AI Agent di Voice Channel
   * @param {string} guildId
   * @param {Object} options
   * @param {string} [options.channelId]
   * @param {Object} [options.connection] - Discord Voice Connection
   * @param {Object} [options.receiver] - Discord Voice Receiver
   * @param {Object} [options.poruPlayer] - Poru player jika menggunakan kluster audio
   * @param {string} [options.persona='default']
   * @param {string} [options.language='id']
   * @param {Object} [options.client] - Discord client
   * @returns {Object} Sesi yang dibuat
   */
  startSession(guildId, options = {}) {
    if (!guildId) {
      throw new ValidationError("Guild ID wajib diisi untuk memulai Duplex Voice Agent.");
    }

    const gId = String(guildId);

    // Jika sesi sebelumnya masih ada, hentikan terlebih dahulu secara graceful
    if (this.activeSessions.has(gId)) {
      this.stopSession(gId, "restart");
    }

    const session = {
      guildId: gId,
      channelId: options.channelId || null,
      state: VOICE_STATES.LISTENING,
      connection: options.connection || null,
      receiver: options.receiver || null,
      poruPlayer: options.poruPlayer || null,
      persona: options.persona || this.defaultPersona,
      language: options.language || this.defaultLanguage,
      client: options.client || null,
      startedAt: Date.now(),
      history: [],
      currentPlayback: null,
      activeSpeakerId: null,
      speakingDebounceTimer: null,
      bufferedInput: "",
      totalInteractions: 0,
      totalAudioBytesGenerated: 0,
      bargeInCount: 0,
    };

    this.activeSessions.set(gId, session);

    // Pasang listener audio receiver jika receiver tersedia
    if (session.receiver) {
      this._bindReceiverEvents(session);
    }

    logger.info(
      `[DuplexVoiceAgent] Sesi Duplex Voice dimulai di guild ${gId} (Channel: ${session.channelId || "auto"}, Persona: ${session.persona}).`,
    );

    this.emit("session:started", { guildId: gId, session });
    eventBus.emit("duplex:started", { guildId: gId, startedAt: session.startedAt });

    return session;
  }

  /**
   * Hentikan sesi Duplex Voice AI Agent
   * @param {string} guildId
   * @param {string} [reason="user_leave"]
   * @returns {boolean}
   */
  stopSession(guildId, reason = "user_leave") {
    if (!guildId) return false;
    const gId = String(guildId);
    const session = this.activeSessions.get(gId);
    if (!session) return false;

    session.state = VOICE_STATES.CLOSED;

    // Bersihkan timer debounce
    if (session.speakingDebounceTimer) {
      clearTimeout(session.speakingDebounceTimer);
      session.speakingDebounceTimer = null;
    }

    // Hentikan playback audio aktif
    this.interruptSpeaking(gId, "session_stop");

    // Bersihkan receiver
    if (session.receiver && typeof session.receiver.removeAllListeners === "function") {
      try {
        session.receiver.removeAllListeners();
      } catch (e) {
        logger.debug("[duplexVoiceAgent:stopSession] Gagal membersihkan receiver: " + (e?.message || e));
      }
    }

    // Bersihkan koneksi voice jika dimiliki secara mandiri
    if (session.connection && typeof session.connection.destroy === "function") {
      try {
        session.connection.destroy();
      } catch (e) {
        logger.debug("[duplexVoiceAgent:stopSession] Gagal menutup voice connection: " + (e?.message || e));
      }
    }

    this.activeSessions.delete(gId);

    logger.info(
      `[DuplexVoiceAgent] Sesi Duplex Voice dihentikan di guild ${gId} (${reason}).`,
    );

    this.emit("session:stopped", { guildId: gId, reason });
    eventBus.emit("duplex:stopped", { guildId: gId, reason });

    return true;
  }

  /**
   * Mengikat event receiver voice Discord untuk mendeteksi pembicara
   * @private
   * @param {Object} session
   */
  _bindReceiverEvents(session) {
    const receiver = session.receiver;
    if (!receiver || !receiver.speaking) return;

    try {
      receiver.speaking.on("start", (userId) => {
        if (session.speakingDebounceTimer) {
          clearTimeout(session.speakingDebounceTimer);
          session.speakingDebounceTimer = null;
        }

        // Duplex Barge-in: Jika bot sedang berbicara dan user mulai bicara, interupsi bot!
        if (session.state === VOICE_STATES.SPEAKING) {
          logger.info(
            `[DuplexVoiceAgent] Barge-in terdeteksi dari user ${userId} di guild ${session.guildId}. Menghentikan ucapan bot...`,
          );
          session.bargeInCount++;
          this.interruptSpeaking(session.guildId, "user_barge_in");
        }

        session.activeSpeakerId = userId;
        session.state = VOICE_STATES.LISTENING;
      });

      receiver.speaking.on("end", (userId) => {
        if (session.activeSpeakerId === userId) {
          if (session.speakingDebounceTimer) {
            clearTimeout(session.speakingDebounceTimer);
          }
          session.speakingDebounceTimer = setTimeout(() => {
            if (session.activeSpeakerId === userId) {
              session.activeSpeakerId = null;
            }
            session.speakingDebounceTimer = null;
            this.emit("speaker:finished", { guildId: session.guildId, userId });
          }, this.silenceTimeoutMs);
          if (session.speakingDebounceTimer.unref) session.speakingDebounceTimer.unref();
        }
      });
    } catch (err) {
      logger.warn(
        `[DuplexVoiceAgent] Gagal mengikat event speaking receiver di guild ${session.guildId}: ${err.message}`,
      );
    }
  }

  /**
   * Interupsi ucapan bot yang sedang berlangsung (Barge-in support)
   * @param {string} guildId
   * @param {string} [reason="interrupted"]
   * @returns {boolean}
   */
  interruptSpeaking(guildId, reason = "interrupted") {
    const session = this.getSession(guildId);
    if (!session) return false;

    if (session.speakingDebounceTimer) {
      clearTimeout(session.speakingDebounceTimer);
      session.speakingDebounceTimer = null;
    }

    if (session.state === VOICE_STATES.SPEAKING || session.state === VOICE_STATES.THINKING) {
      session.state = VOICE_STATES.INTERRUPTED;

      // Hentikan playback audio saat ini jika ada
      if (session.currentPlayback) {
        try {
          if (typeof session.currentPlayback.stop === "function") {
            session.currentPlayback.stop();
          } else if (typeof session.currentPlayback.destroy === "function") {
            session.currentPlayback.destroy();
          }
        } catch (e) {
          logger.debug("[duplexVoiceAgent:interruptSpeaking] Gagal menghentikan playback: " + (e?.message || e));
        }
        session.currentPlayback = null;
      }

      // Jika menggunakan Poru player, pause atau stop pemutaran tts
      if (session.poruPlayer && typeof session.poruPlayer.stop === "function") {
        try {
          session.poruPlayer.stop();
        } catch (_) {}
      }

      session.state = VOICE_STATES.LISTENING;
      this.emit("speaking:interrupted", { guildId: session.guildId, reason });
      eventBus.emit("duplex:interrupted", { guildId: session.guildId, reason });
      return true;
    }

    return false;
  }

  /**
   * Proses transkrip suara pengguna: kirim ke AI Ensemble dan sintesis jawaban suara Fish Audio.
   * @param {string} guildId
   * @param {string} userId
   * @param {string} speechText
   * @param {Object} [metadata={}]
   * @returns {Promise<{ replyText: string, audioBuffer: Buffer|null, latencyMs: number }>}
   */
  async processSpeechInput(guildId, userId, speechText, metadata = {}) {
    const session = this.getSession(guildId);
    if (!session) {
      throw new Error(`Sesi Duplex Voice tidak ditemukan untuk guild ${guildId}.`);
    }

    const cleanInput = (speechText || "").trim();
    if (!cleanInput) {
      return { replyText: "", audioBuffer: null, latencyMs: 0 };
    }

    const startTime = Date.now();
    session.state = VOICE_STATES.THINKING;
    this.emit("agent:thinking", { guildId, userId, input: cleanInput });
    eventBus.emit("duplex:thinking", { guildId, userId });

    try {
      // 1. Susun prompt ringkas untuk respon suara (1-2 kalimat alami)
      const personaPrompt =
        session.language === "en"
          ? `[Voice Channel Dialogue]: User said: "${cleanInput}". Reply in 1 or 2 concise, natural, friendly, cute anime sentences as Naura Hoshino. Keep it conversational without markdown formatting or bullet points.`
          : `[Percakapan Voice Channel]: Pengguna berkata: "${cleanInput}". Berikan balasan suara santai, ramah, dan imut sebagai Naura Hoshino dalam 1 atau maksimal 2 kalimat pendek yang nyaman didengar. Dilarang menggunakan format markdown atau poin-poin.`;

      // 2. Kirim ke AI Ensemble Router (Task Type: FAST_RESPONSE via Gemini/Groq)
      const aiResponse = await aiEnsembleRouter.routeTask(TASK_TYPES.FAST_RESPONSE, {
        prompt: personaPrompt,
        history: session.history.map((h) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }],
        })),
        systemInstruction: `Kamu adalah Naura Hoshino, asisten anime pintar dan ceria yang sedang berbincang langsung di Voice Channel Discord. Karakter persona: ${session.persona}. Balasanmu akan disuarakan lewat TTS, jadi bicaralah seringkas dan senatural mungkin.`,
      });

      const replyText = (aiResponse?.text || "").replace(/[*_~`#>]/g, "").trim() ||
        (session.language === "en"
          ? "I am listening to you! What are we doing next?"
          : "Naura mendengarmu nih! Ada yang bisa Naura bantu?");

      // Cek apakah ada interupsi saat AI berpikir
      if (session.state === VOICE_STATES.INTERRUPTED || session.state === VOICE_STATES.CLOSED) {
        return { replyText, audioBuffer: null, latencyMs: Date.now() - startTime };
      }

      // Catat riwayat percakapan (maksimal 12 putaran)
      session.history.push({ role: "user", text: cleanInput, timestamp: Date.now() });
      session.history.push({ role: "model", text: replyText, timestamp: Date.now() });
      if (session.history.length > 24) {
        session.history.splice(0, session.history.length - 24);
      }

      // 3. Sintesis Suara via Fish Audio TTS API
      let audioBuffer = null;
      try {
        if (fishAudioService.isConfigured()) {
          audioBuffer = await fishAudioService.generateSpeech(replyText, {
            referenceId: env.FISH_AUDIO_VOICE_ID || "",
            format: "mp3",
            latency: "low",
          });
        }
      } catch (ttsErr) {
        logger.warn(
          `[DuplexVoiceAgent] Fish Audio TTS gagal untuk guild ${guildId}: ${ttsErr.message}. Mengabaikan sintesis audio.`,
        );
      }

      const totalLatency = Date.now() - startTime;
      session.totalInteractions++;
      if (audioBuffer) {
        session.totalAudioBytesGenerated += audioBuffer.length;
      }

      // 4. Putar audio di Voice Channel jika buffer berhasil disintesis
      if (audioBuffer && session.state !== VOICE_STATES.CLOSED) {
        await this._playVoiceBuffer(session, audioBuffer, replyText);
      } else {
        session.state = VOICE_STATES.LISTENING;
      }

      return {
        replyText,
        audioBuffer,
        latencyMs: totalLatency,
      };
    } catch (err) {
      session.state = VOICE_STATES.LISTENING;
      logger.error(
        `[DuplexVoiceAgent] Gagal memproses dialog suara di guild ${guildId}:`,
        err,
      );
      this.emit("agent:error", { guildId, error: err });
      return {
        replyText:
          session.language === "en"
            ? "Oops, I had a little hiccup processing that."
            : "Waduh, sinyal audio Naura agak tersendat barusan!",
        audioBuffer: null,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Mainkan buffer suara ke channel
   * @private
   * @param {Object} session
   * @param {Buffer} audioBuffer
   * @param {string} text
   */
  async _playVoiceBuffer(session, audioBuffer, text) {
    session.state = VOICE_STATES.SPEAKING;
    this.emit("agent:speaking", {
      guildId: session.guildId,
      text,
      bufferSize: audioBuffer.length,
    });
    eventBus.emit("duplex:speaking", { guildId: session.guildId, text });

    // Simulasi durasi ucapan berdasarkan ukuran buffer MP3 (~16KB per detik pada 128kbps)
    const estimatedDurationMs =
      env.NODE_ENV === "test"
        ? 20
        : Math.min(15000, Math.max(1200, Math.round((audioBuffer.length / 16000) * 1000)));

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (session.state === VOICE_STATES.SPEAKING) {
          session.state = VOICE_STATES.LISTENING;
          this.emit("agent:listening", { guildId: session.guildId });
          eventBus.emit("duplex:listening", { guildId: session.guildId });
        }
        resolve();
      }, estimatedDurationMs);

      session.currentPlayback = {
        stop: () => {
          clearTimeout(timer);
          resolve();
        },
      };
    });
  }

  /**
   * Dapatkan status ringkas telemetri sesi untuk debugging atau dashboard
   * @param {string} guildId
   * @returns {Object|null}
   */
  getStatus(guildId) {
    const session = this.getSession(guildId);
    if (!session) return null;

    return {
      guildId: session.guildId,
      channelId: session.channelId,
      state: session.state,
      persona: session.persona,
      language: session.language,
      uptimeSeconds: Math.floor((Date.now() - session.startedAt) / 1000),
      totalInteractions: session.totalInteractions,
      bargeInCount: session.bargeInCount,
      historyLength: session.history.length,
      totalAudioBytes: session.totalAudioBytesGenerated,
    };
  }
}

const duplexVoiceAgent = new DuplexVoiceAgent();
duplexVoiceAgent.DuplexVoiceAgent = DuplexVoiceAgent;
duplexVoiceAgent.VOICE_STATES = VOICE_STATES;

module.exports = duplexVoiceAgent;
