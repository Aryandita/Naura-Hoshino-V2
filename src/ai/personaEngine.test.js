"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { PERSONA_TONES } = require("./personaEngine");

test("PersonaEngine - Preset Tones Definition", () => {
  assert.ok(PERSONA_TONES, "PERSONA_TONES harus didefinisikan");
  assert.ok(PERSONA_TONES.TSUNDERE, "Harus ada tone TSUNDERE");
  assert.ok(PERSONA_TONES.CYBER_HACKER, "Harus ada tone CYBER_HACKER");
  assert.ok(PERSONA_TONES.ANCIENT_SAGE, "Harus ada tone ANCIENT_SAGE");
  assert.ok(PERSONA_TONES.BLACKSMITH, "Harus ada tone BLACKSMITH");
  assert.ok(PERSONA_TONES.KUUDERE, "Harus ada tone KUUDERE");

  assert.ok(PERSONA_TONES.TSUNDERE.includes("Tsundere"));
});
