"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { tools, dispatchFunction } = require("../ai/functionDispatcher");
const StockMarketEngine = require("./stockMarketEngine");

describe("Agentic Voice Function Dispatcher Tests", () => {
  let origGetMarketOverview;

  before(() => {
    origGetMarketOverview = StockMarketEngine.getMarketOverview;
    StockMarketEngine.getMarketOverview = async () => [
      {
        ticker: "HOSHINO_AI",
        name: "Hoshino Core AI Corp",
        currentPrice: 150.0,
        dividendYield: 0.06,
      },
      {
        ticker: "NEO_ENERGY",
        name: "Neo-Hoshino Fusion Power",
        currentPrice: 85.0,
        dividendYield: 0.04,
      },
    ];
  });

  after(() => {
    StockMarketEngine.getMarketOverview = origGetMarketOverview;
  });

  it("tools list contains harvest_greenhouse, check_omikuji, and check_stock_market", () => {
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("harvest_greenhouse"));
    assert.ok(names.includes("check_omikuji"));
    assert.ok(names.includes("check_stock_market"));
  });

  it("dispatchFunction checks stock market overview cleanly", async () => {
    const mockMsg = {
      author: { id: "user_test_voice_stock", username: "InvestorHoshino" },
    };
    const res = await dispatchFunction("check_stock_market", {}, mockMsg);
    assert.ok(res);
    assert.strictEqual(res.status, "success");
    assert.ok(Array.isArray(res.stocks));
    assert.ok(res.totalStocks >= 0);
  });

  it("dispatchFunction check_omikuji returns valid daily omikuji fortune", async () => {
    const mockMsg = {
      author: { id: "user_test_voice_omikuji", username: "StarlightSeeker" },
    };
    const res = await dispatchFunction("check_omikuji", {}, mockMsg);
    assert.ok(res);
    assert.strictEqual(res.status, "success");
    assert.ok(typeof res.tierName === "string");
    assert.ok(typeof res.fortuneScore === "number");
  });

  it("dispatchFunction returns error when user ID is missing", async () => {
    const res = await dispatchFunction("check_balance", {}, {});
    assert.ok(res.error);
  });
});

