try {
  process.loadEnvFile();
} catch (e) {}

let ClusterManager;
try {
  ClusterManager = require("discord-hybrid-sharding").ClusterManager;
} catch (_) {}

const { ShardingManager } = require("discord.js");
const { logger } = require("./src/managers/logger");
const { displayClusterBootScreen } = require("./src/utils/bootScreen");
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

let manager;
const useClustering = Boolean(env.USE_CLUSTERING && ClusterManager);

displayClusterBootScreen({
  useClustering,
  totalShards: "auto",
});

// ==========================================
// 🛑 GRACEFUL SHUTDOWN & SIBLING TEARDOWN COORDINATION
// ==========================================
let isShuttingDown = false;
let shutdownWatchdog = null;
const deadChildren = new Set();

function checkAllChildrenDead(source = "unknown") {
  if (!isShuttingDown) return;

  const children = (manager && (manager.clusters || manager.shards)) || null;
  if (!children || children.size === 0) {
    if (shutdownWatchdog) clearTimeout(shutdownWatchdog);
    logger.success("[MANAGER] Tidak ada worker atau shard aktif. Manager keluar.");
    process.exit(0);
    return;
  }

  let aliveCount = 0;
  for (const child of children.values()) {
    const proc = child.process || child.worker;
    const isDead =
      deadChildren.has(child.id) ||
      !proc ||
      proc.exitCode !== null ||
      proc.signalCode !== null ||
      proc.killed;
    if (!isDead) {
      aliveCount++;
    } else {
      deadChildren.add(child.id);
    }
  }

  logger.info(
    `[MANAGER] Status teardown child processes: ${aliveCount} masih aktif (event: ${source}).`,
  );

  if (aliveCount === 0) {
    if (shutdownWatchdog) clearTimeout(shutdownWatchdog);
    logger.success(
      `[MANAGER] Semua proses child (${children.size}) telah selesai teardown dan berhenti secara bersih. Manager exiting...`,
    );
    process.exit(0);
  }
}

function handleManagerShutdown(originChildId = null) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (manager) manager.respawn = false;
  deadChildren.clear();

  logger.system(
    `[MANAGER] Memulai penutupan terkendali seluruh child processes (pemicu: ${originChildId !== null ? `Child #${originChildId}` : "Signal OS"})...`,
  );

  const children = (manager && (manager.clusters || manager.shards)) || null;
  if (children) {
    children.forEach((child) => {
      if (originChildId === null || child.id !== originChildId) {
        try {
          child.send({ type: "MANAGER_SHUTDOWN" });
        } catch (_) {}
      }
    });
  }

  // Safety watchdog timer (15 detik): lebih lama dari lifecycleManager.TIMEOUT_MS (12 detik).
  // Keluar dengan status 1 bila terpaksa dihentikan paksa (timeout) agar supervisor proses mendeteksi anomali.
  shutdownWatchdog = setTimeout(() => {
    logger.warn(
      "[MANAGER] Batas waktu teardown (15 detik) tercapai. Memaksa seluruh proses manager berhenti.",
    );
    process.exit(1);
  }, 15000);
  if (shutdownWatchdog.unref) shutdownWatchdog.unref();

  // Evaluasi jika ternyata tidak ada proses anak atau sudah langsung mati
  setImmediate(() => checkAllChildrenDead("initial_check"));
}

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
    deadChildren.delete(cluster.id);
    logger.success(`[CLUSTERING] Launched Cluster #${cluster.id}`);

    cluster.on("disconnect", () => {
      logger.warn(`[CLUSTERING] Cluster #${cluster.id} disconnected.`);
    });

    cluster.on("reconnecting", () => {
      logger.info(`[CLUSTERING] Cluster #${cluster.id} is reconnecting...`);
    });

    cluster.on("ready", () => {
      deadChildren.delete(cluster.id);
      logger.success(`[CLUSTERING] Cluster #${cluster.id} is fully ready!`);
    });

    cluster.on("spawn", () => {
      deadChildren.delete(cluster.id);
    });

    cluster.on("message", (msg) => {
      if (msg?.type === "MANAGER_SHUTDOWN") {
        logger.system(`[CLUSTERING] Menerima sinyal MANAGER_SHUTDOWN dari Cluster #${cluster.id}.`);
        handleManagerShutdown(cluster.id);
      } else if (msg?.type === "MANAGER_RESTART") {
        logger.system(`[CLUSTERING] Menerima sinyal MANAGER_RESTART dari Cluster #${cluster.id}. Merestart cluster...`);
        cluster.respawn().catch((err) => logger.error("[CLUSTERING] Gagal respawn cluster:", err));
      } else if (msg?.type === "MAINTENANCE_SYNC") {
        if (manager.clusters) {
          manager.clusters.forEach((c) => {
            if (c.id !== cluster.id) {
              try {
                c.send(msg);
              } catch (_) {}
            }
          });
        }
      }
    });

    cluster.on("error", (error) => {
      logger.error(
        `[CLUSTERING] Cluster #${cluster.id} encountered an error:`,
        error,
      );
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

      if (isShuttingDown) {
        deadChildren.add(cluster.id);
        checkAllChildrenDead(`cluster_${cluster.id}_death`);
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
    deadChildren.delete(shard.id);
    logger.success(`[SHARDING] Launched Shard #${shard.id}`);

    shard.on("disconnect", () => {
      logger.warn(`[SHARDING] Shard #${shard.id} disconnected.`);
    });

    shard.on("reconnecting", () => {
      logger.info(`[SHARDING] Shard #${shard.id} is reconnecting...`);
    });

    shard.on("ready", () => {
      deadChildren.delete(shard.id);
      logger.success(`[SHARDING] Shard #${shard.id} is fully ready!`);
    });

    shard.on("spawn", () => {
      deadChildren.delete(shard.id);
    });

    shard.on("message", (msg) => {
      if (msg?.type === "MANAGER_SHUTDOWN") {
        logger.system(`[SHARDING] Menerima sinyal MANAGER_SHUTDOWN dari Shard #${shard.id}.`);
        handleManagerShutdown(shard.id);
      } else if (msg?.type === "MANAGER_RESTART") {
        logger.system(`[SHARDING] Menerima sinyal MANAGER_RESTART dari Shard #${shard.id}. Merestart shard...`);
        shard.respawn().catch((err) => logger.error("[SHARDING] Gagal respawn shard:", err));
      } else if (msg?.type === "MAINTENANCE_SYNC") {
        if (manager.shards) {
          manager.shards.forEach((s) => {
            if (s.id !== shard.id) {
              try {
                s.send(msg);
              } catch (_) {}
            }
          });
        }
      }
    });

    shard.on("error", (error) => {
      logger.error(
        `[SHARDING] Shard #${shard.id} encountered an error:`,
        error,
      );
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

      if (isShuttingDown) {
        deadChildren.add(shard.id);
        checkAllChildrenDead(`shard_${shard.id}_death`);
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
// 🛑 OS SIGNAL HANDLERS (MANAGER)
// ==========================================
function shutdownManager() {
  handleManagerShutdown(null);
}

process.on("SIGINT", shutdownManager);
process.on("SIGTERM", shutdownManager);
