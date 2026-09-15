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

const API_BASE = "https://api.fish.audio";
const CACHE_TTL_SECONDS = 86400; // 24 Jam

class FishAudioService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), "naura-tts-audio");
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch (_) {}
    }
    this.activeRequests = 0;
    this.maxConcurrentRequests = 2;
    this.requestTimestamps = [];
    this.maxRequestsPerWindow = 6;
    this.windowMs = 10_000;
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
      logger.warn(
        "[FishAudio] Rate limit TTS tercapai (maks 6 req/10s). Request dibatalkan sementara.",
      );
      return false;
    }

    if (this.activeRequests >= this.maxConcurrentRequests) {
      logger.warn(
        "[FishAudio] Concurrency limit tercapai (maks 2 paralel). Menolak request burst.",
      );
      return false;
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
      return null;
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return null;
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
    const slotAcquired = await this._acquireSlot();
    if (!slotAcquired) {
      return null;
    }

    try {
      const payload = {
        text: cleanText,
        format: format,
        latency: options.latency || "balanced",
      };

      if (voiceId) {
        payload.reference_id = voiceId;
      }

      logger.info(
        `[FishAudio] Membuat speech: "${cleanText.slice(0, 40)}..." (Voice: ${voiceId || "default"})`,
      );

      const response = await fetch(`${API_BASE}/v1/tts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.FISH_AUDIO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        logger.error(
          `[FishAudio] API Error HTTP ${response.status}: ${errBody}`,
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

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
    } catch (err) {
      logger.error(`[FishAudio] Eksepsi saat generate speech: ${err.message}`);
      return null;
    } finally {
      this._releaseSlot();
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
    if (!audioBuffer) return null;

    try {
      const ext = options.format || "mp3";
      const tempPath = path.join(
        this.tempDir,
        `tts_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`,
      );
      fs.writeFileSync(tempPath, audioBuffer);
      return tempPath;
    } catch (err) {
      logger.error(
        `[FishAudio] Gagal menyimpan file sementara: ${err.message}`,
      );
      return null;
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
        return null;
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
      return null;
    }
  }
}

module.exports = new FishAudioService();
