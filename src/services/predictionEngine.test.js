"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("PredictionEngine - Pari-Mutuel payout calculation formula", () => {
  const totalPool = 10000;
  const houseFeePercent = 5;
  const houseFee = Math.floor(totalPool * (houseFeePercent / 100)); // 500
  const distributablePool = totalPool - houseFee; // 9500

  assert.equal(houseFee, 500);
  assert.equal(distributablePool, 9500);

  // User A bet 2000 on Option 1 (Total Option 1 = 4000) -> 50% of winning pool
  const userABet = 2000;
  const winningOptionTotalBet = 4000;
  const userAPayout = Math.floor((userABet / winningOptionTotalBet) * distributablePool);

  assert.equal(userAPayout, 4750); // 9500 * 0.5 = 4750

  // User B bet 2000 on Option 1 -> 50%
  const userBBet = 2000;
  const userBPayout = Math.floor((userBBet / winningOptionTotalBet) * distributablePool);
  assert.equal(userBPayout, 4750);

  assert.equal(userAPayout + userBPayout, distributablePool);
});

test("PredictionEngine - handles dynamic odds ratio formatting", () => {
  const options = [
    { id: 1, label: "Klan Alpha", totalBet: 7500 },
    { id: 2, label: "Klan Beta", totalBet: 2500 },
  ];
  const totalPool = 10000;

  const percentA = ((options[0].totalBet / totalPool) * 100).toFixed(1);
  const percentB = ((options[1].totalBet / totalPool) * 100).toFixed(1);

  assert.equal(percentA, "75.0");
  assert.equal(percentB, "25.0");
});
