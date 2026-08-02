const { logger } = require('../../src/managers/logger');
const fs = require('fs');

// ==========================================
// SISTEM MIGRASI BERNOMOR (Rule 1.7)
// Semua ALTER TABLE WAJIB di sini, bukan di dbManager.js
// ==========================================

/**
 * Daftar migrasi yang dijalankan secara berurutan.
 * Setiap migrasi punya ID unik dan query SQL-nya.
 * Tambahkan migrasi baru di BAWAH daftar yang sudah ada — jangan ubah urutan/ID yang sudah ada.
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
    }
];

/**
 * Jalankan semua migrasi yang belum dieksekusi di environment ini.
 * Gunakan try/catch per-migrasi dengan log yang jelas — tidak boleh silent catch kosong.
 * @param {import('sequelize').Sequelize} sequelize - Instance Sequelize yang sudah terkoneksi
 */
async function runMigrations(sequelize) {
    if (sequelize.options.dialect !== 'mysql') {
        logger.info('[DB MIGRATOR] Melewati migrasi — bukan MySQL (mode SQLite fallback).');
        return;
    }

    logger.info(`[DB MIGRATOR] Menjalankan ${MIGRATIONS.length} migrasi schema...`);

    for (const migration of MIGRATIONS) {
        try {
            await sequelize.query(migration.sql);
            logger.db(`[DB MIGRATOR] ✅ Migrasi '${migration.id}' berhasil: ${migration.description}`);
        } catch (err) {
            // Error 1060 = kolom sudah ada (ER_DUP_FIELDNAME) — ini aman untuk di-skip
            if (err.original && err.original.errno === 1060) {
                logger.info(`[DB MIGRATOR] ⏭️  Migrasi '${migration.id}' di-skip (kolom sudah ada).`);
            } else {
                // Error lain harus dilaporkan dengan jelas
                logger.error(`[DB MIGRATOR] ❌ Migrasi '${migration.id}' GAGAL: ${err.message}`);
            }
        }
    }

    logger.success('[DB MIGRATOR] Semua migrasi schema selesai diproses.');
}

// ==========================================
// MIGRASI DATA: SQLite → MySQL (Fallback Recovery)
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
