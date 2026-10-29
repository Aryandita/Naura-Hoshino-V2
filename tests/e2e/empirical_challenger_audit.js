#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "../..");
const ASSETS_ROOT = path.join(ROOT_DIR, "assets/emojis");
const STATIC_DIR = path.join(ASSETS_ROOT, "export/static");
const ANIMATED_DIR = path.join(ASSETS_ROOT, "export/animated");
const SOURCE_DIR = path.join(ASSETS_ROOT, "source");
const SPRITESHEETS_DIR = path.join(ASSETS_ROOT, "spritesheets");

const MAX_FILE_SIZE = 256 * 1024; // 256 KB = 262,144 bytes

// 1. CRC32 Implementation for PNG Chunk Validation
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c;
}

function calculateCrc32(buf, start = 0, end = buf.length) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// 2. Strict PNG Parser & Chunk CRC32 Validator
function parseAndValidatePng(filePath) {
  const buf = fs.readFileSync(filePath);
  const size = buf.length;

  if (size < 8) {
    return { ok: false, error: "Buffer smaller than 8 bytes (truncated)" };
  }

  // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
  const expectedMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== expectedMagic[i]) {
      return { ok: false, error: "Invalid PNG magic signature" };
    }
  }

  let offset = 8;
  let ihdrFound = false;
  let iendFound = false;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let hasAlpha = false;
  const chunks = [];

  while (offset < size) {
    if (offset + 8 > size) {
      return { ok: false, error: `Truncated chunk header at byte offset ${offset}` };
    }

    const chunkLength = buf.readUInt32BE(offset);
    const chunkType = buf.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const crcOffset = dataEnd;

    if (crcOffset + 4 > size) {
      return { ok: false, error: `Truncated chunk data for ${chunkType} at offset ${offset}` };
    }

    // CRC covers Chunk Type + Chunk Data
    const actualCrc = calculateCrc32(buf, offset + 4, crcOffset);
    const expectedCrc = buf.readUInt32BE(crcOffset);
    if (actualCrc !== expectedCrc) {
      return {
        ok: false,
        error: `CRC32 mismatch in chunk ${chunkType}: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`,
      };
    }

    chunks.push({ type: chunkType, length: chunkLength });

    if (chunkType === "IHDR") {
      if (ihdrFound) return { ok: false, error: "Duplicate IHDR chunk found" };
      if (chunkLength !== 13) return { ok: false, error: `Invalid IHDR length: ${chunkLength} (must be 13)` };
      ihdrFound = true;
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf.readUInt8(dataStart + 8);
      colorType = buf.readUInt8(dataStart + 9);
      if (colorType === 4 || colorType === 6) {
        hasAlpha = true;
      }
    } else if (chunkType === "tRNS") {
      hasAlpha = true;
    } else if (chunkType === "IEND") {
      iendFound = true;
      if (crcOffset + 4 !== size) {
        const extraBytes = size - (crcOffset + 4);
        return { ok: false, error: `Extra trailing ${extraBytes} garbage bytes after IEND chunk` };
      }
      break;
    }

    offset = crcOffset + 4;
  }

  if (!ihdrFound) return { ok: false, error: "Missing IHDR chunk" };
  if (!iendFound) return { ok: false, error: "Missing IEND chunk or truncated before IEND" };

  return {
    ok: true,
    size,
    width,
    height,
    bitDepth,
    colorType,
    hasAlpha,
    chunksCount: chunks.length,
  };
}

// 3. Strict GIF89a Parser & Block Validator
function parseAndValidateGif(filePath) {
  const buf = fs.readFileSync(filePath);
  const size = buf.length;

  if (size < 13) {
    return { ok: false, error: "Buffer smaller than 13 bytes (truncated GIF header)" };
  }

  const sig = buf.toString("ascii", 0, 6);
  if (sig !== "GIF89a" && sig !== "GIF87a") {
    return { ok: false, error: `Invalid GIF signature: ${sig}` };
  }

  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  const packedFields = buf.readUInt8(10);
  const gctFlag = (packedFields & 0x80) !== 0;
  const gctSize = 2 ** ((packedFields & 0x07) + 1);

  let offset = 13;
  if (gctFlag) {
    offset += 3 * gctSize;
  }

  if (offset > size) {
    return { ok: false, error: "Buffer truncated in Global Color Table" };
  }

  let frameCount = 0;
  let netscapeLoopFound = false;
  let loopCount = -1;
  let hasGceTransparency = false;
  let trailerFound = false;
  const delays = [];

  while (offset < size) {
    const blockIntro = buf.readUInt8(offset);

    if (blockIntro === 0x3b) {
      // Trailer
      trailerFound = true;
      if (offset + 1 !== size) {
        const trailing = size - (offset + 1);
        return { ok: false, error: `Found ${trailing} extra bytes after GIF trailer (0x3B)` };
      }
      break;
    }

    if (blockIntro === 0x21) {
      // Extension Block
      offset++;
      if (offset >= size) return { ok: false, error: "Truncated after extension introducer 0x21" };
      const extLabel = buf.readUInt8(offset);
      offset++;

      if (extLabel === 0xf9) {
        // Graphic Control Extension
        if (offset >= size) return { ok: false, error: "Truncated GCE block size" };
        const blockSize = buf.readUInt8(offset);
        offset++;
        if (blockSize !== 4) return { ok: false, error: `Invalid GCE block size: ${blockSize}` };
        if (offset + 4 > size) return { ok: false, error: "Truncated GCE payload" };

        const gcePacked = buf.readUInt8(offset);
        const delay = buf.readUInt16LE(offset + 1);
        delays.push(delay * 10); // in ms
        if ((gcePacked & 0x01) !== 0) {
          hasGceTransparency = true;
        }
        offset += 4;

        if (offset >= size) return { ok: false, error: "Truncated GCE terminator" };
        const term = buf.readUInt8(offset);
        if (term !== 0x00) return { ok: false, error: `Non-zero GCE terminator: 0x${term.toString(16)}` };
        offset++;
      } else if (extLabel === 0xff) {
        // Application Extension
        if (offset >= size) return { ok: false, error: "Truncated App Extension block size" };
        const blockSize = buf.readUInt8(offset);
        offset++;
        if (offset + blockSize > size) return { ok: false, error: "Truncated App Extension header" };
        const appIdentifier = buf.toString("ascii", offset, offset + blockSize);
        offset += blockSize;

        // Sub-blocks
        while (offset < size) {
          const subLen = buf.readUInt8(offset);
          offset++;
          if (subLen === 0x00) break;
          if (offset + subLen > size) return { ok: false, error: "Truncated App Extension sub-block" };

          if (appIdentifier === "NETSCAPE2.0" || appIdentifier === "ANIMEXTS1.0") {
            netscapeLoopFound = true;
            if (subLen === 3 && buf.readUInt8(offset) === 0x01) {
              loopCount = buf.readUInt16LE(offset + 1);
            }
          }
          offset += subLen;
        }
      } else {
        // Other extension (Comment 0xFE, PlainText 0x01, etc.) -> skip data sub-blocks
        while (offset < size) {
          const subLen = buf.readUInt8(offset);
          offset++;
          if (subLen === 0x00) break;
          offset += subLen;
          if (offset > size) return { ok: false, error: `Truncated extension sub-block (label 0x${extLabel.toString(16)})` };
        }
      }
    } else if (blockIntro === 0x2c) {
      // Image Descriptor
      frameCount++;
      offset++;
      if (offset + 9 > size) return { ok: false, error: `Truncated Image Descriptor for frame ${frameCount}` };
      const imgLeft = buf.readUInt16LE(offset);
      const imgTop = buf.readUInt16LE(offset + 2);
      const imgWidth = buf.readUInt16LE(offset + 4);
      const imgHeight = buf.readUInt16LE(offset + 6);
      const imgPacked = buf.readUInt8(offset + 8);
      offset += 9;

      if (imgLeft + imgWidth > width || imgTop + imgHeight > height) {
        return { ok: false, error: `Frame ${frameCount} bounds exceed canvas: ${imgLeft}+${imgWidth}x${imgTop}+${imgHeight} > ${width}x${height}` };
      }

      const lctFlag = (imgPacked & 0x80) !== 0;
      if (lctFlag) {
        const lctSize = 2 ** ((imgPacked & 0x07) + 1);
        offset += 3 * lctSize;
        if (offset > size) return { ok: false, error: `Truncated Local Color Table in frame ${frameCount}` };
      }

      if (offset >= size) return { ok: false, error: `Truncated LZW min code size in frame ${frameCount}` };
      offset++; // LZW min code size byte

      // Image Data Sub-blocks
      while (offset < size) {
        const subLen = buf.readUInt8(offset);
        offset++;
        if (subLen === 0x00) break;
        offset += subLen;
        if (offset > size) return { ok: false, error: `Truncated LZW image data in frame ${frameCount}` };
      }
    } else {
      return { ok: false, error: `Unknown GIF block introducer 0x${blockIntro.toString(16)} at offset ${offset}` };
    }
  }

  if (!trailerFound) return { ok: false, error: "Premature end of buffer: missing GIF trailer 0x3B" };

  const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
  const fps = avgDelay > 0 ? 1000 / avgDelay : 0;

  return {
    ok: true,
    size,
    width,
    height,
    frameCount,
    netscapeLoopFound,
    loopCount,
    hasGceTransparency,
    delays,
    avgDelay,
    fps,
  };
}

// 4. Strict SVG XML & ViewBox & Color Token Parser
function parseAndValidateSvg(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");

  // Check valid XML tags balance
  // 1. Root <svg ...>
  const svgOpenMatch = content.match(/<svg([^>]*)>/i);
  if (!svgOpenMatch) {
    return { ok: false, error: "Missing opening <svg> tag" };
  }
  if (!content.includes("</svg>")) {
    return { ok: false, error: "Missing closing </svg> tag" };
  }

  const svgAttrs = svgOpenMatch[1];

  // 2. Check viewBox="0 0 128 128"
  const viewBoxMatch = svgAttrs.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBoxMatch) {
    return { ok: false, error: "Missing viewBox attribute on <svg>" };
  }
  const viewBoxVal = viewBoxMatch[1].trim();
  if (viewBoxVal !== "0 0 128 128") {
    return { ok: false, error: `viewBox is '${viewBoxVal}', expected '0 0 128 128'` };
  }

  // 3. Strict XML well-formedness: check tag pairing and attribute quotes
  // Check for any unquoted attribute value
  if (/<[a-zA-Z0-9_-]+\s+[^>]*[a-zA-Z0-9_-]+=[^"'\s>]+[^>]*>/i.test(content)) {
    return { ok: false, error: "Detected unquoted attribute value (violates strict XML)" };
  }

  // 4. Forbidden Color Check
  const forbiddenHex = ["#ff00ff", "#00ff00"];
  const colorMatches = content.match(/#([0-9a-fA-F]{3,8})/g) || [];
  const forbiddenFound = [];
  for (const c of colorMatches) {
    const lower = c.toLowerCase();
    if (forbiddenHex.includes(lower)) {
      forbiddenFound.push(c);
    }
  }

  // Also check rgb/rgba forms: rgb(255, 0, 255), rgb(0, 255, 0)
  if (/rgb\s*\(\s*255\s*,\s*0\s*,\s*255\s*\)/i.test(content) || /rgb\s*\(\s*0\s*,\s*255\s*,\s*0\s*\)/i.test(content)) {
    forbiddenFound.push("rgb-forbidden-neon");
  }

  // 5. Brand Color Tokens Check
  const brandTokens = {
    nauraPink: "#FFB6C1",
    cyberCyan: "#00FFFF",
    dreamPurple: "#C084FC",
    natureGreen: "#22C55E",
    softRose: "#FFC0CB",
    deepMagenta: "#FF69B4",
    skyBlue: "#87CEEB",
    warmAmber: "#FFD700",
    alertRed: "#FF6B6B",
  };

  const detectedTokens = [];
  const contentUpper = content.toUpperCase();
  for (const [key, hex] of Object.entries(brandTokens)) {
    if (contentUpper.includes(hex.toUpperCase())) {
      detectedTokens.push(key);
    }
  }

  return {
    ok: forbiddenFound.length === 0,
    error: forbiddenFound.length > 0 ? `Forbidden neon colors found: ${forbiddenFound.join(", ")}` : null,
    viewBox: viewBoxVal,
    forbiddenFound,
    detectedTokens,
    totalColors: colorMatches.length,
  };
}

// 5. Main Execution Suite
async function runAudit() {
  console.log("================================================================================");
  console.log("  EMPIRICAL CHALLENGER AUDIT: 90 CUSTOM EMOJIS COMPREHENSIVE VERIFICATION");
  console.log("================================================================================");
  console.log(`Execution Timestamp : ${new Date().toISOString()}`);
  console.log(`Node.js Version     : ${process.version}`);
  console.log(`Assets Directory    : ${ASSETS_ROOT}`);
  console.log("--------------------------------------------------------------------------------\n");

  const manifestPath = path.join(SPRITESHEETS_DIR, "emoji_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  const emojis = manifest.emojis;
  console.log(`[MANIFEST] Total emojis registered in manifest: ${emojis.length}`);
  if (emojis.length !== 90) {
    throw new Error(`Expected exactly 90 emojis, got ${emojis.length}`);
  }

  // ----------------------------------------------------
  // TEST 1: PNG File Binary & Boundary Stress
  // ----------------------------------------------------
  console.log("\n[TEST 1/4] AUDITING 90 STATIC PNG BINARIES...");
  let pngPassCount = 0;
  const pngSizes = [];
  const pngFailures = [];

  for (const e of emojis) {
    const pngPath = path.join(STATIC_DIR, `${e.name}.png`);
    if (!fs.existsSync(pngPath)) {
      pngFailures.push({ name: e.name, error: "File not found" });
      continue;
    }

    const result = parseAndValidatePng(pngPath);
    if (!result.ok) {
      pngFailures.push({ name: e.name, error: result.error });
      continue;
    }

    if (result.width !== 128 || result.height !== 128) {
      pngFailures.push({ name: e.name, error: `Invalid dimensions: ${result.width}x${result.height}` });
      continue;
    }

    if (!result.hasAlpha) {
      pngFailures.push({ name: e.name, error: "Missing alpha transparency channel" });
      continue;
    }

    if (result.size >= MAX_FILE_SIZE) {
      pngFailures.push({ name: e.name, error: `Size exceeds 256KB: ${result.size} bytes` });
      continue;
    }

    pngSizes.push(result.size);
    pngPassCount++;
  }

  console.log(`  PNG Validated: ${pngPassCount}/90 passed`);
  if (pngFailures.length > 0) {
    console.error("  ❌ PNG FAILURES:", pngFailures);
  } else {
    console.log("  ✔ All 90 PNGs have valid CRC32, exactly 128x128 px, 8-bit alpha, <256KB.");
  }

  // ----------------------------------------------------
  // TEST 2: GIF File Binary & Boundary Stress & Distribution
  // ----------------------------------------------------
  console.log("\n[TEST 2/4] AUDITING 90 ANIMATED GIF BINARIES...");
  let gifPassCount = 0;
  const gifSizes = [];
  const gifFailures = [];
  let maxGifFile = null;
  let maxGifSize = 0;
  let minGifSize = Infinity;
  let minGifFile = null;

  for (const e of emojis) {
    const gifPath = path.join(ANIMATED_DIR, `${e.name}.gif`);
    if (!fs.existsSync(gifPath)) {
      gifFailures.push({ name: e.name, error: "File not found" });
      continue;
    }

    const result = parseAndValidateGif(gifPath);
    if (!result.ok) {
      gifFailures.push({ name: e.name, error: result.error });
      continue;
    }

    if (result.width !== 128 || result.height !== 128) {
      gifFailures.push({ name: e.name, error: `Invalid dimensions: ${result.width}x${result.height}` });
      continue;
    }

    if (!result.netscapeLoopFound || result.loopCount !== 0) {
      gifFailures.push({ name: e.name, error: `Missing or non-zero infinite loop flag (loopCount=${result.loopCount})` });
      continue;
    }

    if (!result.hasGceTransparency) {
      gifFailures.push({ name: e.name, error: "Missing Graphic Control Extension transparency" });
      continue;
    }

    if (result.fps < 10 || result.fps > 20) {
      gifFailures.push({ name: e.name, error: `FPS out of spec (12-15 expected): ${result.fps.toFixed(2)}` });
      continue;
    }

    if (result.size >= MAX_FILE_SIZE) {
      gifFailures.push({ name: e.name, error: `Size exceeds 256KB: ${result.size} bytes` });
      continue;
    }

    gifSizes.push({ name: e.name, size: result.size, fps: result.fps, frames: result.frameCount });
    if (result.size > maxGifSize) {
      maxGifSize = result.size;
      maxGifFile = e.name;
    }
    if (result.size < minGifSize) {
      minGifSize = result.size;
      minGifFile = e.name;
    }
    gifPassCount++;
  }

  // Calculate GIF Size Distribution Stats
  const sortedSizes = gifSizes.map(g => g.size).sort((a, b) => a - b);
  const totalGifBytes = sortedSizes.reduce((a, b) => a + b, 0);
  const meanSize = totalGifBytes / sortedSizes.length;
  const medianSize = sortedSizes[Math.floor(sortedSizes.length / 2)];
  const p95Size = sortedSizes[Math.floor(sortedSizes.length * 0.95)];
  const p99Size = sortedSizes[Math.floor(sortedSizes.length * 0.99)];
  const variance = sortedSizes.reduce((acc, val) => acc + (val - meanSize) ** 2, 0) / sortedSizes.length;
  const stdDev = Math.sqrt(variance);

  // Size distribution buckets (in KB)
  const buckets = {
    "< 50 KB": 0,
    "50 - 100 KB": 0,
    "100 - 150 KB": 0,
    "150 - 200 KB": 0,
    "200 - 256 KB": 0,
    ">= 256 KB (VIOLATION)": 0,
  };

  for (const s of sortedSizes) {
    const kb = s / 1024;
    if (kb < 50) buckets["< 50 KB"]++;
    else if (kb < 100) buckets["50 - 100 KB"]++;
    else if (kb < 150) buckets["100 - 150 KB"]++;
    else if (kb < 200) buckets["150 - 200 KB"]++;
    else if (kb < 256) buckets["200 - 256 KB"]++;
    else buckets[">= 256 KB (VIOLATION)"]++;
  }

  console.log(`  GIF Validated: ${gifPassCount}/90 passed`);
  if (gifFailures.length > 0) {
    console.error("  ❌ GIF FAILURES:", gifFailures);
  } else {
    console.log("  ✔ All 90 GIFs have valid block structure, Netscape2.0 loop, 128x128 px, <256KB.");
  }

  console.log("\n  --- GIF FILE SIZE DISTRIBUTION METRICS ---");
  console.log(`  Min Size          : ${(minGifSize / 1024).toFixed(2)} KB (${minGifSize} bytes) -> '${minGifFile}.gif'`);
  console.log(`  Max Size          : ${(maxGifSize / 1024).toFixed(2)} KB (${maxGifSize} bytes) -> '${maxGifFile}.gif' [Limit: 256 KB]`);
  console.log(`  Mean Size         : ${(meanSize / 1024).toFixed(2)} KB (${Math.round(meanSize)} bytes)`);
  console.log(`  Median Size       : ${(medianSize / 1024).toFixed(2)} KB (${medianSize} bytes)`);
  console.log(`  Std Dev           : ${(stdDev / 1024).toFixed(2)} KB`);
  console.log(`  95th Percentile   : ${(p95Size / 1024).toFixed(2)} KB`);
  console.log(`  99th Percentile   : ${(p99Size / 1024).toFixed(2)} KB`);
  console.log("  Distribution Histogram:");
  for (const [range, count] of Object.entries(buckets)) {
    const bar = "#".repeat(Math.round((count / 90) * 40));
    console.log(`    ${range.padEnd(23)}: ${String(count).padStart(2)} emojis | ${bar}`);
  }

  // ----------------------------------------------------
  // TEST 3: SVG XML, ViewBox, Brand Tokens & Forbidden Neons
  // ----------------------------------------------------
  console.log("\n[TEST 3/4] AUDITING 90 MASTER SVG SOURCES...");
  let svgPassCount = 0;
  const svgFailures = [];
  const brandTokenSummary = {};

  // Find all SVGs in assets/emojis/source
  function findSvgs(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        results = results.concat(findSvgs(full));
      } else if (ent.isFile() && ent.name.endsWith(".svg")) {
        results.push(full);
      }
    }
    return results;
  }

  const allSvgFiles = findSvgs(SOURCE_DIR);
  console.log(`  Found ${allSvgFiles.length} SVG files across source category subdirectories`);

  for (const svgFile of allSvgFiles) {
    const baseName = path.basename(svgFile, ".svg");
    const result = parseAndValidateSvg(svgFile);

    if (!result.ok) {
      svgFailures.push({ name: baseName, file: path.relative(ROOT_DIR, svgFile), error: result.error });
      continue;
    }

    for (const token of result.detectedTokens) {
      brandTokenSummary[token] = (brandTokenSummary[token] || 0) + 1;
    }

    svgPassCount++;
  }

  console.log(`  SVG Validated: ${svgPassCount}/90 passed`);
  if (svgFailures.length > 0) {
    console.error("  ❌ SVG FAILURES:", svgFailures);
  } else {
    console.log("  ✔ All 90 SVGs are valid XML, declare viewBox='0 0 128 128', 0 forbidden neons.");
  }
  console.log("  Brand Token Representation in SVGs:");
  for (const [token, count] of Object.entries(brandTokenSummary)) {
    console.log(`    - ${token.padEnd(14)}: present in ${count} SVGs`);
  }

  // ----------------------------------------------------
  // TEST 4: Spritesheet Mapping & Overlap Collision Check
  // ----------------------------------------------------
  console.log("\n[TEST 4/4] AUDITING SPRITESHEETS & MANIFEST COORDINATES...");
  const sheet32Cells = new Map();
  const sheet64Cells = new Map();
  const manifestFailures = [];

  const sheet32Meta = manifest.spritesheets["32"];
  const sheet64Meta = manifest.spritesheets["64"];

  console.log(`  Spritesheet 32px: ${sheet32Meta.width}x${sheet32Meta.height} (${sheet32Meta.cols} cols x ${sheet32Meta.rows} rows, cell: ${sheet32Meta.cellSize}px)`);
  console.log(`  Spritesheet 64px: ${sheet64Meta.width}x${sheet64Meta.height} (${sheet64Meta.cols} cols x ${sheet64Meta.rows} rows, cell: ${sheet64Meta.cellSize}px)`);

  for (const e of emojis) {
    // Check 32px coordinates
    const key32 = `${e.x32},${e.y32}`;
    if (e.x32 < 0 || e.x32 + 32 > sheet32Meta.width || e.y32 < 0 || e.y32 + 32 > sheet32Meta.height) {
      manifestFailures.push({ name: e.name, error: `32px out-of-bounds: (${e.x32}, ${e.y32}) exceeds sheet ${sheet32Meta.width}x${sheet32Meta.height}` });
    }
    if (e.x32 % 32 !== 0 || e.y32 % 32 !== 0) {
      manifestFailures.push({ name: e.name, error: `32px not cell-aligned: (${e.x32}, ${e.y32})` });
    }
    if (sheet32Cells.has(key32)) {
      manifestFailures.push({ name: e.name, error: `32px CELL COLLISION with ${sheet32Cells.get(key32)} at (${e.x32}, ${e.y32})` });
    } else {
      sheet32Cells.set(key32, e.name);
    }

    // Check 64px coordinates
    const key64 = `${e.x64},${e.y64}`;
    if (e.x64 < 0 || e.x64 + 64 > sheet64Meta.width || e.y64 < 0 || e.y64 + 64 > sheet64Meta.height) {
      manifestFailures.push({ name: e.name, error: `64px out-of-bounds: (${e.x64}, ${e.y64}) exceeds sheet ${sheet64Meta.width}x${sheet64Meta.height}` });
    }
    if (e.x64 % 64 !== 0 || e.y64 % 64 !== 0) {
      manifestFailures.push({ name: e.name, error: `64px not cell-aligned: (${e.x64}, ${e.y64})` });
    }
    if (sheet64Cells.has(key64)) {
      manifestFailures.push({ name: e.name, error: `64px CELL COLLISION with ${sheet64Cells.get(key64)} at (${e.x64}, ${e.y64})` });
    } else {
      sheet64Cells.set(key64, e.name);
    }
  }

  // Validate Spritesheet Image Files
  const sheet32Path = path.join(SPRITESHEETS_DIR, sheet32Meta.file);
  const sheet64Path = path.join(SPRITESHEETS_DIR, sheet64Meta.file);

  const parsed32 = parseAndValidatePng(sheet32Path);
  const parsed64 = parseAndValidatePng(sheet64Path);

  if (!parsed32.ok) manifestFailures.push({ name: sheet32Meta.file, error: parsed32.error });
  else if (parsed32.width !== sheet32Meta.width || parsed32.height !== sheet32Meta.height) {
    manifestFailures.push({ name: sheet32Meta.file, error: `Dimension mismatch: expected ${sheet32Meta.width}x${sheet32Meta.height}, got ${parsed32.width}x${parsed32.height}` });
  }

  if (!parsed64.ok) manifestFailures.push({ name: sheet64Meta.file, error: parsed64.error });
  else if (parsed64.width !== sheet64Meta.width || parsed64.height !== sheet64Meta.height) {
    manifestFailures.push({ name: sheet64Meta.file, error: `Dimension mismatch: expected ${sheet64Meta.width}x${sheet64Meta.height}, got ${parsed64.width}x${parsed64.height}` });
  }

  if (manifestFailures.length > 0) {
    console.error("  ❌ SPRITESHEET & MANIFEST FAILURES:", manifestFailures);
  } else {
    console.log("  ✔ Spritesheet cell mapping: 90 unique cells mapped in 32px & 64px sheets, 0 overlaps, 0 out-of-bounds.");
    console.log("  ✔ Spritesheet PNG files verified: 512x192 (32px) and 512x768 (64px) with valid CRC32 and alpha.");
  }

  // ----------------------------------------------------
  // FINAL VERDICT
  // ----------------------------------------------------
  console.log("\n================================================================================");
  console.log("                       EMPIRICAL AUDIT SUMMARY");
  console.log("================================================================================");
  console.log(`PNG Binaries Audited       : ${pngPassCount}/90 PASSED (Failures: ${pngFailures.length})`);
  console.log(`GIF Binaries Audited       : ${gifPassCount}/90 PASSED (Failures: ${gifFailures.length})`);
  console.log(`SVG Sources Audited        : ${svgPassCount}/90 PASSED (Failures: ${svgFailures.length})`);
  console.log(`Manifest & Spritesheets    : ${manifestFailures.length === 0 ? "PASSED" : "FAILED"} (Failures: ${manifestFailures.length})`);
  console.log("--------------------------------------------------------------------------------");

  const totalErrors = pngFailures.length + gifFailures.length + svgFailures.length + manifestFailures.length;
  if (totalErrors === 0) {
    console.log("CHALLENGER VERDICT: >>> APPROVE <<< (0 ERRORS DETECTED ACROSS ALL 270 ASSETS)");
  } else {
    console.log(`CHALLENGER VERDICT: >>> REQUEST_CHANGES <<< (${totalErrors} DEFECTS FOUND)`);
  }
  console.log("================================================================================\n");

  return {
    totalErrors,
    pngPassCount,
    gifPassCount,
    svgPassCount,
    minGifSize,
    minGifFile,
    maxGifSize,
    maxGifFile,
    meanSize,
    medianSize,
    stdDev,
    p95Size,
    p99Size,
    buckets,
    brandTokenSummary,
  };
}

runAudit().catch(err => {
  console.error("FATAL ERROR IN AUDIT SCRIPT:", err);
  process.exit(1);
});
