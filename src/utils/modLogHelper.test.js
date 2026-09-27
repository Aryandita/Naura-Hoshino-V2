"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sendModLog } = require("./modLogHelper");

test("sendModLog - mengembalikan null bila parameter guild atau payload tidak lengkap", async () => {
  const result1 = await sendModLog(null, { content: "test" });
  assert.equal(result1, null);

  const result2 = await sendModLog({}, null);
  assert.equal(result2, null);
});

test("sendModLog - mengembalikan null bila auditLogChannel tidak dikonfigurasi", async () => {
  const mockGuild = {
    id: "guild_without_channel",
    channels: {
      cache: new Map(),
      fetch: async () => null,
    },
  };

  const result = await sendModLog(mockGuild, { content: "test" });
  assert.equal(result, null);
});

test("sendModLog - berhasil mengirimkan payload ke channel yang valid", async () => {
  let messageSent = null;

  const mockChannel = {
    id: "channel_123",
    send: async (payload) => {
      messageSent = payload;
      return { id: "msg_999", ...payload };
    },
  };

  const GuildSettings = require("../models/GuildSettings");
  const originalFindOne = GuildSettings.findOne;

  GuildSettings.findOne = async () => ({
    settings: { auditLogChannel: "channel_123" },
  });

  const mockGuild = {
    id: "guild_with_channel",
    channels: {
      cache: new Map([["channel_123", mockChannel]]),
      fetch: async () => mockChannel,
    },
  };

  try {
    const payload = { content: "Moderation Log Test" };
    const sent = await sendModLog(mockGuild, payload);
    assert.ok(sent);
    assert.equal(messageSent.content, "Moderation Log Test");
  } finally {
    GuildSettings.findOne = originalFindOne;
  }
});
