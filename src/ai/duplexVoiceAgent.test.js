"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const duplexVoiceAgent = require("./duplexVoiceAgent");
const { DuplexVoiceAgent, VOICE_STATES } = duplexVoiceAgent;
const fishAudioService = require("../services/fishAudioService");
const aiEnsembleRouter = require("./aiEnsembleRouter");

test("DuplexVoiceAgent - Instance and State Constants Integrity", () => {
  assert.ok(duplexVoiceAgent, "duplexVoiceAgent singleton harus ada");
  assert.equal(typeof duplexVoiceAgent.startSession, "function");
  assert.equal(typeof duplexVoiceAgent.stopSession, "function");
  assert.equal(typeof duplexVoiceAgent.processSpeechInput, "function");
  assert.equal(typeof duplexVoiceAgent.interruptSpeaking, "function");
  assert.equal(typeof duplexVoiceAgent.getStatus, "function");

  assert.equal(VOICE_STATES.IDLE, "IDLE");
  assert.equal(VOICE_STATES.LISTENING, "LISTENING");
  assert.equal(VOICE_STATES.THINKING, "THINKING");
  assert.equal(VOICE_STATES.SPEAKING, "SPEAKING");
  assert.equal(VOICE_STATES.INTERRUPTED, "INTERRUPTED");
  assert.equal(VOICE_STATES.CLOSED, "CLOSED");
});

test("DuplexVoiceAgent - Lifecycle: startSession, getSession, isActive, stopSession", () => {
  const agent = new DuplexVoiceAgent();
  const guildId = "guild_test_voice_101";

  assert.equal(agent.isActive(guildId), false);
  assert.equal(agent.getSession(guildId), null);

  // Mulai sesi
  const session = agent.startSession(guildId, {
    channelId: "vc_channel_456",
    persona: "tsundere",
    language: "id",
  });

  assert.ok(session);
  assert.equal(session.guildId, guildId);
  assert.equal(session.channelId, "vc_channel_456");
  assert.equal(session.persona, "tsundere");
  assert.equal(session.language, "id");
  assert.equal(session.state, VOICE_STATES.LISTENING);
  assert.equal(agent.isActive(guildId), true);
  assert.equal(agent.getSession(guildId), session);

  // Status telemetri
  const status = agent.getStatus(guildId);
  assert.ok(status);
  assert.equal(status.guildId, guildId);
  assert.equal(status.channelId, "vc_channel_456");
  assert.equal(status.persona, "tsundere");
  assert.equal(status.bargeInCount, 0);

  // Hentikan sesi
  const stopped = agent.stopSession(guildId, "manual_disconnect");
  assert.equal(stopped, true);
  assert.equal(agent.isActive(guildId), false);
  assert.equal(agent.getSession(guildId), null);
  assert.equal(agent.getStatus(guildId), null);
});

test("DuplexVoiceAgent - Barge-in Interruption Mechanism", () => {
  const agent = new DuplexVoiceAgent();
  const guildId = "guild_barge_in_test";

  // Mock receiver dengan emitter speaking
  const mockSpeakingEmitter = new EventEmitter();
  const mockReceiver = {
    speaking: mockSpeakingEmitter,
    removeAllListeners: () => mockSpeakingEmitter.removeAllListeners(),
  };

  const session = agent.startSession(guildId, {
    channelId: "vc_test",
    receiver: mockReceiver,
  });

  // Set bot seolah-olah sedang berbicara
  session.state = VOICE_STATES.SPEAKING;

  let interruptedEventFired = false;
  agent.once("speaking:interrupted", (data) => {
    interruptedEventFired = true;
    assert.equal(data.guildId, guildId);
    assert.equal(data.reason, "user_barge_in");
  });

  // User mulai berbicara saat bot sedang berbicara -> memicu barge in
  mockReceiver.speaking.emit("start", "user_interrupter_123");

  assert.equal(interruptedEventFired, true);
  assert.equal(session.state, VOICE_STATES.LISTENING);
  assert.equal(session.bargeInCount, 1);

  agent.stopSession(guildId);
});

test("DuplexVoiceAgent - processSpeechInput AI Dialogue & Fish Audio TTS Pipeline", async () => {
  const agent = new DuplexVoiceAgent();
  const guildId = "guild_speech_pipeline";

  agent.startSession(guildId, {
    channelId: "vc_pipeline",
    persona: "default",
    language: "id",
  });

  // Mock AI ensemble router response
  const origRouteTask = aiEnsembleRouter.routeTask;
  aiEnsembleRouter.routeTask = async () => ({
    text: "Halo! Naura siap membantumu hari ini!",
    provider: "gemini",
    latencyMs: 120,
    model: "gemini-2.5-flash",
  });

  // Mock Fish Audio TTS
  const origIsConfigured = fishAudioService.isConfigured.bind(fishAudioService);
  const origGenerateSpeech = fishAudioService.generateSpeech.bind(fishAudioService);
  fishAudioService.isConfigured = () => true;
  fishAudioService.generateSpeech = async () => Buffer.from("dummy-mp3-audio-buffer-data");

  try {
    // 1. Uji input kosong
    const emptyRes = await agent.processSpeechInput(guildId, "user1", "   ");
    assert.equal(emptyRes.replyText, "");
    assert.equal(emptyRes.audioBuffer, null);

    // 2. Uji alur bicara normal
    const res = await agent.processSpeechInput(guildId, "user1", "Halo Naura apa kabar?");
    assert.ok(res.replyText.includes("Halo"));
    assert.ok(Buffer.isBuffer(res.audioBuffer));
    assert.ok(res.latencyMs >= 0);

    const session = agent.getSession(guildId);
    assert.equal(session.totalInteractions, 1);
    assert.ok(session.totalAudioBytesGenerated > 0);
    assert.equal(session.history.length, 2); // 1 user + 1 model
    assert.equal(session.history[0].role, "user");
    assert.equal(session.history[1].role, "model");
  } finally {
    aiEnsembleRouter.routeTask = origRouteTask;
    fishAudioService.isConfigured = origIsConfigured;
    fishAudioService.generateSpeech = origGenerateSpeech;
    agent.stopSession(guildId);
  }
});

test("DuplexVoiceAgent - Graceful Fallback saat Fish Audio Error", async () => {
  const agent = new DuplexVoiceAgent();
  const guildId = "guild_tts_error";

  agent.startSession(guildId, {
    channelId: "vc_error",
  });

  const origRouteTask = aiEnsembleRouter.routeTask;
  aiEnsembleRouter.routeTask = async () => ({
    text: "Jawaban bot tetap diproduksi meskipun TTS gagal.",
    provider: "gemini",
    latencyMs: 50,
  });

  const origIsConfigured = fishAudioService.isConfigured.bind(fishAudioService);
  const origGenerateSpeech = fishAudioService.generateSpeech.bind(fishAudioService);
  fishAudioService.isConfigured = () => true;
  fishAudioService.generateSpeech = async () => {
    throw new Error("Quota exceeded 429");
  };

  try {
    const res = await agent.processSpeechInput(guildId, "user_err", "Tes suara");
    assert.equal(res.replyText, "Jawaban bot tetap diproduksi meskipun TTS gagal.");
    assert.equal(res.audioBuffer, null, "Buffer harus null saat TTS gagal");
  } finally {
    aiEnsembleRouter.routeTask = origRouteTask;
    fishAudioService.isConfigured = origIsConfigured;
    fishAudioService.generateSpeech = origGenerateSpeech;
    agent.stopSession(guildId);
  }
});

test("DuplexVoiceAgent - Speaking debounce and silence timeout on speaker end", async () => {
  const agent = new DuplexVoiceAgent();
  agent.silenceTimeoutMs = 20; // Short timer for testing
  const guildId = "guild_debounce_test";

  const mockSpeakingEmitter = new EventEmitter();
  const mockReceiver = {
    speaking: mockSpeakingEmitter,
    removeAllListeners: () => mockSpeakingEmitter.removeAllListeners(),
  };

  const session = agent.startSession(guildId, {
    channelId: "vc_debounce",
    receiver: mockReceiver,
  });

  // User begins speaking
  mockReceiver.speaking.emit("start", "user_speaker_99");
  assert.equal(session.activeSpeakerId, "user_speaker_99");

  let speakerFinishedFired = false;
  agent.once("speaker:finished", (data) => {
    speakerFinishedFired = true;
    assert.equal(data.userId, "user_speaker_99");
    assert.equal(data.guildId, guildId);
  });

  // User stops speaking (initiating debounce)
  mockReceiver.speaking.emit("end", "user_speaker_99");
  assert.ok(session.speakingDebounceTimer, "Debounce timer harus aktif");

  // Wait for debounce timer to fire
  await new Promise((resolve) => setTimeout(resolve, 35));

  assert.equal(speakerFinishedFired, true, "Event speaker:finished harus dipancarkan setelah jeda hening");
  assert.equal(session.activeSpeakerId, null, "Speaker ID harus null setelah hening");

  agent.stopSession(guildId);
});
