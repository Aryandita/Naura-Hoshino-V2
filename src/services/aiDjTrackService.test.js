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

test("aiDjTrackService - general user uses persona pronoun and does not spell raw username", async () => {
  const Module = require("module");
  const originalRequire = Module.prototype.require;
  let capturedRequesterName = null;

  Module.prototype.require = function (id) {
    if (typeof id === "string" && id.includes("aiDjManager")) {
      return {
        isDjEnabled: () => true,
        detectVoiceLanguage: async () => "id",
        getPersonaPronoun: () => "kamu",
        generateDjScript: (trackInfo, reqName) => {
          capturedRequesterName = reqName;
          return { script: `Lagu untuk ${reqName}`, classification: { genre: "pop" } };
        },
        saveLocalIntroAudio: () => "d:\\test\\intro.mp3",
      };
    }
    if (typeof id === "string" && id.includes("fishAudioService")) {
      return { isConfigured: () => true, generateSpeech: async () => Buffer.from("audio") };
    }
    if (typeof id === "string" && id.includes("cacheManager")) {
      return { getUserProfile: async () => ({ isPremium: false }) };
    }
    if (typeof id === "string" && id.includes("discord.js")) {
      return {
        AttachmentBuilder: class {
          constructor(att, opts) {
            this.attachment = att;
            this.name = opts?.name;
          }
        },
        MessageFlags: {
          IsComponentsV2: 32768,
          Ephemeral: 64,
        },
      };
    }
    return originalRequire.apply(this, arguments);
  };

  delete require.cache[require.resolve("./aiDjTrackService")];
  const { prepareDjIntroTrack } = require("./aiDjTrackService");

  const sendMap = new Map();
  sendMap.set("file", { url: "https://example.com/audio.mp3" });

  await prepareDjIntroTrack({
    poru: { resolve: async () => ({ tracks: [{ info: {} }] }) },
    channel: { send: async () => ({ attachments: sendMap, id: "msg1" }) },
    user: { id: "user_normal_1", displayName: "RawUser123", username: "rawuser123" },
    trackInfo: { title: "Diri", author: "Tulus", identifier: "tulus_diri" },
    guildId: "guild1",
    musicManager: { poru: { players: new Map([["guild1", { voiceChannel: "vc1" }]]) } },
    memberVoice: "vc1",
  });

  assert.equal(capturedRequesterName, "kamu", "Pengguna umum harus menggunakan kata ganti persona");
  assert.notEqual(capturedRequesterName, "RawUser123", "Tidak boleh mengeja username mentah pengguna umum");

  Module.prototype.require = originalRequire;
});

test("aiDjTrackService - owner and premium user uses display name or custom dashboard name", async () => {
  const Module = require("module");
  const originalRequire = Module.prototype.require;
  let capturedRequesterName = null;

  Module.prototype.require = function (id) {
    if (typeof id === "string" && id.includes("aiDjManager")) {
      return {
        isDjEnabled: () => true,
        detectVoiceLanguage: async () => "id",
        getPersonaPronoun: () => "kamu",
        generateDjScript: (trackInfo, reqName) => {
          capturedRequesterName = reqName;
          return { script: `Lagu untuk ${reqName}`, classification: { genre: "pop" } };
        },
        saveLocalIntroAudio: () => "d:\\test\\intro.mp3",
      };
    }
    if (typeof id === "string" && id.includes("fishAudioService")) {
      return {
        isConfigured: () => true,
        getOrGeneratePremiumAudio: async () => Buffer.from("premium_audio"),
        generateSpeech: async () => Buffer.from("audio"),
      };
    }
    if (typeof id === "string" && id.includes("cacheManager")) {
      return {
        getUserProfile: async () => ({
          isPremium: true,
          premiumUntil: new Date("2099-01-01"),
          aiPersona: { name: "Sultan Naura" },
        }),
      };
    }
    if (typeof id === "string" && id.includes("discord.js")) {
      return {
        AttachmentBuilder: class {
          constructor(att, opts) {
            this.attachment = att;
            this.name = opts?.name;
          }
        },
        MessageFlags: {
          IsComponentsV2: 32768,
          Ephemeral: 64,
        },
      };
    }
    return originalRequire.apply(this, arguments);
  };

  delete require.cache[require.resolve("./aiDjTrackService")];
  const { prepareDjIntroTrack } = require("./aiDjTrackService");

  const sendMap = new Map();
  sendMap.set("file", { url: "https://example.com/audio.mp3" });

  await prepareDjIntroTrack({
    poru: { resolve: async () => ({ tracks: [{ info: {} }] }) },
    channel: { send: async () => ({ attachments: sendMap, id: "msg1" }) },
    user: { id: "user_vip_1", displayName: "VipBoss", username: "vipboss" },
    trackInfo: { title: "Teh Hijau", author: "Tulus", identifier: "tulus_teh" },
    guildId: "guild1",
    musicManager: { poru: { players: new Map([["guild1", { voiceChannel: "vc1" }]]) } },
    memberVoice: "vc1",
  });

  assert.equal(capturedRequesterName, "Sultan Naura", "VIP dengan custom name dashboard harus menyebut custom name");

  Module.prototype.require = originalRequire;
});

test("aiDjTrackService - saves audio intro locally and returns localFilePath", async () => {
  const Module = require("module");
  const originalRequire = Module.prototype.require;
  let saveLocalCalled = false;

  Module.prototype.require = function (id) {
    if (typeof id === "string" && id.includes("aiDjManager")) {
      return {
        isDjEnabled: () => true,
        detectVoiceLanguage: async () => "id",
        getPersonaPronoun: () => "kamu",
        generateDjScript: () => ({ script: "Lagu spesial", classification: { genre: "pop" } }),
        saveLocalIntroAudio: () => {
          saveLocalCalled = true;
          return "d:\\Naura Hoshino V2\\assets\\audio\\dj\\intro\\intro_test.mp3";
        },
      };
    }
    if (typeof id === "string" && id.includes("fishAudioService")) {
      return { isConfigured: () => true, generateSpeech: async () => Buffer.from("fake_mp3_data") };
    }
    if (typeof id === "string" && id.includes("cacheManager")) {
      return { getUserProfile: async () => ({ isPremium: false }) };
    }
    if (typeof id === "string" && id.includes("discord.js")) {
      return {
        AttachmentBuilder: class {
          constructor(att, opts) {
            this.attachment = att;
            this.name = opts?.name;
          }
        },
        MessageFlags: {
          IsComponentsV2: 32768,
          Ephemeral: 64,
        },
      };
    }
    return originalRequire.apply(this, arguments);
  };

  delete require.cache[require.resolve("./aiDjTrackService")];
  const { prepareDjIntroTrack } = require("./aiDjTrackService");

  const sendMap = new Map();
  sendMap.set("file", { url: "https://example.com/audio.mp3" });

  const result = await prepareDjIntroTrack({
    poru: { resolve: async () => ({ tracks: [{ info: {} }] }) },
    channel: { send: async () => ({ attachments: sendMap, id: "msg1" }) },
    user: { id: "user_1", displayName: "Tester", username: "tester" },
    trackInfo: { title: "Diri", author: "Tulus", identifier: "diri_id" },
    guildId: "guild1",
    musicManager: { poru: { players: new Map([["guild1", { voiceChannel: "vc1" }]]) } },
    memberVoice: "vc1",
  });

  assert.ok(result, "Harus mengembalikan result intro track");
  assert.equal(saveLocalCalled, true, "Harus memanggil saveLocalIntroAudio");
  assert.ok(result.localFilePath.includes("intro"), "localFilePath harus diisi");
  assert.equal(result.ttsTrack.isTTS, true, "Track harus berstatus isTTS = true");

  Module.prototype.require = originalRequire;
});

