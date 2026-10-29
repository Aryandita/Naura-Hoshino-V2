// Lokasi: scripts/emojis/spritesheetBuilder.js
// Pembuat Spritesheet (32px & 64px) dan Generator Metadata Manifest
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, loadImage } = require("../../src/canvas/canvasRuntime");
const { EMOJI_CATALOG } = require("./catalog");

/**
 * Membangun spritesheet 32px dan 64px dari kumpulan static PNG
 * @param {string} staticPngDir - Direktori aset static PNG
 * @param {string} outputDir - Direktori target spritesheets
 */
async function buildSpritesheets(staticPngDir, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Spritesheet 32px (512x192, 16x6 grid, cell 32)
  const canvas32 = createCanvas(512, 192);
  const ctx32 = canvas32.getContext("2d");
  ctx32.clearRect(0, 0, 512, 192);

  // 2. Spritesheet 64px (512x768, 8x12 grid, cell 64)
  const canvas64 = createCanvas(512, 768);
  const ctx64 = canvas64.getContext("2d");
  ctx64.clearRect(0, 0, 512, 768);

  const manifestEmojis = [];

  for (let idx = 0; idx < EMOJI_CATALOG.length; idx++) {
    const emoji = EMOJI_CATALOG[idx];
    const pngPath = path.join(staticPngDir, `${emoji.name}.png`);

    if (!fs.existsSync(pngPath)) {
      throw new Error(`Static PNG tidak ditemukan untuk spritesheet: ${pngPath}`);
    }

    const pngBuf = fs.readFileSync(pngPath);
    const img = await loadImage(pngBuf);

    // Hitung koordinat 32px (16 cols x 6 rows)
    const col32 = idx % 16;
    const row32 = Math.floor(idx / 16);
    const x32 = col32 * 32;
    const y32 = row32 * 32;
    ctx32.drawImage(img, x32, y32, 32, 32);

    // Hitung koordinat 64px (8 cols x 12 rows)
    const col64 = idx % 8;
    const row64 = Math.floor(idx / 8);
    const x64 = col64 * 64;
    const y64 = row64 * 64;
    ctx64.drawImage(img, x64, y64, 64, 64);

    manifestEmojis.push({
      id: emoji.id,
      name: emoji.name,
      category: emoji.category,
      type: "animated",
      file: `${emoji.name}.png`,
      animatedFile: `${emoji.name}.gif`,
      size: [128, 128],
      frames: 12,
      fps: 12.5,
      duration: 0.96,
      tags: emoji.tags || [emoji.name],
      fallback: emoji.fallback || "🌸",
      sheetIndex: idx,
      col32,
      row32,
      x32,
      y32,
      col64,
      row64,
      x64,
      y64,
    });
  }

  // Simpan spritesheet 32px
  const sheet32Buffer = await canvas32.encode("png");
  const sheet32Path = path.join(outputDir, "emoji_sheet_32.png");
  fs.writeFileSync(sheet32Path, sheet32Buffer);

  // Simpan spritesheet 64px
  const sheet64Buffer = await canvas64.encode("png");
  const sheet64Path = path.join(outputDir, "emoji_sheet_64.png");
  fs.writeFileSync(sheet64Path, sheet64Buffer);

  // Buat manifest metadata
  const manifestData = {
    version: "1.0.0",
    generated: new Date().toISOString(),
    total: manifestEmojis.length,
    emojis: manifestEmojis,
    spritesheets: {
      32: {
        file: "emoji_sheet_32.png",
        width: 512,
        height: 192,
        cols: 16,
        rows: 6,
        cellSize: 32,
      },
      64: {
        file: "emoji_sheet_64.png",
        width: 512,
        height: 768,
        cols: 8,
        rows: 12,
        cellSize: 64,
      },
    },
  };

  const manifestJsonPath = path.join(outputDir, "emoji_manifest.json");
  const mirrorJsonPath = path.join(outputDir, "manifest.json");
  const manifestContent = JSON.stringify(manifestData, null, 2);

  fs.writeFileSync(manifestJsonPath, manifestContent, "utf8");
  fs.writeFileSync(mirrorJsonPath, manifestContent, "utf8");

  return {
    sheet32Path,
    sheet64Path,
    manifestJsonPath,
    mirrorJsonPath,
    count: manifestEmojis.length,
  };
}

module.exports = {
  buildSpritesheets,
};
