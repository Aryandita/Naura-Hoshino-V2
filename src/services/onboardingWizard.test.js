"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const onboardingWizard = require("./onboardingWizard");

describe("OnboardingWizard Service", () => {
  it("getPresetList returns all 3 presets", () => {
    const list = onboardingWizard.getPresetList();
    assert.strictEqual(Array.isArray(list), true);
    assert.strictEqual(list.length, 3);
    const ids = list.map((p) => p.id);
    assert.deepStrictEqual(ids.sort(), ["gaming", "music", "security"].sort());
  });

  it("getPreset returns valid details for valid keys", () => {
    const gaming = onboardingWizard.getPreset("gaming");
    assert.ok(gaming);
    assert.strictEqual(gaming.id, "gaming");
    assert.strictEqual(Array.isArray(gaming.channels), true);
    assert.ok(gaming.channels.length >= 2);

    const invalid = onboardingWizard.getPreset("non_existent");
    assert.strictEqual(invalid, null);
  });

  it("applyPreset throws error on invalid preset key", async () => {
    await assert.rejects(async () => {
      await onboardingWizard.applyPreset({}, "invalid_preset");
    }, /tidak valid/);
  });
});
