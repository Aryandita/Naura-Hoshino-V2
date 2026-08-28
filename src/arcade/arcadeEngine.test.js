"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ArcadeEngine = require("./arcadeEngine");

test("ArcadeEngine - getRandomTrivia returns valid trivia question", () => {
  const trivia = ArcadeEngine.getRandomTrivia();
  assert.ok(trivia.q, "Trivia question should exist");
  assert.equal(trivia.options.length, 4, "Should have 4 options");
  assert.ok(
    trivia.answerIndex >= 0 && trivia.answerIndex < 4,
    "Answer index must be between 0 and 3",
  );
});

test("ArcadeEngine - generateRhythmSequence returns specified length", () => {
  const seq = ArcadeEngine.generateRhythmSequence(5);
  assert.equal(seq.length, 5);
  assert.ok(seq[0].emoji, "Item should have emoji");
});

test("ArcadeEngine - spinRoulette payout calculation", () => {
  const res = ArcadeEngine.spinRoulette("RED", 100);
  assert.ok(res.number >= 0 && res.number <= 36);
  assert.ok(["RED", "BLACK", "GREEN"].includes(res.color));
  if (res.isWon) {
    assert.equal(res.payout, 200);
  } else {
    assert.equal(res.payout, 0);
  }
});
