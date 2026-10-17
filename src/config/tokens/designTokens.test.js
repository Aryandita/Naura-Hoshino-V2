"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BRAND,
  SURVIVAL,
  RARITY,
  STATUS,
  SYSTEMS,
  getColorHex,
  getColorInt,
  getColorRgb,
  getRarityToken,
  getStatusToken,
  generateCssVariables,
  hexToRgb,
  hexToInt,
} = require("./designTokens");

test("designTokens - hex conversion helpers", () => {
  assert.equal(hexToInt("#FFC0CB"), 16761035);
  assert.equal(hexToRgb("#FFC0CB"), "255, 192, 203");
});

test("designTokens - category token integrity", () => {
  assert.equal(BRAND.primary.hex, "#FFC0CB");
  assert.equal(BRAND.primary.int, 16761035);
  assert.equal(BRAND.primary.cssVar, "--naura-primary");
  assert.equal(SURVIVAL.emerald.hex, "#86EFAC");
  assert.equal(RARITY.legendary.hex, "#FFD700");
  assert.equal(STATUS.online.hex, "#22C55E");
  assert.equal(SYSTEMS.economy.hex, "#FFD700");
  assert.equal(BRAND.primary.rgb, "255, 192, 203");
});

test("designTokens - getters with fallbacks", () => {
  assert.equal(getColorHex("primary"), "#FFC0CB");
  assert.equal(getColorHex("unknown_color", "#123456"), "#123456");

  assert.equal(getColorInt("primary"), 16761035);
  assert.equal(getColorInt("unknown_color", "#000000"), 0);

  assert.equal(getColorRgb("primary"), "255, 192, 203");
});

test("designTokens - RARITY and STATUS getters", () => {
  const legendary = getRarityToken("legendary");
  assert.equal(legendary.hex, "#FFD700");
  assert.equal(legendary.emoji, "🟡");

  const unkRarity = getRarityToken("super_mythic_nonexistent");
  assert.equal(unkRarity.hex, "#9CA3AF");

  const online = getStatusToken("online");
  assert.equal(online.badge, "🟢 AKTIF");
});

test("designTokens - CSS generation produces valid :root block", () => {
  const css = generateCssVariables();
  assert.match(css, /^:root \{/);
  assert.match(css, /--naura-primary: #ffc0cb;/);
  assert.match(css, /--naura-primary-rgb: 255, 192, 203;/);
  assert.match(css, /\}$/);
});
