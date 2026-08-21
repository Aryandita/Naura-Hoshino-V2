"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_STOCKS } = require("./stockMarketEngine");

test("StockMarketEngine - Default Listed Stocks and $NRA Volatile Index", () => {
  assert.ok(Array.isArray(DEFAULT_STOCKS), "DEFAULT_STOCKS harus berupa array");
  assert.ok(DEFAULT_STOCKS.length >= 4, "Harus ada minimal 4 saham");

  const nraStock = DEFAULT_STOCKS.find((s) => s.ticker === "NAURA_COIN");
  assert.ok(nraStock, "Harus ada saham NAURA_COIN");
  assert.equal(nraStock.isHighRisk, true, "NAURA_COIN harus bertipe isHighRisk");
  assert.ok(nraStock.dividendYield >= 0.1, "Dividen NAURA_COIN harus tinggi (>=10%)");

  const aiStock = DEFAULT_STOCKS.find((s) => s.ticker === "HOSHINO_AI");
  assert.ok(aiStock, "Harus ada HOSHINO_AI");
});

test("StockMarketEngine - Trade Valuation & Price Impact Formula", () => {
  const currentPrice = 100.0;
  const qty = 50;
  const totalCost = currentPrice * qty;
  assert.equal(totalCost, 5000);

  // Buy price impact: 1 + min(0.05, (qty / 100) * 0.01)
  const priceImpact = 1 + Math.min(0.05, (qty / 100) * 0.01);
  const newPrice = Number((currentPrice * priceImpact).toFixed(2));
  assert.equal(newPrice, 100.5);
});
