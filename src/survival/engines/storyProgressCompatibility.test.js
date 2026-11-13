"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const enginePath = require.resolve("./storyEngine");
const original = Module._load;
let state = {};
let fail = false;
let mirror = null;
const cache = {
  async getUserSurvival() { return { storyProgress: structuredClone(state) }; },
  async mutateUserSurvivalJson(_id, field, mutate) {
    assert.equal(field, "storyProgress");
    const next = mutate(structuredClone(state));
    if (next == null || fail) return { ok: false, reason: "error" };
    state = next;
    return { ok: true, value: structuredClone(state) };
  },
};
let engine;
try {
  Module._load = function(request, parent, isMain) {
    if (parent?.filename === enginePath) {
      if (request === "../../managers/cacheManager") return cache;
      if (request === "../../managers/logger") return { logger: { debug() {}, error() {} } };
      if (request === "../../models/StoryProgress") return { async upsert(value) { mirror = value; } };
    }
    return original.call(this, request, parent, isMain);
  };
  engine = require("./storyEngine");
} catch (error) { Module._load = original; throw error; }
after(() => { Module._load = original; });

test("penulis lama mempertahankan progres prolog baru", async () => {
  state = { currentChapter: "prologue", currentScene: "start", flags: {}, sliceOfLifePrologueV1: { scene: "garden", completed: false, choices: {} } };
  fail = false;
  const result = await engine.updateUserStoryProgress("user", { flags: { visited: true } });
  assert.equal(result.sliceOfLifePrologueV1.scene, "garden");
  assert.equal(state.sliceOfLifePrologueV1.scene, "garden");
  assert.equal(mirror.flags.visited, true);
});

test("kegagalan mutasi tidak dilaporkan sebagai penyimpanan berhasil", async () => {
  const previous = structuredClone(state); fail = true; mirror = null;
  await assert.rejects(engine.updateUserStoryProgress("user", { currentScene: "next" }), /Gagal menyimpan/);
  assert.deepEqual(state, previous); assert.equal(mirror, null); fail = false;
});

test("data rusak tidak ditimpa", async () => {
  state = "{broken"; mirror = null;
  await assert.rejects(engine.updateUserStoryProgress("user", { flags: {} }), /Gagal menyimpan/);
  assert.equal(state, "{broken"); assert.equal(mirror, null);
});