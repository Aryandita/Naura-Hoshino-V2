"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderFishCatch } = require("./fishCanvas");

test("fishCanvas - renderFishCatch menghasilkan PNG Buffer yang valid", async () => {
  const payload = {
    username: "TestAngler",
    fish: {
      name: "Ikan Salmon Segar Ujang",
      rarity: "Langka",
      weight: 2.85,
      length: 38,
      value: 120,
      emoji: "🐟",
    },
    locationName: "Pangkalan Perahu & Dermaga Mang Ujang",
    isRecord: true,
  };

  const buffer = await renderFishCatch(payload);
  assert.ok(Buffer.isBuffer(buffer), "Output harus berupa Buffer");
  assert.ok(buffer.length > 0, "Buffer tidak boleh kosong");
  // Cek magic number PNG: 0x89 0x50 0x4E 0x47
  assert.equal(buffer[0], 0x89);
  assert.equal(buffer[1], 0x50);
  assert.equal(buffer[2], 0x4e);
  assert.equal(buffer[3], 0x47);
});
