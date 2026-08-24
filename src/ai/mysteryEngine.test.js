"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const MysteryEngine = require("./mysteryEngine");

test("MysteryEngine - Scenario and Suspects Integrity", async () => {
  const session = await MysteryEngine.createGameSession("guild_test_mystery", "user_host_123", [
    { id: "user_host_123", username: "DetektifAgung" },
  ]);

  assert.ok(session, "Sesi kasus harus dibuat");
  assert.ok(session.scenario.title, "Harus memiliki judul kasus");
  assert.ok(session.scenario.victim, "Harus memiliki korban");
  assert.ok(Array.isArray(session.scenario.suspects), "Harus memiliki daftar tersangka");
  assert.equal(session.scenario.suspects.length, 3, "Harus ada 3 tersangka");

  const culprits = session.scenario.suspects.filter((s) => s.isCulprit);
  assert.equal(culprits.length, 1, "Harus tepat ada 1 pelaku sebenarnya");
  assert.ok(culprits[0].secretFlaw, "Pelaku harus memiliki celah rahasia");
});
