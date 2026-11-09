// Lokasi: test/m1ExpressionEmojis.test.js
// Automated Test Suite for Milestone M1: Core Expression Emoji Assets
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createCanvas,
  loadImage,
} = require("../src/canvas/canvasRuntime");

const EMOJI_DIR = path.resolve(__dirname, "../assets/emojis/naura_custom");
const MAX_DISCORD_BYTES = 256 * 1024; // 256 KB

const REQUIRED_PNG_EMOJIS = [
  "naura_happy.png",
  "naura_thinking.png",
  "naura_cry.png",
  "naura_angry.png",
  "naura_shy.png",
  "naura_sleepy.png",
  "naura_shocked.png",
  "naura_eat.png",
  "naura_cheers.png",
  "naura_chirping.png",
  "naura_annoy.png",
  "naura_blow_kiss.png",
  "naura_akward.png",
  "naura_confused.png",
  "naura_hmph.png",
  "naura_impressed.png",
  "naura_read.png",
];

const REQUIRED_GIF_EMOJIS = [
  "naura_happy.gif",
  "naura_thinking.gif",
  "naura_cry.gif",
  "naura_angry.gif",
  "naura_sleepy.gif",
  "naura_cheers.gif",
  "naura_chirping.gif",
  "naura_blow_kiss.gif",
];

test("M1: All 17 Core Static PNG Expression Emojis exist and meet constraints", async (t) => {
  for (const filename of REQUIRED_PNG_EMOJIS) {
    await t.test(`Verify static PNG: ${filename}`, async () => {
      const filePath = path.join(EMOJI_DIR, filename);
      assert.ok(fs.existsSync(filePath), `File ${filename} must exist in ${EMOJI_DIR}`);

      const stats = fs.statSync(filePath);
      assert.ok(
        stats.size < MAX_DISCORD_BYTES,
        `File ${filename} size (${stats.size} bytes) must be strictly < 256 KB (262,144 bytes)`
      );
      assert.ok(stats.size > 5000, `File ${filename} size (${stats.size} bytes) must be a non-trivial graphic`);

      // Verify PNG binary header
      const buffer = fs.readFileSync(filePath);
      const signature = buffer.subarray(0, 8);
      const expectedSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.deepEqual(signature, expectedSig, `File ${filename} must have standard PNG signature`);

      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      const bitDepth = buffer.readUInt8(24);
      const colorType = buffer.readUInt8(25);

      assert.equal(width, 128, `File ${filename} width must be exactly 128 px`);
      assert.equal(height, 128, `File ${filename} height must be exactly 128 px`);
      assert.equal(bitDepth, 8, `File ${filename} bit depth must be 8-bit`);
      assert.equal(colorType, 6, `File ${filename} color type must be 6 (Truecolor RGBA with alpha)`);

      // Verify transparency and safe margins with canvas
      const img = await loadImage(filePath);
      const canvas = createCanvas(128, 128);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const idata = ctx.getImageData(0, 0, 128, 128).data;

      // 4 corners must be completely transparent (alpha === 0)
      const corners = [
        [0, 0],
        [127, 0],
        [0, 127],
        [127, 127],
      ];
      for (const [cx, cy] of corners) {
        const alpha = idata[(cy * 128 + cx) * 4 + 3];
        assert.equal(alpha, 0, `File ${filename} corner (${cx}, ${cy}) must be 100% transparent (alpha=0)`);
      }

      // Check bounding box of non-transparent pixels
      let minX = 128;
      let maxX = 0;
      let minY = 128;
      let maxY = 0;
      let visiblePixels = 0;

      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          const a = idata[(y * 128 + x) * 4 + 3];
          if (a > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            visiblePixels++;
          }
        }
      }

      assert.ok(visiblePixels > 500, `File ${filename} must have sufficient character silhouette data`);
      assert.ok(minX >= 9, `File ${filename} left margin must respect 10px safe zone (got ${minX})`);
      assert.ok(maxX <= 118, `File ${filename} right margin must respect 10px safe zone (got ${127 - maxX})`);
      assert.ok(minY >= 9, `File ${filename} top margin must respect 10px safe zone (got ${minY})`);
      assert.ok(maxY <= 118, `File ${filename} bottom margin must respect 10px safe zone (got ${127 - maxY})`);

      // Optical horizontal centering
      const centerX = (minX + maxX) / 2;
      assert.ok(
        Math.abs(centerX - 64) <= 3,
        `File ${filename} horizontal center (${centerX}) must be optically centered at ~64`
      );
    });
  }
});

test("M1: All 8 Key Animated GIF Expression Emojis exist and meet constraints", async (t) => {
  for (const filename of REQUIRED_GIF_EMOJIS) {
    await t.test(`Verify animated GIF: ${filename}`, async () => {
      const filePath = path.join(EMOJI_DIR, filename);
      assert.ok(fs.existsSync(filePath), `File ${filename} must exist in ${EMOJI_DIR}`);

      const stats = fs.statSync(filePath);
      assert.ok(
        stats.size < MAX_DISCORD_BYTES,
        `File ${filename} size (${stats.size} bytes) must be strictly < 256 KB`
      );
      assert.ok(stats.size > 10000, `File ${filename} size (${stats.size} bytes) must contain animated frame data`);

      // Verify GIF binary header
      const buffer = fs.readFileSync(filePath);
      const header = buffer.subarray(0, 6).toString("ascii");
      assert.ok(header === "GIF89a" || header === "GIF87a", `File ${filename} must have valid GIF header`);

      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      assert.equal(width, 128, `File ${filename} width must be exactly 128 px`);
      assert.equal(height, 128, `File ${filename} height must be exactly 128 px`);

      // Check for Graphic Control Extension (0x21, 0xF9) with transparent color flag
      let hasTransparentBlock = false;
      let frameCount = 0;
      for (let i = 0; i < buffer.length - 8; i++) {
        if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9 && buffer[i + 2] === 0x04) {
          frameCount++;
          const flags = buffer[i + 3];
          const transparentColorFlag = flags & 0x01;
          if (transparentColorFlag) hasTransparentBlock = true;
        }
      }

      assert.ok(hasTransparentBlock, `File ${filename} must have active GIF transparency flag`);
      assert.ok(
        frameCount >= 10,
        `File ${filename} must contain at least 10 animation frames (found ${frameCount})`
      );
    });
  }
});
