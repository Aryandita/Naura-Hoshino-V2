"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("aiDjTrackService - returns null when AI DJ disabled", async () => {
  const Module = require("module");
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (id) {
    if (typeof id === "string" && id.includes("aiDjManager")) {
      return { isDjEnabled: () => false, detectVoiceLanguage: async () => "id", generateDjScript: () => ({ script: "", classification: { genre: "pop" } }) };
    }
    if (typeof id === "string" && id.includes("fishAudioService")) {
      return { isConfigured: () => true, generateSpeech: async () => Buffer.from("test") };
    }
    if (typeof id === "string" && id.includes("discord.js")) {
      return { AttachmentBuilder: class { constructor() {} } };
    }
    return originalRequire.apply(this, arguments);
  };

  delete require.cache[require.resolve("./aiDjTrackService")];
  const { prepareDjIntroTrack } = require("./aiDjTrackService");

  const result = await prepareDjIntroTrack({
    poru: {},
    channel: {},
    user: { displayName: "Test" },
    trackInfo: { title: "Song", author: "Artist" },
    guildId: "guild1",
    musicManager: { poru: { players: new Map() } },
  });

  assert.equal(result, null, "Harus return null saat AI DJ disabled");

  Module.prototype.require = originalRequire;
});

test("aiDjTrackService - returns null when Fish Audio not configured", async () => {
  const Module = require("module");
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (id) {
    if (typeof id === "string" && id.includes("aiDjManager")) {
      return { isDjEnabled: () => true, detectVoiceLanguage: async () => "id", generateDjScript: () => ({ script: "", classification: { genre: "pop" } }) };
    }
    if (typeof id === "string" && id.includes("fishAudioService")) {
      return { isConfigured: () => false, generateSpeech: async () => null };
    }
    if (typeof id === "string" && id.includes("discord.js")) {
      return { AttachmentBuilder: class { constructor() {} } };
    }
    return originalRequire.apply(this, arguments);
  };

  delete require.cache[require.resolve("./aiDjTrackService")];
  const { prepareDjIntroTrack } = require("./aiDjTrackService");

  const result = await prepareDjIntroTrack({
    poru: {},
    channel: {},
    user: { displayName: "Test" },
    trackInfo: { title: "Song", author: "Artist" },
    guildId: "guild1",
    musicManager: { poru: { players: new Map() } },
  });

  assert.equal(result, null, "Harus return null saat Fish Audio tidak dikonfigurasi");

  Module.prototype.require = originalRequire;
});

test("aiDjTrackService - returns null when voiceChannel not found", async () => {
  const Module = require("module");
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (id) {
    if (typeof id === "string" && id.includes("aiDjManager")) {
      return { isDjEnabled: () => true, detectVoiceLanguage: async () => "id", generateDjScript: () => ({ script: "", classification: { genre: "pop" } }) };
    }
    if (typeof id === "string" && id.includes("fishAudioService")) {
      return { isConfigured: () => true, generateSpeech: async () => Buffer.from("test") };
    }
    if (typeof id === "string" && id.includes("discord.js")) {
      return { AttachmentBuilder: class { constructor() {} } };
    }
    return originalRequire.apply(this, arguments);
  };

  delete require.cache[require.resolve("./aiDjTrackService")];
  const { prepareDjIntroTrack } = require("./aiDjTrackService");

  const result = await prepareDjIntroTrack({
    poru: {},
    channel: {},
    user: { displayName: "Test" },
    trackInfo: { title: "Song", author: "Artist" },
    guildId: "guild1",
    musicManager: { poru: { players: new Map() } },
    memberVoice: null,
  });

  assert.equal(result, null, "Harus return null saat voiceChannel tidak ditemukan");

  Module.prototype.require = originalRequire;
});

test("aiDjTrackService - returns null when generateSpeech fails", async () => {
  const Module = require("module");
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function (id) {
    if (typeof id === "string" && id.includes("aiDjManager")) {
      return { isDjEnabled: () => true, detectVoiceLanguage: async () => "id", generateDjScript: () => ({ script: "Test script", classification: { genre: "pop" } }) };
    }
    if (typeof id === "string" && id.includes("fishAudioService")) {
      return { isConfigured: () => true, generateSpeech: async () => null };
    }
    if (typeof id === "string" && id.includes("discord.js")) {
      return { AttachmentBuilder: class { constructor() {} } };
    }
    return originalRequire.apply(this, arguments);
  };

  delete require.cache[require.resolve("./aiDjTrackService")];
  const { prepareDjIntroTrack } = require("./aiDjTrackService");

  const result = await prepareDjIntroTrack({
    poru: {},
    channel: { send: async () => ({ attachments: new Map() }) },
    user: { displayName: "Test" },
    trackInfo: { title: "Song", author: "Artist" },
    guildId: "guild1",
    musicManager: { poru: { players: new Map([["guild1", { voiceChannel: "vc1" }]]) } },
    memberVoice: "vc1",
  });

  assert.equal(result, null, "Harus return null saat generateSpeech return null");

  Module.prototype.require = originalRequire;
});
