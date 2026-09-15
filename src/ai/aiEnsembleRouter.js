"use strict";

/**
 * aiEnsembleRouter.js - Cross-Model Ensemble Router & Living AI Gateway
 *
 * Mengatur rute pemanggilan model AI secara cerdas berdasarkan tipe tugas (Task Type):
 * 1. Gemini (Google GenAI): Unggul untuk chat umum, analisis multimodal (gambar/vision), dan konteks besar.
 * 2. Groq (LLaMA 3.3 70B): Unggul untuk penalaran taktis cepat (~250 token/detik), persidangan, dan opsi cerita RPG.
 * 3. Ollama / Fallback: Penyelamat darurat saat terjadi pemadaman koneksi cloud.
 *
 * Dilengkapi Circuit Breaker per provider untuk mengalihkan beban secara otomatis bila terjadi HTTP 429 / timeout.
 */

const env = require("../config/env");
const { logger } = require("../managers/logger");
const { normalizeAiResponse } = require("../adapters/aiBoundaryAdapter");
const geminiClient = require("./geminiClient");

const TASK_TYPES = Object.freeze({
  GENERAL_CHAT: "GENERAL_CHAT",
  TACTICAL_REASONING: "TACTICAL_REASONING",
  ROLEPLAY_STORY: "ROLEPLAY_STORY",
  CODE_LOGIC: "CODE_LOGIC",
  VISION_MULTIMODAL: "VISION_MULTIMODAL",
});

const DEFAULT_ROUTING_MAP = {
  [TASK_TYPES.GENERAL_CHAT]: ["gemini", "groq", "ollama"],
  [TASK_TYPES.TACTICAL_REASONING]: ["groq", "gemini", "ollama"],
  [TASK_TYPES.ROLEPLAY_STORY]: ["groq", "gemini", "ollama"],
  [TASK_TYPES.CODE_LOGIC]: ["groq", "gemini", "ollama"],
  [TASK_TYPES.VISION_MULTIMODAL]: ["gemini"],
};

class CircuitBreaker {
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

  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.rollingLatencies = [];
  }
}

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
  isProviderConfigured(provider) {
    switch (provider) {
      case "gemini":
        return Boolean(env.GEMINI_API);
      case "groq":
        return Boolean(env.GROQ_API_KEY);
      case "ollama":
        return Boolean(env.OLLAMA_BASE_URL);
      default:
        return false;
    }
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

    // Jika seluruh provider di dalam kandidat gagal
    throw new Error(
      `Semua provider AI (${candidates.join(", ")}) gagal atau kuota habis: ${lastError ? lastError.message : "Tidak ada provider aktif"}`,
    );
  }

  /**
   * Eksekusi panggilan ke Google Gemini API
   * @private
   */
  async _callGemini({ parts, history, systemInstruction, config, message }) {
    const finalParts = [...parts];
    if (systemInstruction) {
      finalParts.unshift({ text: `[System Instruction]\n${systemInstruction}\n\n` });
    }

    const text = await geminiClient.generate({
      parts: finalParts,
      history,
      config,
      message,
    });

    return {
      text: text.trim(),
      provider: "gemini",
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
    };
  }

  /**
   * Eksekusi panggilan ke Groq Cloud API
   * @private
   */
  async _callGroq({ prompt, parts, history = [], systemInstruction, config = {} }) {
    if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY tidak dikonfigurasi.");

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
      return fetch("https://api.groq.com/openai/v1/chat/completions", {
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
    };

    let modelName = env.GROQ_MODEL || "llama-3.3-70b-versatile";
    let res = await executeRequest(modelName);

    // Bila model 70B tidak tersedia di tier akun pengguna, coba model 8B instant
    if (res.status === 404 && modelName !== "llama-3.1-8b-instant") {
      logger.info(
        `[AiEnsembleRouter] Model Groq ${modelName} tidak ditemukan (404). Mencoba fallback ke llama-3.1-8b-instant...`,
      );
      modelName = "llama-3.1-8b-instant";
      res = await executeRequest(modelName);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const rawJson = await res.json();
    const normalized = normalizeAiResponse("groq", rawJson);

    return {
      text: normalized.content.trim(),
      provider: "groq",
      model: modelName,
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
        throw new Error(`Ollama HTTP ${res.status}`);
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
      throw err;
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
}

const ensembleRouter = new AiEnsembleRouter();
ensembleRouter.TASK_TYPES = TASK_TYPES;
ensembleRouter.AiEnsembleRouter = AiEnsembleRouter;
ensembleRouter.CircuitBreaker = CircuitBreaker;

module.exports = ensembleRouter;
