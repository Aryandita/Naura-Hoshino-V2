"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSliceOfLifeProgress, KEY } = require("./sliceOfLifeProgress");

function setup(initial = { currentChapter: "prologue", flags: { existing: true } }) {
  let state = structuredClone(initial);
  let fail = false;
  const cache = { async mutateUserSurvivalJson(_userId, _field, callback) {
    const next = callback(structuredClone(state));
    if (next == null) return { ok: false, reason: "aborted" };
    if (fail) return { ok: false, reason: "error" };
    state = next;
    return { ok: true, value: state };
  } };
  return { service: createSliceOfLifeProgress(cache), getState: () => state, fail: () => { fail = true; } };
}

test("transisi menyimpan posisi dan menjaga progres lama", async () => {
  const x = setup();
  const result = await x.service.transition("user", "start", 0);
  assert.equal(result.ok, true);
  assert.equal(result.progress.scene, "naura");
  assert.deepEqual(x.getState().flags, { existing: true });
  assert.equal(x.getState().currentChapter, "prologue");
});

test("pilihan tersimpan bersama posisi dan klik lama ditolak", async () => {
  const x = setup({ [KEY]: { scene: "first_choice", completed: false, choices: {} }, flags: {} });
  assert.equal((await x.service.transition("user", "first_choice", 1)).progress.scene, "rest");
  assert.equal(x.getState()[KEY].choices.first_choice, 1);
  assert.equal((await x.service.transition("user", "first_choice", 0)).reason, "stale");
  assert.equal(x.getState()[KEY].scene, "rest");
});

test("kegagalan penyimpanan dan input salah tidak melaporkan sukses", async () => {
  const x = setup();
  assert.equal((await x.service.transition("user", "start", 4)).reason, "invalid_choice");
  x.fail();
  assert.equal((await x.service.transition("user", "start", 0)).reason, "unconfirmed");
  assert.equal(x.getState()[KEY], undefined);
});

test("adegan akhir hanya selesai setelah mutasi berhasil", async () => {
  const x = setup({ [KEY]: { scene: "finish", completed: false, choices: {} } });
  assert.equal((await x.service.transition("user", "finish", 0)).progress.completed, true);
  assert.equal((await x.service.transition("user", "finish", 0)).reason, "stale");
});

test("data lama rusak ditolak tanpa overwrite", async () => {
  const x = setup("{broken");
  assert.equal((await x.service.transition("user", "start", 0)).reason, "unconfirmed");
  assert.equal(x.getState(), "{broken");
});