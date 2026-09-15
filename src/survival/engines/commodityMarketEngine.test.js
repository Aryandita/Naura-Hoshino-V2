"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  COMMODITY_CATALOG,
  MIN_PRICE_MULTIPLIER,
  MAX_PRICE_MULTIPLIER,
  calculateCommodityPrice,
  getMarketOverview,
} = require("./commodityMarketEngine");

test("CommodityMarketEngine - menolak komoditas yang tidak terdaftar", () => {
  assert.throws(() => {
    calculateCommodityPrice("unknown_item");
  }, /Komoditas tidak dikenal/);
});

test("CommodityMarketEngine - volume 0 menghasilkan harga dasar (basePrice) stabil", () => {
  const result = calculateCommodityPrice("celestial_koi", { sold: 0, bought: 0 });
  assert.equal(result.currentPrice, COMMODITY_CATALOG.celestial_koi.basePrice);
  assert.equal(result.multiplier, 1.0);
  assert.equal(result.priceChangePercent, 0);
  assert.equal(result.trend, "stable");
});

test("CommodityMarketEngine - penjualan masif menurunkan harga dan ter-clamp di batas bawah (0.65)", () => {
  const result = calculateCommodityPrice("starlight_ore", { sold: 5000, bought: 0 });
  const expectedMin = Math.round(COMMODITY_CATALOG.starlight_ore.basePrice * MIN_PRICE_MULTIPLIER);
  assert.equal(result.currentPrice, expectedMin);
  assert.equal(result.multiplier, MIN_PRICE_MULTIPLIER);
  assert.equal(result.trend, "bearish");
});

test("CommodityMarketEngine - pembelian masif menaikkan harga dan ter-clamp di batas atas (1.50)", () => {
  const result = calculateCommodityPrice("cyber_ruby", { sold: 0, bought: 5000 });
  const expectedMax = Math.round(COMMODITY_CATALOG.cyber_ruby.basePrice * MAX_PRICE_MULTIPLIER);
  assert.equal(result.currentPrice, expectedMax);
  assert.equal(result.multiplier, MAX_PRICE_MULTIPLIER);
  assert.equal(result.trend, "bullish");
});

test("CommodityMarketEngine - timeDecay meregresikan harga menuju baseline seiring waktu", () => {
  const freshBull = calculateCommodityPrice("void_coffee", { sold: 0, bought: 300 }, 0);
  const decayedBull = calculateCommodityPrice("void_coffee", { sold: 0, bought: 300 }, 12); // 12 jam kemudian

  assert.ok(freshBull.currentPrice > decayedBull.currentPrice);
  assert.ok(decayedBull.currentPrice >= COMMODITY_CATALOG.void_coffee.basePrice);
});

test("CommodityMarketEngine - getMarketOverview menyajikan seluruh komoditas katalog", () => {
  const overview = getMarketOverview();
  const catalogCount = Object.keys(COMMODITY_CATALOG).length;
  assert.equal(overview.length, catalogCount);
});
