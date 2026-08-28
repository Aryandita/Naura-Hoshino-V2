"use strict";

// Test untuk survivalUIHelper.js: menjaga kontrak token Naura Wilds dengan
// DESIGN.md agar warna dan threshold vital tidak berubah diam-diam.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  survivalColors,
  survivalGlass,
  rarityColors,
  getColor,
  getRarityColor,
  getVitalColor,
  buildVitalsBar,
  getFooter,
  formatStat,
} = require("./survivalUIHelper");

test("token warna survival sesuai kontrak DESIGN.md", () => {
  assert.equal(survivalColors.emerald, "#86EFAC");
  assert.equal(survivalColors.moss, "#34D399");
  assert.equal(survivalColors.amber, "#FBBF24");
  assert.equal(survivalColors.bark, "#92400E");
  assert.equal(survivalColors.river, "#7DD3FC");
  assert.equal(survivalColors.danger, "#F87171");
});

test("material glass survival memakai tint hijau", () => {
  assert.equal(survivalGlass.surface, "rgba(134, 239, 172, 0.06)");
  assert.equal(survivalGlass.hairline, "rgba(134, 239, 172, 0.2)");
});

test("skala rarity lengkap enam tingkat", () => {
  assert.deepEqual(Object.keys(rarityColors).sort(), [
    "common",
    "epic",
    "legendary",
    "mythic",
    "rare",
    "uncommon",
  ]);
});

test("getColor mengembalikan token survival dan fallback aman", () => {
  assert.equal(getColor("emerald"), "#86EFAC");
  assert.equal(getColor("danger"), "#F87171");
  // Token tidak dikenal jatuh ke emerald sebagai aksen default Wilds
  assert.equal(getColor("tidak_ada"), "#86EFAC");
  assert.equal(getColor(undefined), "#86EFAC");
});

test("getRarityColor case-insensitive dengan fallback Common", () => {
  assert.equal(getRarityColor("LEGENDARY"), "#FFD700");
  assert.equal(getRarityColor("Mythic"), "#F9A8D4");
  assert.equal(getRarityColor("unknown"), "#9CA3AF");
  assert.equal(getRarityColor(null), "#9CA3AF");
});

test("threshold vital otomatis moss/amber/danger", () => {
  // Sehat (>50%) -> moss
  assert.equal(getVitalColor(100), survivalColors.moss);
  assert.equal(getVitalColor(51), survivalColors.moss);
  // Waspada (20-50%) -> amber
  assert.equal(getVitalColor(50), survivalColors.amber);
  assert.equal(getVitalColor(21), survivalColors.amber);
  // Kritis (<20%) -> danger
  assert.equal(getVitalColor(20), survivalColors.danger);
  assert.equal(getVitalColor(0), survivalColors.danger);
});

test("buildVitalsBar mengembalikan bar, persen, dan warna threshold", () => {
  const result = buildVitalsBar({ current: 80, target: 100 });
  assert.equal(result.percent, 80);
  assert.equal(result.color, survivalColors.moss);
  assert.ok(typeof result.bar === "string" && result.bar.length > 0);

  const critical = buildVitalsBar({ current: 10, target: 100 });
  assert.equal(critical.color, survivalColors.danger);
});

test("getFooter memakai footer survival terpusat", () => {
  const footer = getFooter();
  assert.ok(typeof footer === "string" && footer.length > 0);
  assert.match(footer, /Survival/i);
});

test("formatStat aman terhadap nilai non-numerik", () => {
  assert.equal(formatStat(1234567), "1.234.567");
  assert.equal(formatStat("abc"), "0");
  assert.equal(formatStat(NaN), "0");
  assert.equal(formatStat(undefined), "0");
});
