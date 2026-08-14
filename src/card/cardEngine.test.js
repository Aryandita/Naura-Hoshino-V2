"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CardEngine = require("./cardEngine");

test("CardEngine - generateCardCode returns unique 8-char code with nra- prefix", () => {
  const code1 = CardEngine.generateCardCode();
  const code2 = CardEngine.generateCardCode();
  assert.match(code1, /^nra-[a-z0-9]{5}$/);
  assert.match(code2, /^nra-[a-z0-9]{5}$/);
  assert.notEqual(code1, code2);
});

test("CardEngine - getCatalog contains characters with valid rarity and burnValue", () => {
  const catalog = CardEngine.getCatalog();
  assert.ok(catalog.length >= 10);
  for (const c of catalog) {
    assert.ok(c.id);
    assert.ok(c.name);
    assert.ok(c.series);
    assert.ok(["SECRET_MYTHIC", "ULTRA_RARE", "RARE"].includes(c.rarity));
    assert.ok(c.burnValue > 0);
  }
});

test("CardEngine - rollQuality returns valid condition tiers", () => {
  const validTiers = ["POOR", "GOOD", "EXCELLENT", "GEM_MINT"];
  for (let i = 0; i < 50; i++) {
    const q = CardEngine.rollQuality();
    assert.ok(validTiers.includes(q));
  }
});
