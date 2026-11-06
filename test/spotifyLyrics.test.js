"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const LyricsManager = require("../src/music/LyricsManager");

describe("Spotify Live Lyrics Engine & Timeline Suite", () => {
  const manager = new LyricsManager({});

  it("renderProgressBar menghasilkan timeline visual yang proporsional", () => {
    // 0 detik dari 120 detik (0%)
    const bar0 = manager.renderProgressBar(0, 120000, 10);
    assert.ok(bar0.includes("0:00"), "Harus memuat durasi awal 0:00");
    assert.ok(bar0.includes("2:00"), "Harus memuat durasi akhir 2:00");
    assert.ok(bar0.includes("🟢"), "Harus memiliki penanda aktif");

    // 60 detik dari 120 detik (50%)
    const barHalf = manager.renderProgressBar(60000, 120000, 10);
    assert.ok(barHalf.includes("1:00"));
    assert.ok(barHalf.includes("2:00"));

    // Kasus durasi 0 atau tidak valid
    const barZero = manager.renderProgressBar(0, 0, 10);
    assert.strictEqual(barZero, "0:00 ━━━━🟢━━━━ 0:00");
  });

  it("parseLRC mengekstrak baris dan waktu milidetik secara presisi", () => {
    const rawLrc = [
      "[00:00.50] Hello world",
      "[00:15.25] Second verse is singing",
      "[01:02.100] Final chorus here",
      "Non timestamp line should be ignored",
    ].join("\n");

    const parsed = manager.parseLRC(rawLrc);
    assert.strictEqual(parsed.length, 3, "Harus mengabaikan baris tanpa timestamp");

    assert.strictEqual(parsed[0].text, "Hello world");
    assert.strictEqual(parsed[0].time, 500);

    assert.strictEqual(parsed[1].text, "Second verse is singing");
    assert.strictEqual(parsed[1].time, 15250);

    assert.strictEqual(parsed[2].text, "Final chorus here");
    assert.strictEqual(parsed[2].time, 62100);
  });

  it("formatDur mengonversi milidetik ke string mm:ss", () => {
    assert.strictEqual(manager.formatDur(0), "0:00");
    assert.strictEqual(manager.formatDur(65000), "1:05");
    assert.strictEqual(manager.formatDur(360000), "6:00");
  });
});

