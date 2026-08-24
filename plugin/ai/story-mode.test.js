"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateTierReward, parseStoryOptions } = require("./story-mode");

test("story-mode - calculateTierReward returns progressive rewards", () => {
  // Early chapters 1-3
  const ch1 = calculateTierReward(1);
  assert.equal(ch1.fragments, 15);
  assert.equal(ch1.xp, 10);
  assert.equal(ch1.coupons, 0);

  const ch3 = calculateTierReward(3);
  assert.equal(ch3.fragments, 15);
  assert.equal(ch3.xp, 10);
  assert.equal(ch3.coupons, 0);

  // Mid chapters 4-7
  const ch5 = calculateTierReward(5);
  assert.equal(ch5.fragments, 30);
  assert.equal(ch5.xp, 25);
  assert.equal(ch5.coupons, 0);

  // Late chapters 8-9
  const ch9 = calculateTierReward(9);
  assert.equal(ch9.fragments, 50);
  assert.equal(ch9.xp, 50);
  assert.equal(ch9.coupons, 0);

  // Finale chapter 10 (gives rare Coupon)
  const ch10 = calculateTierReward(10);
  assert.equal(ch10.fragments, 75);
  assert.equal(ch10.xp, 100);
  assert.equal(ch10.coupons, 1);
});

test("story-mode - parseStoryOptions extracts options and narrative", () => {
  const sampleLLMOutput = `Kamu berdiri di hadapan gerbang kastil kuno yang diselimuti tanaman merambat berduri.
Suara gemerisik terdengar dari balik semak belukar di sisi timur.

[OPSI 1] Buka gerbang utama secara paksa
[OPSI 2] Periksa semak belukar yang bergerak
[OPSI 3] Panjat dinding samping benteng`;

  const { narrative, options } = parseStoryOptions(sampleLLMOutput);

  assert.ok(narrative.includes("Kamu berdiri di hadapan gerbang kastil"));
  assert.ok(!narrative.includes("[OPSI 1]"));
  assert.equal(options.length, 3);
  assert.equal(options[0], "Buka gerbang utama secara paksa");
  assert.equal(options[1], "Periksa semak belukar yang bergerak");
  assert.equal(options[2], "Panjat dinding samping benteng");
});
