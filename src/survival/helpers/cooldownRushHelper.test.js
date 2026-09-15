"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CooldownRushHelper = require("./cooldownRushHelper");

test("CooldownRushHelper - Validation and Button Builder", async () => {
  // Test invalid parameters
  const invalidRes = await CooldownRushHelper.executeRush("", "");
  assert.equal(invalidRes.success, false);

  // Test button builder
  const btn = CooldownRushHelper.buildRushButton("work");
  assert.ok(btn, "Harus menghasilkan ButtonBuilder");
  assert.equal(btn.data.custom_id, "rush_cd_work");

  // Test cooldown prompt container builder
  const prompt = CooldownRushHelper.buildCooldownPrompt({
    title: "Cooldown Kerja",
    activityName: "Bekerja Shift",
    cooldownKey: "work",
    remainingSeconds: 120,
  });
  assert.ok(prompt, "Harus menghasilkan container payload");
  assert.ok(prompt.flags !== undefined, "Harus memiliki flags");
});
