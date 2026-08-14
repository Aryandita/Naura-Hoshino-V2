"use strict";

/**
 * Langkah migrasi skema yang berdiri sendiri: `npm run db:migrate`.
 *
 * Sebelum ini, migrasi dipanggil di dalam connectToDatabase(). Akibatnya migrasi
 * yang gagal tetap menghasilkan bot yang menyala di atas skema separuh jalan, dan
 * setiap shard menjalankan ALTER TABLE yang sama secara bersamaan.
 *
 * Urutan deploy yang benar adalah:
 *   1. npm run db:migrate     (sekali, satu proses)
 *   2. npm start              (shard sebanyak yang dibutuhkan)
 *
 * Panel seperti Pterodactyl hanya menyediakan SATU kolom perintah start, jadi
 * urutan di atas dijamin oleh npm lifecycle script "prestart": `npm start` akan
 * selalu menjalankan file ini lebih dulu dan berhenti bila migrasi gagal.
 *
 * Keluar dengan kode 1 bila ada migrasi yang gagal, sehingga pipeline deploy
 * berhenti sebelum bot dinyalakan.
 */

const { sequelize } = require("../src/managers/dbManager");
const {
  runMigrations,
  getPendingMigrations,
} = require("../src/managers/dbMigrator");
const { logger } = require("../src/managers/logger");

// Pintu darurat. Bila MySQL sedang mati dan bot harus tetap dinyalakan di atas skema
// lama, set SKIP_DB_MIGRATE=1 di panel. Jangan dibiarkan menyala permanen: kolom baru
// tidak akan pernah dibuat, dan fitur yang bergantung padanya akan gagal.
const SKIP_VALUES = new Set(["1", "true", "yes"]);

if (SKIP_VALUES.has(String(process.env.SKIP_DB_MIGRATE || "").toLowerCase())) {
  logger.warn(
    "[MIGRATE] SKIP_DB_MIGRATE aktif. Migrasi DILEWATI dan skema database tidak diperiksa.",
  );
  process.exit(0);
}

async function main() {
  await sequelize.authenticate();
  logger.info(
    `[MIGRATE] Terhubung ke database (${sequelize.options.dialect}).`,
  );

  // Membuat tabel yang belum ada. alter: false, jadi kolom yang sudah ada tidak
  // pernah diubah di sini; perubahan bentuk kolom hanya lewat daftar migrasi.
  await sequelize.sync({ alter: false });

  const pending = await getPendingMigrations(sequelize);
  if (pending.length > 0) {
    logger.info(`[MIGRATE] Migrasi tertunda: ${pending.join(", ")}`);
  }

  const result = await runMigrations(sequelize);
  logger.success(
    `[MIGRATE] Beres. Dijalankan: ${result.applied.length}, dicatat menyusul: ${result.alreadyPresent.length}.`,
  );
}

main()
  .catch((error) => {
    logger.error("[MIGRATE] Migrasi gagal:", error.message);
    logger.error(
      "[MIGRATE] Bot TIDAK dinyalakan supaya tidak berjalan di atas skema separuh jalan.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (closeError) {
      logger.warn(
        "[MIGRATE] Gagal menutup koneksi database:",
        closeError.message,
      );
    }
  });
