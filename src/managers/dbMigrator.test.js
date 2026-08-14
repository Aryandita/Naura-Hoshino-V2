"use strict";

/**
 * Test pertama di repo ini. Sengaja dipilih modul yang murni data supaya bisa
 * dijalankan tanpa koneksi database, Discord, maupun Redis.
 *
 * Yang dijaga di sini: daftar migrasi tidak boleh punya ID kembar dan tidak boleh
 * ada entri setengah jadi. Dua kesalahan itu diam-diam membuat satu migrasi
 * terlewat selamanya, karena ledger hanya mencatat ID.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { MIGRATIONS, LEDGER_TABLE } = require("./dbMigrator");

test("setiap migrasi punya ID yang unik", () => {
  const ids = MIGRATIONS.map((migration) => migration.id);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `Ada ID migrasi kembar: ${ids.join(", ")}`,
  );
});

test("setiap migrasi punya deskripsi dan SQL yang terisi", () => {
  for (const migration of MIGRATIONS) {
    assert.equal(typeof migration.id, "string");
    assert.ok(migration.id.length > 0, "ID migrasi tidak boleh kosong");
    assert.ok(
      migration.description && migration.description.length > 0,
      `Migrasi ${migration.id} tanpa deskripsi`,
    );
    assert.ok(
      migration.sql && migration.sql.trim().endsWith(";"),
      `SQL migrasi ${migration.id} harus diakhiri titik koma`,
    );
  }
});

test("nama tabel ledger tidak berubah tanpa sengaja", () => {
  // Mengganti nama tabel ini membuat seluruh riwayat migrasi terlihat kosong,
  // sehingga semua migrasi dijalankan ulang pada database yang sudah benar.
  assert.equal(LEDGER_TABLE, "schema_migrations");
});

test("nomor versi migrasi naik terus dan tidak pernah disusun ulang", () => {
  // Ledger hanya mencatat ID, jadi menyisipkan migrasi di tengah daftar akan
  // terlewat pada database yang sudah menjalankan migrasi sesudahnya.
  const versions = MIGRATIONS.map((migration) => {
    const match = /^v(\d+)_/.exec(migration.id);
    assert.ok(match, `ID migrasi '${migration.id}' harus berawalan v<nomor>_`);
    return Number(match[1]);
  });

  for (let i = 1; i < versions.length; i += 1) {
    assert.ok(
      versions[i] > versions[i - 1],
      `Migrasi '${MIGRATIONS[i].id}' berada di urutan yang salah`,
    );
  }
});

test("kolom kupon dibuat lebih dulu sebelum datanya dipindahkan", () => {
  const addIndex = MIGRATIONS.findIndex(
    (migration) => migration.id === "v5_add_coupons",
  );
  const moveIndex = MIGRATIONS.findIndex(
    (migration) => migration.id === "v6_move_coupons_to_column",
  );

  assert.ok(addIndex >= 0, "Migrasi v5_add_coupons hilang");
  assert.ok(
    moveIndex > addIndex,
    "Pemindahan data kupon harus berjalan sesudah kolomnya dibuat",
  );

  // Migrasi data ini menambah nilai pada dirinya sendiri, jadi menjalankannya
  // dua kali akan menggandakan saldo kupon pemain. Ia hanya aman selama ledger
  // yang menahannya, dan itulah alasan test ini ada.
  assert.match(
    MIGRATIONS[moveIndex].sql,
    /^UPDATE UserSurvivals SET coupons = coupons \+/,
  );
  assert.match(
    MIGRATIONS[moveIndex].sql,
    /JSON_REMOVE\(rpg_state, '\$\.coupons'\)/,
  );
});
