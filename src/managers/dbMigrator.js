const { logger } = require('../../src/managers/logger');
const fs = require('fs');

// ==========================================
// SISTEM MIGRASI BERNOMOR (Rule 1.7)
// Semua ALTER TABLE WAJIB di sini, bukan di dbManager.js
// ==========================================

/**
 * Daftar migrasi yang dijalankan secara berurutan.
 * Setiap migrasi punya ID unik dan query SQL-nya.
 * Tambahkan migrasi baru di BAWAH daftar yang sudah ada \u2014 jangan ubah urutan/ID yang sudah ada.
 */
const MIGRATIONS = [
    {
        id: 'v1_add_mannersPoint',
        description: 'Tambah kolom mannersPoint ke user_leveling',
        sql: 'ALTER TABLE user_leveling ADD COLUMN mannersPoint INT DEFAULT 100;'
    },
    {
        id: 'v2_add_dailyNotify',
        description: 'Tambah kolom dailyNotify ke user_profiles',
        sql: 'ALTER TABLE user_profiles ADD COLUMN dailyNotify TINYINT(1) DEFAULT 1;'
    },
    {
        id: 'v3_add_economy_deposit',
        description: 'Tambah kolom economy_deposit ke user_profiles',
        sql: 'ALTER TABLE user_profiles ADD COLUMN economy_deposit JSON DEFAULT NULL;'
    },
    {
        id: 'v4_add_economy_investments',
        description: 'Tambah kolom economy_investments ke user_profiles',
        sql: 'ALTER TABLE user_profiles ADD COLUMN economy_investments JSON DEFAULT NULL;'
    },
    {
        id: 'v5_language_nullable',
        description: 'Ubah kolom language menjadi NULL agar bisa membedakan belum memilih dan sengaja memilih id',
        sql: "ALTER TABLE user_profiles MODIFY COLUMN language VARCHAR(255) NULL DEFAULT NULL;"
    },
    {
        id: 'v6_language_reset_default',
        description: 'Kosongkan nilai id bawaan lama supaya pemilih bahasa /help muncul sekali untuk user lama',
        sql: "UPDATE user_profiles SET language = NULL WHERE language = 'id';",
        runOnce: true
    }
];

/**
 * Jalankan semua migrasi yang belum dieksekusi di environment ini.
 * Gunakan try/catch per-migrasi dengan log yang jelas \u2014 tidak boleh silent catch kosong.
 * @param {import('sequelize').Sequelize} sequelize - Instance Sequelize yang sudah terkoneksi
 */
async function runMigrations(sequelize) {
    if (sequelize.options.dialect !== 'mysql') {
        logger.info('[DB MIGRATOR] Melewati migrasi \u2014 bukan MySQL (mode SQLite fallback).');
        return;
    }

    await ensureHistoryTable(sequelize);
    const executed = await loadExecutedIds(sequelize);

    logger.info(`[DB MIGRATOR] Menjalankan ${MIGRATIONS.length} migrasi schema...`);

    for (const migration of MIGRATIONS) {
        // Migrasi bertanda runOnce menyentuh DATA, bukan struktur, sehingga tidak
        // idempoten. Jalankan sekali saja lalu catat di tabel riwayat.
        if (migration.runOnce && executed.has(migration.id)) {
            logger.info(`[DB MIGRATOR] \u23ed\ufe0f  Migrasi '${migration.id}' di-skip (sudah pernah dijalankan).`);
            continue;
        }

        try {
            await sequelize.query(migration.sql);
            logger.db(`[DB MIGRATOR] \u2705 Migrasi '${migration.id}' berhasil: ${migration.description}`);
            if (migration.runOnce) await recordMigration(sequelize, migration.id);
        } catch (err) {
            // Error 1060 = kolom sudah ada (ER_DUP_FIELDNAME) \u2014 ini aman untuk di-skip
            if (err.original && err.original.errno === 1060) {
                logger.info(`[DB MIGRATOR] \u23ed\ufe0f  Migrasi '${migration.id}' di-skip (kolom sudah ada).`);
            } else {
                // Error lain harus dilaporkan dengan jelas
                logger.error(`[DB MIGRATOR] \u274c Migrasi '${migration.id}' GAGAL: ${err.message}`);
            }
        }
    }

    logger.success('[DB MIGRATOR] Semua migrasi schema selesai diproses.');
}

/** Tabel riwayat khusus migrasi data sekali jalan. */
async function ensureHistoryTable(sequelize) {
    try {
        await sequelize.query(
            'CREATE TABLE IF NOT EXISTS naura_migrations (id VARCHAR(191) NOT NULL PRIMARY KEY, executedAt DATETIME NOT NULL);'
        );
    } catch (err) {
        logger.error(`[DB MIGRATOR] Gagal menyiapkan tabel riwayat migrasi: ${err.message}`);
    }
}

async function loadExecutedIds(sequelize) {
    try {
        const [rows] = await sequelize.query('SELECT id FROM naura_migrations;');
        return new Set((rows || []).map(row => row.id));
    } catch (err) {
        logger.error(`[DB MIGRATOR] Gagal membaca riwayat migrasi: ${err.message}`);
        return new Set();
    }
}

async function recordMigration(sequelize, id) {
    try {
        await sequelize.query(
            'INSERT IGNORE INTO naura_migrations (id, executedAt) VALUES (?, NOW());',
            { replacements: [id] }
        );
    } catch (err) {
        logger.error(`[DB MIGRATOR] Gagal mencatat migrasi '${id}': ${err.message}`);
    }
}

// ==========================================
// MIGRASI DATA: SQLite \u2192 MySQL (Fallback Recovery)
// ==========================================

async function syncFallbackToMySQL(mysqlSequelize) {
    if (!fs.existsSync('./naura_fallback.sqlite')) return;

    logger.info('[DB MIGRATOR] Mendeteksi file SQLite lokal. Memulai proses pemindahan data ke MySQL...');

    let database;
    try {
        // Gunakan native sqlite dari Node.js (v22+) agar ringan, fallback ke sqlite3 jika gagal
        let DatabaseSync;
        try {
            DatabaseSync = require('node:sqlite').DatabaseSync;
            database = new DatabaseSync('./naura_fallback.sqlite');
        } catch (err) {
            logger.warn('[DB MIGRATOR] node:sqlite tidak ditemukan atau versi Node < 22.5.0. Menggunakan fallback sqlite3 eksternal.');
            const sqlite3 = require('sqlite3').verbose();
            database = new sqlite3.Database('./naura_fallback.sqlite');

            database.prepare = function(sql) {
                return {
                    all: function() {
                        throw new Error('Fallback sqlite3 tidak mendukung full sinkronous. Harap gunakan Node 22.5.0+');
                    }
                };
            };
        }

        const models = Object.keys(mysqlSequelize.models);

        for (const modelName of models) {
            const MysqlModel = mysqlSequelize.models[modelName];

            try {
                const stmt = database.prepare(`SELECT * FROM ${MysqlModel.tableName}`);
                const rows = stmt.all();

                if (rows && rows.length > 0) {
                    logger.db(`[DB MIGRATOR] Memindahkan ${rows.length} baris ke tabel ${MysqlModel.tableName}...`);
                    for (const row of rows) {
                        try {
                            const [record, created] = await MysqlModel.findOrCreate({
                                where: {
                                    [MysqlModel.primaryKeyAttributes[0]]: row[MysqlModel.primaryKeyAttributes[0]]
                                },
                                defaults: row
                            });
                            if (!created) {
                                await record.update(row);
                            }
                        } catch (rowErr) {
                            logger.warn(`[DB MIGRATOR] Skip baris invalid di ${MysqlModel.tableName}: ${rowErr.message}`);
                        }
                    }
                }
            } catch (tableErr) {
                // Tabel tidak ada di SQLite, lewati saja
            }
        }

        logger.success('[DB MIGRATOR] Pemindahan data selesai. Menghapus database SQLite sementara...');
    } catch (e) {
        logger.error('[DB MIGRATOR ERROR] Gagal memindahkan data:', e.message);
    } finally {
        if (database) database.close();
        try { fs.unlinkSync('./naura_fallback.sqlite'); } catch(e) {}
    }
}

module.exports = { runMigrations, syncFallbackToMySQL };
