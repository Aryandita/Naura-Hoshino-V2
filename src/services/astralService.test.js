"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const astralService = require("./astralService");
const tradeEngine = require("./tradeEngine");
const radioService = require("./radioService");

describe("AstralService - Hoshino Astral Sanctuary", () => {
  test("getGuildAstralWeather returns deterministic weather object with buffs", async () => {
    const weather = await astralService.getGuildAstralWeather("guild_test_123");
    assert.ok(weather.id, "Weather should have an id");
    assert.ok(weather.name, "Weather should have a name");
    assert.ok(weather.buffs, "Weather should contain buffs");
    assert.strictEqual(typeof weather.color, "string");
  });

  test("drawDailyOmikuji returns lucky metrics and personal quote", async () => {
    const res = await astralService.drawDailyOmikuji("user_test_456", "Aryandita");
    assert.ok(res.result, "Result should be populated");
    assert.ok(res.result.tier, "Omikuji should have a tier");
    assert.ok(res.result.categories, "Omikuji should have category stats");
    assert.ok(res.result.personalQuote.includes("Aryandita"), "Quote should address user personal name");
  });

  test("observeConstellation returns valid constellation", () => {
    const obs = astralService.observeConstellation("user_test_456", "Aryandita");
    assert.ok(obs.constellation, "Constellation should be returned");
    assert.ok(obs.constellation.stardust > 0, "Stardust should be greater than 0");
  });
});

describe("TradeEngine - Galactic Caravan", () => {
  test("getMarketPrices returns fluctuating prices for all commodities", () => {
    const prices = tradeEngine.getMarketPrices();
    assert.ok(prices.GOLDEN_WOOD, "Golden wood should be listed");
    assert.ok(prices.MYTHIC_FISH, "Mythic fish should be listed");
    assert.ok(prices.COSMIC_ORE, "Cosmic ore should be listed");
    assert.ok(prices.ASTRAL_SILK, "Astral silk should be listed");
    assert.ok(prices.GOLDEN_WOOD.currentPrice > 0, "Price should be positive number");
  });

  test("getRoutes returns all valid trade routes", () => {
    const routes = tradeEngine.getRoutes();
    assert.ok(routes.tokyo, "Tokyo route should exist");
    assert.ok(routes.outpost, "Outpost route should exist");
    assert.ok(routes.nexus, "Nexus route should exist");
    assert.ok(routes.tokyo.profitMarginPercent > 0, "Profit margin should be positive");
  });
});

describe("RadioService - Virtual Radio DJ", () => {
  test("generateTrackIntro personalizes requester name", () => {
    const intro = radioService.generateTrackIntro("Sparkle", "Arya");
    assert.ok(intro.includes("Sparkle"), "Intro should mention track title");
    assert.ok(intro.includes("Arya"), "Intro should address user personal name");
  });

  test("getPresets returns relaxation presets", () => {
    const presets = radioService.getPresets();
    assert.ok(Array.isArray(presets), "Presets should be an array");
    assert.ok(presets.length >= 3, "There should be at least 3 presets");
  });
});
