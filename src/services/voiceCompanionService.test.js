"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const voiceCompanionService = require("./voiceCompanionService");
const fishAudioService = require("./fishAudioService");
const aiEnsembleRouter = require("../ai/aiEnsembleRouter");

describe("Duplex Voice Channel AI Companion Service", () => {
  let origGenerateSpeech;
  let origRouteTask;

  before(() => {
    origGenerateSpeech = fishAudioService.generateSpeech;
    fishAudioService.generateSpeech = async () =>
      Buffer.from("mock_audio_stream");

    origRouteTask = aiEnsembleRouter.routeTask;
    aiEnsembleRouter.routeTask = async () => ({
      text: "Halo Kak Aryandita! Naura siap mengobrol di voice channel.",
    });
  });

  after(() => {
    fishAudioService.generateSpeech = origGenerateSpeech;
    aiEnsembleRouter.routeTask = origRouteTask;
  });

  it("joinVoice mendaftarkan sesi voice channel aktif", async () => {
    const res = await voiceCompanionService.joinVoice({
      guildId: "guild_voice_test_01",
      channelId: "channel_vc_01",
      inviterName: "Aryandita",
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.session);
    assert.strictEqual(res.session.status, "LISTENING");

    const session = voiceCompanionService.getSession("guild_voice_test_01");
    assert.ok(session);
    assert.strictEqual(session.channelId, "channel_vc_01");
  });

  it("joinVoice menangani permintaan duplikat secara idempotent", async () => {
    const res = await voiceCompanionService.joinVoice({
      guildId: "guild_voice_test_01",
      channelId: "channel_vc_01",
    });

    assert.strictEqual(res.success, true);
  });

  it("handleBargeIn menghentikan ucapan aktif saat interupsi pengguna terjadi", async () => {
    const session = voiceCompanionService.getSession("guild_voice_test_01");
    assert.ok(session);

    // Simulasi Naura sedang berbicara
    session.isSpeaking = true;
    session.status = "SPEAKING";

    const bargeInRes = voiceCompanionService.handleBargeIn(
      "guild_voice_test_01",
      "user_voice_01",
    );
    assert.strictEqual(bargeInRes.aborted, true);
    assert.strictEqual(bargeInRes.bargeInCount, 1);
    assert.strictEqual(session.isSpeaking, false);
    assert.strictEqual(session.status, "LISTENING");

    // Pemanggilan kedua saat tidak sedang berbicara
    const secondBargeIn = voiceCompanionService.handleBargeIn(
      "guild_voice_test_01",
      "user_voice_01",
    );
    assert.strictEqual(secondBargeIn.aborted, false);
  });

  it("detectToolIntent mengenali maksud tindakan in-game secara akurat", () => {
    const t1 = voiceCompanionService.detectToolIntent(
      "Naura, cek saldoku dong",
    );
    assert.ok(t1);
    assert.strictEqual(t1.name, "check_balance");

    const t2 = voiceCompanionService.detectToolIntent(
      "Tolong putar lagu anime opening",
    );
    assert.ok(t2);
    assert.strictEqual(t2.name, "play_music");
    assert.strictEqual(t2.args.action, "play");

    const t3 = voiceCompanionService.detectToolIntent(
      "Lihat profil dan status saya",
    );
    assert.ok(t3);
    assert.strictEqual(t3.name, "get_user_info");

    const t4 = voiceCompanionService.detectToolIntent(
      "Naura, tolong panen kebun hidroponik",
    );
    assert.ok(t4);
    assert.strictEqual(t4.name, "harvest_greenhouse");

    const t5 = voiceCompanionService.detectToolIntent(
      "Tarik ramalan omikuji keberuntungan hari ini",
    );
    assert.ok(t5);
    assert.strictEqual(t5.name, "check_omikuji");

    const t6 = voiceCompanionService.detectToolIntent(
      "Bagaimana situasi pasar modal dan saham hari ini?",
    );
    assert.ok(t6);
    assert.strictEqual(t6.name, "check_stock_market");

    const t7 = voiceCompanionService.detectToolIntent(
      "Halo Naura, cuaca hari ini cerah ya",
    );
    assert.strictEqual(t7, null);
  });

  it("onVoiceActivity dan interruptAudio membatalkan audio saat pengguna berbicara", async () => {
    const session = voiceCompanionService.getSession("guild_voice_test_01");
    if (session) {
      session.isSpeaking = true;
      session.status = "SPEAKING";
      voiceCompanionService.onVoiceActivity(
        "guild_voice_test_01",
        "user_test",
        true,
      );
      assert.strictEqual(session.isSpeaking, false);
      assert.strictEqual(session.status, "LISTENING");

      session.isSpeaking = true;
      const res = voiceCompanionService.interruptAudio(
        "guild_voice_test_01",
        "user_test",
      );
      assert.strictEqual(res.aborted, true);
    }
  });

  it("getDuplexMetrics mengembalikan metrik sesi dan telemetri latensi", () => {
    const metrics = voiceCompanionService.getDuplexMetrics(
      "guild_voice_test_01",
    );
    assert.ok(metrics);
    assert.strictEqual(metrics.guildId, "guild_voice_test_01");
    assert.strictEqual(metrics.bargeInCount, 3);
    assert.ok(typeof metrics.maxLatencyMs === "number");
  });

  it("processVoiceTurn menghasilkan respons cerdas dan status audio", async () => {
    const res = await voiceCompanionService.processVoiceTurn({
      guildId: "guild_voice_test_01",
      userId: "user_voice_01",
      username: "Aryandita",
      promptText: "Halo Naura, bagaimana kabarmu hari ini?",
    });

    assert.ok(res);
    assert.ok(typeof res.replyText === "string");
    assert.ok(res.replyText.length > 0);
    assert.ok(typeof res.latencyMs === "number");
  });

  it("leaveVoice menutup sesi voice channel secara aman", async () => {
    const res = await voiceCompanionService.leaveVoice("guild_voice_test_01");
    assert.strictEqual(res.success, true);

    const sessionAfter = voiceCompanionService.getSession(
      "guild_voice_test_01",
    );
    assert.strictEqual(sessionAfter, null);
  });

  it("leaveVoice menangani pemanggilan saat sesi tidak aktif", async () => {
    const res = await voiceCompanionService.leaveVoice("guild_non_existent");
    assert.strictEqual(res.success, false);
  });
});
