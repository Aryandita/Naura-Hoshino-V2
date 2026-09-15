"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const voiceCompanionService = require("./voiceCompanionService");

describe("Duplex Voice Channel AI Companion Service", () => {
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
  });

  it("leaveVoice menutup sesi voice channel secara aman", async () => {
    const res = await voiceCompanionService.leaveVoice("guild_voice_test_01");
    assert.strictEqual(res.success, true);

    const sessionAfter = voiceCompanionService.getSession("guild_voice_test_01");
    assert.strictEqual(sessionAfter, null);
  });

  it("leaveVoice menangani pemanggilan saat sesi tidak aktif", async () => {
    const res = await voiceCompanionService.leaveVoice("guild_non_existent");
    assert.strictEqual(res.success, false);
  });
});
