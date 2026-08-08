'use strict';

/**
 * Langkah migrasi skema yang berdiri sendiri: `npm run db:migrate`.
 *
 * Sebelum ini, migrasi dipanggil di dalam connectToDatabase(). Akibatnya migrasi
 * yang gagal tetap menghasilkan bot yang menyala di atas skema separuh jalan, dan
 * setiap shard menjalankan ALTER TABLE yang sama secara bersamaan.
 *
 * Sekarang urutan deploy yang benar adalah:
 *   1. npm run db:migrate     (sekali, satu proses)
 *   2. npm start              (shard sebanyak yang dibutuhkan)
 *
 * Keluar dengan kode 1 bila ada migrasi yang gagal, sehingga pipeline deploy
 * berhenti sebelum bot dinyalakan.
 */

const { sequelize } = require('../src/managers/dbManager');
const { runMigrations, getPendingMigrations } = require('../src/managers/dbMigrator');
const { logger } = require('../src/managers/logger');

async function main() {
    await sequelize.authenticate();
    logger.info(`[MIGRATE] Terhubung ke database (${sequelize.options.dialect}).`);

    // Membuat tabel yang belum ada. alter: false, jadi kolom yang sudah ada tidak
    // pernah diubah di sini; perubahan bentuk kolom hanya lewat daftar migrasi.
    await sequelize.sync({ alter: false });

    const pending = await getPendingMigrations(sequelize);
    if (pending.length > 0) {
        logger.info(`[MIGRATE] Migrasi tertunda: ${pending.join(', ')}`);
    }

    const result = await runMigrations(sequelize);
    logger.success(`[MIGRATE] Beres. Dijalankan: ${result.applied.length}, dicatat menyusul: ${result.alreadyPresent.length}.`);
}

main()
    .catch(error => {
        logger.error('[MIGRATE] Migrasi gagal:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sequelize.close();
        } catch (closeError) {
            logger.warn('[MIGRATE] Gagal menutup koneksi database:', closeError.message);
        }
    });
