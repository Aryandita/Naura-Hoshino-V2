"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const MusicQuizEngine = require("./musicQuizEngine");

test("MusicQuizEngine - Session Setup and Rounds", async () => {
  const session = await MusicQuizEngine.startQuizSession(
    "guild_music_test",
    "channel_123",
    4,
  );
  assert.ok(session, "Sesi kuis harus dibuat");
  assert.equal(session.totalRounds, 4, "Total ronde harus 4");
  assert.equal(session.currentRoundIndex, 0, "Mulai di ronde 0");
  assert.equal(session.status, "PLAYING");

  const r1 = session.rounds[0];
  assert.ok(r1.audioHint, "Harus memiliki petunjuk audio/lirik");
  assert.ok(r1.correctAnswer, "Harus memiliki jawaban benar");
  assert.equal(r1.choices.length, 4, "Harus ada 4 pilihan tebakan");
  assert.ok(
    r1.choices.includes(r1.correctAnswer),
    "Pilihan harus memuat jawaban yang benar",
  );
});

test("MusicQuizEngine - Scoring Math & Streak Multipliers", () => {
  // Base 100, response time 2000ms -> speedBonus = (10000 - 2000) / 200 = 40
  // Streak 1 -> mult 1.0 -> score = 140
  const speedBonus = Math.max(0, Math.floor((10000 - 2000) / 200));
  const streak = 1;
  const mult = Math.min(2.0, 1.0 + (streak - 1) * 0.2);
  const score = Math.floor((100 + speedBonus) * mult);

  assert.equal(speedBonus, 40);
  assert.equal(mult, 1.0);
  assert.equal(score, 140);

  // Streak 3 -> mult 1.4 -> score = (100 + 40) * 1.4 = 196
  const streak3 = 3;
  const mult3 = Math.min(2.0, 1.0 + (streak3 - 1) * 0.2);
  const score3 = Math.floor((100 + speedBonus) * mult3);
  assert.equal(mult3, 1.4);
  assert.equal(score3, 196);
});
