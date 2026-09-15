"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("3D Mascot Viseme & Lip-Sync Synchronization Engine", () => {
  const VISEME_MAP = {
    A: "aa",
    I: "ih",
    U: "ou",
    E: "ee",
    O: "oh",
  };

  function extractVowelSequence(text) {
    if (!text || typeof text !== "string") return [];
    return (text.match(/[aiueo]/gi) || []).map((c) => c.toUpperCase());
  }

  function calculateVisemeTiming(vowelSequence, durationMs = 2500) {
    if (vowelSequence.length === 0) return { stepMs: 100, frames: [] };
    const stepMs = Math.max(80, Math.floor(durationMs / vowelSequence.length));
    const frames = vowelSequence.map((vowel, idx) => ({
      timeMs: idx * stepMs,
      phoneme: vowel,
      morphTarget: VISEME_MAP[vowel] || "aa",
      intensity: 0.85,
    }));
    return { stepMs, frames };
  }

  it("extractVowelSequence extracts correct phonemes from Indonesian dialogue", () => {
    const text = "Halo Kak Aryandita, Naura siap ngobrol!";
    const vowels = extractVowelSequence(text);

    assert.ok(Array.isArray(vowels));
    assert.ok(vowels.length > 5);
    assert.strictEqual(vowels[0], "A"); // H[a]lo
    assert.strictEqual(vowels[1], "O"); // Hal[o]
  });

  it("calculateVisemeTiming produces correct frame timings and morph targets", () => {
    const vowels = ["A", "I", "U", "E", "O"];
    const timing = calculateVisemeTiming(vowels, 1000);

    assert.strictEqual(timing.stepMs, 200);
    assert.strictEqual(timing.frames.length, 5);
    assert.strictEqual(timing.frames[0].morphTarget, "aa");
    assert.strictEqual(timing.frames[1].morphTarget, "ih");
    assert.strictEqual(timing.frames[2].morphTarget, "ou");
    assert.strictEqual(timing.frames[3].morphTarget, "ee");
    assert.strictEqual(timing.frames[4].morphTarget, "oh");
  });

  it("handles empty or non-vocal texts gracefully", () => {
    const emptyTiming = calculateVisemeTiming([]);
    assert.strictEqual(emptyTiming.frames.length, 0);
  });
});
