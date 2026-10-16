"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fishAudioService = require("./fishAudioService");
const env = require("../config/env");

test("FishAudioService - isConfigured and Cache Key Generation", () => {
  const origKey = env.FISH_AUDIO_API_KEY;
  try {
    env.FISH_AUDIO_API_KEY = "test_valid_key_12345";
    assert.equal(fishAudioService.isConfigured(), true);

    env.FISH_AUDIO_API_KEY = "";
    assert.equal(fishAudioService.isConfigured(), false);
  } finally {
    env.FISH_AUDIO_API_KEY = origKey;
  }

  const key1 = fishAudioService._getCacheKey("Halo Dunia", "voice_1", "mp3");
  const key2 = fishAudioService._getCacheKey("Halo Dunia", "voice_1", "mp3");
  const key3 = fishAudioService._getCacheKey("Lain Teks", "voice_1", "mp3");

  assert.equal(key1, key2, "Hash cache key harus konsisten dan deterministik");
  assert.notEqual(key1, key3, "Hash teks berbeda harus menghasilkan key berbeda");
  assert.ok(key1.startsWith("fish_audio:"));
});

test("FishAudioService - Concurrency Slots & Rate Limiting", async () => {
  assert.equal(fishAudioService.activeRequests, 0);

  await fishAudioService._acquireSlot();
  assert.equal(fishAudioService.activeRequests, 1);

  await fishAudioService._acquireSlot();
  assert.equal(fishAudioService.activeRequests, 2);

  // Exceeds maxConcurrentRequests (2)
  await assert.rejects(
    async () => {
      await fishAudioService._acquireSlot();
    },
    { name: "SystemError" },
  );

  fishAudioService._releaseSlot();
  assert.equal(fishAudioService.activeRequests, 1);

  fishAudioService._releaseSlot();
  assert.equal(fishAudioService.activeRequests, 0);
});

test("FishAudioService - Input Validation on Empty Text", async () => {
  const origKey = env.FISH_AUDIO_API_KEY;
  try {
    env.FISH_AUDIO_API_KEY = "valid_api_key_test";

    await assert.rejects(
      async () => {
        await fishAudioService.generateSpeech("");
      },
      { name: "ValidationError" },
    );

    await assert.rejects(
      async () => {
        await fishAudioService.generateSpeech("   ");
      },
      { name: "ValidationError" },
    );
  } finally {
    env.FISH_AUDIO_API_KEY = origKey;
  }
});

test("FishAudioService - generateDjCompanionIntro with fallback", async () => {
  const origKey = env.FISH_AUDIO_API_KEY;
  try {
    env.FISH_AUDIO_API_KEY = ""; // Test fallback path without spending API credits
    const intro = await fishAudioService.generateDjCompanionIntro({
      trackTitle: "Sparkle",
      trackAuthor: "RADWIMPS",
      requesterName: "Budi",
      listenerNames: ["Dewi"],
      lang: "id",
    });

    assert.ok(intro);
    assert.ok(typeof intro.script === "string" && intro.script.length > 10);
    assert.ok(intro.script.includes("Budi"));
    assert.ok(intro.classification);
    assert.equal(intro.fallbackText, true);
  } finally {
    env.FISH_AUDIO_API_KEY = origKey;
  }
});

test("FishAudioService - generateDjCompanionIntro with active audio stream", async (t) => {
  const origGenerate = fishAudioService.generateSpeech;
  const origKey = env.FISH_AUDIO_API_KEY;
  t.after(() => {
    fishAudioService.generateSpeech = origGenerate;
    env.FISH_AUDIO_API_KEY = origKey;
  });

  env.FISH_AUDIO_API_KEY = "dummy_valid_key";
  fishAudioService.generateSpeech = async () => Buffer.from("mock_audio_bytes");

  const intro = await fishAudioService.generateDjCompanionIntro({
    trackTitle: "Gurenge",
    trackAuthor: "LiSA",
    requesterName: "Tanjiro",
    lang: "id",
  });

  assert.equal(intro.fallbackText, false);
  assert.ok(Buffer.isBuffer(intro.audioBuffer));
  assert.equal(intro.audioBuffer.toString(), "mock_audio_bytes");
});

test("FishAudioService - broadcastVictoryAnnouncement without crash", async () => {
  const origKey = env.FISH_AUDIO_API_KEY;
  try {
    env.FISH_AUDIO_API_KEY = "";
    const result = await fishAudioService.broadcastVictoryAnnouncement({
      client: { poru: { players: new Map() } },
      federationName: "Starlight Alliance",
      bossName: "Celestial Chrono-Wyrm",
      phase: 2,
    });

    assert.equal(result.success, true);
    assert.equal(result.broadcasted, 0);
    assert.ok(result.announcementText.includes("Starlight Alliance"));
    assert.ok(result.announcementText.includes("fase ke-2"));
  } finally {
    env.FISH_AUDIO_API_KEY = origKey;
  }
});
