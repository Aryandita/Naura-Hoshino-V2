"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Sequelize } = require("sequelize");
const { defineStoryIsolatedModel, createStoryIsolatedStore } = require("./storyIsolatedStore");

test("progres baru tersimpan terpisah dan klik bersamaan tidak mengulang transisi", async (t) => {
  const db = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
  t.after(() => db.close());
  const Model = defineStoryIsolatedModel(db);
  await Model.sync();
  await Model.create({ userId: "test", scene: "first_choice", completed: false, choices: {}, revision: 0 });
  const service = createStoryIsolatedStore(Model);
  const results = await Promise.all([service.transition("test", "first_choice", 0), service.transition("test", "first_choice", 1)]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => r.reason === "stale").length, 1);
  const saved = await Model.findByPk("test");
  assert.equal(saved.revision, 1);
  assert.ok(["home", "rest"].includes(saved.scene));
  assert.ok([0, 1].includes(saved.choices.first_choice));
});

test("awal, kegagalan, dan masukan tidak valid", async (t) => {
  const db = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
  t.after(() => db.close());
  const Model = defineStoryIsolatedModel(db);
  await Model.sync();
  const service = createStoryIsolatedStore(Model);
  assert.equal((await service.transition("test", "start", 0)).progress.scene, "naura");
  assert.equal((await service.transition("test", "start", 0)).reason, "stale");
  assert.equal((await service.transition("test", "naura", 1)).reason, "invalid_choice");
  await Model.drop();
  assert.equal((await service.transition("test", "naura", 0)).reason, "unconfirmed");
});