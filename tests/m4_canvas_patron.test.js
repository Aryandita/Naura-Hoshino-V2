"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

test("M4 Canvas: profileWorker exports and VIP profile card generation", async () => {
  const profileWorker = require("../src/canvas/workers/profileWorker");
  assert.equal(typeof profileWorker.generateProfileCard, "function");
  assert.equal(typeof profileWorker.generateBusinessCard, "function");
  assert.equal(typeof profileWorker.generateUnifiedProfile, "function");

  // Test generateProfileCard with VIP user payload (Hologram border & VIP gold stamp)
  const vipPayload = {
    userId: "user_vip_canvas_test",
    username: "NauraPatron",
    avatarUrl: null,
    isPremium: true,
    premiumTier: "vip",
    wallet: 500000,
    bank: 1000000,
    starFragments: 8500,
    level: 42,
    xp: 2500,
    rank: 1,
  };

  const buffer = await profileWorker.generateProfileCard(vipPayload);
  assert.ok(Buffer.isBuffer(buffer), "Buffer output harus dihasilkan");
  assert.ok(buffer.length > 1000, "Ukuran file kartu profil VIP harus valid");

  // Test with standard user payload
  const standardPayload = {
    userId: "user_standard_canvas_test",
    username: "RegularPlayer",
    isPremium: false,
    premiumTier: "none",
    wallet: 100,
    bank: 500,
    starFragments: 50,
    level: 2,
    xp: 50,
    rank: 15,
  };

  const stdBuffer = await profileWorker.generateProfileCard(standardPayload);
  assert.ok(Buffer.isBuffer(stdBuffer), "Buffer output standar harus dihasilkan");
  assert.ok(stdBuffer.length > 1000, "Ukuran file kartu profil standar harus valid");
});

test("M4 Music: stay24_7 mode on MusicManager and LavalinkClusterManager", () => {
  const MusicManager = require("../src/managers/musicManager");
  const { lavalinkClusterManager } = require("../src/managers/lavalinkClusterManager");

  const mockClient = {
    channels: { cache: new Map() },
  };

  const musicManager = new MusicManager(mockClient);

  const testGuildId = "987654321098765432";

  // Initially 24/7 is disabled
  assert.equal(musicManager.isStay24_7(testGuildId), false);

  // Enable 24/7 mode
  const enabled = musicManager.setStay24_7(testGuildId, true);
  assert.equal(enabled, true);
  assert.equal(musicManager.isStay24_7(testGuildId), true);

  // Disable 24/7 mode
  const disabled = musicManager.setStay24_7(testGuildId, false);
  assert.equal(disabled, false);
  assert.equal(musicManager.isStay24_7(testGuildId), false);

  // Test lavalinkClusterManager isStay24_7
  assert.equal(typeof lavalinkClusterManager.isStay24_7, "function");
  // Without musicManager registered in container, defaults to false
  assert.equal(lavalinkClusterManager.isStay24_7(testGuildId), false);
});

test("M4 Soundboard: slot expansion for VIP and Guild Patron", () => {
  const soundboardService = require("../src/services/soundboardService");

  assert.equal(soundboardService.DEFAULT_MAX_CUSTOM_SOUNDS, 20);
  assert.equal(soundboardService.VIP_MAX_CUSTOM_SOUNDS, 50);

  // Standard server gets 20 slots
  assert.equal(soundboardService.getMaxCustomSounds(false), 20);

  // VIP / Guild Patron server gets 50 slots
  assert.equal(soundboardService.getMaxCustomSounds(true), 50);
});
