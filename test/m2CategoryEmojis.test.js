// Lokasi: test/m2CategoryEmojis.test.js
// Automated Test Suite for Milestone M2: Category Feature Emoji Assets
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CATEGORY_EMOJIS } = require("../scripts/generate_category_emojis");

const EMOJI_DIR = path.resolve(__dirname, "../assets/emojis/naura_custom");
const MAX_DISCORD_BYTES = 256 * 1024; // 256 KB (262,144 bytes)

const EXPECTED_PNG_KEYS = [
  // A. Core & System (8)
  "naura_core", "naura_ping", "naura_uptime", "naura_cpu", "naura_ram", "naura_shard", "naura_lang", "naura_donate",
  // B. AI & ML (6)
  "ai_sparkle", "ai_thinking", "ai_vision", "ai_voice", "ai_openrouter", "ai_vip_fast",
  // C. Arcade & Education (9)
  "arcade_hub", "arcade_dice", "arcade_card", "arcade_duel", "arcade_target", "edu_math", "edu_map", "edu_flag", "edu_word",
  // D. Economy & Business (6)
  "eco_cash", "eco_bank", "eco_shop", "eco_work", "eco_heist", "eco_trade",
  // E. Moderation & Admin (7)
  "mod_shield", "mod_warn", "mod_mute", "mod_kick", "mod_ban", "mod_lock", "mod_ticket",
  // F. Music & Media (6)
  "music_play", "music_pause", "music_skip", "music_queue", "music_bass", "music_disc",
  // G. Utility & 3rd Party (8)
  "mc_pickaxe", "mc_steve", "mc_ping", "weather_sun", "weather_rain", "media_anime", "media_movie", "dl_cobalt",
];

const EXPECTED_GIF_KEYS = [
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

test("M2: All 50 Category Static PNG Emojis exist and meet constraints", async (t) => {
  assert.equal(EXPECTED_PNG_KEYS.length, 50, "Total category emojis must be exactly 50");

  for (const key of EXPECTED_PNG_KEYS) {
    await t.test(`Verify category PNG: ${key}.png`, () => {
      const filePath = path.join(EMOJI_DIR, `${key}.png`);
      assert.ok(fs.existsSync(filePath), `File ${key}.png must exist`);

      const buffer = fs.readFileSync(filePath);
      const sizeBytes = buffer.length;

      // File size constraint
      assert.ok(sizeBytes > 0, `File ${key}.png must not be empty`);
      assert.ok(
        sizeBytes < MAX_DISCORD_BYTES,
        `File ${key}.png size (${(sizeBytes / 1024).toFixed(1)} KB) must be < 256 KB`
      );

      // PNG Header Verification
      const pngSignature = buffer.subarray(0, 8);
      assert.deepEqual(
        pngSignature,
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        `File ${key}.png must have valid PNG magic signature`
      );

      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      const bitDepth = buffer.readUInt8(24);
      const colorType = buffer.readUInt8(25);

      assert.equal(width, 128, `Width of ${key}.png must be exactly 128 px`);
      assert.equal(height, 128, `Height of ${key}.png must be exactly 128 px`);
      assert.equal(bitDepth, 8, `Bit depth of ${key}.png must be 8-bit`);
      assert.equal(colorType, 6, `Color type of ${key}.png must be 6 (RGBA with alpha channel)`);
    });
  }
});

test("M2: All 13 Action Animated GIF Emojis exist and meet constraints", async (t) => {
  assert.equal(EXPECTED_GIF_KEYS.length, 13, "Total action animated GIFs must be exactly 13");

  for (const key of EXPECTED_GIF_KEYS) {
    await t.test(`Verify action GIF: ${key}.gif`, () => {
      const filePath = path.join(EMOJI_DIR, `${key}.gif`);
      assert.ok(fs.existsSync(filePath), `File ${key}.gif must exist`);

      const buffer = fs.readFileSync(filePath);
      const sizeBytes = buffer.length;

      assert.ok(sizeBytes > 0, `File ${key}.gif must not be empty`);
      assert.ok(
        sizeBytes < MAX_DISCORD_BYTES,
        `File ${key}.gif size (${(sizeBytes / 1024).toFixed(1)} KB) must be < 256 KB`
      );

      // GIF Header Verification (GIF89a)
      const gifHeader = buffer.subarray(0, 6).toString("ascii");
      assert.ok(
        gifHeader === "GIF89a" || gifHeader === "GIF87a",
        `File ${key}.gif must have valid GIF header (found ${gifHeader})`
      );

      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);

      assert.equal(width, 128, `Width of ${key}.gif must be exactly 128 px`);
      assert.equal(height, 128, `Height of ${key}.gif must be exactly 128 px`);
    });
  }
});

test("M2: Generator Definition Parity and Completeness", () => {
  assert.equal(CATEGORY_EMOJIS.length, 50, "CATEGORY_EMOJIS definition array must have 50 items");

  const definedKeys = new Set(CATEGORY_EMOJIS.map((e) => e.key));
  for (const key of EXPECTED_PNG_KEYS) {
    assert.ok(definedKeys.has(key), `Key ${key} must be defined in generator array`);
  }

  const animatedKeys = CATEGORY_EMOJIS.filter((e) => e.animated).map((e) => e.key);
  assert.equal(animatedKeys.length, 13, "Animated category emojis count must be 13");
  for (const key of EXPECTED_GIF_KEYS) {
    assert.ok(animatedKeys.includes(key), `Animated key ${key} must be marked animated in generator`);
  }
});
