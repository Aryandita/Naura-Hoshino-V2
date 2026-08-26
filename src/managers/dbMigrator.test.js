"use strict";

/**
 * Test statis untuk dbMigrator (node:test).
 *
 * Tujuannya menjaga dua invariant yang pernah pecah di produksi:
 *
 * 1. Setiap migrasi WAJIB punya varian `pgSql` bebas dialek MySQL. Produksi
 *    memakai Supabase/PostgreSQL; satu saja migrasi yang lolos dengan sintaks
 *    MySQL akan menggagalkan `prestart` sehingga bot tidak menyala.
 * 2. Multi-statement harus bisa dipecah `splitStatements()` tanpa memotong
 *    nilai default yang mengandung titik koma di dalam string terkutip.
 */

const test = require("node:test");
const assert = require("node:assert");
const { MIGRATIONS, splitStatements } = require("./dbMigrator");

// Token yang hanya valid di MySQL/MariaDB dan pasti gagal di PostgreSQL.
const FORBIDDEN_MYSQL_TOKENS = [
  "ENGINE=InnoDB",
  "ENGINE=MyISAM",
  "AUTO_INCREMENT",
  "TINYINT(",
  "MODIFY COLUMN",
  "UNIQUE KEY",
  "INSERT IGNORE",
  "JSON_EXTRACT(",
  "JSON_REMOVE(",
  "JSON_TYPE(",
];

test("setiap migrasi wajib punya pgSql non-kosong", () => {
  assert.ok(MIGRATIONS.length > 0, "daftar migrasi tidak boleh kosong");

  const missing = MIGRATIONS.filter(
    (m) => typeof m.pgSql !== "string" || m.pgSql.trim() === "",
  );

  assert.deepStrictEqual(
    missing.map((m) => m.id),
    [],
    `Migrasi berikut belum punya pgSql: ${missing.map((m) => m.id).join(", ")}`,
  );
});

test("pgSql tidak boleh mengandung token dialek MySQL", () => {
  const offenders = [];

  for (const migration of MIGRATIONS) {
    for (const token of FORBIDDEN_MYSQL_TOKENS) {
      if (migration.pgSql && migration.pgSql.includes(token)) {
        offenders.push(`${migration.id} -> "${token}"`);
      }
    }
  }

  assert.deepStrictEqual(
    offenders,
    [],
    `Token MySQL ditemukan di pgSql:\n${offenders.join("\n")}`,
  );
});

test("id dan urutan migrasi unik (ledger schema_migrations bergantung padanya)", () => {
  const ids = MIGRATIONS.map((m) => m.id);
  const unique = new Set(ids);
  assert.strictEqual(unique.size, ids.length, "ada ID migrasi duplikat");
});

test("splitStatements memecah multi-statement sederhana", () => {
  const result = splitStatements(
    'ALTER TABLE a ADD COLUMN x INT; ALTER TABLE b ADD COLUMN y INT;',
  );
  assert.strictEqual(result.length, 2);
  assert.match(result[0], /^ALTER TABLE a/);
  assert.match(result[1], /^ALTER TABLE b/);
});

test("splitStatements tidak memotong titik koma di dalam string terkutip", () => {
  const sql =
    "CREATE TABLE t (name VARCHAR(64) DEFAULT 'Cyber; Maid'); CREATE TABLE u (note VARCHAR(32) DEFAULT \"a;b\");";
  const result = splitStatements(sql);

  assert.strictEqual(result.length, 2);
  assert.ok(result[0].includes("'Cyber; Maid'"), "nilai single-quote utuh");
  assert.ok(result[1].includes('"a;b"'), "nilai double-quote utuh");
});

test("splitStatements memecah migrasi v33 (5 statement) dengan benar", () => {
  const v33 = MIGRATIONS.find((m) => m.id === "v33_create_sprint20_milestone_tables");
  assert.ok(v33, "v33 harus ada");

  const statements = splitStatements(v33.pgSql);
  assert.strictEqual(statements.length, 5);
  assert.match(statements[0], /^ALTER TABLE "GuildClans"/);
  assert.match(statements[1], /^CREATE TABLE IF NOT EXISTS "coliseum_teams"/);
  assert.match(statements[2], /^CREATE TABLE IF NOT EXISTS "guild_personas"/);
  assert.match(statements[3], /^CREATE TABLE IF NOT EXISTS "server_stocks"/);
  assert.match(statements[4], /^CREATE TABLE IF NOT EXISTS "user_stock_holdings"/);
});

test("splitStatements menangani input kosong dan trailing semicolon", () => {
  assert.deepStrictEqual(splitStatements(""), []);
  assert.deepStrictEqual(splitStatements(null), []);
  assert.deepStrictEqual(splitStatements("SELECT 1;"), ["SELECT 1"]);
});