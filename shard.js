try {
  process.loadEnvFile();
} catch (e) {}

let ClusterManager;
try {
  ClusterManager = require("discord-hybrid-sharding").ClusterManager;
} catch (_) {}

const { ShardingManager } = require("discord.js");
const { logger } = require("./src/managers/logger");
const path = require("path");
const env = require("./src/config/env");

// Kode keluar yang dipakai index.js saat konfigurasi wajib belum lengkap.
const EXIT_CODE_BAD_CONFIG = 78;

// Validasi konfigurasi SEBELUM cluster/shard di-spawn.
env.validateEnv({ fatal: false });

if (!env.TOKEN) {
  logger.warn(
    "\x1b[33m[CLUSTER] DISCORD_TOKEN belum diatur di .env. Membuka Dashboard Web secara langsung...\x1b[0m",
  );
  require("./index.js");
  return;
}

console.log(
  "\n\x1b[46m\x1b[30m ⚙️ CLUSTER / SHARD MANAGER \x1b[0m \x1b[36mStarting Multi-Core Cluster Engine...\x1b[0m\n",
);

let manager;
const useClustering = Boolean(env.USE_CLUSTERING && ClusterManager);

if (useClustering) {
  manager = new ClusterManager(path.join(__dirname, "index.js"), {
    token: env.TOKEN,
    totalShards: "auto",
    shardsPerClusters: 2,
    totalClusters: "auto",
    mode: "process",
    respawn: true,
  });

  manager.on("clusterCreate", (cluster) => {
    logger.success(`[CLUSTERING] Launched Cluster #${cluster.id}`);

    cluster.on("disconnect", () => {
      logger.warn(`[CLUSTERING] Cluster #${cluster.id} disconnected.`);
    });

    cluster.on("reconnecting", () => {
      logger.info(`[CLUSTERING] Cluster #${cluster.id} is reconnecting...`);
    });

    cluster.on("ready", () => {
      logger.success(`[CLUSTERING] Cluster #${cluster.id} is fully ready!`);
    });

    cluster.on("error", (error) => {
      logger.error(`[CLUSTERING] Cluster #${cluster.id} encountered an error:`, error);
    });

    cluster.on("death", (childProcess) => {
      const exitCode = childProcess ? childProcess.exitCode : null;
      logger.error(
        `[CLUSTERING] Cluster #${cluster.id} died with exit code ${exitCode}`,
      );

      if (exitCode === EXIT_CODE_BAD_CONFIG) {
        manager.respawn = false;
        logger.error(
          "[CLUSTERING] Konfigurasi environment tidak lengkap. Respawn dimatikan. Perbaiki .env lalu jalankan ulang.",
        );
        process.exitCode = EXIT_CODE_BAD_CONFIG;
      }
    });
  });

  manager.spawn({ timeout: 60000 }).catch((error) => {
    logger.error("[CLUSTERING] Failed to spawn clusters:", error);
  });
} else {
  manager = new ShardingManager(path.join(__dirname, "index.js"), {
    token: env.TOKEN,
    totalShards: "auto",
    respawn: true,
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

      if (exitCode === EXIT_CODE_BAD_CONFIG) {
        manager.respawn = false;
        logger.error(
          "[SHARDING] Konfigurasi environment tidak lengkap. Respawn dimatikan. Perbaiki .env lalu jalankan ulang.",
        );
        process.exitCode = EXIT_CODE_BAD_CONFIG;
      }
    });
  });

  manager
    .spawn({ amount: manager.totalShards, delay: 5500, timeout: 60000 })
    .catch((error) => {
      logger.error("[SHARDING] Failed to spawn shards:", error);
    });
}

// Process Error Handlers on Manager
process.on("unhandledRejection", (reason, promise) => {
  logger.error("[CLUSTER MANAGER] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("[CLUSTER MANAGER] Uncaught Exception:", error);
});

// ==========================================
// 🛑 GRACEFUL SHUTDOWN HANDLER (MANAGER)
// ==========================================
let isShuttingDown = false;
async function shutdownManager() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(
    "\n\x1b[41m\x1b[37m 🛑 MANAGER SHUTDOWN \x1b[0m \x1b[31mMencegah respawn dan menunggu worker mati...\x1b[0m",
  );
  manager.respawn = false;

  setTimeout(() => {
    console.log(
      "\x1b[42m\x1b[30m ✨ MANAGER \x1b[0m \x1b[32mSemua proses cluster telah aman. Exiting...\x1b[0m",
    );
    process.exit(0);
  }, 5000);
}

process.on("SIGINT", shutdownManager);
process.on("SIGTERM", shutdownManager);
