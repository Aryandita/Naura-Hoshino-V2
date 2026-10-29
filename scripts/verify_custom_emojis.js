#!/usr/bin/env node
// Lokasi: scripts/verify_custom_emojis.js
// Skrip Verifikasi Otomatis 90 Custom Emoji Naura Hoshino V2 (Requirement R3)
// Memvalidasi seluruh aset grafis, spesifikasi teknis, binary header, dan manifest.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT_DIR = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.join(ROOT_DIR, "assets/emojis");
const STATIC_DIR = path.join(ASSETS_ROOT, "export/static");
const ANIMATED_DIR = path.join(ASSETS_ROOT, "export/animated");
const SOURCE_DIR = path.join(ASSETS_ROOT, "source");
const SPRITESHEETS_DIR = path.join(ASSETS_ROOT, "spritesheets");

const MAX_FILE_SIZE = 256 * 1024; // 256 KB
const TARGET_CANVAS_DIMENSION = 128;
const TARGET_ANIMATION_FRAMES = 12;
const TARGET_MIN_FPS = 12;
const TARGET_MAX_FPS = 15;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const BRAND_TOKENS = {
  primary: {
    nauraPink: "#FFB6C1",
    cyberCyan: "#00FFFF",
    dreamPurple: "#C084FC",
    natureGreen: "#22C55E",
  },
  forbidden: ["#FF00FF", "#00FF00"],
};

/**
 * 6 Kategori Resmi dan 90 Emoji Sesuai NAURA_EMOJI_DESIGN_SYSTEM.md
 */
const EMOJI_CATEGORIES = {
  status: {
    id: "status",
    name: "Status & Reactions",
    count: 20,
    emojis: [
      "naura_happy",
      "naura_sad",
      "naura_angry",
      "naura_surprised",
      "naura_love",
      "naura_thinking",
      "naura_wink",
      "naura_cry",
      "naura_laugh",
      "naura_shy",
      "naura_excited",
      "naura_sleepy",
      "naura_confused",
      "naura_proud",
      "naura_scared",
      "naura_determined",
      "naura_relaxed",
      "naura_embarrassed",
      "naura_curious",
      "naura_celebrate",
    ],
  },
  action: {
    id: "action",
    name: "Actions & Commands",
    count: 15,
    emojis: [
      "naura_play",
      "naura_pause",
      "naura_skip",
      "naura_stop",
      "naura_volume_up",
      "naura_volume_down",
      "naura_queue",
      "naura_shuffle",
      "naura_repeat",
      "naura_lyrics",
      "naura_radio",
      "naura_mic",
      "naura_headphones",
      "naura_equalizer",
      "naura_disc",
    ],
  },
  rpg: {
    id: "rpg",
    name: "RPG & Survival",
    count: 20,
    emojis: [
      "naura_sword",
      "naura_shield",
      "naura_potion_hp",
      "naura_potion_mp",
      "naura_coin_sc",
      "naura_coin_pd",
      "naura_gem_vb",
      "naura_diamond_ba",
      "naura_heart_full",
      "naura_heart_half",
      "naura_energy",
      "naura_food",
      "naura_water",
      "naura_fire",
      "naura_tree",
      "naura_pickaxe",
      "naura_backpack",
      "naura_map",
      "naura_treasure",
      "naura_level_up",
    ],
  },
  system: {
    id: "system",
    name: "System & UI",
    count: 15,
    emojis: [
      "naura_settings",
      "naura_info",
      "naura_warning",
      "naura_error",
      "naura_success",
      "naura_loading",
      "naura_lock",
      "naura_unlock",
      "naura_search",
      "naura_menu",
      "naura_close",
      "naura_back",
      "naura_next",
      "naura_refresh",
      "naura_notification",
    ],
  },
  social: {
    id: "social",
    name: "Social & Community",
    count: 10,
    emojis: [
      "naura_handshake",
      "naura_gift",
      "naura_trophy",
      "naura_star",
      "naura_crown",
      "naura_medal",
      "naura_thumbs_up",
      "naura_clap",
      "naura_wave_hello",
      "naura_vip_badge",
    ],
  },
  special: {
    id: "special",
    name: "Special Naura Signatures",
    count: 10,
    emojis: [
      "naura_smile",
      "naura_wave",
      "naura_sparkle",
      "naura_magic_cast",
      "naura_heart_hands",
      "naura_peace_sign",
      "naura_finger_heart",
      "naura_salute",
      "naura_hug",
      "naura_kiss",
    ],
  },
};

const ALL_90_EMOJIS = Object.values(EMOJI_CATEGORIES).flatMap((c) => c.emojis);

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

/**
 * Parser binary murni untuk header PNG.
 * Menguraikan signature, chunk IHDR (dimensi, bit depth, color type), serta keberadaan alpha channel.
 *
 * @param {Buffer} buffer
 * @returns {object|null}
 */
function parsePngHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 29) {
    return null;
  }

  const isPng = buffer.subarray(0, 8).equals(PNG_SIGNATURE);
  if (!isPng) return null;

  const ihdrType = buffer.subarray(12, 16).toString("ascii");
  if (ihdrType !== "IHDR") return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const compressionMethod = buffer.readUInt8(26);
  const filterMethod = buffer.readUInt8(27);
  const interlaceMethod = buffer.readUInt8(28);

  let hasAlpha = colorType === 6 || colorType === 4;

  if (!hasAlpha) {
    let offset = 33;
    while (offset + 8 <= buffer.length) {
      const chunkLen = buffer.readUInt32BE(offset);
      const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
      if (chunkType === "tRNS") {
        hasAlpha = true;
        break;
      }
      if (chunkType === "IEND") break;
      offset += 12 + chunkLen;
    }
  }

  return {
    isPng: true,
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
    hasAlpha,
  };
}

/**
 * Parser binary murni untuk GIF89a / GIF87a.
 * Menguraikan dimensi, Graphic Control Extension (transparansi & frame delay),
 * Application Extension (Netscape 2.0 loop), dan total frame count.
 *
 * @param {Buffer} buffer
 * @returns {object|null}
 */
function parseGifHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 13) {
    return null;
  }

  const sig = buffer.subarray(0, 6).toString("ascii");
  if (sig !== "GIF87a" && sig !== "GIF89a") {
    return null;
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packedFields = buffer.readUInt8(10);
  const hasGlobalColorTable = (packedFields & 0x80) !== 0;

  let offset = 13;
  if (hasGlobalColorTable) {
    const gctSize = 3 * (1 << ((packedFields & 0x07) + 1));
    offset += gctSize;
  }

  let frameCount = 0;
  const delays = [];
  let isLooping = false;
  let loopCount = null;
  let hasTransparency = false;
  const frameBlocks = [];

  while (offset < buffer.length) {
    const introducer = buffer[offset];
    if (introducer === 0x3b) {
      break;
    }

    if (introducer === 0x21) {
      const label = buffer[offset + 1];
      if (label === 0xf9) {
        frameCount++;
        const packed = buffer[offset + 3];
        if ((packed & 0x01) !== 0) {
          hasTransparency = true;
        }
        const delay = buffer.readUInt16LE(offset + 4);
        delays.push(delay);
        offset += 8;
      } else if (label === 0xff) {
        const blockSize = buffer[offset + 2];
        if (blockSize >= 11 && offset + 3 + 11 <= buffer.length) {
          const appName = buffer.subarray(offset + 3, offset + 14).toString("ascii");
          if (appName === "NETSCAPE2.0" || appName === "ANIMEXTS1.0") {
            isLooping = true;
            const subBlockLen = buffer[offset + 14];
            if (subBlockLen === 3 && buffer[offset + 15] === 1) {
              loopCount = buffer.readUInt16LE(offset + 16);
            }
          }
        }
        offset += 2;
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset += buffer[offset] + 1;
        }
        offset++;
      } else {
        offset += 2;
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset += buffer[offset] + 1;
        }
        offset++;
      }
    } else if (introducer === 0x2c) {
      // Capture full image descriptor + local color table + raster data
      const descStart = offset;
      offset += 10;
      if (offset <= buffer.length) {
        const localPacked = buffer[descStart + 9];
        if ((localPacked & 0x80) !== 0) {
          const lctSize = 3 * (1 << ((localPacked & 0x07) + 1));
          offset += lctSize;
        }
        offset++; // LZW minimum code size
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset += buffer[offset] + 1;
        }
        offset++; // 0x00 terminating sub-block
        frameBlocks.push(buffer.subarray(descStart, offset));
      }
    } else {
      offset++;
    }
  }

  const frameHashes = frameBlocks.map((b) => crypto.createHash("sha256").update(b).digest("hex"));
  const uniqueFrames = new Set(frameHashes).size;
  const hasAnimationEntropy = uniqueFrames > 1;

  const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
  const fps = avgDelay > 0 ? 100 / avgDelay : 0;

  return {
    sig,
    width,
    height,
    frameCount,
    delays,
    avgDelay,
    fps,
    isLooping,
    loopCount,
    hasTransparency,
    uniqueFrames,
    hasAnimationEntropy,
  };
}

/**
 * Validasi token warna brand dan larangan warna neon kasar pada teks SVG.
 *
 * @param {string} svgContent
 * @returns {{ valid: boolean, primaryFound: string[], forbiddenFound: string[], errors: string[] }}
 */
function validateSvgColorTokens(svgContent) {
  const errors = [];
  const primaryFound = [];
  const forbiddenFound = [];
  const lowerSvg = svgContent.toLowerCase();

  for (const forbidden of BRAND_TOKENS.forbidden) {
    if (lowerSvg.includes(forbidden.toLowerCase())) {
      forbiddenFound.push(forbidden);
      errors.push(`Forbidden neon color detected: ${forbidden}`);
    }
  }

  for (const [tokenName, hex] of Object.entries(BRAND_TOKENS.primary)) {
    if (lowerSvg.includes(hex.toLowerCase())) {
      primaryFound.push(tokenName);
    }
  }

  if (primaryFound.length === 0) {
    errors.push("No primary brand color tokens (#FFB6C1, #00FFFF, #C084FC, #22C55E) detected in SVG");
  }

  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/i);
  if (!viewBoxMatch) {
    errors.push("Missing viewBox in SVG");
  } else {
    const coords = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (coords.length === 4) {
      if (coords[2] <= 0 || coords[3] <= 0) {
        errors.push(`Invalid viewBox dimensions: ${viewBoxMatch[1]}`);
      } else if (coords[2] !== coords[3]) {
        errors.push(`Non-square viewBox aspect ratio: ${coords[2]}x${coords[3]}`);
      }
    } else {
      errors.push(`Malformed viewBox attribute: ${viewBoxMatch[1]}`);
    }
  }

  return {
    valid: errors.length === 0,
    primaryFound,
    forbiddenFound,
    errors,
  };
}

/**
 * Validasi integritas skema dan koordinat pada manifest JSON.
 *
 * @param {object} manifest
 * @param {string} manifestFilename
 * @returns {{ valid: boolean, emojiCount: number, errors: string[] }}
 */
function validateManifestStructure(manifest, manifestFilename = "manifest.json") {
  const errors = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, emojiCount: 0, errors: [`${manifestFilename} is not a valid JSON object`] };
  }

  if (!manifest.version) {
    errors.push(`${manifestFilename} missing required 'version' field`);
  }

  if (!manifest.generated) {
    errors.push(`${manifestFilename} missing required 'generated' timestamp`);
  }

  const emojis = Array.isArray(manifest.emojis) ? manifest.emojis : [];
  if (emojis.length !== 90) {
    errors.push(`${manifestFilename} contains ${emojis.length} emojis (expected exactly 90)`);
  }

  const seenNames = new Set();
  for (let i = 0; i < emojis.length; i++) {
    const item = emojis[i];
    if (!item.name) {
      errors.push(`${manifestFilename}: Emoji at index ${i} missing 'name'`);
      continue;
    }

    if (seenNames.has(item.name)) {
      errors.push(`${manifestFilename}: Duplicate emoji name '${item.name}'`);
    }
    seenNames.add(item.name);

    if (!ALL_90_EMOJIS.includes(item.name)) {
      errors.push(`${manifestFilename}: Unknown emoji name '${item.name}'`);
    }

    if (!item.category || !EMOJI_CATEGORIES[item.category]) {
      errors.push(`${manifestFilename}: Invalid category '${item.category}' for '${item.name}'`);
    }

    if (!Array.isArray(item.tags) || item.tags.length === 0) {
      errors.push(`${manifestFilename}: Emoji '${item.name}' missing valid 'tags' array`);
    }

    if (!item.fallback || typeof item.fallback !== "string") {
      errors.push(`${manifestFilename}: Emoji '${item.name}' missing 'fallback' string`);
    }

    if (typeof item.sheetIndex === "number") {
      if (item.sheetIndex < 0 || item.sheetIndex >= 96) {
        errors.push(`${manifestFilename}: Emoji '${item.name}' sheetIndex out of bounds: ${item.sheetIndex}`);
      }
    }

    if (typeof item.x32 === "number" && typeof item.y32 === "number") {
      if (item.x32 < 0 || item.x32 > 512 - 32 || item.y32 < 0 || item.y32 > 192 - 32) {
        errors.push(`${manifestFilename}: Emoji '${item.name}' 32px coordinates out of bounds: (${item.x32}, ${item.y32})`);
      }
    }

    if (typeof item.x64 === "number" && typeof item.y64 === "number") {
      if (item.x64 < 0 || item.x64 > 512 - 64 || item.y64 < 0 || item.y64 > 768 - 64) {
        errors.push(`${manifestFilename}: Emoji '${item.name}' 64px coordinates out of bounds: (${item.x64}, ${item.y64})`);
      }
    }
  }

  if (manifest.spritesheets) {
    const s32 = manifest.spritesheets["32"];
    if (!s32 || s32.width !== 512 || s32.height !== 192) {
      errors.push(`${manifestFilename}: Spritesheet 32 dimensions mismatch (expected 512x192)`);
    }
    const s64 = manifest.spritesheets["64"];
    if (!s64 || s64.width !== 512 || s64.height !== 768) {
      errors.push(`${manifestFilename}: Spritesheet 64 dimensions mismatch (expected 512x768)`);
    }
  } else {
    errors.push(`${manifestFilename} missing 'spritesheets' metadata block`);
  }

  return {
    valid: errors.length === 0,
    emojiCount: emojis.length,
    errors,
  };
}

/**
 * Menjalankan seluruh verifikasi aset emoji Naura Hoshino V2.
 *
 * @param {object} options
 * @param {boolean} options.verbose
 * @returns {object} Hasil verifikasi lengkap
 */
function verifyAll(options = {}) {
  const { verbose = false } = options;
  const errors = [];
  const warnings = [];

  const stats = {
    totalChecked: 0,
    staticPngValid: 0,
    animatedGifValid: 0,
    sourceSvgValid: 0,
    spritesheetsValid: 0,
    manifestsValid: 0,
    categories: {},
  };

  // 1. Verifikasi File Counts dan Struktur Direktori
  const requiredDirs = [
    { label: "Assets Root", dir: ASSETS_ROOT },
    { label: "Export Static", dir: STATIC_DIR },
    { label: "Export Animated", dir: ANIMATED_DIR },
    { label: "Source Root", dir: SOURCE_DIR },
    { label: "Spritesheets", dir: SPRITESHEETS_DIR },
  ];

  for (const { label, dir } of requiredDirs) {
    if (!fs.existsSync(dir)) {
      errors.push(`Directory missing: ${label} (${dir})`);
    }
  }

  // 2. Verifikasi 90 Master SVGs, Static PNGs, dan Animated GIFs per Kategori
  for (const cat of Object.values(EMOJI_CATEGORIES)) {
    const catStats = {
      name: cat.name,
      expected: cat.count,
      staticCount: 0,
      animatedCount: 0,
      sourceCount: 0,
      errors: [],
    };

    const sourceCatDir = path.join(SOURCE_DIR, cat.id);
    if (!fs.existsSync(sourceCatDir)) {
      errors.push(`Category source directory missing: assets/emojis/source/${cat.id}`);
    }

    for (const emojiName of cat.emojis) {
      stats.totalChecked++;

      // A. Static PNG Verification
      const pngPath = path.join(STATIC_DIR, `${emojiName}.png`);
      if (!fs.existsSync(pngPath)) {
        errors.push(`Missing static PNG: ${emojiName}.png`);
        catStats.errors.push(`Missing static PNG: ${emojiName}.png`);
      } else {
        const pngBuf = fs.readFileSync(pngPath);
        const pngStat = fs.statSync(pngPath);
        const pngHeader = parsePngHeader(pngBuf);

        if (!pngHeader || !pngHeader.isPng) {
          errors.push(`Invalid PNG signature / corrupt IHDR: ${emojiName}.png`);
        } else {
          if (pngHeader.width !== TARGET_CANVAS_DIMENSION || pngHeader.height !== TARGET_CANVAS_DIMENSION) {
            errors.push(`Static PNG dimension mismatch for ${emojiName}.png: ${pngHeader.width}x${pngHeader.height} (expected 128x128)`);
          }
          if (!pngHeader.hasAlpha) {
            errors.push(`Static PNG missing 8-bit alpha transparency channel: ${emojiName}.png`);
          }
          if (pngHeader.bitDepth !== 8) {
            errors.push(`Static PNG bit depth mismatch for ${emojiName}.png: ${pngHeader.bitDepth} (expected 8)`);
          }
          if (pngStat.size >= MAX_FILE_SIZE) {
            errors.push(`Static PNG exceeds 256 KB: ${emojiName}.png (${(pngStat.size / 1024).toFixed(1)} KB)`);
          }
          if (pngStat.size === 0) {
            errors.push(`Static PNG empty 0 bytes: ${emojiName}.png`);
          }

          if (
            pngHeader.width === TARGET_CANVAS_DIMENSION &&
            pngHeader.height === TARGET_CANVAS_DIMENSION &&
            pngHeader.hasAlpha &&
            pngStat.size < MAX_FILE_SIZE &&
            pngStat.size > 0
          ) {
            stats.staticPngValid++;
            catStats.staticCount++;
          }
        }
      }

      // B. Animated GIF Verification
      const gifPath = path.join(ANIMATED_DIR, `${emojiName}.gif`);
      if (!fs.existsSync(gifPath)) {
        errors.push(`Missing animated GIF: ${emojiName}.gif`);
        catStats.errors.push(`Missing animated GIF: ${emojiName}.gif`);
      } else {
        const gifBuf = fs.readFileSync(gifPath);
        const gifStat = fs.statSync(gifPath);
        const gifHeader = parseGifHeader(gifBuf);

        if (!gifHeader) {
          errors.push(`Invalid GIF signature / corrupt header: ${emojiName}.gif`);
        } else {
          if (gifHeader.width !== TARGET_CANVAS_DIMENSION || gifHeader.height !== TARGET_CANVAS_DIMENSION) {
            errors.push(`Animated GIF dimension mismatch for ${emojiName}.gif: ${gifHeader.width}x${gifHeader.height} (expected 128x128)`);
          }
          if (!gifHeader.hasTransparency) {
            errors.push(`Animated GIF missing GCE transparency flag: ${emojiName}.gif`);
          }
          if (!gifHeader.isLooping) {
            errors.push(`Animated GIF missing NETSCAPE2.0 infinite loop extension: ${emojiName}.gif`);
          }
          if (gifHeader.frameCount !== TARGET_ANIMATION_FRAMES) {
            errors.push(`Animated GIF frame count mismatch for ${emojiName}.gif: ${gifHeader.frameCount} frames (expected 12 frames)`);
          }
          if (gifHeader.fps < TARGET_MIN_FPS || gifHeader.fps > TARGET_MAX_FPS) {
            errors.push(`Animated GIF frame rate out of bounds for ${emojiName}.gif: ${gifHeader.fps.toFixed(1)} fps (expected 12-15 fps)`);
          }
          if (!gifHeader.hasAnimationEntropy || gifHeader.uniqueFrames <= 1) {
            errors.push(`Animated GIF static frame facade detected for ${emojiName}.gif: ${gifHeader.uniqueFrames}/${gifHeader.frameCount} unique frames (zero delta entropy)`);
          }
          if (gifStat.size >= MAX_FILE_SIZE) {
            errors.push(`Animated GIF exceeds 256 KB: ${emojiName}.gif (${(gifStat.size / 1024).toFixed(1)} KB)`);
          }
          if (gifStat.size === 0) {
            errors.push(`Animated GIF empty 0 bytes: ${emojiName}.gif`);
          }

          if (
            gifHeader.width === TARGET_CANVAS_DIMENSION &&
            gifHeader.height === TARGET_CANVAS_DIMENSION &&
            gifHeader.hasTransparency &&
            gifHeader.isLooping &&
            gifHeader.frameCount === TARGET_ANIMATION_FRAMES &&
            gifHeader.fps >= TARGET_MIN_FPS &&
            gifHeader.fps <= TARGET_MAX_FPS &&
            gifHeader.uniqueFrames > 1 &&
            gifHeader.hasAnimationEntropy &&
            gifStat.size < MAX_FILE_SIZE &&
            gifStat.size > 0
          ) {
            stats.animatedGifValid++;
            catStats.animatedCount++;
          }
        }
      }

      // C. Master SVG Verification
      const svgPath = path.join(sourceCatDir, `${emojiName}.svg`);
      const fallbackSvgPath = path.join(SOURCE_DIR, `${emojiName}.svg`);
      const activeSvgPath = fs.existsSync(svgPath) ? svgPath : fs.existsSync(fallbackSvgPath) ? fallbackSvgPath : null;

      if (!activeSvgPath) {
        errors.push(`Missing master SVG: ${emojiName}.svg in assets/emojis/source/${cat.id}/`);
        catStats.errors.push(`Missing master SVG: ${emojiName}.svg`);
      } else {
        const svgText = fs.readFileSync(activeSvgPath, "utf8");
        const svgVal = validateSvgColorTokens(svgText);

        if (!svgVal.valid) {
          for (const err of svgVal.errors) {
            errors.push(`SVG error in ${emojiName}.svg: ${err}`);
          }
        } else {
          stats.sourceSvgValid++;
          catStats.sourceCount++;
        }
      }
    }

    stats.categories[cat.id] = catStats;
  }

  // 3. Verifikasi Spritesheets (32px dan 64px)
  const sheet32Path = path.join(SPRITESHEETS_DIR, "emoji_sheet_32.png");
  const sheet64Path = path.join(SPRITESHEETS_DIR, "emoji_sheet_64.png");

  if (!fs.existsSync(sheet32Path)) {
    errors.push("Missing 32px spritesheet: assets/emojis/spritesheets/emoji_sheet_32.png");
  } else {
    const s32Buf = fs.readFileSync(sheet32Path);
    const s32Header = parsePngHeader(s32Buf);
    if (!s32Header || !s32Header.isPng) {
      errors.push("Invalid PNG signature for emoji_sheet_32.png");
    } else if (s32Header.width !== 512 || s32Header.height !== 192 || !s32Header.hasAlpha) {
      errors.push(`Invalid 32px spritesheet format: ${s32Header.width}x${s32Header.height}, alpha=${s32Header.hasAlpha} (expected 512x192 with alpha)`);
    } else {
      stats.spritesheetsValid++;
    }
  }

  if (!fs.existsSync(sheet64Path)) {
    errors.push("Missing 64px spritesheet: assets/emojis/spritesheets/emoji_sheet_64.png");
  } else {
    const s64Buf = fs.readFileSync(sheet64Path);
    const s64Header = parsePngHeader(s64Buf);
    if (!s64Header || !s64Header.isPng) {
      errors.push("Invalid PNG signature for emoji_sheet_64.png");
    } else if (s64Header.width !== 512 || s64Header.height !== 768 || !s64Header.hasAlpha) {
      errors.push(`Invalid 64px spritesheet format: ${s64Header.width}x${s64Header.height}, alpha=${s64Header.hasAlpha} (expected 512x768 with alpha)`);
    } else {
      stats.spritesheetsValid++;
    }
  }

  // 4. Verifikasi Manifest Files (emoji_manifest.json dan manifest.json)
  const manifestFiles = ["emoji_manifest.json", "manifest.json"];
  for (const mFile of manifestFiles) {
    const mPath = path.join(SPRITESHEETS_DIR, mFile);
    if (!fs.existsSync(mPath)) {
      errors.push(`Missing manifest file: assets/emojis/spritesheets/${mFile}`);
    } else {
      try {
        const mContent = JSON.parse(fs.readFileSync(mPath, "utf8"));
        const mVal = validateManifestStructure(mContent, mFile);
        if (!mVal.valid) {
          for (const err of mVal.errors) {
            errors.push(err);
          }
        } else {
          stats.manifestsValid++;
        }
      } catch (err) {
        errors.push(`Failed to parse JSON in ${mFile}: ${err.message}`);
      }
    }
  }

  const success = errors.length === 0;

  return {
    success,
    errors,
    warnings,
    stats,
    verbose,
  };
}

/**
 * Mencetak laporan hasil verifikasi ke terminal dalam format terstruktur.
 *
 * @param {object} result
 */
function printReport(result) {
  const { success, errors, warnings, stats } = result;

  console.log(`${COLORS.cyan}================================================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.magenta}       NAURA HOSHINO V2 -- CUSTOM EMOJIS AUTOMATED VERIFIER (R3)${COLORS.reset}`);
  console.log(`${COLORS.cyan}================================================================================${COLORS.reset}`);
  console.log(`Target Assets Directory : ${path.relative(ROOT_DIR, ASSETS_ROOT)}`);
  console.log(`Standards Reference     : docs/NAURA_EMOJI_DESIGN_SYSTEM.md`);
  console.log(`Requirement Scope       : R3 Automated Verification Script (All 90 Assets)`);
  console.log(`${COLORS.cyan}--------------------------------------------------------------------------------${COLORS.reset}\n`);

  console.log(`${COLORS.bold}[1/4] KELENGKAPAN ASET PER KATEGORI (90 EMOJIS)${COLORS.reset}`);
  for (const cat of Object.values(EMOJI_CATEGORIES)) {
    const cStat = stats.categories[cat.id];
    const isCatComplete =
      cStat &&
      cStat.staticCount === cat.count &&
      cStat.animatedCount === cat.count &&
      cStat.sourceCount === cat.count;

    const icon = isCatComplete ? `${COLORS.green}✔ PASS${COLORS.reset}` : `${COLORS.red}✖ FAIL${COLORS.reset}`;
    console.log(
      `  ${icon} ${cat.name.padEnd(26)} : SVG ${cStat?.sourceCount || 0}/${cat.count} | PNG ${cStat?.staticCount || 0}/${cat.count} | GIF ${cStat?.animatedCount || 0}/${cat.count}`,
    );
  }

  console.log(`\n${COLORS.bold}[2/4] SPESIFIKASI BINARY HEADER & TRANSPARANSI${COLORS.reset}`);
  const pngOk = stats.staticPngValid === 90;
  const gifOk = stats.animatedGifValid === 90;
  console.log(
    `  ${pngOk ? `${COLORS.green}✔ PASS${COLORS.reset}` : `${COLORS.red}✖ FAIL${COLORS.reset}`} Static PNGs   : ${stats.staticPngValid}/90 conform 128x128 px, 8-bit alpha, <256 KB`,
  );
  console.log(
    `  ${gifOk ? `${COLORS.green}✔ PASS${COLORS.reset}` : `${COLORS.red}✖ FAIL${COLORS.reset}`} Animated GIFs : ${stats.animatedGifValid}/90 conform 128x128 px, 12 frames, 12-15 fps, loop, non-zero entropy, <256 KB`,
  );

  console.log(`\n${COLORS.bold}[3/4] SPRITESHEETS & JSON MANIFEST${COLORS.reset}`);
  const sheetsOk = stats.spritesheetsValid === 2;
  const manifestsOk = stats.manifestsValid === 2;
  console.log(
    `  ${sheetsOk ? `${COLORS.green}✔ PASS${COLORS.reset}` : `${COLORS.red}✖ FAIL${COLORS.reset}`} Spritesheets  : ${stats.spritesheetsValid}/2 generated (32px: 512x192, 64px: 512x768)`,
  );
  console.log(
    `  ${manifestsOk ? `${COLORS.green}✔ PASS${COLORS.reset}` : `${COLORS.red}✖ FAIL${COLORS.reset}`} JSON Manifest : ${stats.manifestsValid}/2 valid (emoji_manifest.json & manifest.json mapped 90)`,
  );

  console.log(`\n${COLORS.bold}[4/4] BRAND PALETTE & FILTER WARNA NEON${COLORS.reset}`);
  const svgOk = stats.sourceSvgValid === 90;
  console.log(
    `  ${svgOk ? `${COLORS.green}✔ PASS${COLORS.reset}` : `${COLORS.red}✖ FAIL${COLORS.reset}`} Master SVGs   : ${stats.sourceSvgValid}/90 comply with Brand Palette (Pink, Cyan, Purple, Green)`,
  );

  if (warnings.length > 0) {
    console.log(`\n${COLORS.yellow}[WARNINGS]${COLORS.reset}`);
    for (const warn of warnings) {
      console.log(`  ⚠ ${warn}`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n${COLORS.red}[ERRORS DETECTED] (${errors.length} issue${errors.length > 1 ? "s" : ""}):${COLORS.reset}`);
    for (let i = 0; i < Math.min(errors.length, 20); i++) {
      console.log(`  ✖ ${errors[i]}`);
    }
    if (errors.length > 20) {
      console.log(`  ... dan ${errors.length - 20} error lainnya.`);
    }
  }

  console.log(`\n${COLORS.cyan}================================================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}                      VERIFICATION AUDIT SUMMARY${COLORS.reset}`);
  console.log(`${COLORS.cyan}================================================================================${COLORS.reset}`);
  console.log(`Total Assets Checked   : 90 Static PNG + 90 Animated GIF + 90 Master SVG (270 total)`);
  console.log(`Spritesheets Checked   : 2 (32px & 64px)`);
  console.log(`Manifests Checked      : 2 (emoji_manifest.json & manifest.json)`);
  console.log(`Validation Errors      : ${errors.length === 0 ? `${COLORS.green}0 Errors${COLORS.reset}` : `${COLORS.red}${errors.length} Errors${COLORS.reset}`}`);
  console.log(`Verification Status    : ${success ? `${COLORS.green}${COLORS.bold}ALL 90 ASSETS PASSED (100% SPEC CONFORMANT)${COLORS.reset}` : `${COLORS.red}${COLORS.bold}VERIFICATION FAILED${COLORS.reset}`}`);
  console.log(`${COLORS.cyan}================================================================================${COLORS.reset}\n`);
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let verbose = false;
  let json = false;

  for (const arg of args) {
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--json") {
      json = true;
    }
  }

  return { verbose, json };
}

function main() {
  const startTime = Date.now();
  const { verbose, json } = parseCliArgs();

  const result = verifyAll({ verbose });
  const durationMs = Date.now() - startTime;

  if (json) {
    const jsonOutput = {
      timestamp: new Date().toISOString(),
      durationMs,
      success: result.success,
      errorsCount: result.errors.length,
      errors: result.errors,
      stats: result.stats,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    printReport(result);
    console.log(`${COLORS.dim}Executed in ${durationMs}ms | Exit code: ${result.success ? 0 : 1}${COLORS.reset}\n`);
  }

  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  verifyAll,
  parsePngHeader,
  parseGifHeader,
  validateSvgColorTokens,
  validateManifestStructure,
  EMOJI_CATEGORIES,
  ALL_90_EMOJIS,
};
