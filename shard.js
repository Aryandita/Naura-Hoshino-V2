try {
  process.loadEnvFile();
} catch (e) {}
const { ShardingManager } = require("discord.js");
const { logger } = require("./src/managers/logger");
const path = require("path");
const env = require("./src/config/env");

// Kode keluar yang dipakai index.js saat konfigurasi wajib belum lengkap.
const EXIT_CODE_BAD_CONFIG = 78;

// Validasi konfigurasi SEBELUM shard di-spawn. Kalau ada yang kurang, proses berhenti
// di sini sehingga anak shard tidak pernah lahir lalu mati berulang (respawn loop).
env.validateEnv({ fatal: true });

console.log(
  "\n\x1b[46m\x1b[30m ⚙️ SHARD MANAGER \x1b[0m \x1b[36mStarting Sharding Manager...\x1b[0m\n",
);

const manager = new ShardingManager(path.join(__dirname, "index.js"), {
  token: env.TOKEN,
  totalShards: "auto", // Menyesuaikan jumlah shard secara otomatis sesuai kebutuhan server
  respawn: true, // Otomatis respawn jika terjadi crash pada shard
});

manager.on("shardCreate", (shard) => {
  logger.success(`[SHARDING] Launched Shard #${shard.id}`);

  shard.on("disconnect", () => {
    logger.warn(`[SHARDING] Shard #${shard.id} disconnected.`);
  });

  shard.on("reconnecting", () => {
    logger.info(`[SHARDING] Shard #${shard.id} is reconnecting...`);
  });

  shard.on("ready", () => {
    logger.success(`[SHARDING] Shard #${shard.id} is fully ready!`);
  });

  shard.on("error", (error) => {
    logger.error(`[SHARDING] Shard #${shard.id} encountered an error:`, error);
  });

  shard.on("death", (childProcess) => {
    const exitCode = childProcess ? childProcess.exitCode : null;
    logger.error(
      `[SHARDING] Shard #${shard.id} died with exit code ${exitCode}`,
    );

    // Respawn tidak akan pernah memperbaiki konfigurasi yang kosong. Menghidupkan
    // ulang shard dalam kondisi ini hanya menghasilkan siklus lahir-mati tanpa henti.
    if (exitCode === EXIT_CODE_BAD_CONFIG) {
      manager.respawn = false;
      logger.error(
        "[SHARDING] Konfigurasi environment tidak lengkap. Respawn dimatikan. Perbaiki .env lalu jalankan ulang.",
      );
      process.exitCode = EXIT_CODE_BAD_CONFIG;
    }
  });
});

// Spawn Shards cleanly
manager
  .spawn({ amount: manager.totalShards, delay: 5500, timeout: 60000 })
  .catch((error) => {
    logger.error("[SHARDING] Failed to spawn shards:", error);
  });

// Process Error Handlers on Manager
process.on("unhandledRejection", (reason, promise) => {
  logger.error("[SHARDING MANAGER] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("[SHARDING MANAGER] Uncaught Exception:", error);
});

// ==========================================
// 🛑 GRACEFUL SHUTDOWN HANDLER (MANAGER)
// ==========================================
let isShuttingDown = false;
async function shutdownManager() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(
    "\n\x1b[41m\x1b[37m 🛑 MANAGER SHUTDOWN \x1b[0m \x1b[31mMencegah respawn dan menunggu shard mati...\x1b[0m",
  );
  manager.respawn = false; // Cegah shard respawn saat dimatikan

  // Beri waktu bagi setiap shard (index.js) untuk menyimpan cache & memutus koneksi
  setTimeout(() => {
    console.log(
      "\x1b[42m\x1b[30m ✨ MANAGER \x1b[0m \x1b[32mSemua proses shard telah aman. Exiting...\x1b[0m",
    );
    process.exit(0);
  }, 5000);
}

process.on("SIGINT", shutdownManager);
process.on("SIGTERM", shutdownManager);
