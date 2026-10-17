"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const economyContract = require("./economyContract");
const survivalContract = require("./survivalContract");
const musicContract = require("./musicContract");
const eventBus = require("../../core/eventBus");

test("EconomyContract - getBalance, charge, reward, and pure tax calculation", async () => {
  // Pure tax check
  const tax = economyContract.calculateDynamicTax(1000, 0.05);
  assert.equal(tax, 50);

  // Invalid user getBalance returns zeros
  const balEmpty = await economyContract.getBalance("");
  assert.deepEqual(balEmpty, { wallet: 0, bank: 0, total: 0 });

  // Charge invalid amount returns ok: false
  const chargeInvalid = await economyContract.charge("test-user", -10);
  assert.equal(chargeInvalid.ok, false);
});

test("SurvivalContract - getCharacter default values and vitals patch clamping", async () => {
  // Empty user character
  const emptyChar = await survivalContract.getCharacter("");
  assert.equal(emptyChar.userId, "");
  assert.equal(emptyChar.hp, 0);

  // Clamped patch validation (no DB call needed if empty user)
  const emptyVitals = await survivalContract.updateVitals("", { hp: 150 });
  assert.equal(emptyVitals.hp, 0);
});

test("SurvivalContract - bridgeFragmentsToCoins validation", async () => {
  // Should reject if < 1000 fragments
  const resLow = await survivalContract.bridgeFragmentsToCoins("test-user", 500);
  assert.equal(resLow.ok, false);
  assert.equal(resLow.reason, "MINIMUM_1000_FRAGMENTS_REQUIRED");
});

test("MusicContract - getState when no player active", () => {
  const state = musicContract.getState("fake-guild-123");
  assert.equal(state.guildId, "fake-guild-123");
  assert.equal(state.isActive, false);
  assert.equal(state.isPlaying, false);
  assert.equal(state.currentTrack, null);

  const skipRes = musicContract.skip("fake-guild-123");
  assert.equal(skipRes.ok, false);
  assert.equal(skipRes.reason, "NO_ACTIVE_PLAYER");

  const q = musicContract.getQueue("fake-guild-123");
  assert.deepEqual(q, { currentTrack: null, queue: [] });
});

test("DomainContracts - EventBus notifications on domain actions", () => {
  let eventFired = false;
  eventBus.on("music:skip", (data) => {
    if (data.guildId === "mock-guild-99") eventFired = true;
  });

  // Mock player on musicContract
  const mockPlayer = {
    stop() {},
    isPlaying: false,
    isPaused: false,
    currentTrack: null,
    position: 0,
    volume: 100,
    queue: [],
  };
  const originalGetPlayer = musicContract.getPlayer;
  musicContract.getPlayer = () => mockPlayer;

  try {
    const res = musicContract.skip("mock-guild-99");
    assert.equal(res.ok, true);
    assert.equal(eventFired, true);
  } finally {
    musicContract.getPlayer = originalGetPlayer;
    eventBus.clear();
  }
});
