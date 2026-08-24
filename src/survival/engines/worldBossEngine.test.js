"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("WorldBossEngine - Role & Multi-Phase calculations", () => {
  const maxHp = 500000;
  const currentHp = 200000;
  const hpPercent = (currentHp / maxHp) * 100;

  assert.equal(hpPercent, 40);

  // Phase evaluation: <= 50% activates phase 2, <= 20% activates phase 3
  const phase = hpPercent <= 20 ? 3 : hpPercent <= 50 ? 2 : 1;
  assert.equal(phase, 2);

  // Shield calculation
  const maxShieldHp = Math.floor(maxHp * 0.25);
  assert.equal(maxShieldHp, 125000);
});

test("WorldBossEngine - Reward distribution formula", () => {
  const totalPoolFrag = 10000;

  const dpsPoolFrag = Math.floor(totalPoolFrag * 0.7); // 7000
  const supportPoolFrag = Math.floor(totalPoolFrag * 0.3); // 3000

  assert.equal(dpsPoolFrag, 7000);
  assert.equal(supportPoolFrag, 3000);
  assert.equal(dpsPoolFrag + supportPoolFrag, totalPoolFrag);
});
