"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("MusicManager - isRecentDuplicate returns false untuk track baru", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  const track = { info: { title: "Lagu Baru", author: "Artist", uri: "https://example.com/1", identifier: "abc123" } };
  assert.equal(manager.isRecentDuplicate("guild1", track), false);
});

test("MusicManager - recordPlayedTrack menyimpan history", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  const track = { info: { title: "Test Song", author: "Test Artist", uri: "https://example.com/test", identifier: "test1" } };
  manager.recordPlayedTrack("guild1", track);

  const history = manager.trackHistories.get("guild1");
  assert.ok(history, "History harus tersimpan");
  assert.equal(history.length, 1);
  assert.equal(history[0].title, "test song");
});

test("MusicManager - isRecentDuplicate returns true untuk duplikat dalam 5 lagu", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  const track1 = { info: { title: "Song A", author: "Artist", uri: "https://example.com/a", identifier: "a1" } };
  const track2 = { info: { title: "Song B", author: "Artist", uri: "https://example.com/b", identifier: "b1" } };
  const track3 = { info: { title: "Song C", author: "Artist", uri: "https://example.com/c", identifier: "c1" } };

  manager.recordPlayedTrack("guild1", track1);
  manager.recordPlayedTrack("guild1", track2);
  manager.recordPlayedTrack("guild1", track3);

  assert.equal(manager.isRecentDuplicate("guild1", track1), true, "Track A harus terdeteksi duplikat");
  assert.equal(manager.isRecentDuplicate("guild1", track2), true, "Track B harus terdeteksi duplikat");
});

test("MusicManager - recordPlayedTrack membatasi max 10 entry", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  for (let i = 0; i < 15; i++) {
    const track = { info: { title: `Song ${i}`, author: "Artist", uri: `https://example.com/${i}`, identifier: `id${i}` } };
    manager.recordPlayedTrack("guild1", track);
  }

  const history = manager.trackHistories.get("guild1");
  assert.equal(history.length, 10, "History maksimal 10 entry");
});

test("MusicManager - isRecentDuplicate hanya cek 5 terakhir", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  const oldTrack = { info: { title: "Old Song", author: "Artist", uri: "https://example.com/old", identifier: "old1" } };
  manager.recordPlayedTrack("guild1", oldTrack);

  for (let i = 0; i < 6; i++) {
    const track = { info: { title: `New Song ${i}`, author: "Artist", uri: `https://example.com/new${i}`, identifier: `new${i}` } };
    manager.recordPlayedTrack("guild1", track);
  }

  assert.equal(manager.isRecentDuplicate("guild1", oldTrack), false, "Track lama di luar 5 terakhir tidak dianggap duplikat");
});

test("MusicManager - duplicate filter state management", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  assert.equal(manager.isDuplicateFilterEnabled("guild1"), false, "Default disabled");

  manager.setDuplicateFilterEnabled("guild1", true);
  assert.equal(manager.isDuplicateFilterEnabled("guild1"), true, "Setelah enable");

  manager.setDuplicateFilterEnabled("guild1", false);
  assert.equal(manager.isDuplicateFilterEnabled("guild1"), false, "Setelah disable");
});

test("MusicManager - sleep timer set dan cancel", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  const mockPlayer = { setVolume: () => {}, stop: () => {} };
  const mockGuild = { id: "guild1" };

  manager.setSleepTimer(mockGuild, mockPlayer, 5);
  const timer = manager.getSleepTimer("guild1");
  assert.ok(timer, "Timer harus ada setelah set");

  manager.cancelSleepTimer("guild1");
  const afterCancel = manager.getSleepTimer("guild1");
  assert.equal(afterCancel, null, "Timer harus null setelah cancel");
});

test("MusicManager - stay247 state management", () => {
  const { MusicManager } = require("./musicManager");
  const manager = new MusicManager({});

  assert.equal(manager.isStay24_7("guild1"), false, "Default false");

  manager.setStay24_7("guild1", true);
  assert.equal(manager.isStay24_7("guild1"), true, "Setelah enable");

  manager.setStay24_7("guild1", false);
  assert.equal(manager.isStay24_7("guild1"), false, "Setelah disable");
});
