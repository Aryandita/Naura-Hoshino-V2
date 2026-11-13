"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { Sequelize } = require("sequelize");
const { defineStoryIsolatedModel, createStoryIsolatedStore } = require("./storyIsolatedStore");
const uri = process.env.NAURA_STORY_TEST_PG_URI;

test("PostgreSQL terisolasi: inisialisasi, klik bersamaan, dan hasil ambigu", { skip: !uri }, async (t) => {
  const url = new URL(uri);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.username, "naura_story_test");
  assert.equal(url.pathname, "/postgres");
  const tableName = `test_story_${randomBytes(8).toString("hex")}`;
  const db1 = new Sequelize(uri, { logging: false });
  const db2 = new Sequelize(uri, { logging: false });
  const one = defineStoryIsolatedModel(db1);
  const two = defineStoryIsolatedModel(db2);
  one.tableName = tableName;
  two.tableName = tableName;
  t.after(async () => { await one.drop(); await db1.close(); await db2.close(); });
  await one.sync();
  const s1 = createStoryIsolatedStore(one);
  const s2 = createStoryIsolatedStore(two);
  const first = await Promise.all([s1.transition("new_user", "start", 0), s2.transition("new_user", "start", 0)]);
  assert.equal(first.filter((r) => r.ok).length, 1);
  assert.equal(first.filter((r) => r.reason === "stale").length, 1);
  const stored = await two.findByPk("new_user");
  assert.equal(stored.scene, "naura");
  assert.equal(stored.revision, 1);
  assert.equal((await s2.transition("new_user", "naura", 0)).progress.scene, "first_choice");
  const branches = await Promise.all([s1.transition("new_user", "first_choice", 0), s2.transition("new_user", "first_choice", 1)]);
  assert.equal(branches.filter((r) => r.ok).length, 1);
  assert.equal(branches.filter((r) => r.reason === "stale").length, 1);
  const final = await one.findByPk("new_user");
  assert.equal(final.revision, 3);
  assert.ok(["home", "rest"].includes(final.scene));
  assert.ok([0, 1].includes(final.choices.first_choice));
  const originalUpdate = one.update;
  try {
    one.update = async function (...args) {
      await originalUpdate.apply(this, args);
      throw new Error("simulated response loss after commit");
    };
    assert.equal((await s1.transition("uncertain_user", "start", 0)).reason, "unconfirmed");
  } finally {
    one.update = originalUpdate;
  }
  const afterUncertain = await two.findByPk("uncertain_user");
  assert.equal(afterUncertain.scene, "naura");
  assert.equal(afterUncertain.revision, 1);
  assert.equal((await s2.transition("uncertain_user", "start", 0)).reason, "stale");
});