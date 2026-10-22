"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ensembleRouter = require("./aiEnsembleRouter");
const { CircuitBreaker, AiEnsembleRouter, TASK_TYPES } = ensembleRouter;

test("AiEnsembleRouter - Task Types & Routing Map", () => {
  assert.ok(TASK_TYPES.GENERAL_CHAT, "GENERAL_CHAT harus ada");
  assert.ok(TASK_TYPES.TACTICAL_REASONING, "TACTICAL_REASONING harus ada");
  assert.ok(TASK_TYPES.ROLEPLAY_STORY, "ROLEPLAY_STORY harus ada");
  assert.ok(TASK_TYPES.VISION_MULTIMODAL, "VISION_MULTIMODAL harus ada");

  const router = new AiEnsembleRouter();
  assert.deepEqual(router.routingMap[TASK_TYPES.GENERAL_CHAT], [
    "gemini",
    "groq",
    "ollama",
  ]);
  assert.deepEqual(router.routingMap[TASK_TYPES.TACTICAL_REASONING], [
    "groq",
    "gemini",
    "ollama",
  ]);
  assert.deepEqual(router.routingMap[TASK_TYPES.VISION_MULTIMODAL], [
    "gemini",
  ]);
});

test("CircuitBreaker - State Transitions & Failure Threshold", () => {
  const breaker = new CircuitBreaker("test-provider", {
    failureThreshold: 2,
    cooldownMs: 500,
  });

  assert.equal(breaker.state, "CLOSED");
  assert.equal(breaker.isAvailable(), true);

  // Gagal pertama
  breaker.recordFailure(new Error("Network timeout"));
  assert.equal(breaker.state, "CLOSED");
  assert.equal(breaker.failureCount, 1);
  assert.equal(breaker.isAvailable(), true);

  // Gagal kedua (mencapai threshold 2) -> transisi ke OPEN
  breaker.recordFailure(new Error("Server error"));
  assert.equal(breaker.state, "OPEN");
  assert.equal(breaker.failureCount, 2);
  assert.equal(breaker.isAvailable(), false);

  // Sukses me-reset breaker
  breaker.recordSuccess(150);
  assert.equal(breaker.state, "CLOSED");
  assert.equal(breaker.failureCount, 0);
  assert.equal(breaker.successCount, 1);
  assert.equal(breaker.getMetrics().avgLatencyMs, 150);
});

test("CircuitBreaker - Rate Limit Error (429) Triggers Immediate OPEN", () => {
  const breaker = new CircuitBreaker("test-groq", {
    failureThreshold: 5,
    cooldownMs: 60000,
  });

  assert.equal(breaker.state, "CLOSED");
  breaker.recordFailure(new Error("Groq HTTP 429: Too Many Requests"));
  assert.equal(breaker.state, "OPEN", "429 harus langsung memicu OPEN state");
  assert.equal(breaker.isAvailable(), false);
});

test("AiEnsembleRouter - Seamless Failover Logic", async () => {
  const router = new AiEnsembleRouter();

  // Mock configuration: gemini & groq aktif
  router.isProviderConfigured = (p) => p === "gemini" || p === "groq";

  // Mock groq gagal (misal 500 error)
  router._callGroq = async () => {
    throw new Error("Groq temporary outage 500");
  };

  // Mock gemini berhasil
  router._callGemini = async () => {
    return {
      text: "Jawaban dari Gemini Fallback",
      provider: "gemini",
      model: "gemini-2.5-flash",
    };
  };

  // Jalankan TACTICAL_REASONING (prioritas: groq -> gemini)
  const result = await router.generate({
    taskType: TASK_TYPES.TACTICAL_REASONING,
    prompt: "Siapa yang bersalah dalam perkara ini?",
  });

  assert.equal(result.provider, "gemini", "Harus berhasil failover ke gemini");
  assert.equal(result.text, "Jawaban dari Gemini Fallback");
  assert.ok(typeof result.latencyMs === "number");
  assert.equal(result.toString(), "Jawaban dari Gemini Fallback");
  assert.equal(router.breakers.groq.state, "CLOSED"); // baru 1 error belum threshold
  assert.equal(router.breakers.groq.failureCount, 1);
  assert.equal(router.breakers.gemini.successCount, 1);
});

test("AiEnsembleRouter - Graceful Degradation Saat Semua Provider Gagal", async () => {
  const router = new AiEnsembleRouter();
  router.isProviderConfigured = (p) => p === "gemini";

  router._callGemini = async () => {
    throw new Error("Quota exceeded 429");
  };

  const result = await router.generate({
    taskType: TASK_TYPES.VISION_MULTIMODAL,
    prompt: "Jelaskan gambar ini",
  });

  assert.ok(result, "Harus mengembalikan balasan fallback");
  assert.equal(result.provider, "fallback");
  assert.equal(result.model, null);
  assert.ok(typeof result.text === "string" && result.text.length > 0);
  assert.equal(result.toString(), result.text);
});

test("AiEnsembleRouter - Telemetry Structure", () => {
  const telemetry = ensembleRouter.getTelemetry();
  assert.ok(telemetry.providers, "Harus menyertakan status providers");
  assert.ok(telemetry.providers.gemini, "Status gemini harus ada");
  assert.ok(telemetry.providers.groq, "Status groq harus ada");
  assert.ok(telemetry.providers.ollama, "Status ollama harus ada");
  assert.ok(telemetry.routingMap, "Routing map harus ada");
  assert.ok(telemetry.timestamp, "Timestamp harus ada");
});

test("AiEnsembleRouter - Personas Catalog & Format Prompt", () => {
  const personas = ensembleRouter.getAvailablePersonas();
  assert.ok(personas.default, "Persona default harus ada");
  assert.ok(personas.tsundere, "Persona tsundere harus ada");
  assert.ok(personas.kuudere, "Persona kuudere harus ada");
  assert.ok(personas.gamer, "Persona gamer harus ada");
  assert.ok(personas.butler, "Persona butler harus ada");

  const promptTsundere = ensembleRouter.formatPersonaPrompt("tsundere", "Halo Naura!");
  assert.ok(promptTsundere.includes("[Instruksi Persona: Tsundere Naura]"));
  assert.ok(promptTsundere.includes("Halo Naura!"));

  const promptFallback = ensembleRouter.formatPersonaPrompt("nonexistent", "Tes prompt");
  assert.ok(promptFallback.includes("[Instruksi Persona: Naura Standar]"));
  assert.ok(promptFallback.includes("Tes prompt"));
});

test("AiEnsembleRouter - User Chat Quota & VIP Unlimited Access", async () => {
  const router = new AiEnsembleRouter();

  // Test empty/null userId
  const nullCheck = await router.checkUserQuota(null);
  assert.equal(nullCheck.allowed, false);
  assert.equal(nullCheck.isUnlimited, false);

  // Test Owner ID (Unlimited)
  const env = require("../config/env");
  const origOwnerIds = env.OWNER_IDS;
  env.OWNER_IDS = ["111222333444555666"];

  try {
    const ownerCheck = await router.checkUserQuota("111222333444555666");
    assert.equal(ownerCheck.allowed, true);
    assert.equal(ownerCheck.isUnlimited, true);
    assert.equal(ownerCheck.remaining, Infinity);
    assert.equal(ownerCheck.tier, "owner");

    // Owner quota consumption returns unlimited without decrementing
    const ownerConsume = await router.consumeUserQuota("111222333444555666");
    assert.equal(ownerConsume.allowed, true);
    assert.equal(ownerConsume.isUnlimited, true);
    assert.equal(ownerConsume.remaining, Infinity);
  } finally {
    env.OWNER_IDS = origOwnerIds;
  }

  // Test Free User (25 daily limit)
  const freeUserId = "user_free_tester_001";
  const freeCheck = await router.checkUserQuota(freeUserId);
  assert.equal(freeCheck.allowed, true);
  assert.equal(freeCheck.isUnlimited, false);
  assert.equal(freeCheck.limit, 25);
  assert.equal(freeCheck.remaining, 25);

  // Consume free quota
  const consumeRes = await router.consumeUserQuota(freeUserId);
  assert.equal(consumeRes.allowed, true);
  assert.equal(consumeRes.isUnlimited, false);
  assert.equal(consumeRes.used, 1);
  assert.equal(consumeRes.remaining, 24);

  // Check quota after consumption
  const afterConsume = await router.checkUserQuota(freeUserId);
  assert.equal(afterConsume.used, 1);
  assert.equal(afterConsume.remaining, 24);
});

