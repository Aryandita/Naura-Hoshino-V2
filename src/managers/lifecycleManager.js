"use strict";

/**
 * @file lifecycleManager.js
 * @description Orkestrator siklus hidup terpusat untuk Naura Hoshino V2.
 * Menangani Graceful Teardown, Graceful Restart, Emergency Flush, dan Maintenance Mode
 * dengan koordinasi multi-database, audio cluster, dan IPC ShardingManager.
 */

const { spawn } = require("child_process");
const { logger } = require("./logger");
const container = require("../core/container");

let isShuttingDown = false;
let isMaintenance = false;
let maintenanceReason = "Pemeliharaan sistem berkala";
let teardownPromise = null;
let shutdownPromise = null;
let restartPromise = null;

let parentPort = null;
let isMainThread = true;
try {
  const wt = require("node:worker_threads");
  isMainThread = wt.isMainThread;
  parentPort = wt.parentPort;
} catch (err) {
  logger.debug("[LifecycleManager] Worker threads tidak tersedia: " + (err?.message || err));
}

function sendToParent(msg) {
  if (typeof process.send === "function") {
    try {
      process.send(msg);
      return true;
    } catch (err) {
      logger.debug("[LifecycleManager] Gagal mengirim pesan via process.send: " + (err?.message || err));
    }
  }
  if (!isMainThread && parentPort && typeof parentPort.postMessage === "function") {
    try {
      parentPort.postMessage(msg);
      return true;
    } catch (err) {
      logger.debug("[LifecycleManager] Gagal mengirim pesan via parentPort: " + (err?.message || err));
    }
  }
  return false;
}

/**
 * Mengambil ringkasan kesehatan & metrik sistem secara real-time.
 * @param {object} client - Discord Client
 * @returns {object} Metrik kesehatan sistem
 */
function getSystemHealth(client) {
  const mem = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  const uptimeFormatted = `${hours}j ${minutes}m ${seconds}d`;

  // Database status
  let postgresConnected = false;
  try {
    const { sequelize } = require("./dbManager");
    postgresConnected = Boolean(sequelize && sequelize.connectionManager && !sequelize.connectionManager.closed);
  } catch (err) {
    logger.debug("[LifecycleManager] Gagal memeriksa status PostgreSQL: " + (err?.message || err));
  }

  let redisConnected = false;
  try {
    const redisManager = require("./redisManager");
    redisConnected = Boolean(redisManager && redisManager.isReady);
  } catch (err) {
    logger.debug("[LifecycleManager] Gagal memeriksa status Redis: " + (err?.message || err));
  }

  let mongoConnected = false;
  try {
    const mongoManager = require("./mongoManager");
    mongoConnected = Boolean(mongoManager && mongoManager.isReady);
  } catch (err) {
    logger.debug("[LifecycleManager] Gagal memeriksa status MongoDB: " + (err?.message || err));
  }

  let pendingWrites = 0;
  try {
    const cacheManager = require("./cacheManager");
    pendingWrites = cacheManager.pendingWrites || 0;
  } catch (err) {
    logger.debug("[LifecycleManager] Gagal mengambil pending writes: " + (err?.message || err));
  }

  let aiCircuitBreakers = {};
  try {
    const aiRouter = require("../ai/aiEnsembleRouter");
    if (aiRouter && typeof aiRouter.getCircuitBreakerMetrics === "function") {
      aiCircuitBreakers = aiRouter.getCircuitBreakerMetrics();
    }
  } catch (err) {
    logger.debug("[LifecycleManager] Gagal mengambil AI circuit breaker metrics: " + (err?.message || err));
  }

  let dbPoolMetrics = {};
  try {
    const { getPoolMetrics } = require("../config/database");
    if (typeof getPoolMetrics === "function") {
      dbPoolMetrics = getPoolMetrics();
    }
  } catch (err) {
    logger.debug("[LifecycleManager] Gagal mengambil database pool metrics: " + (err?.message || err));
  }

  // Audio stats
  let activePlayers = 0;
  let connectedNodes = 0;
  let totalNodes = 0;
  if (client && client.musicManager && client.musicManager.poru) {
    const poru = client.musicManager.poru;
    if (poru.players) {
      activePlayers = poru.players.size || 0;
    }
    if (poru.nodes) {
      totalNodes = poru.nodes.size || 0;
      connectedNodes = [...poru.nodes.values()].filter((n) => n.isConnected).length;
    }
  }

  return {
    uptimeSec,
    uptimeFormatted,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    databases: {
      postgres: postgresConnected,
      redis: redisConnected,
      mongo: mongoConnected,
    },
    audio: {
      activePlayers,
      connectedNodes,
      totalNodes,
    },
    cache: {
      pendingWrites,
    },
    databasePool: dbPoolMetrics,
    aiCircuitBreakers,
    shards: {
      shardId: client?.shard?.ids ? client.shard.ids.join(",") : "0",
      clusterId: client?.cluster?.id != null ? client.cluster.id : null,
      guildCount: client?.guilds?.cache?.size || 0,
      userCount: client?.guilds?.cache
        ? (typeof client.guilds.cache.reduce === "function"
            ? client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0)
            : [...client.guilds.cache.values()].reduce((acc, g) => acc + (g.memberCount || 0), 0))
        : 0,
    },
    isMaintenance,
    maintenanceReason,
    isShuttingDown,
  };
}

/**
 * Menyimpan seluruh antrean tulis cache dan penyangga XP ke database tanpa mematikan bot.
 * @returns {Promise<{ flushedWrites: number, success: boolean }>}
 */
async function flushAllData() {
  logger.system("[Lifecycle] Menjalankan Emergency State Flush...");
  let flushedWrites = 0;

  try {
    const xpBuffer = require("../leveling/xpBuffer");
    if (xpBuffer && typeof xpBuffer.flush === "function") {
      logger.info("[Lifecycle] Menyetorkan penyangga XP ke database...");
      await xpBuffer.flush();
    }
  } catch (err) {
    logger.warn(`[Lifecycle] Gagal flush xpBuffer: ${err.message}`);
  }

  try {
    const cacheManager = require("./cacheManager");
    if (cacheManager) {
      flushedWrites = cacheManager.pendingWrites || 0;
      if (typeof cacheManager.flushAll === "function") {
        logger.info(`[Lifecycle] Menyimpan ${flushedWrites} antrean cache ke PostgreSQL...`);
        await cacheManager.flushAll();
      }
    }
  } catch (err) {
    logger.warn(`[Lifecycle] Gagal flush cacheManager: ${err.message}`);
  }

  logger.success("[Lifecycle] Emergency State Flush selesai diproses.");
  return { flushedWrites, success: true };
}

/**
 * Menerapkan status Mode Pemeliharaan secara lokal pada shard/cluster saat ini.
 * @param {object} client - Discord Client
 * @param {boolean} enabled - Aktifkan atau nonaktifkan
 * @param {string} [reason] - Alasan pemeliharaan
 */
function applyMaintenanceLocally(client, enabled, reason = "Pemeliharaan sistem berkala") {
  isMaintenance = Boolean(enabled);
  maintenanceReason = reason;

  if (client) {
    client.isMaintenance = isMaintenance;
    client.maintenanceReason = maintenanceReason;
  }

  // Update presence status
  if (client && client.user) {
    try {
      if (isMaintenance) {
        client.user.setPresence({
          status: "dnd",
          activities: [
            {
              name: `⚠️ MAINTENANCE: ${maintenanceReason}`,
              type: 0,
            },
          ],
        });
      } else {
        const botActivity = require("../config/bot-activity");
        if (botActivity && botActivity.activities && botActivity.activities[0]) {
          const act = botActivity.activities[0];
          client.user.setPresence({
            status: act.status || "online",
            activities: [
              {
                name: act.name,
                type: act.type,
              },
            ],
          });
        }
      }
    } catch (_) {}
  }

  logger.system(
    `[Lifecycle] Mode Maintenance sekarang: ${isMaintenance ? "AKTIF (" + maintenanceReason + ")" : "NONAKTIF (Normal)"}`,
  );
}

/**
 * Mengatur status Mode Pemeliharaan (Maintenance Mode) dan menyinkronkan ke seluruh shard.
 * @param {object} client - Discord Client
 * @param {boolean} enabled - Aktifkan atau nonaktifkan
 * @param {string} [reason] - Alasan pemeliharaan
 */
async function setMaintenanceMode(client, enabled, reason = "Pemeliharaan sistem berkala") {
  applyMaintenanceLocally(client, enabled, reason);

  // 1. Sinkronisasi status ke Redis jika aktif
  try {
    const redisManager = require("./redisManager");
    if (redisManager && redisManager.isReady && redisManager.client) {
      if (isMaintenance) {
        await redisManager.client.set("system:maintenance", JSON.stringify({
          active: true,
          reason: maintenanceReason,
          activatedAt: new Date().toISOString(),
        }));
      } else {
        await redisManager.client.del("system:maintenance");
      }
    }
  } catch (_) {}

  // 2. Broadcast ke Sharding/Cluster Manager agar seluruh shard lain tersinkronisasi
  sendToParent({
    type: "MAINTENANCE_SYNC",
    enabled: isMaintenance,
    reason: maintenanceReason,
  });

  return isMaintenance;
}

/**
 * Eksekusi urutan Graceful Teardown bertahap.
 * @param {object} client - Discord Client
 * @param {object} [options]
 * @param {string} [options.mode="shutdown"] - Mode: 'shutdown' | 'restart'
 * @param {string} [options.reason="Permintaan sistem"] - Alasan
 * @param {string} [options.user="System"] - User pelaksana
 */
function gracefulTeardown(client, { mode = "shutdown", reason = "Permintaan sistem", user = "System" } = {}) {
  if (teardownPromise) {
    return teardownPromise;
  }
  isShuttingDown = true;

  if (client) {
    client.isShuttingDown = true;
  }

  teardownPromise = (async () => {
    // Tampilkan layar ASCII Teardown di konsol
    try {
      const { displayShutdownScreen } = require("../utils/bootScreen");
      if (typeof displayShutdownScreen === "function") {
        displayShutdownScreen({ mode, reason, user });
      } else {
        logger.system(`\n[LIFECYCLE] Memulai urutan graceful teardown (Mode: ${mode.toUpperCase()})...\n`);
      }
    } catch (_) {
      logger.system(`\n[LIFECYCLE] Memulai urutan graceful teardown (Mode: ${mode.toUpperCase()})...\n`);
    }

    const TIMEOUT_MS = 12000;
    const watchdog = setTimeout(() => {
      logger.error(`[Lifecycle] Teardown melebihi batas waktu ${TIMEOUT_MS}ms. Memaksa keluar.`);
      process.exit(1);
    }, TIMEOUT_MS);
    if (watchdog.unref) watchdog.unref();

    // 1. Amankan penyangga XP
    try {
      const xpBuffer = require("../leveling/xpBuffer");
      if (xpBuffer && typeof xpBuffer.flush === "function") {
        logger.info("[1/7] Menyetorkan penyangga XP ke database...");
        xpBuffer.stop();
        await xpBuffer.flush();
      }
    } catch (err) {
      logger.warn(`[1/7] Gagal flush xpBuffer: ${err.message}`);
    }

    // 2. Kosongkan antrean tulis cache ke database
    try {
      const cacheManager = require("./cacheManager");
      if (cacheManager) {
        const pending = cacheManager.pendingWrites || 0;
        if (pending > 0) {
          logger.info(`[2/7] Menyimpan ${pending} data cache ke PostgreSQL...`);
        }
        if (typeof cacheManager.flushAll === "function") {
          await cacheManager.flushAll();
        }
      }
    } catch (err) {
      logger.warn(`[2/7] Gagal flush cacheManager: ${err.message}`);
    }

    // 3. Putus audio cluster Lavalink & bebaskan voice channel
    try {
      if (client && client.musicManager && client.musicManager.poru) {
        logger.info("[3/7] Menghancurkan Lavalink node & pemutar audio aktif...");
        if (client.musicManager.poru.players) {
          for (const player of client.musicManager.poru.players.values()) {
            try {
              player.destroy();
            } catch (_) {}
          }
        }
        if (client.musicManager.poru.nodes) {
          const nodeList = typeof client.musicManager.poru.nodes.values === "function"
            ? Array.from(client.musicManager.poru.nodes.values())
            : (Array.isArray(client.musicManager.poru.nodes) ? client.musicManager.poru.nodes : []);
          for (const node of nodeList) {
            try {
              if (typeof node.destroy === "function") node.destroy();
              else if (typeof node.disconnect === "function") node.disconnect();
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      logger.warn(`[3/7] Gagal membersihkan audio Poru: ${err.message}`);
    }

    // 4. Hentikan worker thread Canvas
    try {
      const canvasWorkerPool = require("../canvas/canvasWorkerPool");
      if (canvasWorkerPool && typeof canvasWorkerPool.shutdown === "function") {
        logger.info("[4/7] Menghentikan Canvas Worker Pool...");
        await canvasWorkerPool.shutdown();
      }
    } catch (err) {
      logger.warn(`[4/7] Gagal mematikan canvasWorkerPool: ${err.message}`);
    }

    // 5. Tutup server Web Dashboard dan WebSocket jika aktif
    try {
      const dashboard = container.resolve("dashboardServer", true);
      if (dashboard) {
        logger.info("[5/7] Menutup listener Web Dashboard dan WebSocket...");
        if (dashboard.io && typeof dashboard.io.close === "function") {
          dashboard.io.close();
        }
        if (dashboard.webServer && typeof dashboard.webServer.close === "function") {
          dashboard.webServer.close();
        }
      }
    } catch (err) {
      logger.warn(`[5/7] Gagal menutup Web Dashboard: ${err.message}`);
    }

    // 6. Jalankan Service Container disposals
    try {
      logger.info("[6/7] Menjalankan lifecycle dispose pada Service Container...");
      await container.dispose();
    } catch (err) {
      logger.warn(`[6/7] Gagal dispose container: ${err.message}`);
    }

    // 7. Putus koneksi Database dan Discord Gateway
    try {
      logger.info("[7/7] Menutup koneksi database dan Discord Gateway...");
      if (client && typeof client.destroy === "function") {
        client.destroy();
      }

      const { sequelize } = require("./dbManager");
      if (sequelize) {
        await sequelize.close().catch(() => {});
      }

      const redisManager = require("./redisManager");
      if (redisManager && redisManager.client) {
        await redisManager.client.quit().catch(() => {});
      }

      const mongoManager = require("./mongoManager");
      if (mongoManager && mongoManager.isReady) {
        await mongoManager.disconnect().catch(() => {});
      }
    } catch (err) {
      logger.warn(`[7/7] Gagal menutup koneksi eksternal: ${err.message}`);
    }

    clearTimeout(watchdog);
    logger.success(`[Lifecycle] Seluruh komponen telah dinonaktifkan dengan aman. Mode: ${mode.toUpperCase()}.`);
  })();

  return teardownPromise;
}

/**
 * Menjalankan Graceful Shutdown penuh.
 * @param {object} client - Discord Client
 * @param {object} [params]
 */
function executeShutdown(client, { user = "Owner", reason = "Shutdown manual via Discord" } = {}) {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    await gracefulTeardown(client, { mode: "shutdown", reason, user });

    // Jika proses anak ShardingManager / ClusterManager, beri tahu parent agar tidak me-respawn
    sendToParent({ type: "MANAGER_SHUTDOWN" });

    setTimeout(() => {
      process.exit(0);
    }, 500);
  })();

  return shutdownPromise;
}

/**
 * Menjalankan Graceful Restart.
 * @param {object} client - Discord Client
 * @param {object} [params]
 */
function executeRestart(client, { user = "Owner", reason = "Restart manual via Discord" } = {}) {
  if (restartPromise) return restartPromise;

  restartPromise = (async () => {
    await gracefulTeardown(client, { mode: "restart", reason, user });

    // Kasus A: Jika dijalankan di bawah ShardingManager / ClusterManager (process atau worker-thread)
    const sent = sendToParent({ type: "MANAGER_RESTART" });
    if (sent) {
      setTimeout(() => {
        process.exit(0);
      }, 500);
      return;
    }

    // Kasus B: Standalone mode (hanya jika main thread tanpa parent IPC)
    if (isMainThread) {
      logger.system("[Lifecycle] Meluncurkan proses Node.js baru secara independen...");
      const child = spawn(process.argv[0], process.argv.slice(1), {
        detached: true,
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env,
      });
      child.unref();
    } else {
      logger.warn("[Lifecycle] Melewati spawn detached process karena berjalan di dalam worker thread.");
    }

    setTimeout(() => {
      process.exit(0);
    }, 500);
  })();

  return restartPromise;
}

module.exports = {
  getSystemHealth,
  flushAllData,
  setMaintenanceMode,
  applyMaintenanceLocally,
  gracefulTeardown,
  executeShutdown,
  executeRestart,
  isMaintenanceMode: () => isMaintenance,
  isShuttingDown: () => isShuttingDown,
};
