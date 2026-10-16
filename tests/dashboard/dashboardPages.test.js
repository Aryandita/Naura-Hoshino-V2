"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT_DIR, "dashboard/public");
const PAGES_DIR = path.join(ROOT_DIR, "dashboard/src/pages");

test("M3 Web Dashboard: File Existence & Parity", () => {
  const publicSoundboard = path.join(PUBLIC_DIR, "soundboard.html");
  const pagesSoundboard = path.join(PAGES_DIR, "soundboard.html");
  const publicAutomod = path.join(PUBLIC_DIR, "automod.html");
  const pagesAutomod = path.join(PAGES_DIR, "automod.html");

  assert.ok(fs.existsSync(publicSoundboard), "dashboard/public/soundboard.html must exist");
  assert.ok(fs.existsSync(pagesSoundboard), "dashboard/src/pages/soundboard.html must exist");
  assert.ok(fs.existsSync(publicAutomod), "dashboard/public/automod.html must exist");
  assert.ok(fs.existsSync(pagesAutomod), "dashboard/src/pages/automod.html must exist");

  const sbStat = fs.statSync(publicSoundboard);
  const amStat = fs.statSync(publicAutomod);
  assert.ok(sbStat.size > 1000, "soundboard.html must be populated");
  assert.ok(amStat.size > 1000, "automod.html must be populated");
});

test("M3 Web Dashboard: soundboard.html Pure WebSocket & Elimination of Legacy REST", () => {
  const content = fs.readFileSync(path.join(PUBLIC_DIR, "soundboard.html"), "utf8");

  // Eliminating legacy REST
  assert.equal(
    content.includes('/api/soundboard/play'),
    false,
    "soundboard.html must not contain legacy fetch('/api/soundboard/play')"
  );

  // Pure WebSocket emission & listeners
  assert.ok(content.includes('socket.emit("soundboard_play"'), "Must emit soundboard_play via WebSocket");
  assert.ok(content.includes('socket.on("soundboard_status"'), "Must listen to soundboard_status");
  assert.ok(content.includes('socket.on("soundboard_played"'), "Must listen to soundboard_played");

  // Dynamic Audio Visualizer Canvas
  assert.ok(content.includes('id="audioVizCanvas"'), "Must include audio visualizer canvas");
  assert.ok(content.includes("drawViz"), "Must include dynamic spectrum visualizer draw routine");

  // 8+ Preset Buttons Required (Airhorn, Ba-Dum-Tss, Bruh, GG, Sad Trombone, Victory, Wow, Quack)
  const requiredPresets = [
    "airhorn",
    "badumtss",
    "bruh",
    "gg",
    "sadtrombone",
    "victory",
    "wow",
    "quack",
  ];

  for (const preset of requiredPresets) {
    assert.ok(
      content.includes(`id: "${preset}"`),
      `soundboard.html must include preset sound "${preset}"`
    );
  }

  // Active Speaker & Cooldown UI elements
  assert.ok(content.includes("activeSpeakerBadge"), "Must have active speaker indicator");
  assert.ok(content.includes("cooldownBadge"), "Must have cooldown timer indicator");
});

test("M3 Web Dashboard: automod.html Visual Automod Studio Requirements", () => {
  const content = fs.readFileSync(path.join(PUBLIC_DIR, "automod.html"), "utf8");

  // API sync
  assert.ok(content.includes("/api/guilds/"), "Must sync with /api/guilds/:guildId/config");
  assert.ok(content.includes("config"), "Must handle config payload");

  // Badwords Studio
  assert.ok(content.includes("Badwords Studio"), "Must include Badwords Studio");
  assert.ok(content.includes("badwordInput"), "Must have badwords tag input");
  assert.ok(content.includes("badwordTagsContainer"), "Must have badwords tag container");

  // Leet-speak normalization preview
  assert.ok(content.includes("normalizeLeetSpeak"), "Must include leet-speak normalizer");
  assert.ok(content.includes("leetTestInput"), "Must have leet-speak test input simulator");
  assert.ok(content.includes("normalizedOutputText"), "Must have normalized text preview");

  // Proactive Protection Toggles
  assert.ok(content.includes("togglePhishingShield"), "Must have Phishing Shield toggle");
  assert.ok(content.includes("toggleGhostPing"), "Must have GhostPing Tracker toggle");
  assert.ok(content.includes("toggleAntiInvite"), "Must have Anti-Invite toggle");
  assert.ok(content.includes("toggleAntiSpam"), "Must have Anti-Spam toggle");
  assert.ok(content.includes("toggleAntiCaps"), "Must have Anti-Caps toggle");
  assert.ok(content.includes("masterAutomodToggle"), "Must have Master Automod toggle");

  // Mass Mention slider (1 to 20)
  assert.ok(content.includes("massMentionSlider"), "Must have mass mention slider");
  assert.ok(content.includes('min="1"'), "Slider must support min 1");
  assert.ok(content.includes('max="20"'), "Slider must support max 20");

  // Punishment Matrix
  assert.ok(content.includes("punishmentMatrix"), "Must have Punishment Matrix");
  assert.ok(content.includes('data-punish="warn"'), "Must include Warn option");
  assert.ok(content.includes('data-punish="timeout_60s"'), "Must include Timeout 60s option");
  assert.ok(content.includes('data-punish="timeout_10m"'), "Must include Timeout 10m option");
  assert.ok(content.includes('data-punish="kick"'), "Must include Kick option");
  assert.ok(content.includes('data-punish="ban"'), "Must include Ban option");
});

test("M3 Web Dashboard: Inline Script Acorn Syntax Validation", () => {
  const pages = [
    path.join(PUBLIC_DIR, "soundboard.html"),
    path.join(PUBLIC_DIR, "automod.html"),
    path.join(PAGES_DIR, "soundboard.html"),
    path.join(PAGES_DIR, "automod.html"),
  ];

  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    const scriptRegex = /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/g;
    let match;
    let scriptCount = 0;

    while ((match = scriptRegex.exec(html))) {
      scriptCount += 1;
      const code = match[2];
      assert.doesNotThrow(() => {
        acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
      }, `Inline script #${scriptCount} in ${path.basename(page)} must parse cleanly with acorn`);
    }

    assert.ok(scriptCount > 0, `${path.basename(page)} must contain inline scripts`);
  }
});

test("M3 Web Dashboard: soundboardService Backend PRESET_SOUNDS", () => {
  const { PRESET_SOUNDS } = require("../../src/services/soundboardService");
  assert.ok(Array.isArray(PRESET_SOUNDS), "PRESET_SOUNDS must be an array");
  assert.ok(PRESET_SOUNDS.length >= 8, "PRESET_SOUNDS must contain at least 8 presets");

  const presetIds = PRESET_SOUNDS.map((s) => s.id);
  const mandated = [
    "airhorn",
    "badumtss",
    "bruh",
    "gg",
    "sadtrombone",
    "victory",
    "wow",
    "quack",
  ];

  for (const id of mandated) {
    assert.ok(presetIds.includes(id), `PRESET_SOUNDS must contain "${id}"`);
  }
});

test("M3 Web Dashboard: sockets/index.js Soundboard Event Handlers", () => {
  const socketsModule = require("../../dashboard/sockets/index");
  assert.equal(typeof socketsModule, "function", "dashboard/sockets/index must export a setup function");

  const socketsContent = fs.readFileSync(path.join(ROOT_DIR, "dashboard/sockets/index.js"), "utf8");
  assert.ok(socketsContent.includes('socket.on("soundboard_play"'), "Must register soundboard_play listener");
  assert.ok(socketsContent.includes('socket.on("join_guild_soundboard"'), "Must register join_guild_soundboard listener");
  assert.ok(socketsContent.includes('socket.emit("soundboard_status"'), "Must emit soundboard_status back to client");
});
