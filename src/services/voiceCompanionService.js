"use strict";

/**
 * @file voiceCompanionService.js
 * @description Layanan Duplex Voice Channel AI Companion untuk Naura Hoshino.
 * Mengelola sesi obrolan dua arah interaktif di voice channel bersama Naura
 * berbasis WebRTC low-latency, Voice Activity Detection (VAD), Barge-In Interruption,
 * dan Agentic Voice Tool Function Calling via functionDispatcher.
 */

const env = require("../config/env");
const { logger } = require("../managers/logger");
const fishAudioService = require("./fishAudioService");
const aiEnsembleRouter = require("../ai/aiEnsembleRouter");
const { dispatchFunction } = require("../ai/functionDispatcher");

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
   * Mengambil metrik duplex dan latensi sesi voice
   * @param {string} guildId
   * @returns {object|null}
   */
  getDuplexMetrics(guildId) {
    const session = this.getSession(guildId);
    if (!session) return null;
    return {
      guildId: session.guildId,
      channelId: session.channelId,
      status: session.status,
      isSpeaking: session.isSpeaking,
      bargeInCount: session.bargeInCount || 0,
      turnCount: session.turnCount || 0,
      latencyStats: session.latencyStats || {},
      vadMode: env.VOICE_GATEWAY_VAD || "enabled",
      maxLatencyMs: env.VOICE_MAX_LATENCY_MS || 300,
    };
  }

  /**
   * Bergabung ke voice channel untuk memulai sesi duplex voice companion
   * @param {object} params
   * @param {object} [params.client] - Discord client
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
      bargeInCount: 0,
      playbackController: null,
      latencyStats: {
        totalMs: 0,
        llmMs: 0,
        ttsMs: 0,
      },
    };

    this.activeSessions.set(guildId, session);
    logger.info(`🎙️ [VoiceCompanion] Naura bergabung ke voice channel ${channelId} di guild ${guildId}`);

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

    if (session.playbackController) {
      try {
        session.playbackController.abort();
      } catch (_) {}
    }

    this.activeSessions.delete(guildId);
    logger.info(`👋 [VoiceCompanion] Naura pamit dari voice channel ${session.channelId}`);

    return {
      success: true,
      message: "Naura telah pamit dari Voice Channel. Terima kasih sudah mengobrol bersama!",
    };
  }

  /**
   * Menangani interupsi suara pengguna saat Naura sedang berbicara (Barge-In Interruption)
   * Menghentikan audio playback seketika dan beralih ke mode LISTENING
   * @param {string} guildId
   * @param {string} [userId]
   * @returns {{aborted: boolean, bargeInCount: number, message: string}}
   */
  /**
   * Menangani interupsi suara pengguna saat Naura sedang berbicara (Barge-In Interruption)
   * Menghentikan audio playback seketika dan beralih ke mode LISTENING
   * @param {string} guildId
   * @param {string} [userId]
   * @returns {{aborted: boolean, bargeInCount: number, message: string}}
   */
  handleBargeIn(guildId, userId) {
    const session = this.activeSessions.get(guildId);
    if (!session) {
      return { aborted: false, bargeInCount: 0, message: "Sesi tidak ditemukan." };
    }

    if (session.isSpeaking) {
      if (session.playbackController) {
        try {
          session.playbackController.abort();
        } catch (_) {}
        session.playbackController = null;
      }
      session.isSpeaking = false;
      session.status = "LISTENING";
      session.bargeInCount = (session.bargeInCount || 0) + 1;
      session.interruptedAt = new Date().toISOString();

      logger.info(
        `⚡ [VoiceCompanion] Barge-in interupsi terdeteksi dari user ${userId || "unknown"} di guild ${guildId}. Audio dibatalkan.`
      );

      return {
        aborted: true,
        bargeInCount: session.bargeInCount,
        message: "Audio stream Naura berhasil dihentikan seketika karena interupsi pengguna.",
      };
    }

    return {
      aborted: false,
      bargeInCount: session.bargeInCount || 0,
      message: "Naura sedang mendengarkan, tidak ada pemutaran audio yang perlu diinterupsi.",
    };
  }

  /**
   * Alias untuk interupsi audio seketika (Barge-In)
   * @param {string} guildId
   * @param {string} [userId]
   * @returns {{aborted: boolean, bargeInCount: number, message: string}}
   */
  interruptAudio(guildId, userId) {
    return this.handleBargeIn(guildId, userId);
  }

  /**
   * Hook event deteksi aktivitas suara (Voice Activity Detection / VAD) dari Discord Gateway
   * @param {string} guildId
   * @param {string} userId
   * @param {boolean} isSpeaking
   */
  onVoiceActivity(guildId, userId, isSpeaking) {
    const session = this.activeSessions.get(guildId);
    if (!session) return;
    if (isSpeaking && session.isSpeaking) {
      this.handleBargeIn(guildId, userId);
    }
  }

  /**
   * Mendeteksi maksud tindakan in-game dari ucapan suara (Agentic Tool Calling)
   * @param {string} promptText
   * @returns {{name: string, args: object}|null}
   */
  detectToolIntent(promptText) {
    if (!promptText || typeof promptText !== "string") return null;
    const lower = promptText.toLowerCase().trim();

    if (lower.includes("saldo") || lower.includes("uang") || lower.includes("koin") || lower.includes("balance") || lower.includes("dompet")) {
      return { name: "check_balance", args: {} };
    }
    if (lower.includes("profil") || lower.includes("level saya") || lower.includes("status saya") || lower.includes("siapa saya")) {
      return { name: "get_user_info", args: {} };
    }
    if (lower.includes("tas") || lower.includes("inventory") || lower.includes("ransel") || lower.includes("isi tas")) {
      return { name: "get_inventory", args: {} };
    }
    if (lower.includes("daily") || lower.includes("klaim harian") || lower.includes("hadiah harian") || lower.includes("absen")) {
      return { name: "give_daily", args: {} };
    }
    if (lower.includes("peringkat") || lower.includes("leaderboard") || lower.includes("top server") || lower.includes("terkaya")) {
      return { name: "get_leaderboard", args: { type: "economy" } };
    }
    if (lower.includes("panen") || lower.includes("hidroponik") || lower.includes("kebun") || lower.includes("greenhouse") || lower.includes("harvest")) {
      return { name: "harvest_greenhouse", args: {} };
    }
    if (lower.includes("omikuji") || lower.includes("ramalan") || lower.includes("tarot") || lower.includes("peruntungan") || lower.includes("fortune")) {
      return { name: "check_omikuji", args: {} };
    }
    if (lower.includes("saham") || lower.includes("bursa") || lower.includes("pasar modal") || lower.includes("stock") || lower.includes("investasi")) {
      return { name: "check_stock_market", args: {} };
    }
    if (lower.includes("putar lagu") || lower.includes("mainkan lagu") || lower.includes("setel musik") || lower.includes("play lagu")) {
      const query = lower.replace(/.*(putar lagu|mainkan lagu|setel musik|play lagu)\s*/i, "").trim();
      return { name: "play_music", args: { action: "play", query: query || "lofi chill beats" } };
    }
    if (lower.includes("pause lagu") || lower.includes("jeda musik") || lower.includes("jeda lagu")) {
      return { name: "play_music", args: { action: "pause" } };
    }
    if (lower.includes("lanjutkan lagu") || lower.includes("resume lagu") || lower.includes("putar lagi")) {
      return { name: "play_music", args: { action: "resume" } };
    }
    if (lower.includes("skip lagu") || lower.includes("lewati lagu") || lower.includes("ganti lagu")) {
      return { name: "play_music", args: { action: "skip" } };
    }
    if (lower.includes("stop lagu") || lower.includes("berhenti musik") || lower.includes("matikan lagu")) {
      return { name: "play_music", args: { action: "stop" } };
    }

    return null;
  }

  /**
   * Menjalankan aksi in-game via functionDispatcher dan merangkai balasan suara alami
   * @param {object} params
   * @param {string} params.name
   * @param {object} params.args
   * @param {string} params.guildId
   * @param {string} params.userId
   * @param {string} params.username
   * @param {object} [params.client]
   * @returns {Promise<string>}
   */
  async dispatchVoiceAction({ name, args, guildId, userId, username, client }) {
    try {
      const mockMsg = {
        author: { id: userId, username },
        guild: { id: guildId },
        client: client || null,
      };

      const result = await dispatchFunction(name, args, mockMsg);
      if (result.error) {
        return `Maaf Kak ${username}, aksi tersebut tidak dapat dijalankan: ${result.error}`;
      }

      switch (name) {
        case "check_balance": {
          const sf = (result.starFragments || 0).toLocaleString("id-ID");
          const cp = (result.coupons || 0).toLocaleString("id-ID");
          const wallet = (result.economyWallet || 0).toLocaleString("id-ID");
          return `Saat ini Kak ${username} memiliki ${sf} Star Fragments, ${cp} Kupon, dan ${wallet} koin di dompet! ✨`;
        }
        case "get_user_info": {
          return `Profil Kak ${username}: Level chat ${result.chatLevel}, Level survival ${result.survivalLevel}, dan reputasi ${result.reputation}! Hebat sekali! 🌟`;
        }
        case "get_inventory": {
          const totalItems = result.totalItems || 0;
          return `Di ransel petualang Kak ${username} ada total ${totalItems} tumpukan barang. Semua tersimpan rapi! 🎒`;
        }
        case "give_daily": {
          if (result.alreadyClaimed) {
            return `Kak ${username} sudah mengambil hadiah harian hari ini. Jangan lupa kembali lagi besok ya! ✨`;
          }
          return `Selamat Kak ${username}! Hadiah harian berhasil diklaim: ditambah ${result.fragmentsGiven || 100} Star Fragments! 🎁`;
        }
        case "get_leaderboard": {
          return `Papan peringkat server saat ini sedang dipimpin oleh para petualang teratas! Semangat terus mengejar ranking ya, Kak ${username}! 🏆`;
        }
        case "harvest_greenhouse": {
          if (result.harvestedCount === 0) {
            return `Kebun hidroponik Kak ${username} belum ada tanaman yang matang. Coba cek lagi nanti ya! 🌱`;
          }
          const itemsText = result.items ? result.items.join(", ") : "hasil panen berlimpah";
          return `Hore Kak ${username}! Berhasil memanen ${result.harvestedCount} petak hidroponik: ${itemsText}! 🌾✨`;
        }
        case "check_omikuji": {
          return `Ramalan Bintang Kak ${username} hari ini: ${result.tierName}! ${result.blessing} Skor keberuntunganmu ${result.fortuneScore}/100! 🔮✨`;
        }
        case "check_stock_market": {
          const list = (result.stocks || []).map((s) => `${s.ticker} (${s.price} koin)`).join(", ");
          return `Ringkasan bursa efek Hoshino hari ini: ${list || "Seluruh sektor stabil"}. Peluang investasi yang menarik! 📈`;
        }
        case "play_music": {
          if (args.action === "pause") return "Pemutaran musik telah dijeda untuk Kakak. ⏸️";
          if (args.action === "resume") return "Musik kembali diputar! Selamat menikmati. ▶️";
          if (args.action === "skip") return "Trek lagu berhasil dilewati! ⏭️";
          if (args.action === "stop") return "Musik telah dihentikan. ⏹️";
          return `Siap Kak! Lagu "${args.query || 'pilihanmu'}" sedang disiapkan untuk dimainkan di voice channel! 🎵`;
        }
        default:
          return `Aksi ${name} berhasil dijalankan untuk Kak ${username}! ✨`;
      }
    } catch (err) {
      logger.error(`[VoiceCompanion] Gagal mengeksekusi voice action ${name}: ${err.message}`);
      return `Maaf Kak ${username}, Naura mengalami kendala saat menjalankan aksi tersebut.`;
    }
  }

  /**
   * Memproses giliran obrolan suara (Voice Turn)
   * Mendukung VAD barge-in aborting dan Agentic Tool Calling
   * @param {object} params
   * @param {string} params.guildId
   * @param {string} params.userId
   * @param {string} params.username
   * @param {string} params.promptText
   * @param {object} [params.client]
   * @param {boolean} [params.enableTools=true]
   * @returns {Promise<{replyText: string, audioReady: boolean, toolExecuted?: string, latencyMs: number, interrupted?: boolean}>}
   */
  async processVoiceTurn({ guildId, userId, username, promptText, client, enableTools = true }) {
    const startTime = Date.now();
    const session = this.activeSessions.get(guildId);
    if (session) {
      session.turnCount = (session.turnCount || 0) + 1;
      session.isSpeaking = true;
      session.status = "SPEAKING";
      session.playbackController = new AbortController();
    }

    try {
      let replyText = "";
      let toolExecuted = null;

      // 1. Periksa apakah pengguna menghendaki eksekusi tindakan in-game (Agentic Function Calling)
      const toolIntent = enableTools ? this.detectToolIntent(promptText) : null;
      if (toolIntent) {
        toolExecuted = toolIntent.name;
        replyText = await this.dispatchVoiceAction({
          name: toolIntent.name,
          args: toolIntent.args,
          guildId,
          userId,
          username,
          client,
        });
      } else {
        // 2. Dapatkan respons teks cerdas via AI Ensemble Router
        const systemPrompt =
          "Kamu adalah Naura Hoshino, AI companion anime yang ceria, manis, dan ramah. Berbicaralah santai, ekspresif, dan alami dalam 1-3 kalimat singkat untuk obrolan suara Discord. Dilarang menggunakan simbol em-dash.";
        const aiResponse = await aiEnsembleRouter.routeTask({
          taskType: "FAST_RESPONSE",
          prompt: promptText,
          systemInstruction: systemPrompt,
          metadata: { userId, username, mode: "voice_companion" },
        });

        replyText =
          aiResponse && aiResponse.text
            ? aiResponse.text.replace(/[\u2014\u2013]/g, "-").trim()
            : `Naura mendengarmu dengan jelas, Kak ${username}! ✨`;
      }

      // Cek apakah terjadi interupsi barge-in sebelum sintesis audio
      if (session && session.playbackController?.signal?.aborted) {
        return {
          replyText,
          audioReady: false,
          toolExecuted,
          latencyMs: Date.now() - startTime,
          interrupted: true,
        };
      }

      // 3. Sintesis audio balasan via Fish Audio TTS (WebRTC low-latency mode)
      const audioBuffer = await fishAudioService.generateSpeech(replyText, {
        latency: "ultra-low",
      });

      const totalLatency = Date.now() - startTime;
      if (session) {
        session.isSpeaking = false;
        session.status = "LISTENING";
        session.playbackController = null;
        session.latencyStats = {
          totalMs: totalLatency,
          lastTurnAt: new Date().toISOString(),
        };
      }

      return {
        replyText,
        audioReady: Boolean(audioBuffer),
        toolExecuted,
        latencyMs: totalLatency,
        interrupted: false,
      };
    } catch (err) {
      logger.error(`[VoiceCompanion] Gagal memproses voice turn: ${err.message}`);
      if (session) {
        session.isSpeaking = false;
        session.status = "LISTENING";
        session.playbackController = null;
      }
      return {
        replyText: "Maaf, suara Naura sempat terputus sebentar. Bisa diulangi lagi?",
        audioReady: false,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

module.exports = new VoiceCompanionService();
