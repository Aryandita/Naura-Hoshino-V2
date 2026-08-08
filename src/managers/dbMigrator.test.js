'use strict';

/**
 * Test pertama di repo ini. Sengaja dipilih modul yang murni data supaya bisa
 * dijalankan tanpa koneksi database, Discord, maupun Redis.
 *
 * Yang dijaga di sini: daftar migrasi tidak boleh punya ID kembar dan tidak boleh
 * ada entri setengah jadi. Dua kesalahan itu diam-diam membuat satu migrasi
 * terlewat selamanya, karena ledger hanya mencatat ID.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { MIGRATIONS, LEDGER_TABLE } = require('./dbMigrator');

test('setiap migrasi punya ID yang unik', () => {
    const ids = MIGRATIONS.map(migration => migration.id);
    assert.equal(new Set(ids).size, ids.length, `Ada ID migrasi kembar: ${ids.join(', ')}`);
});

test('setiap migrasi punya deskripsi dan SQL yang terisi', () => {
    for (const migration of MIGRATIONS) {
        assert.equal(typeof migration.id, 'string');
        assert.ok(migration.id.length > 0, 'ID migrasi tidak boleh kosong');
        assert.ok(migration.description && migration.description.length > 0, `Migrasi ${migration.id} tanpa deskripsi`);
        assert.ok(migration.sql && migration.sql.trim().endsWith(';'), `SQL migrasi ${migration.id} harus diakhiri titik koma`);
    }
});

test('nama tabel ledger tidak berubah tanpa sengaja', () => {
    // Mengganti nama tabel ini membuat seluruh riwayat migrasi terlihat kosong,
    // sehingga semua migrasi dijalankan ulang pada database yang sudah benar.
    assert.equal(LEDGER_TABLE, 'schema_migrations');
});
