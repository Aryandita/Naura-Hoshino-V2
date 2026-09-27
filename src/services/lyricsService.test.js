"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const lyricsService = require("./lyricsService");

describe("LyricsService - Pagination & Formatting", () => {
  it("paginateLyrics memecah teks panjang menjadi beberapa halaman", () => {
    const lines = [];
    for (let i = 1; i <= 60; i++) {
      lines.push(`Baris lirik ke-${i} dari lagu anime epik Naura Hoshino`);
    }
    const fullText = lines.join("\n");
    const pages = lyricsService.paginateLyrics(fullText, 400);

    assert.ok(pages.length > 1, "Harus menghasilkan lebih dari 1 halaman");
    for (const page of pages) {
      assert.ok(page.length <= 450, "Panjang per halaman tidak boleh melebihi batas toleransi");
    }
  });

  it("paginateLyrics menangani teks kosong atau pendek dengan aman", () => {
    const emptyPages = lyricsService.paginateLyrics("");
    assert.strictEqual(emptyPages.length, 1);

    const shortPages = lyricsService.paginateLyrics("Satu baris lirik singkat.");
    assert.strictEqual(shortPages.length, 1);
    assert.strictEqual(shortPages[0], "Satu baris lirik singkat.");
  });
});
