"use strict";

/**
 * @module aiEnsembleRouter
 * @description Cross-Model Ensemble Router and Living AI Gateway untuk Naura Hoshino V2.
 *
 * ## Architecture Overview
 * Modul ini merupakan gateway sentral yang mengatur rute pemanggilan model AI secara cerdas
 * berdasarkan tipe tugas (Task Type). Sistem menggunakan arsitektur ensemble dengan tiga
 * provider AI utama yang memiliki spesialisasi berbeda:
 *
 * 1. **Gemini (Google GenAI)**: Unggul untuk chat umum, analisis multimodal (gambar/vision),
 *    dan konteks besar. Model default: gemini-2.5-flash.
 * 2. **Groq (LLaMA 3.3 70B)**: Unggul untuk penalaran taktis cepat (~250 token/detik),
 *    persidangan tribunal, dan opsi cerita RPG. Memiliki failover model bertingkat.
 * 3. **Ollama / Fallback**: Penyelamat darurat saat terjadi pemadaman koneksi cloud.
 *    Berjalan lokal dengan timeout 4 detik.
 *
 * ## Key Features
 * - Task-based intelligent routing dengan prioritas provider per tipe tugas
 * - Circuit Breaker pattern per provider (CLOSED -> OPEN -> HALF_OPEN) untuk failover otomatis
 * - HTTP 429 / rate limit detection dengan cooldown 60 detik
 * - Persona system dengan 5 karakter AI (default, tsundere, kuudere, gamer, butler)
 * - User quota management berbasis Redis dengan fallback in-memory
 * - VIP tier-aware quota (unlimited untuk Owner dan VIP Tier 2+)
 * - Groq model cascade failover (70B -> 8B -> 1B)
 * - Telemetry metrics untuk Web Dashboard monitoring
 * - Graceful degradation ke i18n fallback saat semua provider gagal
 * - Dual API signature: routeTask(taskType, payload) dan routeTask(options)
 *
 * ## Integration Points
 * - geminiClient - Google Gemini API client
 * - config/env - Environment configuration (API keys, models)
 * - managers/cacheManager - User profile dan premium tier lookup
 * - managers/redisManager - Quota tracking dan caching
 * - managers/languageManager - i18n fallback responses
 * - adapters/aiBoundaryAdapter - Response normalization
 * - errors/DomainError - Structured error types
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const env = require("../config/env");
const { logger } = require("../managers/logger");
const { normalizeAiResponse } = require("../adapters/aiBoundaryAdapter");
const geminiClient = require("./geminiClient");
const { SystemError, ExternalAPIError, DomainError } = require("../errors/DomainError");
const languageManager = require("../managers/languageManager");

/**
 * Enum kategori tugas AI yang menentukan prioritas routing provider.
 * Setiap task type dipetakan ke urutan provider preferensi di DEFAULT_ROUTING_MAP.
 * @readonly
 * @enum {string}
 */
const TASK_TYPES = Object.freeze({
  GENERAL_CHAT: "GENERAL_CHAT",
  GENERAL_CONVERSATION: "GENERAL_CONVERSATION",
  FAST_RESPONSE: "FAST_RESPONSE",
  TACTICAL_REASONING: "TACTICAL_REASONING",
  TRIBUNAL_VERDICT: "TRIBUNAL_VERDICT",
  ROLEPLAY_STORY: "ROLEPLAY_STORY",
  CODE_LOGIC: "CODE_LOGIC",
  VISION_MULTIMODAL: "VISION_MULTIMODAL",
  OFFLINE_FALLBACK: "OFFLINE_FALLBACK",
});

/**
 * Peta routing default: setiap task type memiliki urutan prioritas provider.
 * Provider pertama adalah preferensi utama, berikutnya adalah failover.
 * @type {Object<string, string[]>}
 */
const DEFAULT_ROUTING_MAP = {
  [TASK_TYPES.GENERAL_CHAT]: ["gemini", "groq", "ollama"],
  [TASK_TYPES.GENERAL_CONVERSATION]: ["gemini", "groq", "ollama"],
  [TASK_TYPES.FAST_RESPONSE]: ["gemini", "groq", "ollama"],
  [TASK_TYPES.TACTICAL_REASONING]: ["groq", "gemini", "ollama"],
  [TASK_TYPES.TRIBUNAL_VERDICT]: ["groq", "gemini", "ollama"],
  [TASK_TYPES.ROLEPLAY_STORY]: ["groq", "gemini", "ollama"],
  [TASK_TYPES.CODE_LOGIC]: ["groq", "gemini", "ollama"],
  [TASK_TYPES.VISION_MULTIMODAL]: ["gemini"],
  [TASK_TYPES.OFFLINE_FALLBACK]: ["ollama", "groq", "gemini"],
};

/**
 * Definisi persona AI yang tersedia untuk modifikasi gaya bicara Naura.
 * Setiap persona memiliki prompt modifier yang disuntikkan ke system instruction.
 * @readonly
 * @type {Object<string, {key: string, name: string, description: string, promptModifier: string}>}
 */
const PERSONAS = Object.freeze({
  default: {
    key: "default",
    name: "Naura Standar",
    description: "Karakter asli Naura Hoshino yang ramah, enerjik, dan ceria.",
    promptModifier: "Gunakan persona standar Naura Hoshino: gadis anime ceria, ramah, dan selalu siap membantu.",
  },
  tsundere: {
    key: "tsundere",
    name: "Tsundere Naura",
    description: "Pura-pura jutek dan ketus, padahal sangat perhatian dan peduli.",
    promptModifier: "Gaya bicara Tsundere: pura-pura kesal, ketus, suka bilang 'B-Bukan karena aku peduli padamu ya!' atau 'Hmph!', tapi di balik itu sebenarnya sangat perhatian.",
  },
  kuudere: {
    key: "kuudere",
    name: "Kuudere Naura",
    description: "Tenang, dingin, logis, minim ekspresi namun setia mendampingi.",
    promptModifier: "Gaya bicara Kuudere: tenang, datar, minim kata-kata berbunga, efisien, logis, namun menunjukkan kepedulian yang halus dan setia.",
  },
  gamer: {
    key: "gamer",
    name: "Gamer Naura",
    description: "Penuh semangat gaming, istilah GG, grinding, meta, dan kompetitif.",
    promptModifier: "Gaya bicara Pro Gamer: penuh semangat kompetitif, gunakan istilah gaming (GG, clutch, noob, meta, grinding, nerf/buff, carry) secara alami.",
  },
  butler: {
    key: "butler",
    name: "Royal Butler Naura",
    description: "Sopan, formal, elegan, dan melayani dengan dedikasi tinggi ala pelayan istana.",
    promptModifier: "Gaya bicara Pelayan Kerajaan (Butler): sopan, sangat formal, panggil lawan bicara dengan 'Tuan' atau 'Nyonya', tulus dan mengutamakan kenyamanan pengguna.",
  },
});

// ============================================================================
// CLASS: CircuitBreaker
// ============================================================================

/**
 * Implementasi Circuit Breaker pattern untuk proteksi failover provider AI.
 *
 * State machine:
 * - CLOSED: Normal operasi, request diteruskan. Failure dihitung.
 * - OPEN: Provider dianggap down, request ditolak sampai cooldown berakhir.
 * - HALF_OPEN: Cooldown berakhir, request percobaan diperbolehkan untuk menguji pemulihan.
 *
 * Trigger transisi ke OPEN:
 * - HTTP 429 / rate limit / quota exhausted (langsung OPEN)
 * - Failure count mencapai failureThreshold (default 3)
 */
class CircuitBreaker {
  /**
   * @param {string} name - Nama provider (gemini, groq, ollama)
   * @param {Object} [options]
   * @param {number} [options.failureThreshold=3] - Jumlah kegagalan sebelum circuit terbuka
   * @param {number} [options.cooldownMs=60000] - Durasi cooldown dalam milidetik
   */
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 60000; // 60 detik cooldown
    this.state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.rollingLatencies = [];
    this.totalRequests = 0;
    this.successCount = 0;
  }

  /**
   * Memeriksa apakah provider tersedia untuk menerima request.
   * Mengelola transisi state OPEN -> HALF_OPEN berdasarkan cooldown.
   * @returns {boolean} True jika provider boleh menerima request
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
    return true; // HALF_OPEN
  }

  /**
   * Mencatat keberhasilan request dan mereset failure counter.
   * Menyimpan latency untuk perhitungan metrik rata-rata (rolling window 20).
   * @param {number} latencyMs - Waktu respons dalam milidetik
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
   * Mencatat kegagalan request. Memicu transisi ke OPEN jika rate limit atau threshold tercapai.
   * @param {Error} error - Error yang terjadi
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

    // Jika terkena batas kuota atau melebihi ambang batas kegagalan, buka circuit breaker
    if (isRateLimit || this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      logger.warn(
        `[AiEnsembleRouter] Circuit Breaker untuk ${this.name} beralih ke OPEN (${isRateLimit ? "Rate Limit" : "Threshold"}). Cooldown: ${this.cooldownMs / 1000}s`,
      );
    }
  }

  /**
   * Mengembalikan metrik performa provider untuk telemetri dashboard.
   * @returns {{name: string, state: string, failureCount: number, totalRequests: number, successCount: number, avgLatencyMs: number}}
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
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      avgLatencyMs: avgLatency,
    };
  }

  /** Reset circuit breaker ke kondisi awal (untuk unit test). */
  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.rollingLatencies = [];
  }
}

// ============================================================================
// CLASS: AiEnsembleRouter
// ============================================================================

/**
 * Router utama yang mengorkestrasi pemanggilan AI multi-provider dengan failover bertingkat.
 * Singleton instance diekspor sebagai default export modul ini.
 */
class AiEnsembleRouter {
  constructor() {
    this.routingMap = { ...DEFAULT_ROUTING_MAP };
    this.breakers = {
      gemini: new CircuitBreaker("gemini"),
      groq: new CircuitBreaker("groq"),
      ollama: new CircuitBreaker("ollama"),
    };
  }

  /**
   * Cek apakah konfigurasi API provider tersedia di environment
   * @param {string} provider
   * @returns {boolean}
   */
  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  isProviderConfigured(provider) {
    switch (provider) {
      case "gemini":
        return Boolean(env.GEMINI_API);
      case "groq":
        return Boolean(env.GROQ_API_KEY);
      case "ollama":
        return Boolean(env.OLLAMA_ENABLED && env.OLLAMA_BASE_URL);
      default:
        return false;
    }
  }

  /**
   * Wrapper cerdas untuk pemanggilan tugas AI yang fleksibel
   * Mendukung pemanggilan routeTask(taskType, payload) dan routeTask(options)
   * @param {string|Object} taskTypeOrOptions
   * @param {Object} [payload]
   * @returns {Promise<{ text: string, provider: string, latencyMs: number, model: string, usage?: Object }>}
   */
  async routeTask(taskTypeOrOptions, payload = {}) {
    let options = {};
    if (typeof taskTypeOrOptions === "string") {
      options = {
        taskType: taskTypeOrOptions,
        ...payload,
      };
      if (!options.prompt && typeof payload.message === "string") {
        options.prompt = payload.message;
      }
    } else if (typeof taskTypeOrOptions === "object" && taskTypeOrOptions !== null) {
      options = { ...taskTypeOrOptions };
      if (!options.prompt && typeof options.message === "string") {
        options.prompt = options.message;
      }
    }

    if (!this.routingMap[options.taskType]) {
      options.taskType = TASK_TYPES.GENERAL_CHAT;
    }

    return this.generate(options);
  }

  /**
   * Eksekusi pemanggilan AI secara cerdas dengan failover bertingkat
   * @param {Object} options
   * @param {string} [options.taskType] - Kategori tugas (lihat TASK_TYPES)
   * @param {string} [options.prompt] - Prompt teks utama
   * @param {Array<Object>} [options.parts] - Array parts Gemini/multimodal
   * @param {Array<Object>} [options.history] - Riwayat dialog percakapan
   * @param {string} [options.systemInstruction] - Instruksi sistem/persona
   * @param {Object} [options.config] - Konfigurasi tambahan (temperature, maxOutputTokens, dsb)
   * @param {Object} [options.message] - Pesan discord opsional untuk function calling
   * @returns {Promise<{ text: string, provider: string, latencyMs: number, model: string, usage?: Object }>}
   */
  async generate({
    taskType = TASK_TYPES.GENERAL_CHAT,
    prompt,
    parts,
    history = [],
    systemInstruction,
    config = {},
    message = null,
  } = {}) {
    // Normalisasi input prompt & parts
    const safeParts =
      Array.isArray(parts) && parts.length > 0
        ? parts
        : [{ text: String(prompt || "") }];

    const safePrompt =
      prompt || safeParts.map((p) => p.text || "").join(" ").trim();

    // Dapatkan daftar kandidat provider sesuai prioritas taskType
    const candidates = this.routingMap[taskType] || this.routingMap[TASK_TYPES.GENERAL_CHAT];

    let lastError = null;

    for (const provider of candidates) {
      if (!this.isProviderConfigured(provider)) {
        continue;
      }

      const breaker = this.breakers[provider];
      if (breaker && !breaker.isAvailable()) {
        continue;
      }

      const startTime = Date.now();
      try {
        let result = null;

        if (provider === "gemini") {
          result = await this._callGemini({
            parts: safeParts,
            history,
            systemInstruction,
            config,
            message,
          });
        } else if (provider === "groq") {
          result = await this._callGroq({
            prompt: safePrompt,
            parts: safeParts,
            history,
            systemInstruction,
            config,
          });
        } else if (provider === "ollama") {
          result = await this._callOllama({
            prompt: safePrompt,
            history,
            systemInstruction,
            config,
          });
        }

        if (result && typeof result.text === "string" && result.text.length > 0) {
          const latencyMs = Date.now() - startTime;
          if (breaker) breaker.recordSuccess(latencyMs);

          return {
            ...result,
            latencyMs,
            taskType,
            toString() {
              return this.text;
            },
          };
        }
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        if (breaker) breaker.recordFailure(err);
        lastError = err;
        logger.warn(
          `[AiEnsembleRouter] Provider ${provider} gagal untuk ${taskType} (${latencyMs}ms): ${err.message}. Mencoba failover...`,
        );
      }
    }

    // Jika seluruh provider di dalam kandidat gagal atau tidak tersedia,
    // degrade secara mulus dengan balasan ramah dari kamus i18n lokal.
    logger.warn(
      `[AiEnsembleRouter] Semua provider AI gagal untuk ${taskType} (${lastError ? lastError.message : "no provider"}). Menggunakan balasan fallback i18n.`,
    );

    const fallbackText = languageManager.translateSync(
      languageManager.default,
      "ai_fallback",
    );

    return {
      text: fallbackText,
      provider: "fallback",
      model: null,
      latencyMs: 0,
      taskType,
      toString() {
        return this.text;
      },
    };
  }

  /**
   * Eksekusi panggilan ke Google Gemini API
   * @private
   */
  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Eksekusi panggilan ke Google Gemini API.
   * Menyuntikkan system instruction sebagai prefix part jika ada.
   * @private
   * @param {Object} params
   * @param {Array<Object>} params.parts - Content parts untuk Gemini
   * @param {Array<Object>} params.history - Riwayat percakapan
   * @param {string} [params.systemInstruction] - System instruction/persona
   * @param {Object} params.config - Konfigurasi generation
   * @param {Object} [params.message] - Discord message untuk function calling
   * @returns {Promise<{text: string, provider: string, model: string}>}
   */
  async _callGemini({ parts, history, systemInstruction, config, message }) {
    const finalParts = [...parts];
    if (systemInstruction) {
      finalParts.unshift({ text: `[System Instruction]\n${systemInstruction}\n\n` });
    }

    const selectedModel = env.GEMINI_MODEL || "gemini-2.5-flash";
    const text = await geminiClient.generate({
      parts: finalParts,
      history,
      model: selectedModel,
      config,
      message,
    });

    return {
      text: text.trim(),
      provider: "gemini",
      model: selectedModel,
    };
  }

  /**
   * Eksekusi panggilan ke Groq Cloud API
   * @private
   */
  async _callGroq({ prompt, parts, history = [], systemInstruction, config = {} }) {
    if (!env.GROQ_API_KEY) throw new SystemError("GROQ_API_KEY tidak dikonfigurasi.");

    const messages = [];

    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }

    for (const h of history) {
      const role = h.role === "model" ? "assistant" : "user";
      const content =
        typeof h.content === "string"
          ? h.content
          : Array.isArray(h.parts)
            ? h.parts.map((p) => p.text || "").join(" ")
            : "";
      if (content) messages.push({ role, content });
    }

    const currentContent =
      prompt || parts.map((p) => p.text || "").join(" ") || "";
    messages.push({ role: "user", content: currentContent });

    const executeRequest = async (targetModel) => {
      try {
        return await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxOutputTokens ?? 1024,
        }),
      });
      } catch (err) {
        throw new ExternalAPIError(
          `Gagal menghubungi Groq API untuk model ${targetModel}: ${err.message}`,
          { provider: "groq", model: targetModel },
          err,
        );
      }
    };

    const candidateModels = [
      env.GROQ_MODEL || "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama-3.2-1b-preview",
    ];

    let lastGroqStatus = null;
    let lastGroqErr = "";
    let rawJson = null;
    let successfulModel = null;

    for (const targetModel of candidateModels) {
      const res = await executeRequest(targetModel);
      if (res.ok) {
        rawJson = await res.json();
        successfulModel = targetModel;
        break;
      }
      lastGroqStatus = res.status;
      lastGroqErr = await res.text().catch(() => "");
      const isDecommissioned =
        lastGroqErr.includes("decommissioned") ||
        lastGroqErr.includes("no longer supported");
      if (res.status === 404 || (res.status === 400 && isDecommissioned)) {
        logger.info(
          `[AiEnsembleRouter] Model Groq ${targetModel} tidak tersedia (${res.status}), mencoba model cadangan berikutnya...`,
        );
        continue;
      }
      throw new ExternalAPIError(`Groq HTTP ${res.status}: ${lastGroqErr.slice(0, 200)}`);
    }

    if (!rawJson) {
      throw new ExternalAPIError(
        `Groq HTTP ${lastGroqStatus || 500}: ${lastGroqErr.slice(0, 200) || "Semua model Groq kandidat tidak ditemukan"}`,
      );
    }

    const normalized = normalizeAiResponse("groq", rawJson);

    return {
      text: normalized.content.trim(),
      provider: "groq",
      model: successfulModel || candidateModels[0],
      usage: normalized.tokenUsage,
    };
  }

  /**
   * Eksekusi panggilan ke Ollama Lokal (Fallback Offline)
   * @private
   */
  async _callOllama({ prompt, history = [], systemInstruction, config = {} }) {
    const baseUrl = env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = env.OLLAMA_MODEL || "llama3.1";

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }

    for (const h of history) {
      const role = h.role === "model" ? "assistant" : "user";
      const content =
        typeof h.content === "string"
          ? h.content
          : Array.isArray(h.parts)
            ? h.parts.map((p) => p.text || "").join(" ")
            : "";
      if (content) messages.push({ role, content });
    }

    messages.push({ role: "user", content: prompt });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 detik batas timeout lokal

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: config.temperature ?? 0.7,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new ExternalAPIError(`Ollama HTTP ${res.status}`);
      }

      const rawJson = await res.json();
      const normalized = normalizeAiResponse("ollama", rawJson);

      return {
        text: normalized.content.trim(),
        provider: "ollama",
        model,
        usage: normalized.tokenUsage,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DomainError) throw err;
      throw new ExternalAPIError(
        `Gagal menghubungi Ollama: ${err.message}`,
        { provider: "ollama", model },
        err,
      );
    }
  }

  /**
   * Mengembalikan status metrik seluruh circuit breaker untuk telemetri Web Dashboard
   * @returns {Object}
   */
  getTelemetry() {
    const status = {};
    for (const [key, breaker] of Object.entries(this.breakers)) {
      status[key] = {
        configured: this.isProviderConfigured(key),
        ...breaker.getMetrics(),
      };
    }
    return {
      providers: status,
      routingMap: this.routingMap,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset seluruh circuit breaker ke kondisi awal (untuk unit test)
   */
  resetBreakers() {
    for (const breaker of Object.values(this.breakers)) {
      breaker.reset();
    }
  }

  /**
   * Mengambil daftar seluruh persona AI yang tersedia
   * @returns {Object}
   */
  getAvailablePersonas() {
    return PERSONAS;
  }

  /**
   * Menyusun prompt konteks dengan persona kustom
   * @param {string} personaKey - Kunci persona ('tsundere', 'kuudere', 'gamer', 'butler', 'default')
   * @param {string} [basePrompt=''] - Prompt dasar atau konteks sebelumnya
   * @returns {string} Prompt yang telah disuntikkan persona
   */
  formatPersonaPrompt(personaKey, basePrompt = "") {
    const persona = PERSONAS[personaKey] || PERSONAS.default;
    const modifier = `[Instruksi Persona: ${persona.name}]\n${persona.promptModifier}\n\n`;
    return `${modifier}${basePrompt}`.trim();
  }

  /**
   * Memeriksa kuota harian turn chat AI pengguna.
   * Memberikan akses UNLIMITED untuk Owner dan VIP Tier 2 ke atas.
   *
   * @param {string} userId - Snowflake Discord user ID
   * @returns {Promise<{allowed: boolean, remaining: number, isUnlimited: boolean, used?: number, limit?: number, tier?: string}>}
   */
  async checkUserQuota(userId) {
    if (!userId) {
      return { allowed: false, remaining: 0, isUnlimited: false, tier: "none" };
    }

    const uid = String(userId);
    const isOwner = Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(uid);
    if (isOwner) {
      return { allowed: true, remaining: Infinity, isUnlimited: true, tier: "owner" };
    }

    let profile = null;
    try {
      const cacheManager = require("../managers/cacheManager");
      if (typeof cacheManager.getUserProfile === "function") {
        profile = await cacheManager.getUserProfile(uid);
      }
    } catch (_) {}

    const isVipTier2Plus = Boolean(
      profile &&
      profile.isPremium &&
      profile.premiumUntil &&
      new Date(profile.premiumUntil) > new Date() &&
      ["tier2", "friends", "tier3", "vip"].includes(profile.premium_tier),
    );

    if (isVipTier2Plus) {
      return {
        allowed: true,
        remaining: Infinity,
        isUnlimited: true,
        tier: profile.premium_tier,
      };
    }

    const isTier1 = Boolean(
      profile &&
      profile.isPremium &&
      profile.premiumUntil &&
      new Date(profile.premiumUntil) > new Date(),
    );

    const limit = isTier1 ? 100 : 25;
    const dateKey = new Date().toISOString().slice(0, 10);
    const quotaKey = `ai_chat_quota:${uid}:${dateKey}`;

    let used = 0;
    try {
      const redisManager = require("../managers/redisManager");
      if (redisManager && redisManager.isReady) {
        const val = await redisManager.getCache(quotaKey);
        used = parseInt(val || "0", 10);
      } else if (this._inMemoryQuota && this._inMemoryQuota.has(quotaKey)) {
        used = this._inMemoryQuota.get(quotaKey);
      }
    } catch (_) {}

    const remaining = Math.max(0, limit - used);
    return {
      allowed: remaining > 0,
      remaining,
      isUnlimited: false,
      used,
      limit,
      tier: profile?.premium_tier || (isTier1 ? "tier1" : "free"),
    };
  }

  /**
   * Mengonsumsi kuota chat harian pengguna jika bukan unlimited.
   *
   * @param {string} userId
   * @returns {Promise<{allowed: boolean, remaining: number, isUnlimited: boolean}>}
   */
  async consumeUserQuota(userId) {
    const quotaStatus = await this.checkUserQuota(userId);
    if (!quotaStatus.allowed) {
      return { allowed: false, remaining: 0, isUnlimited: false };
    }
    if (quotaStatus.isUnlimited) {
      return { allowed: true, remaining: Infinity, isUnlimited: true };
    }

    const uid = String(userId);
    const dateKey = new Date().toISOString().slice(0, 10);
    const quotaKey = `ai_chat_quota:${uid}:${dateKey}`;
    const newUsed = (quotaStatus.used || 0) + 1;

    try {
      const redisManager = require("../managers/redisManager");
      if (redisManager && redisManager.isReady) {
        await redisManager.setCache(quotaKey, newUsed, 86400);
      } else {
        if (!this._inMemoryQuota) this._inMemoryQuota = new Map();
        this._inMemoryQuota.set(quotaKey, newUsed);
      }
    } catch (_) {}

    const newRemaining = Math.max(0, (quotaStatus.limit || 25) - newUsed);
    return {
      allowed: true,
      remaining: newRemaining,
      isUnlimited: false,
      used: newUsed,
      limit: quotaStatus.limit,
    };
  }

  /**
   * Mengambil metrik circuit breaker semua provider.
   * @returns {Object<string, {name: string, state: string, failureCount: number, totalRequests: number, successCount: number, avgLatencyMs: number}>}
   */
  getCircuitBreakerMetrics() {
    const metrics = {};
    for (const [name, breaker] of Object.entries(this.breakers)) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Singleton instance AiEnsembleRouter dengan constants ter-attach.
 * @type {AiEnsembleRouter & {TASK_TYPES: typeof TASK_TYPES, PERSONAS: typeof PERSONAS, AiEnsembleRouter: typeof AiEnsembleRouter, CircuitBreaker: typeof CircuitBreaker}}
 */
const ensembleRouter = new AiEnsembleRouter();
ensembleRouter.TASK_TYPES = TASK_TYPES;
ensembleRouter.PERSONAS = PERSONAS;
ensembleRouter.AiEnsembleRouter = AiEnsembleRouter;
ensembleRouter.CircuitBreaker = CircuitBreaker;

module.exports = ensembleRouter;

