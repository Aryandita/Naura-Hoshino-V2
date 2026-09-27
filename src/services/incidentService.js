"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { logger } = require("../managers/logger");
const mongoManager = require("../managers/mongoManager");
const redisManager = require("../managers/redisManager");
const { sequelize } = require("../managers/dbManager");
const redisLockHelper = require("../utils/redisLockHelper");

// State in-memory (tersedia instan jika Redis offline)
const inMemoryMaintenance = {
  active: false,
  reason: "Pemeliharaan sistem berkala",
  toggledBy: null,
  timestamp: null,
};

const inMemoryKillSwitches = new Map();
const activePanicLockdowns = new Map();

// ==========================================
// 1. GLOBAL EMERGENCY MAINTENANCE
// ==========================================

async function setGlobalMaintenance(active, reason = "Pemeliharaan sistem berkala", toggledBy = "Owner") {
  const isSettingActive = Boolean(active);
  inMemoryMaintenance.active = isSettingActive;
  inMemoryMaintenance.reason = String(reason).trim();
  inMemoryMaintenance.toggledBy = toggledBy;
  inMemoryMaintenance.timestamp = new Date();

  if (redisManager?.isReady) {
    try {
      await redisManager.client.set(
        "system:maintenance:global",
        JSON.stringify(inMemoryMaintenance),
      );
    } catch (err) {
      logger.warn(`[IncidentService] Gagal simpan status maintenance di Redis: ${err.message}`);
    }
  }

  logger.warn(
    `[IncidentService] Global Maintenance diatur ke: ${isSettingActive ? "AKTIF" : "NONAKTIF"} oleh ${toggledBy} (Alasan: ${reason})`,
  );
  return inMemoryMaintenance;
}

async function getGlobalMaintenance() {
  if (redisManager?.isReady) {
    try {
      const data = await redisManager.client.get("system:maintenance:global");
      if (data) {
        const parsed = JSON.parse(data);
        inMemoryMaintenance.active = parsed.active;
        inMemoryMaintenance.reason = parsed.reason;
        inMemoryMaintenance.toggledBy = parsed.toggledBy;
        inMemoryMaintenance.timestamp = parsed.timestamp;
      }
    } catch (err) {
      logger.warn(`[IncidentService] Gagal membaca status maintenance di Redis: ${err.message}`);
    }
  }

  return inMemoryMaintenance;
}

function isGlobalMaintenanceActive() {
  return inMemoryMaintenance.active;
}

// ==========================================
// 2. MODULE KILL-SWITCH
// ==========================================

async function setModuleKillSwitch(moduleName, disabled, toggledBy = "Owner") {
  if (!moduleName) return false;
  const key = String(moduleName).toLowerCase().trim();
  const isDisabled = Boolean(disabled);

  inMemoryKillSwitches.set(key, {
    disabled: isDisabled,
    toggledBy,
    timestamp: new Date(),
  });

  if (redisManager?.isReady) {
    try {
      await redisManager.client.set(
        `system:killswitch:${key}`,
        JSON.stringify({ disabled: isDisabled, toggledBy, timestamp: new Date() }),
      );
    } catch (err) {
      logger.warn(`[IncidentService] Gagal simpan killswitch di Redis: ${err.message}`);
    }
  }

  logger.warn(
    `[IncidentService] Module Kill-Switch "${key}" diatur ke: ${isDisabled ? "MATI" : "AKTIF"} oleh ${toggledBy}`,
  );
  return isDisabled;
}

function isModuleKilled(moduleName) {
  if (!moduleName) return false;
  const key = String(moduleName).toLowerCase().trim();
  const state = inMemoryKillSwitches.get(key);
  return Boolean(state && state.disabled);
}

function listKilledModules() {
  const result = [];
  for (const [mod, val] of inMemoryKillSwitches.entries()) {
    if (val.disabled) {
      result.push({ module: mod, toggledBy: val.toggledBy, timestamp: val.timestamp });
    }
  }
  return result;
}

// ==========================================
// 3. 6-PILLAR DOCTOR HEALTH DIAGNOSTIC
// ==========================================

async function runDoctorDiagnostic(client = null) {
  const startTime = Date.now();
  const report = {
    timestamp: new Date(),
    overallStatus: "ALL_SYSTEMS_OPERATIONAL",
    pillars: {},
  };

  // 1. PostgreSQL (Supabase)
  try {
    const t0 = performance.now();
    await sequelize.authenticate();
    const pgLatency = Math.round(performance.now() - t0);
    report.pillars.relationalDb = {
      name: "Supabase / PostgreSQL",
      status: "UP",
      latencyMs: pgLatency,
      dialect: sequelize.getDialect(),
    };
  } catch (err) {
    report.pillars.relationalDb = {
      name: "Supabase / PostgreSQL",
      status: "DOWN",
      error: err.message,
    };
    report.overallStatus = "CRITICAL_OUTAGE";
  }

  // 2. MongoDB Atlas
  try {
    if (mongoManager?.isReady) {
      const t0 = performance.now();
      report.pillars.mongoDb = {
        name: "MongoDB Atlas",
        status: "UP",
        latencyMs: Math.round(performance.now() - t0),
      };
    } else {
      report.pillars.mongoDb = {
        name: "MongoDB Atlas",
        status: "DEGRADED",
        note: "Koneksi offline, menggunakan memory fallback",
      };
      if (report.overallStatus === "ALL_SYSTEMS_OPERATIONAL") {
        report.overallStatus = "DEGRADED_PERFORMANCE";
      }
    }
  } catch (err) {
    report.pillars.mongoDb = {
      name: "MongoDB Atlas",
      status: "DOWN",
      error: err.message,
    };
    if (report.overallStatus === "ALL_SYSTEMS_OPERATIONAL") {
      report.overallStatus = "DEGRADED_PERFORMANCE";
    }
  }

  // 3. Redis Cache & Distributed Lock
  try {
    if (redisManager?.isReady) {
      const t0 = performance.now();
      await redisManager.client.ping();
      const redisLatency = Math.round(performance.now() - t0);
      report.pillars.redis = {
        name: "Redis Distributed Mutex",
        status: "UP",
        latencyMs: redisLatency,
        lockStats: redisLockHelper.getLockStats ? redisLockHelper.getLockStats() : null,
      };
    } else {
      report.pillars.redis = {
        name: "Redis Cache System",
        status: "DEGRADED",
        note: "Offline, menggunakan fallback memory mutex",
        lockStats: redisLockHelper.getLockStats ? redisLockHelper.getLockStats() : null,
      };
      if (report.overallStatus === "ALL_SYSTEMS_OPERATIONAL") {
        report.overallStatus = "DEGRADED_PERFORMANCE";
      }
    }
  } catch (err) {
    report.pillars.redis = {
      name: "Redis Cache System",
      status: "DOWN",
      error: err.message,
    };
  }

  // 4. Lavalink Audio Cluster
  try {
    const lavalinkClusterManager = require("../managers/lavalinkClusterManager");
    const nodeStatus = lavalinkClusterManager?.getStatus ? lavalinkClusterManager.getStatus() : null;
    report.pillars.audio = {
      name: "Lavalink Audio Cluster",
      status: "UP",
      details: nodeStatus || "Cluster active",
    };
  } catch (_) {
    report.pillars.audio = {
      name: "Lavalink Audio Cluster",
      status: "DEGRADED",
      note: "Audio cluster metrics unreadable",
    };
  }

  // 5. Canvas Worker Threads
  try {
    const canvasWorkerPool = require("../canvas/canvasWorkerPool");
    report.pillars.canvas = {
      name: "Canvas Worker Pool",
      status: canvasWorkerPool?.isReady !== false ? "UP" : "DEGRADED",
      poolSize: canvasWorkerPool?.workerCount || 2,
    };
  } catch (_) {
    report.pillars.canvas = {
      name: "Canvas Worker Pool",
      status: "UP",
    };
  }

  // 6. Discord Gateway
  if (client) {
    const wsPing = client.ws?.ping ?? -1;
    report.pillars.gateway = {
      name: "Discord Gateway WebSocket",
      status: wsPing >= 0 && wsPing < 400 ? "UP" : "DEGRADED",
      pingMs: wsPing,
      guilds: client.guilds?.cache?.size || 0,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  report.totalDurationMs = Date.now() - startTime;
  return report;
}

// ==========================================
// 4. RECENT ERROR LOGS INSPECTOR
// ==========================================

function getRecentLogs(limit = 15) {
  const logDir = path.join(__dirname, "../../logs");
  const errorLogPath = path.join(logDir, "error.log");

  if (!fs.existsSync(errorLogPath)) {
    return ["Tidak ada file error.log yang ditemukan di direktori logs/."];
  }

  try {
    const content = fs.readFileSync(errorLogPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    return lines.slice(-limit);
  } catch (err) {
    return [`Gagal membaca log: ${err.message}`];
  }
}

// ==========================================
// 5. PLAYER STUCK-STATE AUTO-REPAIR
// ==========================================

async function repairPlayerState(userId, repairedBy = "Admin") {
  if (!userId) {
    return { success: false, message: "User ID diperlukan." };
  }

  let locksReleased = 0;
  // Periksa dan bersihkan in-memory locks yang melibatkan userId
  if (redisLockHelper._inMemoryLocks) {
    for (const [key] of redisLockHelper._inMemoryLocks.entries()) {
      if (key.includes(userId)) {
        redisLockHelper._inMemoryLocks.delete(key);
        locksReleased++;
      }
    }
  }

  logger.info(
    `[IncidentService] Player state repair dijalankan untuk ${userId} oleh ${repairedBy}. Locks released: ${locksReleased}`,
  );

  return {
    success: true,
    userId,
    locksReleased,
    repairedBy,
    timestamp: new Date(),
  };
}

// ==========================================
// 6. SERVER RAID EMERGENCY PANIC BUTTON
// ==========================================

async function activatePanicLockdown(guild, activatedBy = "Admin") {
  if (!guild) {
    throw new Error("Guild tidak ditemukan.");
  }

  const previousPermissions = [];
  let affectedChannels = 0;

  for (const [, channel] of guild.channels.cache) {
    if (channel.isTextBased() && !channel.isThread()) {
      try {
        const everyoneOverwrites = channel.permissionOverwrites?.cache?.get(guild.id);
        const prevAllow = everyoneOverwrites?.allow?.bitfield?.toString() || "0";
        const prevDeny = everyoneOverwrites?.deny?.bitfield?.toString() || "0";
        const prevSlowmode = channel.rateLimitPerUser || 0;

        previousPermissions.push({
          channelId: channel.id,
          prevAllow,
          prevDeny,
          prevSlowmode,
        });

        // Terapkan penolakan kirim pesan dan slowmode 15 detik
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });

        if (channel.setRateLimitPerUser) {
          await channel.setRateLimitPerUser(15);
        }

        affectedChannels++;
      } catch (err) {
        logger.warn(`[PanicLockdown] Gagal mengunci channel ${channel.name}: ${err.message}`);
      }
    }
  }

  activePanicLockdowns.set(guild.id, {
    activatedBy,
    activatedAt: new Date(),
    previousPermissions,
  });

  logger.warn(
    `[PanicLockdown] Server ${guild.name} (${guild.id}) dikunci darurat oleh ${activatedBy} (${affectedChannels} channel terdampak).`,
  );

  return {
    success: true,
    affectedChannels,
    activatedBy,
  };
}

async function restorePanicLockdown(guild, restoredBy = "Admin") {
  if (!guild) {
    throw new Error("Guild tidak ditemukan.");
  }

  const savedData = activePanicLockdowns.get(guild.id);
  let restoredChannels = 0;

  if (savedData && Array.isArray(savedData.previousPermissions)) {
    for (const item of savedData.previousPermissions) {
      try {
        const channel = guild.channels.cache.get(item.channelId);
        if (channel) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: null,
            SendMessagesInThreads: null,
            CreatePublicThreads: null,
            CreatePrivateThreads: null,
          });

          if (channel.setRateLimitPerUser) {
            await channel.setRateLimitPerUser(item.prevSlowmode || 0);
          }
          restoredChannels++;
        }
      } catch (err) {
        logger.warn(`[PanicLockdown] Gagal memulihkan channel ${item.channelId}: ${err.message}`);
      }
    }
    activePanicLockdowns.delete(guild.id);
  }

  logger.info(
    `[PanicLockdown] Server ${guild.name} (${guild.id}) dipulihkan dari panic mode oleh ${restoredBy} (${restoredChannels} channel).`,
  );

  return {
    success: true,
    restoredChannels,
    restoredBy,
  };
}

module.exports = {
  setGlobalMaintenance,
  getGlobalMaintenance,
  isGlobalMaintenanceActive,
  setModuleKillSwitch,
  isModuleKilled,
  listKilledModules,
  runDoctorDiagnostic,
  getRecentLogs,
  repairPlayerState,
  activatePanicLockdown,
  restorePanicLockdown,
  _inMemoryMaintenance: inMemoryMaintenance,
  _inMemoryKillSwitches: inMemoryKillSwitches,
  _activePanicLockdowns: activePanicLockdowns,
};
