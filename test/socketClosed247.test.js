"use strict";

const { test, describe, mock, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const cacheManager = require("../src/managers/cacheManager");
const socketClosed = require("../src/music/poru_events/socketClosed");

function makeManager(created) {
  return {
    uiCache: new Map(),
    isStay24_7: () => false,
    client: {
      guilds: {
        cache: new Map([
          ["guild-1", { channels: { cache: new Map([["vc-1", { id: "vc-1" }]]) } }],
        ]),
      },
    },
    poru: {
      players: new Map(),
      createConnection: (opts) => {
        const p = { ...opts };
        created.push(p);
        return p;
      },
    },
  };
}

function makePlayer(extra = {}) {
  const state = { destroyed: 0 };
  return {
    state,
    player: {
      guildId: "guild-1",
      voiceChannel: "vc-1",
      textChannel: "tc-1",
      destroy: () => {
        state.destroyed += 1;
      },
      ...extra,
    },
  };
}

afterEach(() => {
  mock.restoreAll();
  mock.timers.reset();
});

describe("socketClosed dengan mode 24/7", () => {
  test("24/7 melewati batas retry tanpa destroy dan tetap menjadwalkan reconnect", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    mock.method(cacheManager, "getGuildSettings", async () => ({}));

    const created = [];
    const { player, state } = makePlayer({ is247: true, socketRetryCount: 50 });
    await socketClosed.execute(makeManager(created), player, { code: 4006 });

    assert.equal(state.destroyed, 0);
    assert.equal(player.socketRetryCount, 8);

    mock.timers.tick(61 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(created.length, 1);
    assert.equal(created[0].voiceChannel, "vc-1");
    assert.equal(created[0].is247, true);
  });

  test("24/7 yang channel-nya belum tersedia mencoba lagi, bukan menyerah", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    mock.method(cacheManager, "getGuildSettings", async () => ({}));

    const created = [];
    const manager = makeManager(created);
    const channels = manager.client.guilds.cache.get("guild-1").channels.cache;
    channels.clear();

    const { player, state } = makePlayer({ is247: true });
    await socketClosed.execute(manager, player, { code: 4006 });

    mock.timers.tick(61 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(created.length, 0);

    channels.set("vc-1", { id: "vc-1" });
    mock.timers.tick(61 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(created.length, 1);
    assert.equal(state.destroyed, 0);
  });

  test("tanpa 24/7: melewati batas retry tetap destroy", async () => {
    mock.method(cacheManager, "getGuildSettings", async () => ({}));

    const created = [];
    const { player, state } = makePlayer({ socketRetryCount: 50 });
    await socketClosed.execute(makeManager(created), player, { code: 4006 });

    assert.equal(state.destroyed, 1);
    assert.equal(created.length, 0);
  });
});

