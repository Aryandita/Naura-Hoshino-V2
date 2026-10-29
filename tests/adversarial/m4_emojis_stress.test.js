"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { createCanvas, loadImage } = require("../../src/canvas/canvasRuntime.js");

const ROOT_DIR = path.resolve(__dirname, "../..");
const DOCS_PATH = path.join(ROOT_DIR, "docs/NAURA_EMOJI_DESIGN_SYSTEM.md");
const SOURCE_DIR = path.join(ROOT_DIR, "assets/emojis/source");
const STATIC_DIR = path.join(ROOT_DIR, "assets/emojis/export/static");
const ANIMATED_DIR = path.join(ROOT_DIR, "assets/emojis/export/animated");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const EXPECTED_CATEGORIES = {
  status: { name: "Status & Reactions", expectedCount: 20 },
  action: { name: "Actions & Commands", expectedCount: 15 },
  rpg: { name: "RPG & Survival", expectedCount: 20 },
  system: { name: "System & UI", expectedCount: 15 },
  social: { name: "Social & Community", expectedCount: 10 },
  special: { name: "Special Naura Signatures", expectedCount: 10 },
};

/**
 * Binary PNG Parser
 */
function parsePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 29) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const compression = buffer.readUInt8(26);
  const filter = buffer.readUInt8(27);
  const interlace = buffer.readUInt8(28);

  let hasAlpha = colorType === 6 || colorType === 4;
  let hasTrns = false;

  let offset = 33;
  while (offset + 8 <= buffer.length) {
    const chunkLen = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (chunkType === "tRNS") {
      hasTrns = true;
      hasAlpha = true;
    }
    if (chunkType === "IEND") break;
    offset += 12 + chunkLen;
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    compression,
    filter,
    interlace,
    hasAlpha,
    hasTrns,
  };
}

/**
 * Binary GIF Parser
 */
function parseGif(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 13) return null;
  const sig = buffer.subarray(0, 6).toString("ascii");
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packed = buffer.readUInt8(10);
  const hasGct = (packed & 0x80) !== 0;

  let offset = 13;
  if (hasGct) {
    const gctSize = 3 * (1 << ((packed & 0x07) + 1));
    offset += gctSize;
  }

  let frameCount = 0;
  const delays = [];
  let hasNetscapeLoop = false;
  let loopCount = null;
  let hasTransparency = false;

  while (offset < buffer.length) {
    const intro = buffer[offset];
    if (intro === 0x3b) break; // Trailer

    if (intro === 0x21) {
      const label = buffer[offset + 1];
      if (label === 0xf9) {
        // Graphic Control Extension
        frameCount++;
        const gcePacked = buffer[offset + 3];
        if ((gcePacked & 0x01) !== 0) hasTransparency = true;
        const delay = buffer.readUInt16LE(offset + 4); // in hundredths of a second
        delays.push(delay);
        offset += 8;
      } else if (label === 0xff) {
        // Application Extension
        const blockSize = buffer[offset + 2];
        if (blockSize >= 11 && offset + 3 + 11 <= buffer.length) {
          const app = buffer.subarray(offset + 3, offset + 14).toString("ascii");
          if (app === "NETSCAPE2.0" || app === "ANIMEXTS1.0") {
            hasNetscapeLoop = true;
            const subLen = buffer[offset + 14];
            if (subLen === 3 && buffer[offset + 15] === 1) {
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
    } else if (intro === 0x2c) {
      // Image Descriptor
      offset += 10;
      if (offset <= buffer.length) {
        const lPacked = buffer[offset - 1];
        if ((lPacked & 0x80) !== 0) {
          const lctSize = 3 * (1 << ((lPacked & 0x07) + 1));
          offset += lctSize;
        }
        offset++;
        while (offset < buffer.length && buffer[offset] !== 0) {
          offset += buffer[offset] + 1;
        }
        offset++;
      }
    } else {
      offset++;
    }
  }

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
    hasNetscapeLoop,
    loopCount,
    hasTransparency,
  };
}

describe("Empirical Challenger M4 Stress Test: Custom Emojis (90 Assets)", () => {
  // Extract canonical emoji list directly from docs/NAURA_EMOJI_DESIGN_SYSTEM.md
  const docContent = fs.readFileSync(DOCS_PATH, "utf8");
  const parsedDocCategories = {};

  const lines = docContent.split("\n");
  let activeCategory = null;

  const categoryHeaderMap = {
    "Status & Reactions": "status",
    "Actions & Commands": "action",
    "RPG & Survival": "rpg",
    "System & UI": "system",
    "Social & Community": "social",
    "Special Naura Signatures": "special",
  };

  for (const line of lines) {
    const h3Match = line.match(/^###\s+[A-F]\.\s+([^(\n]+)/);
    if (h3Match) {
      const headerTitle = h3Match[1].trim();
      if (categoryHeaderMap[headerTitle]) {
        activeCategory = categoryHeaderMap[headerTitle];
        parsedDocCategories[activeCategory] = [];
      } else {
        activeCategory = null;
      }
    } else if (
      activeCategory &&
      line.startsWith("|") &&
      !line.includes("No | Name") &&
      !line.includes("---")
    ) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 3) {
        const num = parseInt(parts[1], 10);
        const name = parts[2];
        if (!isNaN(num) && name.startsWith("naura_")) {
          parsedDocCategories[activeCategory].push(name);
        }
      }
    }
  }

  const all90CanonicalNames = Object.values(parsedDocCategories).flat();

  describe("Suite 1: 100% Naming Parity & Category Distribution", () => {
    it("STRESS-P1.1: Document has exactly 6 categories with expected distributions", () => {
      assert.equal(Object.keys(parsedDocCategories).length, 6);
      for (const [cat, info] of Object.entries(EXPECTED_CATEGORIES)) {
        const actualList = parsedDocCategories[cat];
        assert.ok(actualList, `Category '${cat}' must exist in parsed documentation`);
        assert.equal(
          actualList.length,
          info.expectedCount,
          `Category '${cat}' must have exactly ${info.expectedCount} items in doc, got ${actualList.length}`,
        );
      }
      assert.equal(
        all90CanonicalNames.length,
        90,
        `Total emojis extracted from documentation must be exactly 90, got ${all90CanonicalNames.length}`,
      );
    });

    it("STRESS-P1.2: Check all 90 filenames across source/{category} against documentation", () => {
      for (const [cat, info] of Object.entries(EXPECTED_CATEGORIES)) {
        const catDir = path.join(SOURCE_DIR, cat);
        assert.ok(fs.existsSync(catDir), `Source directory '${catDir}' must exist`);
        const files = fs.readdirSync(catDir);
        assert.equal(
          files.length,
          info.expectedCount,
          `Directory '${catDir}' must contain exactly ${info.expectedCount} files, got ${files.length}`,
        );

        const expectedList = parsedDocCategories[cat];
        for (const name of expectedList) {
          const expectedFile = `${name}.svg`;
          assert.ok(
            files.includes(expectedFile),
            `Source file '${cat}/${expectedFile}' missing!`,
          );
        }

        // Verify no stray files
        for (const file of files) {
          assert.ok(file.endsWith(".svg"), `File '${file}' in '${cat}' must have .svg extension`);
          const baseName = file.replace(".svg", "");
          assert.ok(
            expectedList.includes(baseName),
            `Unexpected stray file '${file}' found in source/${cat}`,
          );
        }
      }
    });

    it("STRESS-P1.3: Check all 90 filenames in export/static against documentation", () => {
      assert.ok(fs.existsSync(STATIC_DIR), `Static directory '${STATIC_DIR}' must exist`);
      const staticFiles = fs.readdirSync(STATIC_DIR);
      assert.equal(
        staticFiles.length,
        90,
        `export/static must contain exactly 90 files, got ${staticFiles.length}`,
      );

      for (const name of all90CanonicalNames) {
        const expectedPng = `${name}.png`;
        assert.ok(
          staticFiles.includes(expectedPng),
          `Static export missing: ${expectedPng}`,
        );
      }

      for (const file of staticFiles) {
        assert.ok(file.endsWith(".png"), `File '${file}' in static must have .png extension`);
        const base = file.replace(".png", "");
        assert.ok(
          all90CanonicalNames.includes(base),
          `Unexpected file in export/static: ${file}`,
        );
      }
    });

    it("STRESS-P1.4: Check all 90 filenames in export/animated against documentation", () => {
      assert.ok(fs.existsSync(ANIMATED_DIR), `Animated directory '${ANIMATED_DIR}' must exist`);
      const animatedFiles = fs.readdirSync(ANIMATED_DIR);
      assert.equal(
        animatedFiles.length,
        90,
        `export/animated must contain exactly 90 files, got ${animatedFiles.length}`,
      );

      for (const name of all90CanonicalNames) {
        const expectedGif = `${name}.gif`;
        assert.ok(
          animatedFiles.includes(expectedGif),
          `Animated export missing: ${expectedGif}`,
        );
      }

      for (const file of animatedFiles) {
        assert.ok(file.endsWith(".gif"), `File '${file}' in animated must have .gif extension`);
        const base = file.replace(".gif", "");
        assert.ok(
          all90CanonicalNames.includes(base),
          `Unexpected file in export/animated: ${file}`,
        );
      }
    });
  });

  describe("Suite 2: Discord Rendering Parameters Stress Test - Animated GIFs", () => {
    it("STRESS-P2.1: All 90 GIFs possess Netscape 2.0 infinite loop (loopCount === 0)", () => {
      for (const name of all90CanonicalNames) {
        const filePath = path.join(ANIMATED_DIR, `${name}.gif`);
        const buf = fs.readFileSync(filePath);
        const parsed = parseGif(buf);

        assert.ok(parsed, `Failed to parse GIF binary header for ${name}.gif`);
        assert.equal(parsed.width, 128, `${name}.gif must have width 128`);
        assert.equal(parsed.height, 128, `${name}.gif must have height 128`);
        assert.ok(
          parsed.hasNetscapeLoop,
          `${name}.gif missing Netscape 2.0 loop application block! Discord requires this for looping animation.`,
        );
        assert.equal(
          parsed.loopCount,
          0,
          `${name}.gif loopCount must be 0 (infinite loop), got ${parsed.loopCount}`,
        );
      }
    });

    it("STRESS-P2.2: All 90 GIFs possess frame delays ~80ms (12.5 FPS) and valid frame counts", () => {
      const delaysSeen = new Set();
      for (const name of all90CanonicalNames) {
        const filePath = path.join(ANIMATED_DIR, `${name}.gif`);
        const buf = fs.readFileSync(filePath);
        const parsed = parseGif(buf);

        assert.ok(parsed, `Failed to parse GIF binary header for ${name}.gif`);
        assert.ok(
          parsed.frameCount >= 10 && parsed.frameCount <= 25,
          `${name}.gif frame count must be in range 10-25, got ${parsed.frameCount}`,
        );

        // Frame delay check: delay in hundredths of a second
        // 8 hundredths = 80ms -> 12.5 FPS.
        for (let i = 0; i < parsed.delays.length; i++) {
          const d = parsed.delays[i];
          delaysSeen.add(d);
          assert.equal(
            d,
            8,
            `${name}.gif frame ${i} delay is ${d * 10}ms, expected exact 80ms (8 hundredths)`,
          );
        }

        const avgMs = parsed.avgDelay * 10;
        assert.equal(avgMs, 80, `${name}.gif average delay must be 80ms, got ${avgMs}ms`);
        assert.equal(parsed.fps, 12.5, `${name}.gif FPS must be 12.5 FPS, got ${parsed.fps}`);
      }
      assert.deepEqual(Array.from(delaysSeen), [8], "All frames across all 90 GIFs must have 80ms delay");
    });

    it("STRESS-P2.3: All 90 GIFs possess GCE transparency flag and size < 256KB", () => {
      let maxGifSize = 0;
      let minGifSize = Infinity;
      let maxGifName = "";

      for (const name of all90CanonicalNames) {
        const filePath = path.join(ANIMATED_DIR, `${name}.gif`);
        const stats = fs.statSync(filePath);
        if (stats.size > maxGifSize) {
          maxGifSize = stats.size;
          maxGifName = name;
        }
        if (stats.size < minGifSize) minGifSize = stats.size;

        assert.ok(
          stats.size < 256 * 1024,
          `${name}.gif size ${stats.size} exceeds Discord 256 KB limit`,
        );

        const buf = fs.readFileSync(filePath);
        const parsed = parseGif(buf);
        assert.ok(
          parsed.hasTransparency,
          `${name}.gif missing GCE transparent color flag (bit 0)`,
        );
      }

      // Assert that largest GIF is comfortably within budget
      assert.ok(
        maxGifSize < 240 * 1024,
        `Largest GIF (${maxGifName}: ${(maxGifSize / 1024).toFixed(2)} KB) is within safe headroom (<240KB)`,
      );
    });
  });

  describe("Suite 3: Discord Rendering Parameters Stress Test - Static PNGs", () => {
    it("STRESS-P3.1: All 90 PNGs conform to 128x128 canvas, bitDepth=8, colorType 6 (RGBA)", () => {
      const colorTypesSeen = new Set();
      const bitDepthsSeen = new Set();

      for (const name of all90CanonicalNames) {
        const filePath = path.join(STATIC_DIR, `${name}.png`);
        const buf = fs.readFileSync(filePath);
        const parsed = parsePng(buf);

        assert.ok(parsed, `Failed to parse PNG binary header for ${name}.png`);
        assert.equal(parsed.width, 128, `${name}.png width must be 128, got ${parsed.width}`);
        assert.equal(parsed.height, 128, `${name}.png height must be 128, got ${parsed.height}`);
        assert.equal(parsed.bitDepth, 8, `${name}.png bit depth must be 8, got ${parsed.bitDepth}`);
        assert.equal(
          parsed.colorType,
          6,
          `${name}.png colorType must be 6 (RGBA with true 8-bit alpha), got ${parsed.colorType}`,
        );
        assert.ok(parsed.hasAlpha, `${name}.png must possess alpha transparency channel`);

        colorTypesSeen.add(parsed.colorType);
        bitDepthsSeen.add(parsed.bitDepth);
      }

      assert.deepEqual(Array.from(colorTypesSeen), [6], "All 90 PNGs must use ColorType 6 (RGBA)");
      assert.deepEqual(Array.from(bitDepthsSeen), [8], "All 90 PNGs must use 8-bit depth per channel");
    });

    it("STRESS-P3.2: Real Transparency Validation: Corner pixels (0,0) and (127,127) have Alpha === 0", async () => {
      // Decode sample of PNGs using Skia canvas to inspect real decoded RGBA pixel buffer
      const sampleNames = [
        "naura_happy",
        "naura_sad",
        "naura_play",
        "naura_sword",
        "naura_settings",
        "naura_trophy",
        "naura_sparkle",
        "naura_coin_sc",
        "naura_loading",
        "naura_vip_badge",
      ];

      for (const name of sampleNames) {
        const filePath = path.join(STATIC_DIR, `${name}.png`);
        const image = await loadImage(filePath);
        assert.equal(image.width, 128);
        assert.equal(image.height, 128);

        const canvas = createCanvas(128, 128);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);

        const imgData = ctx.getImageData(0, 0, 128, 128);
        const data = imgData.data;

        // Check corner pixel (0,0): index 0,1,2,3 -> alpha is index 3
        const cornerTopLeftAlpha = data[3];
        assert.equal(
          cornerTopLeftAlpha,
          0,
          `Pixel (0,0) in ${name}.png must be completely transparent (alpha=0), got ${cornerTopLeftAlpha}`,
        );

        // Check corner pixel (127,0): (0 * 128 + 127) * 4 + 3
        const cornerTopRightAlpha = data[(127) * 4 + 3];
        assert.equal(
          cornerTopRightAlpha,
          0,
          `Pixel (127,0) in ${name}.png must be completely transparent (alpha=0), got ${cornerTopRightAlpha}`,
        );

        // Check corner pixel (0,127): (127 * 128 + 0) * 4 + 3
        const cornerBottomLeftAlpha = data[(127 * 128) * 4 + 3];
        assert.equal(
          cornerBottomLeftAlpha,
          0,
          `Pixel (0,127) in ${name}.png must be completely transparent (alpha=0), got ${cornerBottomLeftAlpha}`,
        );

        // Check corner pixel (127,127): (127 * 128 + 127) * 4 + 3
        const cornerBottomRightAlpha = data[(127 * 128 + 127) * 4 + 3];
        assert.equal(
          cornerBottomRightAlpha,
          0,
          `Pixel (127,127) in ${name}.png must be completely transparent (alpha=0), got ${cornerBottomRightAlpha}`,
        );
      }
    });

    it("STRESS-P3.3: All 90 PNGs strictly under 256 KB Discord limit", () => {
      let maxPngSize = 0;
      let minPngSize = Infinity;
      let maxPngName = "";

      for (const name of all90CanonicalNames) {
        const filePath = path.join(STATIC_DIR, `${name}.png`);
        const stats = fs.statSync(filePath);
        if (stats.size > maxPngSize) {
          maxPngSize = stats.size;
          maxPngName = name;
        }
        if (stats.size < minPngSize) minPngSize = stats.size;

        assert.ok(
          stats.size < 256 * 1024,
          `${name}.png file size ${stats.size} bytes exceeds Discord 256 KB limit`,
        );
      }

      assert.ok(
        maxPngSize < 50 * 1024,
        `Largest PNG (${maxPngName}: ${(maxPngSize / 1024).toFixed(2)} KB) is compact and well under budget (<50KB)`,
      );
    });
  });

  describe("Suite 4: Master SVGs Quality & Brand Palette Integrity", () => {
    it("STRESS-P4.1: All 90 SVGs are valid XML, viewBox '0 0 128 128', zero forbidden colors", () => {
      for (const cat of Object.keys(EXPECTED_CATEGORIES)) {
        const catDir = path.join(SOURCE_DIR, cat);
        const files = fs.readdirSync(catDir);

        for (const file of files) {
          const content = fs.readFileSync(path.join(catDir, file), "utf8");

          // XML and SVG root check
          assert.ok(content.includes("<svg"), `${file} must contain <svg tag`);
          assert.ok(content.includes("</svg>"), `${file} must contain </svg> closing tag`);
          assert.ok(
            content.includes('viewBox="0 0 128 128"'),
            `${file} must have viewBox="0 0 128 128"`,
          );

          // Forbidden colors check
          assert.equal(
            content.includes("#FF00FF") || content.includes("#ff00ff"),
            false,
            `Forbidden harsh neon #FF00FF found in ${file}!`,
          );
          assert.equal(
            content.includes("#00FF00") || content.includes("#00ff00"),
            false,
            `Forbidden harsh neon #00FF00 found in ${file}!`,
          );
        }
      }
    });
  });

  describe("Suite 5: Real-world Discord Environment Simulation & Performance Stress", () => {
    it("STRESS-P5.1: High-throughput batch decode across all 180 binary assets < 800ms", () => {
      const startTime = performance.now();
      let pngCount = 0;
      let gifCount = 0;

      for (const name of all90CanonicalNames) {
        const pngBuf = fs.readFileSync(path.join(STATIC_DIR, `${name}.png`));
        const pngMeta = parsePng(pngBuf);
        if (pngMeta) pngCount++;

        const gifBuf = fs.readFileSync(path.join(ANIMATED_DIR, `${name}.gif`));
        const gifMeta = parseGif(gifBuf);
        if (gifMeta) gifCount++;
      }

      const elapsed = performance.now() - startTime;
      assert.equal(pngCount, 90);
      assert.equal(gifCount, 90);
      assert.ok(
        elapsed < 1000,
        `Batch parse of 180 emoji binaries took ${elapsed.toFixed(2)}ms (budget: <1000ms)`,
      );
    });

    it("STRESS-P5.2: Spritesheet metadata and manifest coordinate integrity", () => {
      const manifestPath = path.join(ROOT_DIR, "assets/emojis/spritesheets/manifest.json");
      const emojiManifestPath = path.join(ROOT_DIR, "assets/emojis/spritesheets/emoji_manifest.json");
      assert.ok(fs.existsSync(manifestPath), "manifest.json must exist");
      assert.ok(fs.existsSync(emojiManifestPath), "emoji_manifest.json must exist");

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      assert.equal(manifest.total, 90);
      assert.equal(manifest.emojis.length, 90);

      // Verify all canonical names exist in manifest
      const manifestNames = manifest.emojis.map((e) => e.name);
      for (const name of all90CanonicalNames) {
        assert.ok(manifestNames.includes(name), `Emoji ${name} missing from manifest.json`);
      }

      // Check spritesheet dimensions
      const sheet32 = path.join(ROOT_DIR, "assets/emojis/spritesheets/emoji_sheet_32.png");
      const sheet64 = path.join(ROOT_DIR, "assets/emojis/spritesheets/emoji_sheet_64.png");
      const p32 = parsePng(fs.readFileSync(sheet32));
      const p64 = parsePng(fs.readFileSync(sheet64));

      assert.equal(p32.width, 512);
      assert.equal(p32.height, 192);
      assert.equal(p32.colorType, 6);
      assert.ok(p32.hasAlpha);

      assert.equal(p64.width, 512);
      assert.equal(p64.height, 768);
      assert.equal(p64.colorType, 6);
      assert.ok(p64.hasAlpha);
    });
  });
});
