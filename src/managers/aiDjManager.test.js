"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const aiDjManager = require("./aiDjManager");

test("aiDjManager: status aktif per-guild", () => {
  aiDjManager.setDjEnabled("guild-123", true);
  assert.equal(aiDjManager.isDjEnabled("guild-123"), true);

  aiDjManager.setDjEnabled("guild-123", false);
  assert.equal(aiDjManager.isDjEnabled("guild-123"), false);
});

test("aiDjManager: generateDjScript menghasilkan script dan klasifikasi genre", () => {
  const result = aiDjManager.generateDjScript(
    { title: "Cozy Study Lofi", author: "ChilledCow" },
    "Budi",
    ["Siti", "Andi"],
  );

  assert.ok(typeof result.script === "string" && result.script.length > 10);
  assert.ok(result.script.includes("Budi"));
  assert.equal(result.classification.genre, "LOFI");
  assert.equal(result.classification.emoji, "☕");
});

test("aiDjManager: generateDjScript menangani genre anime dengan listener", () => {
  const result = aiDjManager.generateDjScript(
    { title: "Kaikai Kitan - Jujutsu Kaisen OP", author: "Eve" },
    "Arya",
    ["Rina"],
  );

  assert.ok(result.script.includes("Arya"));
  assert.equal(result.classification.genre, "ANIME");
  assert.equal(result.classification.emoji, "🌸");
});

test("aiDjManager: Signature Audio Greeting toggle dan generation", async () => {
  const fishAudioService = require("../services/fishAudioService");
  const origGenerateSpeech = fishAudioService.generateSpeech;
  const origIsConfigured = fishAudioService.isConfigured;

  fishAudioService.isConfigured = () => true;
  fishAudioService.generateSpeech = async () => Buffer.from("fake_mp3_audio_signature_bytes");

  try {
    const userId = "test-vip-user-999";

    // Default greeting enabled
    const defaultEnabled = await aiDjManager.isGreetingEnabled(userId);
    assert.equal(defaultEnabled, true);

    // Toggle off
    await aiDjManager.setGreetingEnabled(userId, false);
    const disabled = await aiDjManager.isGreetingEnabled(userId);
    assert.equal(disabled, false);

    // When disabled, generateSignatureGreeting returns empty script
    const disabledRes = await aiDjManager.generateSignatureGreeting({
      userId,
      displayName: "SobatVIP",
      trackTitle: "Neon City",
      lang: "id",
    });
    assert.equal(disabledRes.isSignature, false);
    assert.equal(disabledRes.script, "");

    // Toggle on
    await aiDjManager.setGreetingEnabled(userId, true);
    const enabledAgain = await aiDjManager.isGreetingEnabled(userId);
    assert.equal(enabledAgain, true);

    // When enabled, generateSignatureGreeting returns personalized greeting in Indonesian
    const enabledResId = await aiDjManager.generateSignatureGreeting({
      userId,
      displayName: "SobatVIP",
      trackTitle: "Neon City",
      lang: "id",
    });
    assert.equal(enabledResId.isSignature, true);
    assert.ok(enabledResId.script.includes("SobatVIP"));
    assert.ok(enabledResId.script.includes("Neon City"));
    assert.ok(Buffer.isBuffer(enabledResId.audioBuffer));

    // When enabled in English, returns personalized greeting in English
    const enabledResEn = await aiDjManager.generateSignatureGreeting({
      userId,
      displayName: "VipFriend",
      trackTitle: "Cyber Dreams",
      lang: "en",
    });
    assert.equal(enabledResEn.isSignature, true);
    assert.ok(enabledResEn.script.includes("VipFriend"));
    assert.ok(enabledResEn.script.includes("Cyber Dreams"));
    assert.ok(Buffer.isBuffer(enabledResEn.audioBuffer));
  } finally {
    fishAudioService.generateSpeech = origGenerateSpeech;
    fishAudioService.isConfigured = origIsConfigured;
  }
});

test("aiDjManager: getPersonaPronoun maps personas correctly", () => {
  assert.equal(aiDjManager.getPersonaPronoun("default", "id"), "kamu");
  assert.equal(aiDjManager.getPersonaPronoun("tsundere", "id"), "kamu");
  assert.equal(aiDjManager.getPersonaPronoun("kuudere", "id"), "dia");
  assert.equal(aiDjManager.getPersonaPronoun("gamer", "id"), "sobat mabar");
  assert.equal(aiDjManager.getPersonaPronoun("butler", "id"), "Anda");

  assert.equal(aiDjManager.getPersonaPronoun("default", "en"), "you");
  assert.equal(aiDjManager.getPersonaPronoun("gamer", "en"), "teammate");
});

test("aiDjManager: generateDjScript formats persona pronouns cleanly without 'Kak'", () => {
  const result = aiDjManager.generateDjScript(
    { title: "Diri", author: "Tulus" },
    "kamu",
    [],
    "id",
  );
  assert.ok(result.script.includes("kamu"));
  assert.ok(!result.script.includes("Kak kamu"), "Tidak boleh mengeja 'Kak kamu'");

  const kuudereRes = aiDjManager.generateDjScript(
    { title: "Teh Hijau", author: "Tulus" },
    "dia",
    [],
    "id",
  );
  assert.ok(kuudereRes.script.includes("dia"));
  assert.ok(!kuudereRes.script.includes("Kak dia"), "Tidak boleh mengeja 'Kak dia'");
});

test("aiDjManager: saveLocalIntroAudio creates file in intro directory", () => {
  const fs = require("fs");
  const testBuffer = Buffer.from("fake_intro_audio_bytes");
  const filePath = aiDjManager.saveLocalIntroAudio(testBuffer, "test_track_123");

  try {
    assert.ok(fs.existsSync(filePath), "File intro lokal harus berhasil dibuat");
    assert.ok(filePath.includes("intro"), "Path harus berada di folder intro");
    const readBack = fs.readFileSync(filePath);
    assert.deepEqual(readBack, testBuffer);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});



