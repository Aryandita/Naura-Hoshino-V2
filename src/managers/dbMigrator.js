const { logger } = require('../../src/managers/logger');
const fs = require('fs');

// ==========================================
// SISTEM MIGRASI BERNOMOR (Rule 1.7)
// Semua ALTER TABLE WAJIB di sini, bukan di dbManager.js
// ==========================================

// Tabel catatan migrasi. Sebelum ini, setiap migrasi dijalankan ulang pada tiap
// boot dan hanya "berhasil" karena MySQL menolaknya dengan error kolom duplikat.
// Pola itu menyembunyikan kegagalan nyata dan membuat migrasi yang bukan ALTER
// (misalnya UPDATE data) mustahil ditulis dengan aman.
const LEDGER_TABLE = 'schema_migrations';

// Error MySQL yang berarti "perubahan ini sudah ada". Aman dicatat sebagai
// selesai, karena database sudah berada pada bentuk yang diinginkan.
// 1050 = tabel sudah ada, 1060 = kolom sudah ada, 1061 = index sudah ada,
// 1091 = kolom/index yang mau dihapus tidak ada.
const ALREADY_APPLIED_ERRNOS = new Set([1050, 1060, 1061, 1091]);

/**
 * Daftar migrasi yang dijalankan secara berurutan.
 * Setiap migrasi punya ID unik dan query SQL-nya.
 * Tambahkan migrasi baru di BAWAH daftar yang sudah ada, jangan ubah urutan/ID yang sudah ada.
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

function isAlreadyApplied(err) {
    const errno = err && err.original && err.original.errno;
    return ALREADY_APPLIED_ERRNOS.has(errno);
}

/** Membuat tabel catatan bila belum ada. Aman dipanggil berkali-kali. */
async function ensureLedger(sequelize) {
    await sequelize.query(
        `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
            id VARCHAR(191) NOT NULL PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
}

async function loadAppliedIds(sequelize) {
    const [rows] = await sequelize.query(`SELECT id FROM ${LEDGER_TABLE};`);
    return new Set((rows || []).map(row => row.id));
}

async function recordMigration(sequelize, id) {
    await sequelize.query(`INSERT IGNORE INTO ${LEDGER_TABLE} (id) VALUES (?);`, {
        replacements: [id]
    });
}

/**
 * Daftar ID migrasi yang belum tercatat selesai.
 *
 * Dipakai dbManager saat boot produksi untuk memperingatkan bahwa
 * `npm run db:migrate` belum dijalankan, tanpa ikut menjalankan migrasinya.
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<Array<string>>}
 */
async function getPendingMigrations(sequelize) {
    if (sequelize.options.dialect !== 'mysql') return [];
    await ensureLedger(sequelize);
    const done = await loadAppliedIds(sequelize);
    return MIGRATIONS.filter(migration => !done.has(migration.id)).map(migration => migration.id);
}

/**
 * Jalankan semua migrasi yang belum dieksekusi di environment ini.
 *
 * Berbeda dari versi sebelumnya, fungsi ini MELEMPAR error bila ada migrasi yang
 * gagal karena alasan tak terduga. Alasannya: migrasi dijalankan sebagai langkah
 * terpisah (`npm run db:migrate`), jadi kegagalan harus menghentikan deploy,
 * bukan menghasilkan bot yang menyala di atas skema separuh jalan.
 *
 * @param {import('sequelize').Sequelize} sequelize - Instance Sequelize yang sudah terkoneksi
 * @returns {Promise<{ applied: Array<string>, alreadyPresent: Array<string> }>}
 */
async function runMigrations(sequelize) {
    if (sequelize.options.dialect !== 'mysql') {
        logger.info('[DB MIGRATOR] Melewati migrasi, bukan MySQL (mode SQLite fallback).');
        return { applied: [], alreadyPresent: [] };
    }

    await ensureLedger(sequelize);
    const done = await loadAppliedIds(sequelize);
    const pending = MIGRATIONS.filter(migration => !done.has(migration.id));

    if (pending.length === 0) {
        logger.success(`[DB MIGRATOR] Tidak ada migrasi tertunda (${MIGRATIONS.length} sudah tercatat).`);
        return { applied: [], alreadyPresent: [] };
    }

    logger.info(`[DB MIGRATOR] ${pending.length} migrasi tertunda dari total ${MIGRATIONS.length}.`);

    const applied = [];
    const alreadyPresent = [];

    for (const migration of pending) {
        try {
            await sequelize.query(migration.sql);
            await recordMigration(sequelize, migration.id);
            applied.push(migration.id);
            logger.db(`[DB MIGRATOR] Migrasi '${migration.id}' berhasil: ${migration.description}`);
        } catch (err) {
            if (isAlreadyApplied(err)) {
                // Perubahannya sudah ada di database, hanya catatannya yang belum.
                await recordMigration(sequelize, migration.id);
                alreadyPresent.push(migration.id);
                logger.info(`[DB MIGRATOR] Migrasi '${migration.id}' dicatat selesai (perubahan sudah ada di database).`);
                continue;
            }

            logger.error(`[DB MIGRATOR] Migrasi '${migration.id}' gagal: ${err.message}`);
            throw new Error(`Migrasi '${migration.id}' gagal: ${err.message}`);
        }
    }

    logger.success(`[DB MIGRATOR] Selesai. ${applied.length} dijalankan, ${alreadyPresent.length} dicatat menyusul.`);
    return { applied, alreadyPresent };
}

// ==========================================
// MIGRASI DATA: SQLite -> MySQL (Fallback Recovery)
// ==========================================

async function syncFallbackToMySQL(mysqlSequelize) {
    if (!fs.existsSync('./naura_fallback.sqlite')) return;

    logger.info('[DB MIGRATOR] Mendeteksi file SQLite lokal. Memulai proses pemindahan data ke MySQL...');

    let database;
    try {
        // Gunakan native sqlite dari Node.js (v22+) agar ringan, fallback ke sqlite3 jika gagal.
        let DatabaseSync;
        try {
            DatabaseSync = require('node:sqlite').DatabaseSync;
            database = new DatabaseSync('./naura_fallback.sqlite');
        } catch (err) {
            logger.warn(`[DB MIGRATOR] node:sqlite tidak tersedia (${err.message}). Menggunakan fallback sqlite3 eksternal.`);
            const sqlite3 = require('sqlite3').verbose();
            database = new sqlite3.Database('./naura_fallback.sqlite');

            database.prepare = function() {
                return {
                    all: function() {
                        throw new Error('Fallback sqlite3 tidak mendukung mode sinkron. Harap gunakan Node 22.5.0+');
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
                logger.warn(`[DB MIGRATOR] Tabel ${MysqlModel.tableName} dilewati saat sync fallback: ${tableErr.message}`);
            }
        }

        logger.success('[DB MIGRATOR] Pemindahan data selesai. Menghapus database SQLite sementara...');
    } catch (e) {
        logger.error('[DB MIGRATOR ERROR] Gagal memindahkan data:', e.message);
    } finally {
        if (database) database.close();
        try {
            fs.unlinkSync('./naura_fallback.sqlite');
        } catch (unlinkError) {
            logger.warn(`[DB MIGRATOR] Gagal menghapus database SQLite fallback: ${unlinkError.message}`);
        }
    }
}

module.exports = {
    runMigrations,
    syncFallbackToMySQL,
    getPendingMigrations,
    MIGRATIONS,
    LEDGER_TABLE
};
