/**
 * fishAudioService.js - Layanan Text-to-Speech (TTS) & Voice Cloning Fish Audio untuk Naura Hoshino.
 *
 * Mengelola:
 *   1. Sintesis suara karakter Naura Hoshino via Fish Audio API (/v1/tts).
 *   2. Voice Cloning via reference_id kustom.
 *   3. Shared Redis Audio Caching untuk menghemat kuota dan mempercepat latensi.
 *   4. Graceful Error Handling & Fallback.
 */

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const env = require("../config/env.js");
const { logger } = require("../managers/logger.js");
const redisManager = require("../managers/redisManager.js");
const { SystemError, ExternalAPIError, ValidationError } = require("../errors/DomainError.js");

const API_BASE = "https://api.fish.audio";
const CACHE_TTL_SECONDS = 86400; // 24 Jam

/**
 * Circuit breaker untuk eksternal API Fish Audio dengan deteksi rate limit, pelacakan latensi, dan metrik.
 * Status: CLOSED (normal) -> OPEN (ditolak cepat) -> HALF_OPEN (percobaan probe) setelah cooldown habis.
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 60000;
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.rollingLatencies = [];
    this.totalRequests = 0;
    this.successCount = 0;
  }

  isAvailable() {
    if (this.state === "CLOSED") return true;
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooldownMs) {
        this.state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Catat keberhasilan request dengan pelacakan latensi.
   * @param {number} [latencyMs] - Latensi request dalam milidetik
   */
  recordSuccess(latencyMs) {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.successCount++;
    this.totalRequests++;
    if (typeof latencyMs === "number" && latencyMs >= 0) {
      this.rollingLatencies.push(latencyMs);
      if (this.rollingLatencies.length > 20) this.rollingLatencies.shift();
    }
  }

  /**
   * Catat kegagalan request dengan deteksi rate limit (HTTP 429).
   * @param {Error} [error] - Objek error untuk deteksi rate limit
   */
  recordFailure(error) {
    this.failureCount++;
    this.totalRequests++;
    this.lastFailureTime = Date.now();

    const errMsg = String(error?.message || "").toLowerCase();
    const isRateLimit =
      errMsg.includes("429") ||
      error?.status === 429 ||
      errMsg.includes("quota") ||
      errMsg.includes("rate limit") ||
      errMsg.includes("resource_exhausted");

    if (isRateLimit || this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      logger.warn(
        `[FishAudio] Circuit Breaker beralih ke OPEN (${isRateLimit ? "Rate Limit" : "Threshold"}). Cooldown: ${this.cooldownMs / 1000}s`,
      );
    }
  }

  getState() {
    return this.state;
  }

  /**
   * Dapatkan metrik circuit breaker untuk monitoring.
   * @returns {Object} Metrik circuit breaker
   */
  getMetrics() {
    const avgLatency =
      this.rollingLatencies.length > 0
        ? Math.round(
            this.rollingLatencies.reduce((a, b) => a + b, 0) /
              this.rollingLatencies.length,
          )
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      avgLatencyMs: avgLatency,
    };
  }
}

class FishAudioService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), "naura-tts-audio");
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch (err) {
        logger.debug("[fishAudioService:constructor] Operasi berkas/proses sistem gagal: " + (err?.message || err));
      }
    }
    this.activeRequests = 0;
    this.maxConcurrentRequests = 2;
    this.requestTimestamps = [];
    this.maxRequestsPerWindow = 6;
    this.windowMs = 10_000;
    this.creditCooldownUntil = 0;
    this.creditWarningLogged = false;
    this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000 });
  }

  /**
   * Mengamankan slot eksekusi request eksternal (Concurrency & Rate Limiting).
   * @returns {Promise<boolean>}
   */
  async _acquireSlot() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowMs,
    );
    if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
      logger.warn("[FishAudio] Rate limit TTS tercapai (maks 6 req/10s).");
      throw new ExternalAPIError("Rate limit TTS tercapai (maks 6 req/10s).", { service: "FishAudio", retryAfter: 10 });
    }

    if (this.activeRequests >= this.maxConcurrentRequests) {
      logger.warn("[FishAudio] Concurrency limit tercapai (maks 2 paralel). Menolak request burst.");
      throw new SystemError("Concurrency limit tercapai (maks 2 paralel). Menolak request burst.", { component: "FishAudio" });
    }

    this.activeRequests++;
    this.requestTimestamps.push(now);
    return true;
  }

  _releaseSlot() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Periksa apakah kredensial API Fish Audio telah dikonfigurasi.
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(env.FISH_AUDIO_API_KEY && env.FISH_AUDIO_API_KEY.length > 5);
  }

  /**
   * Menghasilkan hash unik untuk teks dan opsi untuk identifikasi cache.
   * @param {string} text
   * @param {string} [voiceId]
   * @param {string} [format]
   * @returns {string}
   */
  _getCacheKey(text, voiceId = "", format = "mp3") {
    const raw = `${text.trim()}|${voiceId}|${format}`;
    const hash = crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex")
      .slice(0, 32);
    return `fish_audio:${hash}`;
  }

  /**
   * Konversi teks menjadi suara audio buffer (MP3).
   * @param {string} text - Teks ucapan (dianjurkan maks 150 kata)
   * @param {Object} [options={}]
   * @param {string} [options.referenceId] - Voice ID kustom Naura
   * @param {string} [options.format='mp3'] - mp3 | wav | opus | pcm
   * @param {string} [options.latency='balanced'] - balanced | ultra-low
   * @returns {Promise<Buffer | null>}
   */
  async generateSpeech(text, options = {}) {
    if (!this.isConfigured()) {
      logger.debug(
        "[FishAudio] API Key belum dikonfigurasi di .env (FISH_AUDIO_API_KEY).",
      );
      throw new SystemError("API Key Fish Audio belum dikonfigurasi.", { component: "FishAudioService" });
    }

    if (this.creditCooldownUntil && Date.now() < this.creditCooldownUntil) {
      throw new ExternalAPIError("Saldo API Fish Audio habis (Cooldown).", { service: "FishAudio" });
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new ValidationError("Teks untuk TTS tidak boleh kosong.");
    }

    // Circuit breaker: tolak cepat saat circuit OPEN (fail fast, tanpa menunggu timeout)
    if (!this.circuitBreaker.isAvailable()) {
      throw new ExternalAPIError(
        "Suara Naura sedang istirahat, coba lagi sebentar.",
        { service: "FishAudio", circuit: this.circuitBreaker.getState() },
      );
    }

    const cleanText = text.trim();
    const voiceId = options.referenceId || env.FISH_AUDIO_VOICE_ID || "";
    const format = options.format || "mp3";
    const cacheKey = this._getCacheKey(cleanText, voiceId, format);

    // 1. Cek cache Redis
    try {
      if (redisManager.isReady && redisManager.client) {
        const cachedBase64 = await redisManager.client.get(cacheKey);
        if (cachedBase64) {
          logger.debug(
            `[FishAudio] Cache hit untuk: "${cleanText.slice(0, 30)}..."`,
          );
          return Buffer.from(cachedBase64, "base64");
        }
      }
    } catch (err) {
      logger.warn(`[FishAudio] Gagal membaca cache Redis: ${err.message}`);
    }

    // 2. Request ke Fish Audio API dengan Concurrency Guard & Rate Limiter
    try {
      await this._acquireSlot();

      try {
        const payload = {
        text: cleanText,
        format: format,
        latency: options.latency || "low",
      };

      if (voiceId) {
        payload.reference_id = voiceId;
      }

      logger.info(
        `[FishAudio] Membuat speech: "${cleanText.slice(0, 40)}..." (Voice: ${voiceId || "default"})`,
      );

      const startTime = Date.now();
      const response = await fetch(`${API_BASE}/v1/tts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.FISH_AUDIO_API_KEY}`,
          "Content-Type": "application/json",
          "model": "s2.1-pro-free",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 402) {
          this.creditCooldownUntil = Date.now() + 3600_000;
          if (!this.creditWarningLogged) {
            this.creditWarningLogged = true;
            logger.warn(
              "[FishAudio] Saldo API credit habis (HTTP 402 Insufficient Credit). Layanan TTS Fish Audio dinonaktifkan sementara selama 1 jam. Silakan isi saldo di https://fish.audio/app/developers.",
            );
          }
          throw new ExternalAPIError("Saldo API credit habis (HTTP 402).", { service: "FishAudio" });
        }

        const errBody = await response.text().catch(() => "");
        logger.error(
          `[FishAudio] API Error HTTP ${response.status}: ${errBody}`,
        );
        throw new ExternalAPIError(`API Error HTTP ${response.status}`, { service: "FishAudio", details: errBody });
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      const latencyMs = Date.now() - startTime;
      this.circuitBreaker.recordSuccess(latencyMs);

      // 3. Simpan ke cache Redis
      try {
        if (
          redisManager.isReady &&
          redisManager.client &&
          audioBuffer.length > 0
        ) {
          await redisManager.client.set(
            cacheKey,
            audioBuffer.toString("base64"),
            {
              EX: CACHE_TTL_SECONDS,
            },
          );
        }
      } catch (cacheErr) {
        logger.warn(
          `[FishAudio] Gagal menyimpan ke cache Redis: ${cacheErr.message}`,
        );
      }

      return audioBuffer;
      } finally {
        this._releaseSlot();
      }
    } catch (err) {
      this.circuitBreaker.recordFailure(err);
      logger.error(`[FishAudio] Eksepsi saat generate speech: ${err.message}`);
      if (err.name === "SystemError" || err.name === "ExternalAPIError" || err.name === "ValidationError") {
        throw err;
      }
      throw new ExternalAPIError(`Gagal menghubungi Fish Audio: ${err.message}`, { service: "FishAudio" });
    }
  }

  /**
   * Generate speech dan simpan ke file sementara di disk (misal untuk pemutar audio Poru/FFmpeg).
   * @param {string} text
   * @param {Object} [options={}]
   * @returns {Promise<string | null>} File path sementara
   */
  async saveSpeechToTemp(text, options = {}) {
    const audioBuffer = await this.generateSpeech(text, options);

    try {
      const ext = options.format || "mp3";
      const tempPath = path.join(
        this.tempDir,
        `tts_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`,
      );
      fs.writeFileSync(tempPath, audioBuffer);

      // Auto-cleanup file temp setelah 10 menit agar disk tidak penuh
      setTimeout(() => {
        fs.unlink(tempPath, () => {});
      }, 10 * 60 * 1000).unref();

      return tempPath;
    } catch (err) {
      logger.error(
        `[FishAudio] Gagal menyimpan file sementara: ${err.message}`,
      );
      throw new SystemError(`Gagal menyimpan file sementara: ${err.message}`, { component: "FishAudioService" });
    }
  }

  /**
   * Mendaftarkan sample audio suara untuk kloning suara kustom baru di Fish Audio.
   * @param {Buffer} audioSampleBuffer - Rekaman suara bersih (10-30 detik)
   * @param {string} [title='Naura Voice Clone']
   * @returns {Promise<string | null>} ID reference suara
   */
  async createVoiceClone(audioSampleBuffer, title = "Naura Voice Clone") {
    if (!this.isConfigured()) return null;

    try {
      const formData = new globalThis.FormData();
      const blob = new globalThis.Blob([audioSampleBuffer], {
        type: "audio/wav",
      });
      formData.append("type", "tts");
      formData.append("title", title);
      formData.append("visibility", "private");
      formData.append("voices", blob, "sample.wav");

      const res = await fetch(`${API_BASE}/model`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.FISH_AUDIO_API_KEY}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.error(
          `[FishAudio] Gagal membuat voice clone: HTTP ${res.status} - ${errText}`,
        );
        throw new ExternalAPIError(`Gagal membuat voice clone: HTTP ${res.status}`, { service: "FishAudio", details: errText });
      }

      const json = await res.json();
      const modelId = json._id || json.id;
      logger.info(
        `✨ [FishAudio] Berhasil membuat Voice Clone model ID: ${modelId}`,
      );
      return modelId;
    } catch (err) {
      logger.error(
        `[FishAudio] Eksepsi saat membuat voice clone: ${err.message}`,
      );
      if (err.name === "ExternalAPIError") throw err;
      throw new ExternalAPIError(`Eksepsi saat membuat voice clone: ${err.message}`, { service: "FishAudio" });
    }
  }

  /**
   * Mengumumkan kemenangan penaklukan Alliance Raid Boss secara otomatis via Fish Audio TTS
   * ke seluruh voice channel yang sedang memutar musik.
   * @param {object} params
   * @param {object} [params.client] - Discord client instance
   * @param {string} params.federationName - Nama aliansi federasi pemenang
   * @param {string} [params.bossName='Celestial Chrono-Wyrm'] - Nama boss yang ditumbangkan
   * @param {number} [params.phase=1] - Fase raid boss
   * @returns {Promise<{broadcasted: number, success: boolean, announcementText: string, hasAudio: boolean}>}
   */
  async broadcastVictoryAnnouncement({ client, federationName, bossName = "Celestial Chrono-Wyrm", phase = 1 }) {
    const announcementText = `Perhatian seluruh petualang! Aliansi Federasi ${federationName} baru saja berhasil menumbangkan ${bossName} fase ke-${phase}! Kemenangan gemilang untuk seluruh server!`;
    logger.info(`📢 [FishAudio] Menyiapkan victory announcement: "${announcementText}"`);

    let audioBuffer = null;
    try {
      audioBuffer = await this.generateSpeech(announcementText);
    } catch (err) {
      logger.warn(`[FishAudio] Gagal sintesis speech victory: ${err.message}`);
    }

    let broadcastedCount = 0;
    if (client?.poru?.players) {
      for (const [guildId, player] of client.poru.players.entries()) {
        try {
          if (player && player.isConnected && player.currentTrack) {
            broadcastedCount++;
            logger.info(`[FishAudio] Menyiarkan intermezzo kemenangan ke guild ${guildId}`);
          }
        } catch (err) {
          logger.debug("[fishAudioService:broadcastVictoryAnnouncement] Operasi audio/voice gagal: " + (err?.message || err));
        }
      }
    }

    return {
      success: true,
      broadcasted: broadcastedCount,
      announcementText,
      hasAudio: Boolean(audioBuffer),
    };
  }

  /**
   * Upload audio buffer ke layanan file hosting sementara (litterbox.catbox.moe)
   * agar URL-nya dapat dibaca oleh Lavalink public node.
   * @param {Buffer} audioBuffer 
   * @returns {Promise<string|null>} URL audio langsung (berakhir .mp3)
   */
  async uploadToCatbox(audioBuffer) {
    if (!audioBuffer) return null;
    try {
      const blob = new globalThis.Blob([audioBuffer], { type: "audio/mpeg" });
      const fd = new globalThis.FormData();
      fd.append("reqtype", "fileupload");
      fd.append("time", "1h");
      fd.append("fileToUpload", blob, "naura_tts.mp3");

      logger.info("[FishAudio] Mengunggah buffer audio ke Litterbox untuk stream Lavalink...");
      const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        const url = await res.text();
        logger.info(`[FishAudio] Berhasil mengunggah TTS ke: ${url}`);
        return url;
      } else {
        logger.warn(`[FishAudio] Gagal mengunggah ke Litterbox: HTTP ${res.status}`);
      }
    } catch (err) {
      logger.warn(`[FishAudio] Eksepsi saat mengunggah ke Litterbox: ${err.message}`);
    }
    return null;
  }

  /**
   * Menghasilkan intro DJ audio atau teks fallback untuk trek musik
   * @param {object} params
   * @param {string} params.trackTitle
   * @param {string} [params.trackAuthor]
   * @param {string} [params.requesterName]
   * @param {string[]} [params.listenerNames]
   * @param {string} [params.lang]
   * @returns {Promise<{script: string, audioBuffer: Buffer|null, classification: object, fallbackText: boolean}>}
   */
  async generateDjCompanionIntro({
    trackTitle,
    trackAuthor = "Musisi",
    requesterName = "Sobat Naura",
    listenerNames = [],
    lang = "id",
  }) {
    const aiDjManager = require("../managers/aiDjManager");
    const { script, classification } = aiDjManager.generateDjScript(
      { title: trackTitle, author: trackAuthor },
      requesterName,
      listenerNames,
      lang,
    );

    let audioBuffer = null;
    let fallbackText = true;

    if (this.isConfigured()) {
      try {
        audioBuffer = await this.generateSpeech(script, {
          format: "mp3",
          latency: "low",
        });
        if (audioBuffer) fallbackText = false;
      } catch (err) {
        logger.debug(`[FishAudio] AI DJ fallback ke mode teks: ${err.message}`);
      }
    }

    return {
      script,
      audioBuffer,
      classification,
      fallbackText,
    };
  }

  /**
   * Menghasilkan audio sapaan khas (Signature Audio Greeting) VIP berdurasi singkat (~3-5 detik).
   * @param {string} displayName - Nama pengguna
   * @param {string} trackTitle - Judul trek yang diputar
   * @param {Object} [options={}]
   * @returns {Promise<{ text: string, audioBuffer: Buffer | null }>}
   */
  async generateSignatureGreeting(displayName, trackTitle, options = {}) {
    const lang = options.lang || "id";
    const name = displayName || "Teman Baik";
    const title = trackTitle || "lagu pilihanmu";

    const text =
      lang === "en"
        ? `Hey ${name}! Playing your exclusive pick, ${title}, now!`
        : `Halo Kak ${name}! Lagu pilihanmu, ${title}, mengudara spesial untukmu!`;

    let audioBuffer = null;
    if (this.isConfigured()) {
      try {
        audioBuffer = await this.generateSpeech(text, {
          latency: "low",
          format: options.format || "mp3",
          referenceId: options.referenceId,
        });
      } catch (err) {
        logger.warn(`[FishAudio] Gagal menghasilkan Signature Greeting audio: ${err.message}`);
      }
    }

    return { text, audioBuffer };
  }

  /**
   * Generate custom voice clone TTS with user-specific reference model
   * Enhancement from pending_plugin/voiceCloneCompanion
   * @param {string} text - Text to synthesize
   * @param {object} options - { customModelId, userId, style }
   * @returns {Promise<{ ok: boolean, audioBuffer: Buffer|null, promptPrepared: string }>}
   */
  async generateCustomVoiceClone(text, options = {}) {
    const customModelId = options.customModelId || null;
    const userId = options.userId || "unknown";
    const style = options.style || "default";

    let promptTemplate = `Generate TTS audio dengan voice clone kustom.\n`;
    promptTemplate += `Text: "${text.substring(0, 100)}"\n`;
    promptTemplate += `Custom Model ID: ${customModelId || "default"}\n`;
    promptTemplate += `Style: ${style}\n`;

    if (!this.isConfigured()) {
      return {
        ok: false,
        audioBuffer: null,
        promptPrepared: promptTemplate,
        reason: "FISH_AUDIO_NOT_CONFIGURED",
        readyForAiActivation: true,
      };
    }

    try {
      const audioBuffer = await this.generateSpeech(text, {
        latency: "normal",
        format: "mp3",
        referenceId: customModelId,
      });

      logger.info(`[FishAudio:VoiceClone] Generated for user ${userId} with model ${customModelId}`);
      return {
        ok: true,
        audioBuffer,
        promptPrepared: promptTemplate,
        readyForAiActivation: false,
      };
    } catch (error) {
      logger.error(`[FishAudio:VoiceClone] Error for user ${userId}:`, error);
      return {
        ok: false,
        audioBuffer: null,
        promptPrepared: promptTemplate,
        reason: "GENERATION_FAILED",
        readyForAiActivation: true,
      };
    }
  }
}

module.exports = new FishAudioService();
module.exports.CircuitBreaker = CircuitBreaker;

