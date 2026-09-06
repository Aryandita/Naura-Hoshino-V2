// Lokasi: src/canvas/inventoryCanvas.test.js
// Unit test untuk logika adaptive grid scaling dan rendering inventory canvas

"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {
  computeGridLayout,
  generateInventoryBackpackImage,
} = require("./inventoryCanvas");

test("computeGridLayout mengembalikan konfigurasi grid yang tepat sesuai jumlah item", () => {
  // 1. Sedikit item (<= 6) -> Mode Large
  const layoutSmall = computeGridLayout(3);
  assert.strictEqual(layoutSmall.mode, "large");
  assert.strictEqual(layoutSmall.cols, 3);
  assert.strictEqual(layoutSmall.rows, 2);
  assert.strictEqual(layoutSmall.maxVisible, 6);
  assert.strictEqual(layoutSmall.slotW, 180);

  const layout6 = computeGridLayout(6);
  assert.strictEqual(layout6.mode, "large");
  assert.strictEqual(layout6.maxVisible, 6);

  // 2. Sedang (7 - 12 item) -> Mode Medium
  const layout7 = computeGridLayout(7);
  assert.strictEqual(layout7.mode, "medium");
  assert.strictEqual(layout7.cols, 4);
  assert.strictEqual(layout7.rows, 3);
  assert.strictEqual(layout7.maxVisible, 12);
  assert.strictEqual(layout7.slotW, 136);

  const layout12 = computeGridLayout(12);
  assert.strictEqual(layout12.mode, "medium");
  assert.strictEqual(layout12.maxVisible, 12);

  // 3. Banyak (>= 13 item) -> Mode Compact
  const layout13 = computeGridLayout(13);
  assert.strictEqual(layout13.mode, "compact");
  assert.strictEqual(layout13.cols, 5);
  assert.strictEqual(layout13.rows, 3);
  assert.strictEqual(layout13.maxVisible, 15);
  assert.strictEqual(layout13.slotW, 112);

  const layout25 = computeGridLayout(25);
  assert.strictEqual(layout25.mode, "compact");
  assert.strictEqual(layout25.maxVisible, 15);
});

test("computeGridLayout mengkalkulasi sisa item overflow dengan akurat", () => {
  const totalItems = 23;
  const layout = computeGridLayout(totalItems);
  const hasOverflow = totalItems > layout.maxVisible;
  assert.strictEqual(hasOverflow, true);

  // Slot terakhir adalah slot ke-15 (index 14)
  // Menampilkan 14 item pertama + 1 slot overflow (+9 more)
  const overflowRemaining = totalItems - (layout.maxVisible - 1);
  assert.strictEqual(overflowRemaining, 9);
});

test("generateInventoryBackpackImage menghasilkan buffer PNG valid", async () => {
  const mockUser = {
    id: "123456789012345678",
    displayName: "Hoshino Adventurer",
    username: "hoshino_adv",
  };

  const mockInventory = [
    { id: "wooden_sword", name: "Pedang Kayu Latih", amount: 1 },
    { id: "apple", name: "Apel Segar", amount: 5 },
    { id: "iron_ingot", name: "Batang Besi Tempa", amount: 12 },
  ];

  const mockProfile = {
    coins: 5000,
    coupons: 10,
  };

  const buffer = await generateInventoryBackpackImage(mockUser, mockInventory, mockProfile);
  assert.ok(Buffer.isBuffer(buffer), "Output harus berupa Buffer");
  assert.ok(buffer.length > 1000, "Ukuran buffer gambar harus lebih dari 1KB");

  // Periksa signature PNG (8 byte pertama: 89 50 4E 47 0D 0A 1A 0A)
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  assert.strictEqual(isPng, true, "Format gambar yang dihasilkan harus valid PNG");
});
