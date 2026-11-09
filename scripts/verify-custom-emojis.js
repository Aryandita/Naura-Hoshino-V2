#!/usr/bin/env node
// Lokasi: scripts/verify-custom-emojis.js
// Automated Verification Gate for Naura Custom Discord Emojis (Requirement R4)
// Validates 100% presence, binary headers, dimensions, alpha transparency, sizes, and manifest schema.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, loadImage } = require("../src/canvas/canvasRuntime");

const ROOT_DIR = path.resolve(__dirname, "..");
const EMOJIS_DIR = path.join(ROOT_DIR, "assets/emojis/naura_custom");
const MANIFEST_PATH = path.join(EMOJIS_DIR, "manifest.json");
const CHECKLIST_PATH = path.join(EMOJIS_DIR, "UPLOAD_CHECKLIST.md");
const TEMPLATE_PATH = path.join(ROOT_DIR, "src/config/ui/customEmojis.template.js");

const MAX_DISCORD_BYTES = 256 * 1024; // 262,144 bytes (Discord upload limit)
const TARGET_DIMENSION = 128; // Strictly 128x128 1:1 aspect ratio
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DISCORD_NAME_REGEX = /^[a-zA-Z0-9_]{2,32}$/;

// 67 Canonical Custom Emoji Definitions grouped by Category
const EMOJI_INVENTORY = {
  core: [
    "naura_core",
    "naura_ping",
    "naura_uptime",
    "naura_cpu",
    "naura_ram",
    "naura_shard",
    "naura_lang",
    "naura_donate",
  ],
  ai: [
    "ai_sparkle",
    "ai_thinking",
    "ai_vision",
    "ai_voice",
    "ai_openrouter",
    "ai_vip_fast",
  ],
  arcade: [
    "arcade_hub",
    "arcade_dice",
    "arcade_card",
    "arcade_duel",
    "arcade_target",
    "edu_math",
    "edu_map",
    "edu_flag",
    "edu_word",
  ],
  economy: [
    "eco_cash",
    "eco_bank",
    "eco_shop",
    "eco_work",
    "eco_heist",
    "eco_trade",
  ],
  moderation: [
    "mod_shield",
    "mod_warn",
    "mod_mute",
    "mod_kick",
    "mod_ban",
    "mod_lock",
    "mod_ticket",
  ],
  music: [
    "music_play",
    "music_pause",
    "music_skip",
    "music_queue",
    "music_bass",
    "music_disc",
  ],
  utility: [
    "mc_pickaxe",
    "mc_steve",
    "mc_ping",
    "weather_sun",
    "weather_rain",
    "media_anime",
    "media_movie",
    "dl_cobalt",
  ],
  expression: [
    "naura_happy",
    "naura_thinking",
    "naura_cry",
    "naura_angry",
    "naura_shy",
    "naura_sleepy",
    "naura_shocked",
    "naura_eat",
    "naura_cheers",
    "naura_chirping",
    "naura_annoy",
    "naura_blow_kiss",
    "naura_akward",
    "naura_confused",
    "naura_hmph",
    "naura_impressed",
    "naura_read",
  ],
};

// 21 Key Animated GIF Emojis (8 expression + 13 action)
const REQUIRED_GIF_KEYS = [
  // 8 expression GIFs
  "naura_happy",
  "naura_thinking",
  "naura_cry",
  "naura_angry",
  "naura_sleepy",
  "naura_cheers",
  "naura_chirping",
  "naura_blow_kiss",
  // 13 category action GIFs
  "naura_ping",
  "naura_donate",
  "ai_sparkle",
  "ai_vip_fast",
  "arcade_dice",
  "eco_cash",
  "mod_warn",
  "mod_ban",
  "music_play",
  "music_bass",
  "music_disc",
  "weather_rain",
  "dl_cobalt",
];

const ALL_KEYS = Object.values(EMOJI_INVENTORY).flat();

/**
 * Fast PNG IHDR Chunk Parser
 * Reads signature, width, height, bitDepth, and colorType directly from binary buffer.
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, width: number, height: number, bitDepth: number, colorType: number, error?: string }}
 */
function parsePngHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 29) {
    return { valid: false, error: "Buffer too small for PNG IHDR" };
  }
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return { valid: false, error: "Invalid PNG magic signature" };
  }
  const chunkLength = buffer.readUInt32BE(8);
  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkLength !== 13 || chunkType !== "IHDR") {
    return { valid: false, error: "First chunk is not valid IHDR" };
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  return { valid: true, width, height, bitDepth, colorType };
}

/**
 * Fast GIF89a / GIF87a Header Parser
 * Reads signature, width, and height from logical screen descriptor.
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, version: string, width: number, height: number, error?: string }}
 */
function parseGifHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 13) {
    return { valid: false, error: "Buffer too small for GIF header" };
  }
  const sig = buffer.toString("ascii", 0, 6);
  if (sig !== "GIF89a" && sig !== "GIF87a") {
    return { valid: false, error: `Invalid GIF signature: ${sig}` };
  }
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return { valid: true, version: sig, width, height };
}

/**
 * Samples pixel alpha channel using canvas runtime.
 * Checks that the 4 outer corners are 100% transparent (alpha === 0)
 * and that non-transparent graphic content is present inside.
 * @param {string} filePath
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function samplePngAlpha(filePath) {
  try {
    const img = await loadImage(filePath);
    const canvas = createCanvas(TARGET_DIMENSION, TARGET_DIMENSION);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const idata = ctx.getImageData(0, 0, TARGET_DIMENSION, TARGET_DIMENSION).data;

    // 4 corners sampling
    const corners = [
      [0, 0],
      [TARGET_DIMENSION - 1, 0],
      [0, TARGET_DIMENSION - 1],
      [TARGET_DIMENSION - 1, TARGET_DIMENSION - 1],
    ];

    for (const [cx, cy] of corners) {
      const alpha = idata[(cy * TARGET_DIMENSION + cx) * 4 + 3];
      if (alpha !== 0) {
        return {
          valid: false,
          error: `Corner (${cx}, ${cy}) has opaque alpha: ${alpha} (expected 0)`,
        };
      }
    }

    // Verify non-empty graphic content
    let nonZeroAlphaCount = 0;
    for (let i = 3; i < idata.length; i += 4) {
      if (idata[i] > 0) nonZeroAlphaCount++;
    }
    if (nonZeroAlphaCount < 100) {
      return {
        valid: false,
        error: `Image has too few non-transparent pixels: ${nonZeroAlphaCount}`,
      };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Executes all 8 verification checks.
 * @returns {Promise<{ success: boolean, results: Array<{ id: number, name: string, passed: boolean, details: string, count?: number }>, stats: object }>}
 */
async function runVerification() {
  const results = [];
  const stats = {
    totalPngs: ALL_KEYS.length,
    totalGifs: REQUIRED_GIF_KEYS.length,
    pngSizes: [],
    gifSizes: [],
    categoryBreakdown: {},
  };

  // Initialize category breakdown stats
  for (const [cat, keys] of Object.entries(EMOJI_INVENTORY)) {
    stats.categoryBreakdown[cat] = {
      category: cat,
      pngTotal: keys.length,
      pngFound: 0,
      gifTotal: keys.filter((k) => REQUIRED_GIF_KEYS.includes(k)).length,
      gifFound: 0,
      avgPngBytes: 0,
      avgGifBytes: 0,
      allDimensionsValid: true,
      allAlphaValid: true,
      allSizesValid: true,
    };
  }

  // CHECK 1: 100% File Presence for all 67 Static PNG Emojis
  let missingPngs = [];
  for (const [cat, keys] of Object.entries(EMOJI_INVENTORY)) {
    for (const key of keys) {
      const p = path.join(EMOJIS_DIR, `${key}.png`);
      if (fs.existsSync(p)) {
        stats.categoryBreakdown[cat].pngFound++;
      } else {
        missingPngs.push(`${key}.png`);
      }
    }
  }
  const check1Passed = missingPngs.length === 0;
  results.push({
    id: 1,
    name: "Static PNG Presence (67/67 items)",
    passed: check1Passed,
    details: check1Passed
      ? "All 67 canonical PNG emoji assets exist in assets/emojis/naura_custom/"
      : `Missing PNGs: ${missingPngs.join(", ")}`,
    count: ALL_KEYS.length - missingPngs.length,
  });

  // CHECK 2: Key Animated GIF Presence (21 items: 8 expression + 13 action)
  let missingGifs = [];
  for (const [cat, keys] of Object.entries(EMOJI_INVENTORY)) {
    for (const key of keys) {
      if (REQUIRED_GIF_KEYS.includes(key)) {
        const p = path.join(EMOJIS_DIR, `${key}.gif`);
        if (fs.existsSync(p)) {
          stats.categoryBreakdown[cat].gifFound++;
        } else {
          missingGifs.push(`${key}.gif`);
        }
      }
    }
  }
  const check2Passed = missingGifs.length === 0;
  results.push({
    id: 2,
    name: "Key Animated GIF Presence (21/21 items)",
    passed: check2Passed,
    details: check2Passed
      ? "All 21 key animated GIFs (8 expression + 13 action) exist in assets/emojis/naura_custom/"
      : `Missing GIFs: ${missingGifs.join(", ")}`,
    count: REQUIRED_GIF_KEYS.length - missingGifs.length,
  });

  // CHECK 3: Image Dimensions (Strictly 128x128 1:1 Aspect Ratio)
  let dimensionErrors = [];
  for (const [cat, keys] of Object.entries(EMOJI_INVENTORY)) {
    for (const key of keys) {
      const pngPath = path.join(EMOJIS_DIR, `${key}.png`);
      if (fs.existsSync(pngPath)) {
        const buf = fs.readFileSync(pngPath);
        const hdr = parsePngHeader(buf);
        if (!hdr.valid || hdr.width !== TARGET_DIMENSION || hdr.height !== TARGET_DIMENSION) {
          dimensionErrors.push(`${key}.png (${hdr.width}x${hdr.height})`);
          stats.categoryBreakdown[cat].allDimensionsValid = false;
        }
      }
      if (REQUIRED_GIF_KEYS.includes(key)) {
        const gifPath = path.join(EMOJIS_DIR, `${key}.gif`);
        if (fs.existsSync(gifPath)) {
          const buf = fs.readFileSync(gifPath);
          const hdr = parseGifHeader(buf);
          if (!hdr.valid || hdr.width !== TARGET_DIMENSION || hdr.height !== TARGET_DIMENSION) {
            dimensionErrors.push(`${key}.gif (${hdr.width}x${hdr.height})`);
            stats.categoryBreakdown[cat].allDimensionsValid = false;
          }
        }
      }
    }
  }
  const check3Passed = dimensionErrors.length === 0;
  results.push({
    id: 3,
    name: "Image Dimensions 128x128 1:1 Aspect Ratio",
    passed: check3Passed,
    details: check3Passed
      ? "All 67 PNGs and 21 GIFs have strictly 128x128 px dimensions (1:1 square ratio)"
      : `Dimension mismatches: ${dimensionErrors.join(", ")}`,
  });

  // CHECK 4: Alpha Channel Transparency (8-bit truecolor RGBA colorType 6 + transparent corners)
  let alphaErrors = [];
  for (const [cat, keys] of Object.entries(EMOJI_INVENTORY)) {
    for (const key of keys) {
      const pngPath = path.join(EMOJIS_DIR, `${key}.png`);
      if (fs.existsSync(pngPath)) {
        const buf = fs.readFileSync(pngPath);
        const hdr = parsePngHeader(buf);
        if (!hdr.valid || hdr.bitDepth !== 8 || hdr.colorType !== 6) {
          alphaErrors.push(`${key}.png (bitDepth=${hdr.bitDepth}, colorType=${hdr.colorType})`);
          stats.categoryBreakdown[cat].allAlphaValid = false;
          continue;
        }
        const sampleResult = await samplePngAlpha(pngPath);
        if (!sampleResult.valid) {
          alphaErrors.push(`${key}.png (${sampleResult.error})`);
          stats.categoryBreakdown[cat].allAlphaValid = false;
        }
      }
    }
  }
  const check4Passed = alphaErrors.length === 0;
  results.push({
    id: 4,
    name: "Alpha Transparency & 100% Transparent Corners",
    passed: check4Passed,
    details: check4Passed
      ? "All 67 PNGs use 8-bit RGBA (colorType 6) with 100% transparent corners (alpha=0)"
      : `Alpha failures: ${alphaErrors.join("; ")}`,
  });

  // CHECK 5: File Size Constraints (< 256 KB Discord upload limit)
  let sizeErrors = [];
  for (const [cat, keys] of Object.entries(EMOJI_INVENTORY)) {
    let catPngBytes = 0;
    let catPngCount = 0;
    let catGifBytes = 0;
    let catGifCount = 0;

    for (const key of keys) {
      const pngPath = path.join(EMOJIS_DIR, `${key}.png`);
      if (fs.existsSync(pngPath)) {
        const size = fs.statSync(pngPath).size;
        stats.pngSizes.push(size);
        catPngBytes += size;
        catPngCount++;
        if (size >= MAX_DISCORD_BYTES || size === 0) {
          sizeErrors.push(`${key}.png (${(size / 1024).toFixed(1)} KB)`);
          stats.categoryBreakdown[cat].allSizesValid = false;
        }
      }

      if (REQUIRED_GIF_KEYS.includes(key)) {
        const gifPath = path.join(EMOJIS_DIR, `${key}.gif`);
        if (fs.existsSync(gifPath)) {
          const size = fs.statSync(gifPath).size;
          stats.gifSizes.push(size);
          catGifBytes += size;
          catGifCount++;
          if (size >= MAX_DISCORD_BYTES || size === 0) {
            sizeErrors.push(`${key}.gif (${(size / 1024).toFixed(1)} KB)`);
            stats.categoryBreakdown[cat].allSizesValid = false;
          }
        }
      }
    }

    if (catPngCount > 0) {
      stats.categoryBreakdown[cat].avgPngBytes = Math.round(catPngBytes / catPngCount);
    }
    if (catGifCount > 0) {
      stats.categoryBreakdown[cat].avgGifBytes = Math.round(catGifBytes / catGifCount);
    }
  }
  const check5Passed = sizeErrors.length === 0;
  results.push({
    id: 5,
    name: "File Size Constraints (< 256 KB Discord Limit)",
    passed: check5Passed,
    details: check5Passed
      ? `All assets strictly below 256 KB (PNG max: ${(Math.max(...stats.pngSizes) / 1024).toFixed(1)} KB, GIF max: ${(Math.max(...stats.gifSizes) / 1024).toFixed(1)} KB)`
      : `Size limit exceeded: ${sizeErrors.join(", ")}`,
  });

  // CHECK 6: Manifest Validation (manifest.json schema, 67 items, valid regex, real files)
  let manifestErrors = [];
  if (!fs.existsSync(MANIFEST_PATH)) {
    manifestErrors.push("manifest.json file does not exist");
  } else {
    try {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
      if (!manifest.version) manifestErrors.push("Missing manifest.version");
      if (manifest.total !== 67) manifestErrors.push(`Manifest total is ${manifest.total}, expected 67`);
      if (!Array.isArray(manifest.emojis) || manifest.emojis.length !== 67) {
        manifestErrors.push(`Manifest emojis array length is ${manifest.emojis?.length}, expected 67`);
      } else {
        const manifestKeys = new Set();
        for (const item of manifest.emojis) {
          if (!item.key) manifestErrors.push("Item missing key");
          manifestKeys.add(item.key);
          if (!DISCORD_NAME_REGEX.test(item.discordName)) {
            manifestErrors.push(`Invalid discordName '${item.discordName}' for key ${item.key}`);
          }
          if (!fs.existsSync(path.join(ROOT_DIR, item.staticFile))) {
            manifestErrors.push(`staticFile missing for key ${item.key}: ${item.staticFile}`);
          }
          if (item.animated) {
            if (!item.animatedFile || !fs.existsSync(path.join(ROOT_DIR, item.animatedFile))) {
              manifestErrors.push(`animatedFile missing for key ${item.key}: ${item.animatedFile}`);
            }
          }
        }
        for (const key of ALL_KEYS) {
          if (!manifestKeys.has(key)) {
            manifestErrors.push(`Key '${key}' missing from manifest.json`);
          }
        }
      }
    } catch (err) {
      manifestErrors.push(`Manifest JSON parse error: ${err.message}`);
    }
  }
  const check6Passed = manifestErrors.length === 0;
  results.push({
    id: 6,
    name: "Manifest Schema & File Mapping Integrity",
    passed: check6Passed,
    details: check6Passed
      ? "manifest.json conforms to schema, contains 67 items with valid Discord names and verified file paths"
      : `Manifest errors: ${manifestErrors.slice(0, 3).join("; ")}`,
  });

  // CHECK 7: Bot Configuration Template Validation (customEmojis.template.js exports all 67 keys)
  let templateErrors = [];
  if (!fs.existsSync(TEMPLATE_PATH)) {
    templateErrors.push("customEmojis.template.js file does not exist");
  } else {
    try {
      const template = require(TEMPLATE_PATH);
      for (const key of ALL_KEYS) {
        if (!template[key] && !template.customEmojis?.[key]) {
          templateErrors.push(`Missing key '${key}' in customEmojis.template.js`);
        }
      }
      if (typeof template.getCustomEmoji !== "function") {
        templateErrors.push("customEmojis.template.js missing getCustomEmoji helper");
      }
    } catch (err) {
      templateErrors.push(`Template load error: ${err.message}`);
    }
  }
  const check7Passed = templateErrors.length === 0;
  results.push({
    id: 7,
    name: "Bot Configuration Template Key Parity (67 keys)",
    passed: check7Passed,
    details: check7Passed
      ? "customEmojis.template.js exports all 67 emoji keys and fallback resolution helper"
      : `Template errors: ${templateErrors.slice(0, 3).join("; ")}`,
  });

  // CHECK 8: Zero Em-Dash Policy Compliance (\u2014 strictly forbidden)
  let emDashErrors = [];
  const filesToCheckEmDash = [
    MANIFEST_PATH,
    CHECKLIST_PATH,
    TEMPLATE_PATH,
    path.join(ROOT_DIR, "scripts/verify-custom-emojis.js"),
    path.join(ROOT_DIR, "test/customEmojis.test.js"),
    path.join(ROOT_DIR, "TEST_READY.md"),
  ];

  for (const fp of filesToCheckEmDash) {
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, "utf8");
      if (content.includes("\u2014")) {
        emDashErrors.push(`${path.relative(ROOT_DIR, fp)} contains em-dash`);
      }
    }
  }
  const check8Passed = emDashErrors.length === 0;
  results.push({
    id: 8,
    name: "Zero Em-Dash Policy Compliance",
    passed: check8Passed,
    details: check8Passed
      ? "Zero em-dash (\\u2014) characters found across all verified emoji assets and configs"
      : `Em-dash detected: ${emDashErrors.join("; ")}`,
  });

  const allPassed = results.every((r) => r.passed);
  return { success: allPassed, results, stats };
}

/**
 * Prints formatted CLI report table.
 * @param {{ success: boolean, results: Array<object>, stats: object }} report
 */
function printReport(report) {
  const line = "=".repeat(88);
  const subline = "-".repeat(88);

  console.log("\n" + line);
  console.log("  NAURA HOSHINO V2: CUSTOM DISCORD EMOJI AUTOMATED VERIFICATION GATE (R4)");
  console.log(line);

  console.log("\n[1] CATEGORY ASSET MATRIX:");
  console.log(
    "  " +
      "Category".padEnd(20) +
      "PNG Count".padEnd(12) +
      "GIF Count".padEnd(12) +
      "Avg PNG".padEnd(12) +
      "Avg GIF".padEnd(12) +
      "128x128".padEnd(10) +
      "Alpha".padEnd(8) +
      "Status"
  );
  console.log("  " + "-".repeat(84));

  for (const [cat, data] of Object.entries(report.stats.categoryBreakdown)) {
    const pngStr = `${data.pngFound}/${data.pngTotal}`;
    const gifStr = `${data.gifFound}/${data.gifTotal}`;
    const avgPng = `${(data.avgPngBytes / 1024).toFixed(1)} KB`;
    const avgGif = data.gifTotal > 0 ? `${(data.avgGifBytes / 1024).toFixed(1)} KB` : "N/A";
    const dimStr = data.allDimensionsValid ? "PASS" : "FAIL";
    const alphaStr = data.allAlphaValid ? "PASS" : "FAIL";
    const statusStr =
      data.pngFound === data.pngTotal &&
      data.gifFound === data.gifTotal &&
      data.allDimensionsValid &&
      data.allAlphaValid &&
      data.allSizesValid
        ? "PASS"
        : "FAIL";

    console.log(
      "  " +
        cat.padEnd(20) +
        pngStr.padEnd(12) +
        gifStr.padEnd(12) +
        avgPng.padEnd(12) +
        avgGif.padEnd(12) +
        dimStr.padEnd(10) +
        alphaStr.padEnd(8) +
        statusStr
    );
  }

  console.log("\n[2] VERIFICATION CHECKS SUMMARY:");
  console.log(subline);
  for (const res of report.results) {
    const badge = res.passed ? "[ PASS ]" : "[ FAIL ]";
    console.log(`  Check ${res.id}: ${res.name.padEnd(54)} ${badge}`);
    console.log(`    -> ${res.details}`);
  }
  console.log(subline);

  const passedCount = report.results.filter((r) => r.passed).length;
  const totalCount = report.results.length;

  console.log(`\nTOTAL CHECKS: ${passedCount}/${totalCount} PASSED`);
  if (report.success) {
    console.log("STATUS: 100% GREEN GATE PASS: ALL CUSTOM EMOJI ASSETS READY FOR DEPLOYMENT");
  } else {
    console.log("STATUS: VERIFICATION GATE FAILED: RESOLVE REPORTED DEFECTS");
  }
  console.log(line + "\n");
}

// CLI Execution Entry Point
if (require.main === module) {
  runVerification()
    .then((report) => {
      printReport(report);
      process.exit(report.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("Verification execution error:", err);
      process.exit(1);
    });
}

module.exports = {
  runVerification,
  parsePngHeader,
  parseGifHeader,
  samplePngAlpha,
  EMOJI_INVENTORY,
  REQUIRED_GIF_KEYS,
  ALL_KEYS,
};
