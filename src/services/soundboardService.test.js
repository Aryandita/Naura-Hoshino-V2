"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const soundboardService = require("./soundboardService");

test("SoundboardService - PRESET_SOUNDS integrity", () => {
  assert.ok(Array.isArray(soundboardService.PRESET_SOUNDS));
  assert.ok(soundboardService.PRESET_SOUNDS.length >= 8);

  const airhorn = soundboardService.PRESET_SOUNDS.find((s) => s.id === "airhorn");
  assert.ok(airhorn);
  assert.equal(airhorn.title, "Air Horn MLG");
  assert.ok(airhorn.url.startsWith("https://"));
});

test("SoundboardService - getAvailableSounds without guild returns presets", async () => {
  const sounds = await soundboardService.getAvailableSounds();
  assert.ok(Array.isArray(sounds));
  assert.ok(sounds.length >= 8);
  assert.ok(sounds.some((s) => s.id === "applause"));
});

test("SoundboardService - playSound parameter validation", async () => {
  const noGuild = await soundboardService.playSound({
    client: {},
    guildId: null,
    soundId: "airhorn",
  });
  assert.equal(noGuild.success, false);
  assert.ok(noGuild.message.includes("wajib disertakan"));

  const noSound = await soundboardService.playSound({
    client: {},
    guildId: "guild-1",
    soundId: "",
  });
  assert.equal(noSound.success, false);

  const unknownSound = await soundboardService.playSound({
    client: {},
    guildId: "guild-1",
    soundId: "unknown_sound_xyz",
  });
  assert.equal(unknownSound.success, false);
  assert.ok(unknownSound.message.includes("tidak ditemukan"));
});

test("SoundboardService - playSound Poru integration mock", async () => {
  let playCalled = false;
  let unshiftedTrack = null;

  const mockPlayer = {
    isPlaying: true,
    currentTrack: {
      info: { title: "Main Song" },
    },
    position: 45000,
    queue: {
      unshift: (t) => {
        unshiftedTrack = t;
      },
    },
    play: async () => {
      playCalled = true;
    },
  };

  const mockPoru = {
    players: new Map([["guild-test", mockPlayer]]),
    resolve: async ({ query }) => {
      return {
        tracks: [{ info: { title: "SFX Airhorn", uri: query } }],
      };
    },
  };

  const mockClient = {
    musicManager: { poru: mockPoru },
    user: { id: "bot-1" },
  };

  const result = await soundboardService.playSound({
    client: mockClient,
    guildId: "guild-test",
    soundId: "airhorn",
    requester: { id: "user-123", username: "Tester" },
  });

  assert.equal(result.success, true);
  assert.equal(playCalled, true);
  assert.ok(unshiftedTrack);
  assert.equal(unshiftedTrack.info.title, "Main Song");
  assert.equal(unshiftedTrack.info.resumePosition, 45000);
});
