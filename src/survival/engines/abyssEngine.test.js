"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const AbyssEngine = require("./abyssEngine");

test("AbyssEngine - Procedural Choices Generation", () => {
  const choicesFloor1 = AbyssEngine._generateChoices(1);
  assert.equal(
    choicesFloor1.length,
    3,
    "Lantai biasa harus memiliki 3 pilihan ruangan",
  );

  const choicesFloor10 = AbyssEngine._generateChoices(10);
  assert.equal(
    choicesFloor10.length,
    1,
    "Lantai Boss harus memiliki 1 pintu Guardian",
  );
  assert.equal(choicesFloor10[0].type, "GUARDIAN");
  assert.ok(choicesFloor10[0].monsterName.includes("Sentinel"));
});

test("AbyssEngine - Start and Initial Stats", async () => {
  const run = await AbyssEngine.startRun("user_abyss_123");
  assert.ok(run, "Run harus berhasil dibuat");
  assert.equal(run.currentFloor, 1, "Mulai di lantai 1");
  assert.equal(run.currentHp, 300, "HP awal 300");
  assert.equal(run.status, "EXPLORING");
  assert.equal(run.wager, 0, "Default wager harus 0");
});

test("AbyssEngine - Wager Multipliers Scaling", () => {
  assert.equal(AbyssEngine.calculateWagerMultiplier(0), 1.0);
  assert.equal(AbyssEngine.calculateWagerMultiplier(5), 1.0);
  assert.equal(AbyssEngine.calculateWagerMultiplier(10), 1.5);
  assert.equal(AbyssEngine.calculateWagerMultiplier(20), 2.2);
  assert.equal(AbyssEngine.calculateWagerMultiplier(30), 3.2);
  assert.equal(AbyssEngine.calculateWagerMultiplier(40), 4.2);
  assert.equal(AbyssEngine.calculateWagerMultiplier(50), 5.0);
});

test("AbyssEngine - Finish Run Payout Calculation", async (t) => {
  const cacheManager = require("../../managers/cacheManager");
  const originalIncrement = cacheManager.incrementUserSurvival;
  t.after(() => {
    cacheManager.incrementUserSurvival = originalIncrement;
  });
  cacheManager.incrementUserSurvival = async () => {};

  const runKey = "user_abyss_calc_payout";
  const run = await AbyssEngine.startRun(runKey);
  run.currentFloor = 25;
  run.fragmentsCollected = 400;
  run.wager = 500;
  await AbyssEngine._saveRun(runKey, run);

  const finishRes = await AbyssEngine.finishRun(runKey);
  assert.equal(finishRes.success, true);
  assert.equal(finishRes.floorsCleared, 24);
  assert.equal(finishRes.fragmentsCollected, 400);
  assert.equal(finishRes.wager, 500);
  assert.equal(finishRes.wagerMultiplier, 2.2);
  assert.equal(finishRes.wagerPayout, 1100);
  assert.equal(finishRes.totalCoins, 1500); // 400 + 1100
});
