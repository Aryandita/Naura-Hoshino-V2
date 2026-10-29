"use strict";

/**
 * 🐟 Fish Audio Service - TTS & Voice Cloning Integration - Naura Hoshino V2
 * ---------------------------------------------------------------------------
 * Manages Fish Audio API integration for Text-to-Speech synthesis, voice cloning,
 * and AI DJ companion features. Includes circuit breaker protection, Redis caching,
 * rate limiting, and graceful fallback handling.
 *
 * Features:
 * - Text-to-Speech synthesis via Fish Audio /v1/tts endpoint
 * - Voice cloning with custom reference models
 * - Shared Redis audio caching (24h TTL) to reduce API costs
 * - Circuit breaker pattern (CLOSED -> OPEN -> HALF_OPEN) for failover
 * - Concurrency limiting (max 2 parallel requests)
 * - Rate limiting (max 6 requests per 10-second window)
 * - Credit exhaustion detection and cooldown (HTTP 402)
 * - AI DJ companion intro generation with fallback to text
 * - Signature VIP greeting audio generation
 * - Temporary file hosting via Litterbox/Catbox for Lavalink streaming
 * - Victory announcement broadcasting to active voice channels
 *
 * @module src/services/fishAudioService
 * @example
 * const fishAudio = require('./fishAudioService');
 *
 * // Generate speech audio buffer
 * const buffer = await fishAudio.generateSpeech('Halo, selamat datang!');
 *
 * // Save to temp file for Poru/FFmpeg playback
 * const filePath = await fishAudio.saveSpeechToTemp('Audio test', { format: 'mp3' });
 *
 * // Check circuit breaker status
 * const metrics = fishAudio.circuitBreaker.getMetrics();
 * console.log(`State: ${metrics.state}, Avg Latency: ${metrics.avgLatencyMs}ms`);
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const env = require("../config/env.js");
const { logger } = require("../managers/logger.js");
const redisManager = require("../managers/redisManager.js");
const { SystemError, ExternalAPIError, ValidationError } = require("../errors/DomainError.js");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fish Audio API base URL */
const API_BASE = "https://api.fish.audio";

/** Redis cache TTL for audio buffers in seconds (24 hours) */
const CACHE_TTL_SECONDS = 86400;

/** Maximum concurrent API requests allowed */
const MAX_CONCURRENT_REQUESTS = 2;

/** Maximum requests allowed per rate limit window */
const MAX_REQUESTS_PER_WINDOW = 6;

/** Rate limit window duration in milliseconds (10 seconds) */
const RATE_LIMIT_WINDOW_MS = 10_000;

/** Circuit breaker failure threshold before opening */
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;

/** Circuit breaker cooldown period in milliseconds (60 seconds) */
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

/** Rolling latency sample size for circuit breaker metrics */
const LATENCY_SAMPLE_SIZE = 20;

/** Credit exhaustion cooldown duration in milliseconds (1 hour) */
const CREDIT_COOLDOWN_MS = 3600_000;

/** Temporary file auto-cleanup delay in milliseconds (10 minutes) */
const TEMP_FILE_CLEANUP_MS = 10 * 60 * 1000;

/** Cache key prefix for Redis audio storage */
const CACHE_KEY_PREFIX = "fish_audio:";

/** SHA256 hash length for cache keys (first 32 hex chars) */
const CACHE_HASH_LENGTH = 32;

/** Default TTS model identifier */
const DEFAULT_TTS_MODEL = "s2.1-pro-free";

/** Default audio format for TTS output */
const DEFAULT_AUDIO_FORMAT = "mp3";

/** Default latency mode for TTS requests */
const DEFAULT_LATENCY_MODE = "low";

/** Temporary directory name for TTS audio files */
const TEMP_DIR_NAME = "naura-tts-audio";

/** Litterbox Catbox API endpoint for temporary file hosting */
const LITTERBOX_API_URL = "https://litterbox.catbox.moe/resources/internals/api.php";

/** Litterbox file retention time */
const LITTERBOX_RETENTION = "1h";

// ============================================================================
// CIRCUIT BREAKER CLASS
// ============================================================================

/**
 * Circuit breaker for external API calls with rate limit detection.
 * Implements three-state pattern: CLOSED (normal) -> OPEN (fast-fail) -> HALF_OPEN (probe).
 * Tracks rolling latency metrics and request statistics for monitoring.
 */
class CircuitBreaker {
  /**
   * Create a new CircuitBreaker instance.
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.failureThreshold=3] - Failures before opening circuit
   * @param {number} [options.cooldownMs=60000] - Cooldown period before half-open probe
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    this.cooldownMs = options.cooldownMs || CIRCUIT_BREAKER_COOLDOWN_MS;
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.rollingLatencies = [];
    this.totalRequests = 0;
    this.successCount = 0;
  }

  /**
   * Check if the circuit allows requests to proceed.
   * Transitions from OPEN to HALF_OPEN when cooldown expires.
   * @returns {boolean} True if requests are allowed
   */
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
   * Record a successful request with optional latency tracking.
   * Resets failure count and transitions circuit to CLOSED state.
   * @param {number} [latencyMs] - Request latency in milliseconds
   */
  recordSuccess(latencyMs) {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.successCount++;
    this.totalRequests++;
    if (typeof latencyMs === "number" && latencyMs >= 0) {
      this.rollingLatencies.push(latencyMs);
      if (this.rollingLatencies.length > LATENCY_SAMPLE_SIZE) this.rollingLatencies.shift();
    }
  }

  /**
   * Record a failed request with rate limit detection.
   * Increments failure count and opens circuit when threshold reached or rate limited.
   * @param {Error} [error] - Error object for rate limit detection (HTTP 429)
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

  /**
   * Get current circuit breaker state.
   * @returns {string} Current state: 'CLOSED', 'OPEN', or 'HALF_OPEN'
   */
  getState() {
    return this.state;
  }

  /**
   * Get circuit breaker metrics for monitoring and diagnostics.
   * @returns {CircuitBreakerMetrics} Current metrics snapshot
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

// ============================================================================
// FISH AUDIO SERVICE CLASS
// ============================================================================

/**
 * Manages Fish Audio TTS integration with caching, rate limiting, and circuit breaker.
 * Provides speech synthesis, voice cloning, and AI DJ companion features.
 */
class FishAudioService {
  /**
   * Initialize FishAudioService with temp directory and rate limiters.
   * Creates temp directory for audio files and initializes circuit breaker.
   */
  constructor() {
    this.tempDir = path.join(os.tmpdir(), TEMP_DIR_NAME);
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch (err) {
        logger.debug("[fishAudioService:constructor] Operasi berkas/proses sistem gagal: " + (err?.message || err));
      }
    }
    this.activeRequests = 0;
    this.maxConcurrentRequests = MAX_CONCURRENT_REQUESTS;
    this.requestTimestamps = [];
    this.maxRequestsPerWindow = MAX_REQUESTS_PER_WINDOW;
    this.windowMs = RATE_LIMIT_WINDOW_MS;
    this.creditCooldownUntil = 0;
    this.creditWarningLogged = false;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
    });
  }

  /**
   * Acquire execution slot with concurrency and rate limit enforcement.
   * Throws if limits exceeded to prevent API abuse.
   * @returns {Promise<boolean>} True if slot acquired
   * @throws {ExternalAPIError} When rate limit exceeded
   * @throws {SystemError} When concurrency limit reached
   * @private
   */

  /**
   * Find local pre-generated audio file matching DJ template patterns.
   * @param {string} text - Text to match against known templates
   * @param {Object} options - Generation options
   * @returns {Buffer|null} Audio buffer if local file found, null otherwise
   * @private
   */
  _findLocalAudio(text, options) {
    try {
      const aiDjManager = require("../managers/aiDjManager");
      const genres = ["lofi", "anime", "rock", "edm", "kpop", "acoustic", "gaming", "stream", "pop_default"];
      const langs = ["id", "en"];
      
      for (const lang of langs) {
        for (const genre of genres) {
          for (let variant = 0; variant < 2; variant++) {
            const audioPath = aiDjManager.getLocalDjAudioPath(genre, lang, variant);
            if (audioPath) {
              // Check if text contains key phrases from this template
              const textLower = text.toLowerCase();
              const genreKeywords = {
                lofi: ["meredupkan", "rehat", "chill", "peaceful", "tranquility"],
                anime: ["kyaa", "gelombang anime", "jejepangan", "anime waves"],
                rock: ["whoaaa", "distorsi", "adrenalin", "seatbelts", "blazing"],
                edm: ["turn up the bass", "dentuman", "party vibes"],
                kpop: ["k-pop", "stylish", "ritmis"],
                acoustic: ["petikan", "hangat", "menyentuh", "warm", "heart-touching"],
                gaming: ["petualangan", "soundtrack epik", "adventure", "grinding"],
                stream: ["marathon", "siaran panjang", "fokus maksimal"],
                pop_default: ["halo halo", "lagu spesial", "hello hello", "special song"]
              };
              
              const keywords = genreKeywords[genre] || [];
              if (keywords.some(kw => textLower.includes(kw))) {
                logger.debug(`[FishAudio] Found local audio: ${audioPath}`);
                return fs.readFileSync(audioPath);
              }
            }
          }
        }
      }
    } catch (err) {
      logger.debug(`[FishAudio] Local audio check failed: ${err.message}`);
    }
    return null;
  }

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

  /**
   * Release execution slot after request completion.
   * Decrements active request counter safely.
   * @private
   */
  _releaseSlot() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Check if Fish Audio API credentials are configured.
   * Validates API key presence and minimum length.
   * @returns {boolean} True if API key is configured
   */
  isConfigured() {
    return Boolean(env.FISH_AUDIO_API_KEY && env.FISH_AUDIO_API_KEY.length > 5);
  }

  /**
   * Generate unique cache key for text and options combination.
   * Uses SHA256 hash for consistent, compact key format.
   * @param {string} text - Input text to synthesize
   * @param {string} [voiceId=''] - Voice reference ID
   * @param {string} [format='mp3'] - Audio output format
   * @returns {string} Redis cache key with prefix
   * @private
   */
  _getCacheKey(text, voiceId = "", format = DEFAULT_AUDIO_FORMAT) {
    const raw = `${text.trim()}|${voiceId}|${format}`;
    const hash = crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex")
      .slice(0, CACHE_HASH_LENGTH);
    return `${CACHE_KEY_PREFIX}${hash}`;
  }

  /**
   * Synthesize text to speech audio buffer via Fish Audio API.
   * Implements full pipeline: cache check -> circuit breaker -> rate limit -> API call -> cache store.
   * @param {string} text - Text to synthesize (recommended max 150 words)
   * @param {Object} [options={}] - Synthesis options
   * @param {string} [options.referenceId] - Custom voice clone reference ID
   * @param {string} [options.format='mp3'] - Output format: mp3 | wav | opus | pcm
   * @param {string} [options.latency='low'] - Latency mode: balanced | ultra-low | low
   * @returns {Promise<Buffer|null>} Audio buffer or null on failure
   * @throws {SystemError} When API key not configured
   * @throws {ExternalAPIError} When circuit open, rate limited, or credit exhausted
   * @throws {ValidationError} When text is empty or invalid
   * @example
   * const buffer = await fishAudio.generateSpeech('Hello world!', {
   *   format: 'mp3',
   *   latency: 'low'
   * });
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

    if (!this.circuitBreaker.isAvailable()) {
      throw new ExternalAPIError(
        "Suara Naura sedang istirahat, coba lagi sebentar.",
        { service: "FishAudio", circuit: this.circuitBreaker.getState() },
      );
    }

    const cleanText = text.trim();
    const voiceId = options.referenceId || env.FISH_AUDIO_VOICE_ID || "";
    const format = options.format || DEFAULT_AUDIO_FORMAT;
    const cacheKey = this._getCacheKey(cleanText, voiceId, format);


    // === LOCAL AUDIO PRIORITY ===
    // Check for pre-generated local audio before making API calls.
    // This eliminates rate limiting risk and provides zero-delay playback.
    if (options.useLocal !== false && options.genre && options.lang) {
      try {
        const aiDjManager = require('../managers/aiDjManager');
        const variant = options.variant || Math.floor(Math.random() * 2);
        const localPath = aiDjManager.getLocalDjAudioPath(options.genre, options.lang, variant);
        if (localPath) {
          const fs = require('fs');
          logger.info(`[FishAudio] Using local pre-generated audio: ${require('path').basename(localPath)}`);
          return fs.readFileSync(localPath);
        }
      } catch (localErr) {
        logger.debug(`[FishAudio] Local audio lookup failed, falling back to API: ${localErr.message}`);
      }
    }
    // === END LOCAL AUDIO PRIORITY ===


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

    try {
      await this._acquireSlot();

      try {
        const payload = {
          text: cleanText,
          format: format,
          latency: options.latency || DEFAULT_LATENCY_MODE,
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
            "model": DEFAULT_TTS_MODEL,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          if (response.status === 402) {
            this.creditCooldownUntil = Date.now() + CREDIT_COOLDOWN_MS;
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
   * Generate speech and save to temporary file for Poru/FFmpeg playback.
   * Auto-cleans temp file after 10 minutes to prevent disk accumulation.
   * @param {string} text - Text to synthesize
   * @param {Object} [options={}] - Synthesis options (see generateSpeech)
   * @returns {Promise<string|null>} Temporary file path or null on failure
   * @throws {SystemError} When file write fails
   * @example
   * const filePath = await fishAudio.saveSpeechToTemp('Welcome!', { format: 'mp3' });
   * // Use filePath with Poru player, auto-deleted after 10 minutes
   */
  async saveSpeechToTemp(text, options = {}) {
    const audioBuffer = await this.generateSpeech(text, options);

    try {
      const ext = options.format || DEFAULT_AUDIO_FORMAT;
      const tempPath = path.join(
        this.tempDir,
        `tts_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`,
      );
      fs.writeFileSync(tempPath, audioBuffer);

      setTimeout(() => {
        fs.unlink(tempPath, () => {});
      }, TEMP_FILE_CLEANUP_MS).unref();

      return tempPath;
    } catch (err) {
      logger.error(
        `[FishAudio] Gagal menyimpan file sementara: ${err.message}`,
      );
      throw new SystemError(`Gagal menyimpan file sementara: ${err.message}`, { component: "FishAudioService" });
    }
  }

  /**
   * Register audio sample for custom voice cloning at Fish Audio.
   * Creates private voice model from clean audio recording (10-30 seconds recommended).
   * @param {Buffer} audioSampleBuffer - Clean voice recording in WAV format
   * @param {string} [title='Naura Voice Clone'] - Display title for the voice model
   * @returns {Promise<string|null>} Voice model reference ID or null on failure
   * @throws {ExternalAPIError} When API call fails
   * @example
   * const modelId = await fishAudio.createVoiceClone(audioBuffer, 'Custom Naura');
   * // Use modelId as referenceId in generateSpeech options
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
   * Broadcast victory announcement to all active voice channels playing music.
   * Synthesizes alliance raid boss victory message via TTS for immersive experience.
   * @param {Object} params - Announcement parameters
   * @param {Object} [params.client] - Discord.js Client instance
   * @param {string} params.federationName - Winning alliance federation name
   * @param {string} [params.bossName='Celestial Chrono-Wyrm'] - Defeated boss name
   * @param {number} [params.phase=1] - Raid boss phase number
   * @returns {Promise<VictoryAnnouncementResult>} Broadcast result with statistics
   * @example
   * const result = await fishAudio.broadcastVictoryAnnouncement({
   *   client,
   *   federationName: 'Dragon Slayers',
   *   bossName: 'Chrono-Wyrm',
   *   phase: 2
   * });
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
   * Upload audio buffer to Litterbox/Catbox for temporary public URL access.
   * Enables Lavalink nodes to stream TTS audio without local file access.
   * @param {Buffer} audioBuffer - Audio data to upload
   * @returns {Promise<string|null>} Public URL ending in .mp3 or null on failure
   * @example
   * const url = await fishAudio.uploadToCatbox(audioBuffer);
   * // Use url with Poru player for remote streaming
   */
  async uploadToCatbox(audioBuffer) {
    if (!audioBuffer) return null;
    try {
      const blob = new globalThis.Blob([audioBuffer], { type: "audio/mpeg" });
      const fd = new globalThis.FormData();
      fd.append("reqtype", "fileupload");
      fd.append("time", LITTERBOX_RETENTION);
      fd.append("fileToUpload", blob, "naura_tts.mp3");

      logger.info("[FishAudio] Mengunggah buffer audio ke Litterbox untuk stream Lavalink...");
      const res = await fetch(LITTERBOX_API_URL, {
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
   * Generate AI DJ companion intro with TTS audio or text fallback.
   * Creates personalized track introduction using aiDjManager script generation.
   * @param {Object} params - Intro generation parameters
   * @param {string} params.trackTitle - Track title being played
   * @param {string} [params.trackAuthor='Musisi'] - Track artist name
   * @param {string} [params.requesterName='Sobat Naura'] - User who requested track
   * @param {string[]} [params.listenerNames=[]] - Active listener usernames
   * @param {string} [params.lang='id'] - Language code (id/en)
   * @returns {Promise<DjCompanionIntroResult>} Generated script and audio buffer
   * @example
   * const intro = await fishAudio.generateDjCompanionIntro({
   *   trackTitle: 'Nightcall',
   *   trackAuthor: 'Kavinsky',
   *   requesterName: 'JohnDoe'
   * });
   * if (intro.audioBuffer) {
   *   // Play audio intro before track
   * }
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
          format: DEFAULT_AUDIO_FORMAT,
          latency: DEFAULT_LATENCY_MODE,
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
   * Generate short VIP signature greeting audio (~3-5 seconds).
   * Creates personalized welcome message for premium users before track playback.
   * @param {string} displayName - User's display name
   * @param {string} trackTitle - Track being played
   * @param {Object} [options={}] - Generation options
   * @param {string} [options.lang='id'] - Language code (id/en)
   * @param {string} [options.format='mp3'] - Audio output format
   * @param {string} [options.referenceId] - Custom voice clone ID
   * @returns {Promise<SignatureGreetingResult>} Generated text and audio buffer
   * @example
   * const greeting = await fishAudio.generateSignatureGreeting('Alice', 'Bohemian Rhapsody');
   * if (greeting.audioBuffer) {
   *   // Play greeting before track starts
   * }
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
          latency: DEFAULT_LATENCY_MODE,
          format: options.format || DEFAULT_AUDIO_FORMAT,
          referenceId: options.referenceId,
        });
      } catch (err) {
        logger.warn(`[FishAudio] Gagal menghasilkan Signature Greeting audio: ${err.message}`);
      }
    }

    return { text, audioBuffer };
  }

  /**
   * Generate custom voice clone TTS with user-specific reference model.
   * Enhancement from pending_plugin/voiceCloneCompanion for personalized voices.
   * @param {string} text - Text to synthesize
   * @param {Object} [options={}] - Generation options
   * @param {string} [options.customModelId] - Custom voice model reference ID
   * @param {string} [options.userId='unknown'] - Requesting user ID for logging
   * @param {string} [options.style='default'] - Voice style preset
   * @returns {Promise<CustomVoiceCloneResult>} Generation result with audio buffer
   * @example
   * const result = await fishAudio.generateCustomVoiceClone('Hello!', {
   *   customModelId: 'abc123',
   *   userId: '123456789'
   * });
   * if (result.ok) {
   *   // Use result.audioBuffer
   * }
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
        format: DEFAULT_AUDIO_FORMAT,
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

  /**
   * Get or generate cached DJ audio for a premium user.
   * Uses display name for personalization. Caches permanently on disk.
   * 
   * @param {string} userId - Discord user ID
   * @param {string} displayName - User's current display name
   * @param {string} templateText - DJ script text with name already replaced
   * @param {object} options - TTS options (voice model, etc.)
   * @returns {Promise<Buffer|null>} Audio buffer or null on failure
   */
  async getOrGeneratePremiumAudio(userId, displayName, templateText, options = {}) {
    const premiumDir = path.join(process.cwd(), 'assets', 'audio', 'dj', 'premium');
    
    const sanitizedName = displayName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_').substring(0, 30);
    const fileName = userId + '_' + sanitizedName + '.mp3';
    const filePath = path.join(premiumDir, fileName);
    const manifestPath = path.join(premiumDir, 'manifest.json');
    
    if (!fs.existsSync(premiumDir)) {
      try {
        fs.mkdirSync(premiumDir, { recursive: true });
      } catch (err) {
        logger.warn('[FishAudio] Failed to create premium audio directory: ' + err.message);
        return null;
      }
    }
    
    let manifest = {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (e) { manifest = {}; }
    }
    
    const cachedEntry = manifest[userId];
    if (cachedEntry && cachedEntry.displayName === displayName && fs.existsSync(filePath)) {
      logger.info('[FishAudio] Using cached premium audio for ' + displayName + ' (' + userId + ')');
      try {
        return fs.readFileSync(filePath);
      } catch (err) {
        logger.warn('[FishAudio] Failed to read cached premium audio: ' + err.message);
      }
    }
    
    if (!this.isConfigured()) {
      logger.debug('[FishAudio] Cannot generate premium audio: API not configured');
      return null;
    }
    
    logger.info('[FishAudio] Generating premium audio for ' + displayName + ' (' + userId + ') - one-time generation');
    try {
      const audioBuffer = await this.generateSpeech(templateText, options);
      
      if (!audioBuffer) {
        logger.warn('[FishAudio] Premium audio generation returned null for ' + displayName);
        return null;
      }
      
      fs.writeFileSync(filePath, audioBuffer);
      
      manifest[userId] = {
        displayName: displayName,
        fileName: fileName,
        generatedAt: new Date().toISOString(),
        templateHash: crypto.createHash('md5').update(templateText).digest('hex'),
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      
      logger.info('[FishAudio] Premium audio cached: ' + fileName);
      return audioBuffer;
    } catch (err) {
      logger.error('[FishAudio] Failed to generate premium audio for ' + displayName + ': ' + err.message);
      return null;
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} CircuitBreakerMetrics
 * @property {string} state - Current state: 'CLOSED', 'OPEN', or 'HALF_OPEN'
 * @property {number} failureCount - Consecutive failures since last success
 * @property {number} totalRequests - Lifetime request count
 * @property {number} successCount - Lifetime successful requests
 * @property {number} avgLatencyMs - Average latency from rolling window
 */

/**
 * @typedef {Object} VictoryAnnouncementResult
 * @property {boolean} success - Whether operation completed
 * @property {number} broadcasted - Number of guilds notified
 * @property {string} announcementText - Generated announcement text
 * @property {boolean} hasAudio - Whether TTS audio was generated
 */

/**
 * @typedef {Object} DjCompanionIntroResult
 * @property {string} script - Generated DJ script text
 * @property {Buffer|null} audioBuffer - Synthesized audio or null if fallback
 * @property {Object} classification - Track mood/genre classification
 * @property {boolean} fallbackText - True if using text instead of audio
 */

/**
 * @typedef {Object} SignatureGreetingResult
 * @property {string} text - Generated greeting text
 * @property {Buffer|null} audioBuffer - Synthesized audio or null if unavailable
 */

/**
 * @typedef {Object} CustomVoiceCloneResult
 * @property {boolean} ok - Whether generation succeeded
 * @property {Buffer|null} audioBuffer - Synthesized audio or null
 * @property {string} promptPrepared - Prepared prompt template for debugging
 * @property {string} [reason] - Failure reason code if not ok
 * @property {boolean} readyForAiActivation - Whether ready for AI activation
 */

// ============================================================================
// GLOBAL INSTANCE & EXPORTS
// ============================================================================

/**
 * Global FishAudioService instance for application-wide TTS processing.
 * @type {FishAudioService}
 */
const fishAudioService = new FishAudioService();

// Expose class for testing and extension
fishAudioService.CircuitBreaker = CircuitBreaker;

module.exports = fishAudioService;
