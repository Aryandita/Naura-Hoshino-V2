"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const aiEnsembleRouter = require("../src/ai/aiEnsembleRouter");
const { normalizeAiResponse } = require("../src/adapters/aiBoundaryAdapter");

describe("AI Tiering & OpenRouter Integration Suite", () => {
  it("aiEnsembleRouter memiliki circuit breaker dan telemetri openrouter", () => {
    assert.ok(aiEnsembleRouter.breakers.openrouter, "Breaker openrouter harus terdaftar");
    const telemetry = aiEnsembleRouter.getTelemetry();
    assert.ok(telemetry.providers.openrouter, "Telemetri harus menyertakan status openrouter");
  });

  it("normalizeAiResponse dapat memproses format response openrouter", () => {
    const mockOpenRouterPayload = {
      id: "gen-12345",
      choices: [
        {
          message: {
            role: "assistant",
            content: "Halo! Aku Naura Hoshino siap membantumu hari ini!",
            reasoning_content: "Memikirkan sapaan ramah...",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 42,
        completion_tokens: 15,
        total_tokens: 57,
      },
    };

    const normalized = normalizeAiResponse("openrouter", mockOpenRouterPayload);
    assert.strictEqual(normalized.content, "Halo! Aku Naura Hoshino siap membantumu hari ini!");
    assert.strictEqual(normalized.reasoning, "Memikirkan sapaan ramah...");
    assert.strictEqual(normalized.tokenUsage.promptTokens, 42);
    assert.strictEqual(normalized.tokenUsage.completionTokens, 15);
    assert.strictEqual(normalized.tokenUsage.totalTokens, 57);
  });

  it("menolak akses Vision Multimodal untuk Free Tier (Opsi A)", async () => {
    const res = await aiEnsembleRouter.generate({
      taskType: aiEnsembleRouter.TASK_TYPES.VISION_MULTIMODAL,
      userTier: "free",
      prompt: "Tolong jelaskan gambar ini",
    });

    assert.strictEqual(res.isPremiumRestricted, true, "Harus ditandai restricted untuk free tier");
    assert.strictEqual(res.text, "PREMIUM_VISION_REQUIRED");
  });

  it("mengizinkan akses Vision Multimodal untuk VIP/Premium Tier", async () => {
    // Kita uji bahwa untuk VIP, guard isPremiumRestricted tidak memblokir
    // Mock _callGemini untuk menguji routing
    const origCallGemini = aiEnsembleRouter._callGemini;
    aiEnsembleRouter._callGemini = async () => ({
      text: "Ini adalah gambar pemandangan yang indah!",
      provider: "gemini",
      model: "gemini-2.5-flash",
    });

    try {
      const res = await aiEnsembleRouter.generate({
        taskType: aiEnsembleRouter.TASK_TYPES.VISION_MULTIMODAL,
        userTier: "vip",
        prompt: "Tolong jelaskan gambar ini",
      });

      assert.strictEqual(res.isPremiumRestricted, undefined);
      assert.strictEqual(res.provider, "gemini");
      assert.strictEqual(res.text, "Ini adalah gambar pemandangan yang indah!");
    } finally {
      aiEnsembleRouter._callGemini = origCallGemini;
    }
  });

  it("mengarahkan Free Tier ke kandidat OpenRouter dan Ollama", async () => {
    let calledProvider = null;
    const origCallOpenRouter = aiEnsembleRouter._callOpenRouter;
    aiEnsembleRouter._callOpenRouter = async () => {
      calledProvider = "openrouter";
      return {
        text: "Balasan santai dari OpenRouter Free Pool!",
        provider: "openrouter",
        model: "meta-llama/llama-3.3-70b-instruct:free",
      };
    };

    // Pastikan breaker openrouter aktif
    aiEnsembleRouter.breakers.openrouter.reset();

    try {
      const res = await aiEnsembleRouter.generate({
        taskType: aiEnsembleRouter.TASK_TYPES.GENERAL_CHAT,
        userTier: "free",
        prompt: "Halo Naura apa kabar?",
      });

      // Jika OpenRouter dikonfigurasi, ia akan dipanggil terlebih dahulu
      if (aiEnsembleRouter.isProviderConfigured("openrouter")) {
        assert.strictEqual(calledProvider, "openrouter");
        assert.strictEqual(res.provider, "openrouter");
      }
    } finally {
      aiEnsembleRouter._callOpenRouter = origCallOpenRouter;
    }
  });

  it("memprioritaskan Gemini/Groq untuk VIP Tier di General Chat", async () => {
    let calledProvider = null;
    const origCallGemini = aiEnsembleRouter._callGemini;
    aiEnsembleRouter._callGemini = async () => {
      calledProvider = "gemini";
      return {
        text: "Balasan kilat VIP dari Google Gemini!",
        provider: "gemini",
        model: "gemini-2.5-flash",
      };
    };

    try {
      const res = await aiEnsembleRouter.generate({
        taskType: aiEnsembleRouter.TASK_TYPES.GENERAL_CHAT,
        userTier: "vip",
        prompt: "Halo Naura VIP!",
      });

      if (aiEnsembleRouter.isProviderConfigured("gemini")) {
        assert.strictEqual(calledProvider, "gemini");
        assert.strictEqual(res.provider, "gemini");
      }
    } finally {
      aiEnsembleRouter._callGemini = origCallGemini;
    }
  });
});
