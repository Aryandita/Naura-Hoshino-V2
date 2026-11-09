// Lokasi: test/m3ManifestConfig.test.js
// Automated Test Suite for Milestone M3: Discord Upload Manifest & Bot Configuration
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT_DIR, "assets/emojis/naura_custom/manifest.json");
const CHECKLIST_PATH = path.join(ROOT_DIR, "assets/emojis/naura_custom/UPLOAD_CHECKLIST.md");
const TEMPLATE_PATH = path.join(ROOT_DIR, "src/config/ui/customEmojis.template.js");

const MAX_DISCORD_BYTES = 256 * 1024; // 256 KB Discord limit
const DISCORD_NAME_REGEX = /^[a-zA-Z0-9_]{2,32}$/;

const EXPECTED_CATEGORIES = {
  core: 8,
  ai: 6,
  arcade: 9,
  economy: 6,
  moderation: 7,
  music: 6,
  utility: 8,
  expression: 17,
};

test("M3 Manifest: manifest.json exists, parses, and conforms to schema", async (t) => {
  assert.ok(fs.existsSync(MANIFEST_PATH), "manifest.json must exist in assets/emojis/naura_custom/");

  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  assert.ok(!raw.includes("\u2014"), "manifest.json must not contain any em-dash characters");

  let manifest;
  assert.doesNotThrow(() => {
    manifest = JSON.parse(raw);
  }, "manifest.json must be valid JSON");

  // Top-level metadata
  assert.equal(manifest.version, "1.0.0", "version should be 1.0.0");
  assert.ok(typeof manifest.generatedAt === "string", "generatedAt should be an ISO string");
  assert.equal(manifest.total, 67, "total should be exactly 67");

  // Categories breakdown
  assert.deepEqual(
    manifest.categories,
    EXPECTED_CATEGORIES,
    "categories breakdown must match expected counts for all 8 categories"
  );

  const totalFromCategories = Object.values(manifest.categories).reduce((sum, c) => sum + c, 0);
  assert.equal(totalFromCategories, 67, "Sum of category counts must equal 67");

  // Emojis array
  assert.ok(Array.isArray(manifest.emojis), "manifest.emojis must be an array");
  assert.equal(manifest.emojis.length, 67, "manifest.emojis must contain exactly 67 items");

  const seenKeys = new Set();
  let animatedCount = 0;

  for (const item of manifest.emojis) {
    await t.test(`Validate emoji item: ${item.key}`, () => {
      // Key uniqueness
      assert.ok(!seenKeys.has(item.key), `Duplicate emoji key detected: ${item.key}`);
      seenKeys.add(item.key);

      // Discord name compliance
      assert.match(
        item.discordName,
        DISCORD_NAME_REGEX,
        `discordName "${item.discordName}" must match Discord name requirements ^[a-zA-Z0-9_]{2,32}$`
      );

      // Category validation
      assert.ok(
        Object.keys(EXPECTED_CATEGORIES).includes(item.category),
        `category "${item.category}" must be one of the 8 canonical categories`
      );

      // Description & Fallback
      assert.ok(typeof item.description === "string" && item.description.length > 5, "description must be present");
      assert.ok(!item.description.includes("\u2014"), "description must not contain em-dash");
      assert.ok(typeof item.fallback === "string" && item.fallback.length > 0, "fallback must be present");

      // Static file verification
      assert.ok(item.staticFile.endsWith(".png"), "staticFile must end with .png");
      const staticFullPath = path.join(ROOT_DIR, item.staticFile);
      assert.ok(fs.existsSync(staticFullPath), `staticFile on disk must exist: ${staticFullPath}`);

      const staticStats = fs.statSync(staticFullPath);
      assert.ok(
        staticStats.size < MAX_DISCORD_BYTES,
        `staticFile ${item.staticFile} size (${staticStats.size} bytes) must be < 256 KB`
      );
      assert.ok(staticStats.size > 1000, `staticFile ${item.staticFile} must be non-trivial`);

      // Animated file verification
      assert.equal(typeof item.animated, "boolean", "animated must be a boolean");
      if (item.animated) {
        animatedCount++;
        assert.ok(item.animatedFile, `animatedFile must not be null when animated is true for ${item.key}`);
        assert.ok(item.animatedFile.endsWith(".gif"), "animatedFile must end with .gif");
        const animatedFullPath = path.join(ROOT_DIR, item.animatedFile);
        assert.ok(fs.existsSync(animatedFullPath), `animatedFile on disk must exist: ${animatedFullPath}`);

        const animStats = fs.statSync(animatedFullPath);
        assert.ok(
          animStats.size < MAX_DISCORD_BYTES,
          `animatedFile ${item.animatedFile} size (${animStats.size} bytes) must be < 256 KB`
        );
      } else {
        assert.equal(item.animatedFile, null, `animatedFile must be null when animated is false for ${item.key}`);
      }
    });
  }

  assert.equal(animatedCount, 21, "There must be exactly 21 animated GIFs registered");
});

test("M3 Checklist: UPLOAD_CHECKLIST.md exists, covers all 67 emojis and upload instructions", () => {
  assert.ok(fs.existsSync(CHECKLIST_PATH), "UPLOAD_CHECKLIST.md must exist in assets/emojis/naura_custom/");

  const content = fs.readFileSync(CHECKLIST_PATH, "utf8");
  assert.ok(!content.includes("\u2014"), "UPLOAD_CHECKLIST.md must not contain any em-dash characters");
  assert.ok(content.length > 2000, "UPLOAD_CHECKLIST.md should be comprehensive (> 2000 bytes)");

  // Verify all 67 keys appear in checklist
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  for (const item of manifest.emojis) {
    assert.ok(
      content.includes(`\`${item.key}\``),
      `Checklist must contain key \`${item.key}\``
    );
    assert.ok(
      content.includes(`\`${item.discordName}\``),
      `Checklist must contain recommended Discord name \`${item.discordName}\``
    );
  }

  // Verify instruction sections
  assert.ok(content.includes("Discord Application Emojis"), "Checklist must contain Application Emojis guide");
  assert.ok(content.includes("Discord Server Emojis"), "Checklist must contain Server Emojis guide");
  assert.ok(content.includes("Cara Mendapatkan Tag Emoji ID Discord"), "Checklist must guide on getting emoji tag ID");
  assert.ok(content.includes("Panduan Integrasi Kode Bot"), "Checklist must guide on bot config integration");
});

test("M3 Config Template: customEmojis.template.js exports all 67 keys and handles fallback resolution", () => {
  assert.ok(fs.existsSync(TEMPLATE_PATH), "customEmojis.template.js must exist in src/config/ui/");

  const raw = fs.readFileSync(TEMPLATE_PATH, "utf8");
  assert.ok(!raw.includes("\u2014"), "customEmojis.template.js must not contain any em-dash characters");

  let config;
  assert.doesNotThrow(() => {
    config = require(TEMPLATE_PATH);
  }, "customEmojis.template.js must be a valid CommonJS module");

  assert.ok(typeof config.getCustomEmoji === "function", "config must export getCustomEmoji function");
  assert.ok(typeof config.isCustomEmojiConfigured === "function", "config must export isCustomEmojiConfigured function");
  assert.ok(typeof config.customEmojis === "object", "config must export customEmojis object");
  assert.ok(typeof config.fallbackEmojis === "object", "config must export fallbackEmojis object");

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  // Check all 67 keys are exported
  assert.equal(Object.keys(config.customEmojis).length, 67, "customEmojis must contain 67 keys");
  assert.equal(Object.keys(config.fallbackEmojis).length, 67, "fallbackEmojis must contain 67 keys");

  for (const item of manifest.emojis) {
    // Top-level exported property
    assert.ok(item.key in config, `config must export top-level property for "${item.key}"`);

    // In placeholder state, top-level value has ID_PLACEHOLDER
    const placeholderVal = config[item.key];
    assert.ok(
      placeholderVal.includes("ID_PLACEHOLDER"),
      `Placeholder for ${item.key} must contain ID_PLACEHOLDER: ${placeholderVal}`
    );

    // isCustomEmojiConfigured returns false for placeholder
    assert.equal(
      config.isCustomEmojiConfigured(placeholderVal),
      false,
      `isCustomEmojiConfigured should return false for placeholder ${placeholderVal}`
    );

    // getCustomEmoji(key) gracefully returns fallback Unicode
    const resolved = config.getCustomEmoji(item.key);
    assert.equal(
      resolved,
      item.fallback,
      `getCustomEmoji("${item.key}") should return fallback "${item.fallback}" when unconfigured, got "${resolved}"`
    );
  }

  // Test dynamic configuration validation
  assert.equal(config.isCustomEmojiConfigured("<:naura_core:123456789012345678>"), true);
  assert.equal(config.isCustomEmojiConfigured("<a:naura_happy:987654321098765432>"), true);
  assert.equal(config.isCustomEmojiConfigured("<:invalid_name:notdigits>"), false);
  assert.equal(config.isCustomEmojiConfigured("😊"), false);
  assert.equal(config.isCustomEmojiConfigured(null), false);
  assert.equal(config.isCustomEmojiConfigured(undefined), false);

  // Test parseEmoji compatibility from src/config/ui/helpers.js
  const { parseEmoji } = require("../src/config/ui/helpers");

  // Fallback resolution with parseEmoji
  for (const item of manifest.emojis) {
    const fallbackVal = config.getCustomEmoji(item.key);
    const parsed = parseEmoji(fallbackVal);
    assert.ok(parsed, `parseEmoji must not return null for fallback of ${item.key}`);
    assert.equal(parsed.name, item.fallback, `parsed.name should match fallback emoji for ${item.key}`);
  }

  // Simulated configured custom emoji with parseEmoji
  const parsedStatic = parseEmoji("<:naura_core:123456789012345678>");
  assert.deepEqual(parsedStatic, {
    animated: false,
    name: "naura_core",
    id: "123456789012345678",
  });

  const parsedAnimated = parseEmoji("<a:naura_happy:987654321098765432>");
  assert.deepEqual(parsedAnimated, {
    animated: true,
    name: "naura_happy",
    id: "987654321098765432",
  });
});
