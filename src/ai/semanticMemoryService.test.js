"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  cosineSimilarity,
  SemanticMemoryService,
} = require("./semanticMemoryService");

describe("SemanticMemoryService & Cosine Similarity Math", () => {
  it("menghitung cosine similarity secara akurat (vektor identik, ortogonal, berlawanan)", () => {
    // 1. Vektor Identik: Cosine Similarity = 1.0
    const vecA = [1, 2, 3];
    const vecIdentical = [1, 2, 3];
    const simIdentical = cosineSimilarity(vecA, vecIdentical);
    assert.strictEqual(Math.round(simIdentical * 1000) / 1000, 1.0);

    // 2. Vektor Berlawanan: Cosine Similarity = -1.0
    const vecOpposite = [-1, -2, -3];
    const simOpposite = cosineSimilarity(vecA, vecOpposite);
    assert.strictEqual(Math.round(simOpposite * 1000) / 1000, -1.0);

    // 3. Vektor Ortogonal (Tegak Lurus): Cosine Similarity = 0.0
    const vecOrt1 = [1, 0];
    const vecOrt2 = [0, 1];
    const simOrt = cosineSimilarity(vecOrt1, vecOrt2);
    assert.strictEqual(simOrt, 0.0);
  });

  it("menangani edge case vektor kosong atau panjang tidak sama", () => {
    assert.strictEqual(cosineSimilarity([], []), 0);
    assert.strictEqual(cosineSimilarity([1, 2], [1, 2, 3]), 0);
    assert.strictEqual(cosineSimilarity(null, [1, 2]), 0);
    assert.strictEqual(cosineSimilarity([0, 0, 0], [0, 0, 0]), 0);
  });

  it("formatMemoriesForContext menghasilkan blok teks terstruktur", () => {
    const service = new SemanticMemoryService();
    const formattedEmpty = service.formatMemoriesForContext([]);
    assert.strictEqual(formattedEmpty, "");

    const memories = [
      { memoryType: "USER_FACT", content: "Suka makan ramen pedas" },
      { memoryType: "SERVER_RULE", content: "Dilarang spam di chat umum" },
    ];
    const formatted = service.formatMemoriesForContext(memories);
    assert.ok(formatted.includes("[MEMORI & FAKTA PENGGUNA TERSIMPAN DI DATABASE]"));
    assert.ok(formatted.includes("Suka makan ramen pedas"));
    assert.ok(formatted.includes("Dilarang spam di chat umum"));
  });

  it("pruneDuplicateMemories berjalan lancar dan mengembalikan ringkasan", async () => {
    const SemanticMemory = require("../models/SemanticMemory");
    const origFindAll = SemanticMemory.findAll;

    SemanticMemory.findAll = async () => [
      {
        id: "mem1",
        userId: "u1",
        memoryType: "USER_FACT",
        content: "Suka kopi hitam",
        importanceScore: 3,
        embedding: [1, 0, 0],
        save: async () => {},
        destroy: async () => {},
      },
      {
        id: "mem2",
        userId: "u1",
        memoryType: "USER_FACT",
        content: "Suka kopi hitam nikmat",
        importanceScore: 2,
        embedding: [1, 0.01, 0],
        save: async () => {},
        destroy: async () => {},
      },
    ];

    try {
      const service = new SemanticMemoryService();
      const result = await service.pruneDuplicateMemories(0.92, 90);
      assert.ok(typeof result.prunedCount === "number");
      assert.ok(typeof result.duplicatesMerged === "number");
      assert.strictEqual(result.duplicatesMerged, 1);
    } finally {
      SemanticMemory.findAll = origFindAll;
    }
  });
});
