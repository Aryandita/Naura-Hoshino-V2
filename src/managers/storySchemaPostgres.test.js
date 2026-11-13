"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Sequelize } = require("sequelize");
const { MIGRATIONS, verifySliceOfLifeSchema } = require("./dbMigrator");
const uri = process.env.NAURA_STORY_TEST_PG_URI;

test("migrasi cerita membatasi akses dan memeriksa skema", { skip: !uri }, async (t) => {
  const url = new URL(uri);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439");
  assert.equal(url.username, "naura_story_test"); assert.equal(url.pathname, "/postgres");
  const db = new Sequelize(uri, { logging: false });
  const [before] = await db.query("SELECT to_regclass('public.slice_of_life_progress_v1') AS target");
  assert.equal(before[0].target, null, "Tabel uji sudah ada; jangan ditimpa");
  const [existingRoles] = await db.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')");
  assert.equal(existingRoles.length, 0, "Role uji sudah ada; jangan diubah");
  await db.query("CREATE ROLE anon NOLOGIN");
  await db.query("CREATE ROLE authenticated NOLOGIN");
  let created = false;
  t.after(async () => {
    if (created) await db.query('DROP TABLE "public"."slice_of_life_progress_v1"');
    await db.query("DROP ROLE anon");
    await db.query("DROP ROLE authenticated");
    await db.close();
  });
  const migration = MIGRATIONS.find((item) => item.id === "v55_create_slice_of_life_progress_v1");
  assert.ok(migration);
  await db.query(migration.pgSql);
  created = true;
  await verifySliceOfLifeSchema(db);
  await db.query('GRANT SELECT ON "slice_of_life_progress_v1" TO anon');
  await assert.rejects(verifySliceOfLifeSchema(db), /RLS atau peran/);
  await db.query('REVOKE SELECT ON "slice_of_life_progress_v1" FROM anon');
  await verifySliceOfLifeSchema(db);
  await db.query('INSERT INTO "slice_of_life_progress_v1" ("userId", "scene", "choices") VALUES (\'local-test\', \'start\', \'{}\')');
  const [rows] = await db.query('SELECT "scene" FROM "slice_of_life_progress_v1" WHERE "userId" = \'local-test\'');
  assert.equal(rows[0].scene, "start");
});