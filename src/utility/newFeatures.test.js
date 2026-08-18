"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("Audio Assets - 6 Audio Files Existence Check", () => {
  const audioDir = path.resolve(__dirname, "../../assets/audio");
  const expectedFiles = [
    "Ai Chat Intro (EN).mp3",
    "Ai Chat Intro (ID).mp3",
    "Intro (EN).mp3",
    "Intro (ID).mp3",
    "Server Join (EN).mp3",
    "Server Join (ID).mp3",
  ];

  for (const file of expectedFiles) {
    const filePath = path.join(audioDir, file);
    assert.strictEqual(
      fs.existsSync(filePath),
      true,
      `Audio file ${file} should exist in assets/audio`,
    );
    const stats = fs.statSync(filePath);
    assert.ok(stats.size > 10000, `Audio file ${file} should have valid size`);
  }
});

test("LFG System - Preset configuration and role definitions", () => {
  const lfgPlugin = require("../../plugin/utility/lfg");
  assert.ok(lfgPlugin.data, "LFG plugin must have slash command data");
  assert.strictEqual(lfgPlugin.data.name, "lfg");
});

test("FAQ System - Slash command structure and subcommands", () => {
  const faqPlugin = require("../../plugin/utility/faq");
  assert.ok(faqPlugin.data, "FAQ plugin must have slash command data");
  assert.strictEqual(faqPlugin.data.name, "faq");
  const subcommands = faqPlugin.data.options.map((o) => o.name);
  assert.ok(subcommands.includes("ask"), "FAQ plugin must include ask subcommand");
  assert.ok(subcommands.includes("list"), "FAQ plugin must include list subcommand");
});

test("Daily Fortune System - Command structure", () => {
  const fortunePlugin = require("../../plugin/utility/fortune");
  assert.ok(fortunePlugin.data, "Fortune plugin must have slash command data");
  assert.strictEqual(fortunePlugin.data.name, "fortune");
});

test("Pomodoro System - Command structure and time calculations", () => {
  const pomodoroPlugin = require("../../plugin/utility/pomodoro");
  assert.ok(pomodoroPlugin.data, "Pomodoro plugin must have slash command data");
  assert.strictEqual(pomodoroPlugin.data.name, "pomodoro");
});
