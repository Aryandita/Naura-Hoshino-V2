// Lokasi: src/adapters/adapters.test.js
// Unit test untuk modul boundary adapters (Law 2 & Law 3)

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  extractInteractionBoundary,
  parseCustomId,
  ensureGuildContext,
} = require("./interactionBoundaryAdapter");

const { normalizeAiResponse } = require("./aiBoundaryAdapter");
const { normalizePaymentWebhook } = require("./paymentBoundaryAdapter");
const { ValidationError } = require("../errors/DomainError");

describe("Law 3: Interaction Boundary Adapter", () => {
  it("mengekstraksi interaction Discord ke dalam domain boundary terstruktur", () => {
    const mockInteraction = {
      id: "int-999",
      type: 2,
      user: { id: "user-123", username: "naura_fan" },
      member: { displayName: "Naura Fan" },
      guildId: "guild-456",
      channelId: "chan-789",
      commandName: "profile",
      options: {
        getSubcommand: () => "view",
        data: [
          {
            name: "view",
            type: 1,
            options: [{ name: "target", value: "user-456" }],
          },
        ],
      },
    };

    const boundary = extractInteractionBoundary(mockInteraction);
    assert.strictEqual(boundary.interactionId, "int-999");
    assert.strictEqual(boundary.userId, "user-123");
    assert.strictEqual(boundary.displayName, "Naura Fan");
    assert.strictEqual(boundary.isGuildContext, true);
    assert.strictEqual(boundary.commandName, "profile");
    assert.strictEqual(boundary.subcommandName, "view");
    assert.strictEqual(boundary.options.target, "user-456");
  });

  it("parseCustomId mengurai format prefix:action:targetId dengan benar", () => {
    const parsed = parseCustomId("ticket:claim:12345");
    assert.strictEqual(parsed.prefix, "ticket");
    assert.strictEqual(parsed.action, "claim");
    assert.strictEqual(parsed.targetId, "12345");
  });

  it("ensureGuildContext melempar ValidationError jika di luar server", () => {
    const dmBoundary = {
      isGuildContext: false,
      interactionId: "dm-1",
      userId: "u-1",
    };
    assert.throws(
      () => ensureGuildContext(dmBoundary),
      (err) =>
        err instanceof ValidationError && err.code === "VALIDATION_ERROR",
    );
  });
});

describe("Law 3: AI Boundary Adapter", () => {
  it("menormalisasi respons Gemini dengan functionCall", () => {
    const geminiRaw = {
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { text: "Memproses permintaan Anda..." },
              {
                functionCall: {
                  name: "check_weather",
                  args: { city: "Jakarta" },
                },
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 25,
      },
    };

    const normalized = normalizeAiResponse("gemini", geminiRaw);
    assert.strictEqual(normalized.provider, "gemini");
    assert.strictEqual(normalized.content, "Memproses permintaan Anda...");
    assert.strictEqual(normalized.toolCalls.length, 1);
    assert.strictEqual(normalized.toolCalls[0].name, "check_weather");
    assert.strictEqual(normalized.toolCalls[0].args.city, "Jakarta");
    assert.strictEqual(normalized.tokenUsage.totalTokens, 40);
  });

  it("menormalisasi respons Groq/OpenAI dengan format choices", () => {
    const groqRaw = {
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "Halo dunia!",
            reasoning_content: "Berpikir sejenak...",
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
      },
    };

    const normalized = normalizeAiResponse("groq", groqRaw);
    assert.strictEqual(normalized.provider, "groq");
    assert.strictEqual(normalized.content, "Halo dunia!");
    assert.strictEqual(normalized.reasoning, "Berpikir sejenak...");
    assert.strictEqual(normalized.tokenUsage.totalTokens, 15);
  });
});

describe("Law 3: Payment Boundary Adapter", () => {
  it("menormalisasi webhook Saweria dan mengekstrak discord id dari pesan", () => {
    const rawSaweria = {
      donation_id: "saw-001",
      donator_name: "Budi",
      amount_raw: 25000,
      message: "Buat bot Naura! ID Discord: 123456789012345678",
    };

    const transaction = normalizePaymentWebhook("saweria", rawSaweria);
    assert.strictEqual(transaction.provider, "saweria");
    assert.strictEqual(transaction.transactionId, "saw-001");
    assert.strictEqual(transaction.donatorName, "Budi");
    assert.strictEqual(transaction.amount, 25000);
    assert.strictEqual(transaction.targetUserId, "123456789012345678");
  });

  it("menolak webhook dengan nominal negatif", () => {
    assert.throws(
      () => normalizePaymentWebhook("trakteer", { amount: -5000 }),
      (err) => err instanceof ValidationError,
    );
  });
});
