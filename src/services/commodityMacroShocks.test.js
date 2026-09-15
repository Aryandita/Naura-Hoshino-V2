"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const tradeEngine = require("./tradeEngine");
const worldEventEngine = require("../survival/engines/worldEventEngine");

describe("Dynamic Commodity Market Events & Macro Shocks", () => {
  it("worldEventEngine.getCommodityModifiers mengembalikan multiplier saat event aktif", () => {
    // September: Autumn Harvest (month 8, 1-30)
    const harvestDate = new Date(2026, 8, 15);
    const harvestMods = worldEventEngine.getCommodityModifiers(harvestDate);
    assert.ok(harvestMods.GOLDEN_WOOD, "Harus ada shock untuk GOLDEN_WOOD");
    assert.ok(harvestMods.GOLDEN_WOOD.multiplier < 1.0, "Surplus harus menurunkan harga");
    assert.ok(harvestMods.MYTHIC_FISH.multiplier > 1.0, "Permintaan pesta panen harus menaikkan harga ikan");

    // December: Frostsnow Winter (month 11, 20)
    const winterDate = new Date(2026, 11, 20);
    const winterMods = worldEventEngine.getCommodityModifiers(winterDate);
    assert.ok(winterMods.COSMIC_ORE, "Harus ada shock untuk COSMIC_ORE di musim dingin");
    assert.ok(winterMods.COSMIC_ORE.multiplier > 1.0);
  });

  it("tradeEngine.getMarketPrices mengintegrasikan macroShock ke informasi harga", () => {
    const harvestDate = new Date(2026, 8, 15);
    const prices = tradeEngine.getMarketPrices(harvestDate);

    assert.ok(prices.GOLDEN_WOOD);
    assert.ok(prices.GOLDEN_WOOD.macroShock);
    assert.ok(prices.MYTHIC_FISH.macroShock);
    assert.ok(typeof prices.GOLDEN_WOOD.currentPrice === "number");
    assert.ok(prices.GOLDEN_WOOD.currentPrice > 0);
  });
});
