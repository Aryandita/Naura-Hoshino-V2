"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const aiManager = require("./aiManager");

describe("AIManager - Multimodal Vision AI", () => {
  it("menolak pemanggilan chatVision jika buffer gambar kosong", async () => {
    // Inject mock to avoid throwing GEMINI_API_KEY error
    const originalGetGenAI = aiManager.getGenAI;
    aiManager.getGenAI = () => ({});

    await assert.rejects(
      async () => {
        await aiManager.chatVision({
          userId: "123456789",
          prompt: "Jelaskan gambar ini",
          imageBuffer: null,
          mimeType: "image/png",
        });
      },
      {
        name: "Error",
        message: /Buffer gambar tidak valid atau kosong/i,
      },
    );

    aiManager.getGenAI = originalGetGenAI;
  });

  it("menolak pemanggilan chatVision jika imageBuffer bukan Buffer", async () => {
    // Inject mock to avoid throwing GEMINI_API_KEY error
    const originalGetGenAI = aiManager.getGenAI;
    aiManager.getGenAI = () => ({});

    await assert.rejects(
      async () => {
        await aiManager.chatVision({
          userId: "123456789",
          prompt: "Jelaskan gambar ini",
          imageBuffer: "bukan_buffer",
          mimeType: "image/png",
        });
      },
      {
        name: "Error",
        message: /Buffer gambar tidak valid atau kosong/i,
      },
    );

    aiManager.getGenAI = originalGetGenAI;
  });
});
