"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const aiDjManager = require("./aiDjManager");

test("aiDjManager: status aktif per-guild", () => {
  aiDjManager.setDjEnabled("guild-123", true);
  assert.equal(aiDjManager.isDjEnabled("guild-123"), true);

  aiDjManager.setDjEnabled("guild-123", false);
  assert.equal(aiDjManager.isDjEnabled("guild-123"), false);
});

test("aiDjManager: generateDjScript menghasilkan script dan klasifikasi genre", () => {
  const result = aiDjManager.generateDjScript(
    { title: "Cozy Study Lofi", author: "ChilledCow" },
    "Budi",
    ["Siti", "Andi"],
  );

  assert.ok(typeof result.script === "string" && result.script.length > 10);
  assert.ok(result.script.includes("Budi"));
  assert.equal(result.classification.genre, "LOFI");
  assert.equal(result.classification.emoji, "☕");
});

test("aiDjManager: generateDjScript menangani genre anime dengan listener", () => {
  const result = aiDjManager.generateDjScript(
    { title: "Kaikai Kitan - Jujutsu Kaisen OP", author: "Eve" },
    "Arya",
    ["Rina"],
  );

  assert.ok(result.script.includes("Arya"));
  assert.equal(result.classification.genre, "ANIME");
  assert.equal(result.classification.emoji, "🌸");
});
