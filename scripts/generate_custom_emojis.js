#!/usr/bin/env node
// Lokasi: scripts/generate_custom_emojis.js
// Pipeline Orchestrator Pembuatan 90 Custom Emoji Naura Hoshino V2
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { EMOJI_CATALOG, CATEGORIES } = require("./emojis/catalog");
const { getEmojiSvg } = require("./emojis/svgGenerator");
const { renderSvgToPng, renderEmojiToGif } = require("./emojis/canvasRenderer");
const { buildSpritesheets } = require("./emojis/spritesheetBuilder");

const ROOT_DIR = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.join(ROOT_DIR, "assets/emojis");
const SOURCE_DIR = path.join(ASSETS_ROOT, "source");
const STATIC_DIR = path.join(ASSETS_ROOT, "export/static");
const ANIMATED_DIR = path.join(ASSETS_ROOT, "export/animated");
const SPRITESHEETS_DIR = path.join(ASSETS_ROOT, "spritesheets");

function ensureDirectories() {
  const dirs = [
    ASSETS_ROOT,
    SOURCE_DIR,
    STATIC_DIR,
    ANIMATED_DIR,
    SPRITESHEETS_DIR,
    ...Object.values(CATEGORIES).map((cat) => path.join(SOURCE_DIR, cat)),
  ];

  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }
}

async function main() {
  const startTime = Date.now();
  console.log("==========================================================");
  console.log("🌸 NAURA HOSHINO V2 - 90 CUSTOM EMOJIS GENERATION PIPELINE");
  console.log("==========================================================");

  ensureDirectories();
  console.log("[1/4] Directory structure verified.");

  const total = EMOJI_CATALOG.length;
  console.log(`[2/4] Generating ${total} Master SVGs & Static PNGs...`);

  let staticCount = 0;
  let sourceCount = 0;

  for (let i = 0; i < total; i++) {
    const item = EMOJI_CATALOG[i];
    const catDir = path.join(SOURCE_DIR, item.category);
    const svgPath = path.join(catDir, `${item.name}.svg`);
    const pngPath = path.join(STATIC_DIR, `${item.name}.png`);

    // Master SVG
    const svgContent = getEmojiSvg(item.name, { frame: 0, totalFrames: 12 });
    fs.writeFileSync(svgPath, svgContent, "utf8");
    sourceCount++;

    // Static PNG (128x128 transparent 8-bit alpha)
    const pngBuffer = await renderSvgToPng(svgContent);
    fs.writeFileSync(pngPath, pngBuffer);
    staticCount++;

    if ((i + 1) % 15 === 0 || i === total - 1) {
      console.log(`  -> Processed ${i + 1}/${total} static emojis`);
    }
  }

  console.log(`[3/4] Synthesizing ${total} Animated GIFs (12 FPS, Looping, Transparent)...`);
  let animatedCount = 0;
  for (let i = 0; i < total; i++) {
    const item = EMOJI_CATALOG[i];
    const gifPath = path.join(ANIMATED_DIR, `${item.name}.gif`);

    const gifBuffer = await renderEmojiToGif(item.name, { frameCount: 12, delay: 80 });
    fs.writeFileSync(gifPath, gifBuffer);
    animatedCount++;

    if ((i + 1) % 15 === 0 || i === total - 1) {
      console.log(`  -> Synthesized ${i + 1}/${total} animated GIFs`);
    }
  }

  console.log("[4/4] Packing Spritesheets (32px & 64px) & JSON Manifests...");
  const sheetResult = await buildSpritesheets(STATIC_DIR, SPRITESHEETS_DIR);
  console.log(`  -> Spritesheets generated: ${sheetResult.count} items mapped`);
  console.log(`  -> Manifest saved to: ${sheetResult.manifestJsonPath}`);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("==========================================================");
  console.log("✅ GENERATION PIPELINE COMPLETE!");
  console.log(`⏱️ Duration: ${durationSec}s`);
  console.log(`📁 Deliverables:`);
  console.log(`   - Master SVGs:     ${sourceCount} files in assets/emojis/source/`);
  console.log(`   - Static PNGs:     ${staticCount} files in assets/emojis/export/static/`);
  console.log(`   - Animated GIFs:   ${animatedCount} files in assets/emojis/export/animated/`);
  console.log(`   - Spritesheets:    emoji_sheet_32.png & emoji_sheet_64.png`);
  console.log(`   - Manifests:       emoji_manifest.json & manifest.json`);
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("❌ Fatal Generation Error:", err);
  process.exit(1);
});
