"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CROP_SEEDS, getSeedById } = require("../data/cropSeeds");
const greenhouseEngine = require("./greenhouseEngine");

test("Crop Seeds Catalog - Data Integrity", () => {
  assert.ok(Array.isArray(CROP_SEEDS), "CROP_SEEDS harus berupa array");
  assert.equal(CROP_SEEDS.length, 5, "Harus terdapat 5 varian benih");

  for (const seed of CROP_SEEDS) {
    assert.ok(seed.id, "Setiap benih harus punya ID");
    assert.ok(seed.name, "Setiap benih harus punya nama");
    assert.ok(seed.emoji, "Setiap benih harus punya emoji");
    assert.ok(seed.seedPrice > 0, "Harga benih harus > 0");
    assert.ok(seed.growTimeMinutes > 0, "Waktu tumbuh harus > 0");
    assert.ok(seed.harvestYield.itemId, "Yield harus menyertakan itemId");
    assert.ok(seed.harvestYield.amountMax >= seed.harvestYield.amountMin);
  }

  const strawberry = getSeedById("astral_strawberry");
  assert.ok(strawberry, "Astral Strawberry harus dapat ditemukan");
  assert.equal(strawberry.growTimeMinutes, 60);
});

test("Greenhouse Engine - Slot Growth Mathematics", () => {
  const plantedTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 menit lalu dari 60 menit

  const slotState = greenhouseEngine.computeSlotState({
    slotIndex: 0,
    seedId: "astral_strawberry",
    plantedAt: plantedTime,
    moisture: 100,
    isFertilized: false,
  });

  assert.equal(slotState.isEmpty, false);
  assert.equal(slotState.isMature, false);
  assert.equal(slotState.progressPercent, 50);
  assert.equal(slotState.stage, "GROWING");
  assert.equal(slotState.remainingMinutes, 30);
});

test("Greenhouse Engine - Fertilized Growth Acceleration", () => {
  // 60 menit * 0.75 = 45 menit total
  const plantedTime = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 menit lalu

  const slotState = greenhouseEngine.computeSlotState({
    slotIndex: 0,
    seedId: "astral_strawberry",
    plantedAt: plantedTime,
    moisture: 100,
    isFertilized: true,
  });

  assert.equal(slotState.isMature, true);
  assert.equal(slotState.progressPercent, 100);
  assert.equal(slotState.stage, "MATURE");
  assert.equal(slotState.remainingMinutes, 0);
});
