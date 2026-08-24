"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const AbyssEngine = require("./abyssEngine");

test("AbyssEngine - Procedural Choices Generation", () => {
  const choicesFloor1 = AbyssEngine._generateChoices(1);
  assert.equal(choicesFloor1.length, 3, "Lantai biasa harus memiliki 3 pilihan ruangan");

  const choicesFloor10 = AbyssEngine._generateChoices(10);
  assert.equal(choicesFloor10.length, 1, "Lantai Boss harus memiliki 1 pintu Guardian");
  assert.equal(choicesFloor10[0].type, "GUARDIAN");
  assert.ok(choicesFloor10[0].monsterName.includes("Sentinel"));
});

test("AbyssEngine - Start and Initial Stats", async () => {
  const run = await AbyssEngine.startRun("user_abyss_123");
  assert.ok(run, "Run harus berhasil dibuat");
  assert.equal(run.currentFloor, 1, "Mulai di lantai 1");
  assert.equal(run.currentHp, 300, "HP awal 300");
  assert.equal(run.status, "EXPLORING");
});
