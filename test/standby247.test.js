"use strict";

const { test, describe, mock, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Collection } = require("discord.js");

const standby247 = require("../src/music/standby247");
const musicAutoDisconnect = require("../src/events/voiceStateUpdate/musicAutoDisconnect");

const BOT_ID = "bot-1";
const GUILD_ID = "guild-1";

function makeMember(id, isBot = false) {
  return { id, user: { id, bot: isBot } };
}

function makeVoiceChannel(humanIds) {
  const members = new Collection();
  members.set(BOT_ID, makeMember(BOT_ID, true));
  for (const id of humanIds) members.set(id, makeMember(id));
  return { id: "vc-1", name: "Ruang Musik", members };
}

function makePlayer(overrides = {}) {
  const calls = { stopTrack: 0, destroy: 0, play: 0, queueClear: 0 };
  const player = {
    guildId: GUILD_ID,
    textChannel: undefined,
    voiceChannel: "vc-1",
    destroyed: false,
    isPlaying: true,
    isPaused: false,
    currentTrack: { info: { title: "Lagu Uji" } },
    queue: {
      clear: () => {
        calls.queueClear += 1;
      },
      add: () => {},
    },
    stopTrack: () => {
      calls.stopTrack += 1;
    },
    destroy: () => {
      calls.destroy += 1;
      player.destroyed = true;
    },
    play: () => {
      calls.play += 1;
    },
    ...overrides,
  };
  return { player, calls };
}

function makeClient(player, voiceChannel, extraManager = {}) {
  const players = new Map();
  if (player) players.set(GUILD_ID, player);
  return {
    user: { id: BOT_ID },
    musicManager: {
      poru: { players },
      uiCache: new Map(),
      client: { channels: { cache: new Map(), fetch: async () => null } },
      cancelSleepTimer: () => {},
      clearSkipVotes: () => {},
      isStay24_7: () => false,
      ...extraManager,
    },
    voiceChannel,
  };
}

function makeState(client, channel) {
  return {
    channel,
    guild: {
      id: GUILD_ID,
      name: "Guild Uji",
      channels: { cache: new Map([[channel.id, channel]]) },
    },
  };
}

afterEach(() => {
  mock.timers.reset();
});

describe("standby247.is247Active", () => {
  test("mengenali ketiga penanda 24/7 dan menolak player kosong", () => {
    const manager = { isStay24_7: (gid) => gid === "stay-guild" };
    assert.equal(standby247.is247Active(manager, null), false);
    assert.equal(standby247.is247Active(manager, { guildId: "x" }), false);
    assert.equal(standby247.is247Active(manager, { guildId: "x", is247: true }), true);
    assert.equal(standby247.is247Active(manager, { guildId: "x", is24_7: true }), true);
    assert.equal(standby247.is247Active(manager, { guildId: "stay-guild" }), true);
  });
});

describe("standby247.parkPlayer", () => {
  test("menghentikan lagu, mengosongkan antrean, dan tidak destroy player", async () => {
    const { player, calls } = makePlayer({ is247: true });
    const client = makeClient(player, null);

    const parked = await standby247.parkPlayer(client.musicManager, player);

    assert.equal(parked, true);
    assert.equal(player.aloneParked247, true);
    assert.equal(player.isIdle247, true);
    assert.equal(calls.stopTrack, 1);
    assert.equal(calls.queueClear, 1);
    assert.equal(calls.destroy, 0);
  });

  test("tidak memarkir dua kali dan mengabaikan player yang sudah destroyed", async () => {
    const { player, calls } = makePlayer({ is247: true });
    const client = makeClient(player, null);

    await standby247.parkPlayer(client.musicManager, player);
    const second = await standby247.parkPlayer(client.musicManager, player);
    assert.equal(second, false);
    assert.equal(calls.stopTrack, 1);

    const { player: dead } = makePlayer({ destroyed: true });
    assert.equal(await standby247.parkPlayer(client.musicManager, dead), false);
  });
});

describe("standby247.greetReturningListener", () => {
  test("hanya menyapa player yang sedang diparkir dan menghormati cooldown", async () => {
    const { player } = makePlayer({ is247: true });
    const client = makeClient(player, null);

    assert.equal(
      await standby247.greetReturningListener(client.musicManager, player),
      false,
      "player yang tidak diparkir tidak disapa",
    );

    player.aloneParked247 = true;
    assert.equal(await standby247.greetReturningListener(client.musicManager, player), true);
    assert.equal(player.aloneParked247, false);
    assert.ok(player.lastGreet247At > 0);

    player.aloneParked247 = true;
    assert.equal(
      await standby247.greetReturningListener(client.musicManager, player),
      false,
      "sapaan kedua dalam cooldown dilewati",
    );
    assert.equal(player.aloneParked247, false);
  });
});

describe("musicAutoDisconnect dengan mode 24/7", () => {
  test("sendirian di 24/7: tidak destroy setelah 3 menit, hanya parkir setelah 30 detik", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });

    const channel = makeVoiceChannel([]);
    const { player, calls } = makePlayer({ is247: true });
    const client = makeClient(player, channel);

    musicAutoDisconnect.execute(makeState(client, channel), makeState(client, channel), client);
    assert.equal(client.aloneDisconnectTimers.size, 1);

    mock.timers.tick(30 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(player.aloneParked247, true);
    assert.equal(calls.stopTrack, 1);

    mock.timers.tick(10 * 60 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.destroy, 0, "24/7 tidak boleh keluar voice");
  });

  test("tanpa 24/7: tetap destroy setelah 3 menit sendirian", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });

    const channel = makeVoiceChannel([]);
    const { player, calls } = makePlayer();
    const client = makeClient(player, channel);

    musicAutoDisconnect.execute(makeState(client, channel), makeState(client, channel), client);
    mock.timers.tick(3 * 60 * 1000);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(calls.destroy, 1);
    assert.equal(player.aloneParked247, undefined);
  });

  test("24/7 diaktifkan saat timer 3 menit berjalan: tidak keluar", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });

    const channel = makeVoiceChannel([]);
    const { player, calls } = makePlayer();
    const client = makeClient(player, channel);

    musicAutoDisconnect.execute(makeState(client, channel), makeState(client, channel), client);
    player.is247 = true;
    mock.timers.tick(3 * 60 * 1000);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(calls.destroy, 0);
    assert.equal(player.aloneParked247, true);
  });

  test("pengguna kembali sebelum 30 detik: timer parkir dibatalkan", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });

    const channel = makeVoiceChannel([]);
    const { player, calls } = makePlayer({ is247: true });
    const client = makeClient(player, channel);

    musicAutoDisconnect.execute(makeState(client, channel), makeState(client, channel), client);
    channel.members.set("user-1", makeMember("user-1"));
    musicAutoDisconnect.execute(makeState(client, channel), makeState(client, channel), client);

    assert.equal(client.aloneDisconnectTimers.size, 0);
    mock.timers.tick(60 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.stopTrack, 0);
    assert.equal(player.aloneParked247, undefined);
  });

  test("pengguna kembali setelah diparkir: player disapa dan tidak diparkir lagi", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });

    const channel = makeVoiceChannel([]);
    const { player, calls } = makePlayer({ is247: true });
    const client = makeClient(player, channel);

    musicAutoDisconnect.execute(makeState(client, channel), makeState(client, channel), client);
    mock.timers.tick(30 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(player.aloneParked247, true);

    channel.members.set("user-1", makeMember("user-1"));
    musicAutoDisconnect.execute(makeState(client, channel), makeState(client, channel), client);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(player.aloneParked247, false);
    assert.ok(player.lastGreet247At > 0);
    assert.equal(calls.destroy, 0);
  });
});

