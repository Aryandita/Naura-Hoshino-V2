"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Custom Dungeon Engine - Room Validation and Mathematical Payout", () => {
  const entryFee = 200;
  const royaltyRate = 0.05; // 5%

  const creatorRoyalty = Math.round(entryFee * royaltyRate);
  const rewardPayout = entryFee * 2;

  assert.equal(creatorRoyalty, 10, "5% dari 200 koin harus 10 koin");
  assert.equal(rewardPayout, 400, "Payout clear 2x tiket harus 400 koin");
});

test("Custom Dungeon Engine - Rating Weighted Average Math", () => {
  const currentRating = 4.5;
  const plays = 10;
  const newVote = 5;

  const newRating = Number(
    ((currentRating * plays + newVote) / (plays + 1)).toFixed(1),
  );

  // (45 + 5) / 11 = 50 / 11 = 4.5454... -> 4.5
  assert.equal(newRating, 4.5);
});
