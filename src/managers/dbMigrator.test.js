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
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { MIGRATIONS, splitStatements } = require("./dbMigrator");

// ── Keamanan sinkronisasi fallback SQLite ─────────────────────────────────
//
// Latar belakang bug:
// syncFallbackToMySQL() memindahkan data dari ./naura_fallback.sqlite ke
// database utama, lalu pada blok `finally` SELALU menjalankan
//   fs.unlinkSync("./naura_fallback.sqlite")
// tanpa syarat apa pun.
//
// Karena galat per-tabel dan per-baris hanya dicatat lewat logger.warn tanpa
// dilempar, file fallback bisa terhapus meski separuh tabel gagal tersalin.
// Setelah file itu hilang, tidak ada sumber recovery yang tersisa dan data
// pemain hilang permanen.
//
// Test di bawah mengunci dua hal: file fallback tidak pernah hilang, dan
// proses yang gagal dilaporkan sebagai gagal supaya bisa dicoba lagi.

// Model tiruan yang mencatat apa yang diterimanya.
function makeFakeModel(tableName, { failOn = null } = {}) {
  const calls = { upserted: [], findOrCreate: 0, update: 0 };
  return {
    tableName,
    primaryKeyAttributes: ["id"],
    calls,
    lastUpdateOnDuplicate: null,
    async upsert(rows, options = {}) {
      if (failOn === tableName) {
        throw new Error(`kegagalan disengaja pada ${tableName}`);
      }
      this.lastUpdateOnDuplicate = options.updateOnDuplicate || null;
      calls.upserted.push(...rows);
    },
    async findOrCreate() {
      calls.findOrCreate += 1;
      return [{}, true];
    },
    async update() {
      calls.update += 1;
    },
  };
}

/** Buat file SQLite sementara berisi satu atau lebih tabel sederhana. */
function makeSqliteFixture(dir, tables) {
  const { DatabaseSync } = require("node:sqlite");
  const file = path.join(dir, "naura_fallback.sqlite");
  const db = new DatabaseSync(file);
  for (const [tableName, rows] of Object.entries(tables)) {
    db.exec(`CREATE TABLE ${tableName} (id TEXT PRIMARY KEY, name TEXT)`);
    const stmt = db.prepare(`INSERT INTO ${tableName} (id, name) VALUES (?, ?)`);
    for (const r of rows) stmt.run(r.id, r.name);
  }
  db.close();
  return file;
}

test("sinkronisasi fallback tidak pernah menghapus file SQLite", async () => {
  // Berkas sumber dibaca lewat path relatif ke CWD, jadi test memakai CWD
  // sementara lalu memulihkannya kembali.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "naura-sync-"));
  const prevCwd = process.cwd();
  process.chdir(tmp);

  try {
    const { syncFallbackToMySQL } = require("./dbMigrator");
    const file = makeSqliteFixture(tmp, {
      UserProfiles: [
        { id: "1", name: "Satu" },
        { id: "2", name: "Dua" },
      ],
    });

    const model = makeFakeModel("UserProfiles");
    const sequelizeLike = { models: { UserProfile: model } };

    const result = await syncFallbackToMySQL(sequelizeLike);

    // Data benar-benar diteruskan lewat upsert, bukan findOrCreate.
    assert.strictEqual(model.calls.upserted.length, 2, "dua baris harus masuk");
    assert.strictEqual(model.calls.findOrCreate, 0, "tidak boleh ada findOrCreate");

    // Penulisannya tidak boleh memakai updateOnDuplicate pada kolom waktu
    // dan primary key.
    assert.ok(model.lastUpdateOnDuplicate, "upsert harus menyertakan updateOnDuplicate");
    assert.ok(
      !model.lastUpdateOnDuplicate.includes("id") &&
        !model.lastUpdateOnDuplicate.includes("createdAt") &&
        !model.lastUpdateOnDuplicate.includes("updatedAt"),
      `kolom terlarang ikut ter-update: ${model.lastUpdateOnDuplicate.join(", ")}`,
    );

    // File fallback TIDAK boleh hilang, hanya ditandai sudah tersinkron.
    assert.ok(
      !fs.existsSync(file),
      "file asli renamed menjadi .synced, bukan dihapus",
    );
    assert.ok(
      fs.existsSync(`${file}.synced`),
      "file fallback seharusnya ditandai sudah tersinkron",
    );

    // Laporan hasil harus jujur.
    assert.strictEqual(result.ok, true, "sinkronisasi penuh dilaporkan sukses");
    assert.deepStrictEqual(result.failedTables, []);
    assert.strictEqual(result.moved, 2);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("file fallback dipertahankan saat ada tabel yang gagal", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "naura-sync-fail-"));
  const prevCwd = process.cwd();
  process.chdir(tmp);

  try {
    const { syncFallbackToMySQL } = require("./dbMigrator");
    // Kedua tabel sengaja dibuat ada di SQLite supaya sinkronisasi benar-benar
    // dicoba, bukan dilewati karena tabel tidak ada.
    const file = makeSqliteFixture(tmp, {
      UserProfiles: [{ id: "1", name: "Satu" }],
      UserSurvivals: [{ id: "1", name: "Satu" }],
    });

    const sequelizeLike = {
      models: {
        UserProfile: makeFakeModel("UserProfiles"),
        // Tabel ini sengaja gagal untuk meniru kondisi nyata.
        UserSurvivals: makeFakeModel("UserSurvivals", { failOn: "UserSurvivals" }),
      },
    };

    const result = await syncFallbackToMySQL(sequelizeLike);

    assert.strictEqual(
      result.ok,
      false,
      "sinkronisasi yang gagal tidak boleh dilaporkan sukses",
    );
    assert.ok(
      result.failedTables.includes("UserSurvivals"),
      "tabel gagal harus dicatat namanya",
    );

    // Kunci: file fallback wajib masih ada supaya boot berikutnya mencoba lagi.
    assert.ok(
      fs.existsSync(file),
      "file fallback wajib dipertahankan ketika sinkronisasi gagal",
    );
    assert.ok(
      !fs.existsSync(`${file}.synced`),
      "file tidak boleh ditandai tersinkron bila ada tabel gagal",
    );
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("syncFallbackToMySQL tidak lagi memakai findOrCreate per-baris", () => {
  const source = fs.readFileSync(path.join(__dirname, "dbMigrator.js"), "utf8");
  const start = source.indexOf("async function syncFallbackToMySQL");
  assert.ok(start > -1, "fungsi syncFallbackToMySQL harus ada");
  const body = source.slice(start, source.indexOf("module.exports", start));

  assert.ok(
    !body.includes("unlinkSync"),
    "syncFallbackToMySQL tidak boleh menghapus file fallback",
  );
  assert.ok(
    !body.includes("findOrCreate"),
    "loop per-baris findOrCreate menahan connection pool dan terlalu lambat",
  );
});

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
    "ALTER TABLE a ADD COLUMN x INT; ALTER TABLE b ADD COLUMN y INT;",
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
  const v33 = MIGRATIONS.find(
    (m) => m.id === "v33_create_sprint20_milestone_tables",
  );
  assert.ok(v33, "v33 harus ada");

  const statements = splitStatements(v33.pgSql);
  assert.strictEqual(statements.length, 5);
  assert.match(statements[0], /^ALTER TABLE "GuildClans"/);
  assert.match(statements[1], /^CREATE TABLE IF NOT EXISTS "coliseum_teams"/);
  assert.match(statements[2], /^CREATE TABLE IF NOT EXISTS "guild_personas"/);
  assert.match(statements[3], /^CREATE TABLE IF NOT EXISTS "server_stocks"/);
  assert.match(
    statements[4],
    /^CREATE TABLE IF NOT EXISTS "user_stock_holdings"/,
  );
});

test("splitStatements menangani input kosong dan trailing semicolon", () => {
  assert.deepStrictEqual(splitStatements(""), []);
  assert.deepStrictEqual(splitStatements(null), []);
  assert.deepStrictEqual(splitStatements("SELECT 1;"), ["SELECT 1"]);
});
