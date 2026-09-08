// Lokasi: scripts/save_generated_assets.js
// Menyimpan gambar hasil generate AI ke folder assets/ dan dashboard-v2/

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BRAIN_DIR =
  "C:\\Users\\ACER\\.gemini\\antigravity-ide\\brain\\5776c327-3c05-4e45-a2b5-dd73cb941e91";
const ASSETS_ITEMS_DIR = path.join(__dirname, "../assets/items");
const ASSETS_IMAGES_DIR = path.join(__dirname, "../assets/images");
const DASHBOARD_PUBLIC_ITEMS = path.join(
  __dirname,
  "../dashboard-v2/public/items",
);
const DASHBOARD_DIST_ITEMS = path.join(__dirname, "../dashboard-v2/dist/items");

const TARGET_DIRS = [
  ASSETS_ITEMS_DIR,
  ASSETS_IMAGES_DIR,
  DASHBOARD_PUBLIC_ITEMS,
  DASHBOARD_DIST_ITEMS,
];

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const fileMap = [
  {
    prefix: "starlight_blade_v2",
    targetName: "hoshino_starlight_blade.jpg",
    isItem: true,
  },
  {
    prefix: "astral_ward_v2",
    targetName: "hoshino_astral_ward.jpg",
    isItem: true,
  },
  {
    prefix: "excalibur_neo",
    targetName: "excalibur_neo.jpg",
    isItem: true,
  },
  {
    prefix: "volcanic_fire_axe",
    targetName: "volcanic_fire_axe.jpg",
    isItem: true,
  },
  {
    prefix: "golden_apple_deluxe",
    targetName: "golden_apple_deluxe.jpg",
    isItem: true,
  },
  {
    prefix: "ruby_crystal",
    targetName: "ruby_crystal.jpg",
    isItem: true,
  },
  {
    prefix: "starlight_oceanic_rod",
    targetName: "starlight_oceanic_rod.jpg",
    isItem: true,
  },
  {
    prefix: "stardust_confection",
    targetName: "hoshino_stardust_confection.jpg",
    isItem: true,
  },
  {
    prefix: "hoshino_star_core",
    targetName: "hoshino_star_core.jpg",
    isItem: true,
  },
  {
    prefix: "naura_hoshino_mascot",
    targetName: "naura_hoshino_mascot.jpg",
    isItem: false,
  },
];

const brainFiles = fs.readdirSync(BRAIN_DIR);

console.log("=== MENYALIN GAMBAR HASIL GENERATE KE ASSETS ===");

for (const item of fileMap) {
  const matchingFile = brainFiles.find(
    (f) => f.startsWith(item.prefix) && f.endsWith(".jpg"),
  );

  if (matchingFile) {
    const srcPath = path.join(BRAIN_DIR, matchingFile);

    if (item.isItem) {
      // Salin ke assets/items, dashboard public items, dan dist items
      fs.copyFileSync(srcPath, path.join(ASSETS_ITEMS_DIR, item.targetName));
      fs.copyFileSync(
        srcPath,
        path.join(DASHBOARD_PUBLIC_ITEMS, item.targetName),
      );
      fs.copyFileSync(
        srcPath,
        path.join(DASHBOARD_DIST_ITEMS, item.targetName),
      );
      console.log(
        `[OK] Disalin: ${item.targetName} -> assets/items/ & dashboard/items/`,
      );
    } else {
      // Salin ke assets/images
      fs.copyFileSync(srcPath, path.join(ASSETS_IMAGES_DIR, item.targetName));
      console.log(`[OK] Disalin: ${item.targetName} -> assets/images/`);
    }
  } else {
    console.warn(`[SKIP] Berkas dengan prefix ${item.prefix} tidak ditemukan.`);
  }
}

console.log("=== PROSES PENYALINAN SELESAI ===");
