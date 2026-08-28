"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const seasonEngine = require("./seasonEngine");
const { TIER_REWARDS, CURRENT_SEASON } = seasonEngine;

test("SeasonEngine - Season Configuration and Tier Rewards", () => {
  assert.equal(CURRENT_SEASON.id, 1);
  assert.equal(CURRENT_SEASON.maxTier, 30);
  assert.equal(CURRENT_SEASON.xpPerTier, 1000);

  assert.ok(TIER_REWARDS[1]);
  assert.ok(TIER_REWARDS[5]);
  assert.ok(TIER_REWARDS[10]);
  assert.ok(TIER_REWARDS[30]);

  // Validasi hadiah Free vs Premium
  assert.ok(TIER_REWARDS[1].free.gold);
  assert.ok(TIER_REWARDS[1].premium.coupons);
  assert.equal(TIER_REWARDS[30].premium.coupons, 10);
});
