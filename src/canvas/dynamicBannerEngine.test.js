"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generateDynamicMotionBanner, THEMES } = require("./dynamicBannerEngine");

test("DynamicBannerEngine - harus memiliki tema cyberpunk, celestial, abyss, dan hoshino_aura", () => {
  assert.ok(THEMES.cyberpunk, "cyberpunk harus ada");
  assert.ok(THEMES.celestial, "celestial harus ada");
  assert.ok(THEMES.abyss, "abyss harus ada");
  assert.ok(THEMES.hoshino_aura, "hoshino_aura harus ada");
});

test("DynamicBannerEngine - harus berhasil me-render buffer gambar banner dinamis", async () => {
  const buf = await generateDynamicMotionBanner({
    username: "HoshinoVoyager",
    theme: "cyberpunk",
    seasonTier: 30,
    title: "Master of Cyberspace",
    quote: "Beyond the digital horizon lies the starlit sky.",
    stats: { level: 45, power: 12500, prestige: 3400 },
  });

  assert.ok(Buffer.isBuffer(buf), "Hasil harus berupa Buffer");
  assert.ok(buf.length > 1000, "Ukuran buffer harus valid");
});
