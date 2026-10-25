"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("playEngine - play validates empty query", async () => {
  const { play } = require("./playEngine");

  let sentPayload = null;
  const ctx = {
    client: { user: { displayAvatarURL: () => "https://example.com/avatar.png" } },
    poru: { players: new Map() },
    musicManager: { isDuplicateFilterEnabled: () => false, isRecentDuplicate: () => false },
    guild: { id: "guild1" },
    memberVoice: { id: "vc1" },
    channel: { id: "ch1" },
    user: { displayName: "TestUser", username: "testuser" },
    args: { query: "" },
    sendReply: async (payload) => { sentPayload = payload; return null; },
    deleteReply: () => {},
    player: null,
  };

  await play(ctx);
  assert.ok(sentPayload, "Harus mengirim error payload untuk query kosong");
});

test("playEngine - play creates connection when no player exists", async () => {
  const { play } = require("./playEngine");

  let connectionCreated = false;
  const mockPlayer = {
    queue: { add: () => {}, length: 0 },
    isPlaying: false,
    isPaused: false,
    play: () => {},
    voiceChannel: "vc1",
  };

  const ctx = {
    client: { user: { displayAvatarURL: () => "https://example.com/avatar.png" } },
    poru: {
      players: new Map(),
      createConnection: () => { connectionCreated = true; return mockPlayer; },
      resolve: async () => ({ tracks: [{ info: { title: "Test", author: "Artist", length: 180000, uri: "https://example.com", sourceName: "youtube", image: null } }], loadType: "TRACK_LOADED" }),
    },
    musicManager: { isDuplicateFilterEnabled: () => false, isRecentDuplicate: () => false },
    guild: { id: "guild1" },
    memberVoice: { id: "vc1" },
    channel: { id: "ch1" },
    user: { displayName: "TestUser", username: "testuser" },
    args: { query: "test song" },
    sendReply: async () => null,
    deleteReply: () => {},
    player: null,
  };

  await play(ctx);
  assert.ok(connectionCreated || ctx.player, "Harus membuat koneksi atau assign player");
});

test("playEngine - radio creates connection if no player", async () => {
  const { radio } = require("./playEngine");

  let connectionCreated = false;
  const mockPlayer = {
    queue: { clear: () => {}, add: () => {} },
    isPlaying: false,
    isPaused: false,
    play: () => {},
    voiceChannel: "vc1",
    textChannel: "ch1",
    is247: false,
  };

  const ctx = {
    poru: {
      players: new Map(),
      createConnection: () => { connectionCreated = true; return mockPlayer; },
      resolve: async () => ({ tracks: [{ info: { title: "Lofi Beat", originalSource: "youtube" } }] }),
    },
    guild: { id: "guild1" },
    memberVoice: { id: "vc1" },
    channel: { id: "ch1" },
    user: { displayName: "Test" },
    subcommand: "radio",
    sendReply: async () => null,
    player: null,
  };

  await radio(ctx);
  assert.ok(connectionCreated || ctx.player, "Radio harus membuat koneksi");
});
