"use strict";

/**
 * api.js - Router Pusat API Web Dashboard Naura OS (Modular V2).
 *
 * Mengoordinasikan seluruh sub-modul API:
 * - api/telemetry.js: Health, SSE, overview, topology, status, and metrics
 * - api/economy.js: Atomic deposit/withdraw/transfer, leaderboard, stocks, marketplace
 * - api/music.js: Poru state, music control, now-playing, queue, soundboard
 * - api/activity.js: Chat, clan war room, radar, spatial positioning, world POIs, arcade
 * - api/admin.js: Discord token exchange, entitlements webhook, push alerts, system admin
 */

const express = require("express");
const telemetry = require("./api/telemetry");
const economy = require("./api/economy");
const music = require("./api/music");
const activity = require("./api/activity");
const admin = require("./api/admin");
const env = require("../../src/config/env");
const { getDbStatus, sequelize } = require("../../src/managers/dbManager");
const redisManager = require("../../src/managers/redisManager");
const mongoManager = require("../../src/managers/mongoManager");
const metricsManager = require("../../src/managers/metricsManager");
const { logger } = require("../../src/managers/logger");

const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Paksa pemeriksaan dependensi selesai dalam batas waktu ms agar satu
 * dependensi yang lambat atau mati tidak membuat seluruh endpoint terhenti.
 * @param {Promise} promise
 * @param {number} ms
 * @returns {Promise<any>}
 */
function withTimeout(promise, ms) {
  let timer;
  const timeoutReject = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeoutReject]).finally(() => clearTimeout(timer));
}

async function checkDatabase() {
  const start = Date.now();
  try {
    const status = getDbStatus();
    let ok = Boolean(
      status.state === "ready" ||
        status.ready === true ||
        status.online === true ||
        status.connected === true ||
        status.status === "connected",
    );
    let latencyMs = Math.max(1, Date.now() - start);
    if (sequelize) {
      try {
        await withTimeout(sequelize.authenticate(), HEALTH_CHECK_TIMEOUT_MS);
        ok = true;
        latencyMs = Math.max(1, Date.now() - start);
      } catch (e) {
        ok = false;
      }
    }
    return {
      name: "database",
      status: ok ? "healthy" : "unhealthy",
      latencyMs,
      engine: "Supabase / PostgreSQL (Sequelize)",
      detail: status,
    };
  } catch (e) {
    return {
      name: "database",
      status: "unhealthy",
      latencyMs: Math.max(1, Date.now() - start),
      engine: "Supabase / PostgreSQL (Sequelize)",
      error: e.message,
    };
  }
}

async function checkRedis() {
  const start = Date.now();
  try {
    const info = redisManager
      ? redisManager.getStatus()
      : { connected: false, configured: false, mode: "in_memory_fallback" };
    const isReady = Boolean(
      redisManager &&
        (redisManager.isReady === true ||
          (redisManager.client && redisManager.client.isReady === true)),
    );
    return {
      name: "redis",
      status: isReady ? "healthy" : info.configured ? "degraded" : "unhealthy",
      latencyMs: Math.max(1, Date.now() - start),
      mode: info.mode,
      configured: Boolean(info.configured),
      connected: isReady,
    };
  } catch (e) {
    return {
      name: "redis",
      status: "unhealthy",
      latencyMs: Math.max(1, Date.now() - start),
      error: e.message,
    };
  }
}

async function checkMongo() {
  const start = Date.now();
  try {
    const status = mongoManager
      ? mongoManager.getStatus()
      : { state: "disabled", readyState: 0, models: [] };
    const ready =
      status.readyState === 1 ||
      status.state === "ready" ||
      status.connected === true;
    return {
      name: "mongodb",
      status: ready ? "healthy" : status.readyState === 0 ? "standby" : "degraded",
      latencyMs: Math.max(1, Date.now() - start),
      models: Array.isArray(status.models) ? status.models.length : 0,
      readyState: status.readyState,
    };
  } catch (e) {
    return {
      name: "mongodb",
      status: "unhealthy",
      latencyMs: Math.max(1, Date.now() - start),
      error: e.message,
    };
  }
}

async function checkLavalink(client) {
  const start = Date.now();
  const nodes = [];
  const poru = client.poru || (client.musicManager && client.musicManager.poru);
  let total = 0;
  let connected = 0;
  if (poru && poru.nodes) {
    const raw = poru.nodes.values
      ? Array.from(poru.nodes.values())
      : Array.isArray(poru.nodes)
        ? poru.nodes
        : [];
    total = raw.length;
    for (const n of raw) {
      const isConnected = Boolean(n && n.isConnected);
      if (isConnected) connected += 1;
      nodes.push({
        name: n.name || "Lavalink Node",
        host: n.options && n.options.host ? String(n.options.host) : "localhost",
        port: n.options && n.options.port ? Number(n.options.port) : 2333,
        connected: isConnected,
        players: n.players
          ? n.players.size !== undefined
            ? n.players.size
            : Array.isArray(n.players)
              ? n.players.length
              : 0
          : 0,
      });
    }
  }
  const status =
    total === 0
      ? "standby"
      : connected === total
        ? "healthy"
        : connected > 0
          ? "degraded"
          : "unhealthy";
  return {
    name: "lavalink",
    status,
    latencyMs: Math.max(1, Date.now() - start),
    totalNodes: total,
    connectedNodes: connected,
    nodes,
    manager: "Poru Audio Engine v4",
  };
}

async function checkAiProviders() {
  const start = Date.now();
  const providers = [];
  let overall = "healthy";

  const probe = async (name, url, init) => {
    try {
      const res = await withTimeout(fetch(url, init), HEALTH_CHECK_TIMEOUT_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { name, status: "healthy" };
    } catch (e) {
      return { name, status: "unhealthy", error: e.message };
    }
  };

  if (env.GEMINI_API) {
    providers.push(
      await probe(
        "gemini",
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.GEMINI_API)}`,
      ),
    );
  } else {
    providers.push({ name: "gemini", status: "unconfigured" });
    overall = "degraded";
  }

  if (env.GROQ_API_KEY) {
    providers.push(
      await probe("groq", "https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      }),
    );
  } else {
    providers.push({ name: "groq", status: "unconfigured" });
    overall = "degraded";
  }

  if (env.OLLAMA_ENABLED && env.OLLAMA_BASE_URL) {
    providers.push(
      await probe("ollama", `${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/tags`),
    );
  } else {
    providers.push({ name: "ollama", status: "standby" });
  }

  providers.forEach((p) => {
    if (p.status === "unhealthy") overall = "unhealthy";
  });

  return {
    name: "ai",
    status: overall,
    latencyMs: Math.max(1, Date.now() - start),
    providers,
  };
}

async function checkShards(client) {
  const start = Date.now();
  const shard = client.shard || {};
  const ids = Array.isArray(shard.ids)
    ? shard.ids
    : shard.id !== undefined
      ? [shard.id]
      : [0];
  const total = shard.count || ids.length || 1;
  const ping =
    client.ws && typeof client.ws.ping === "number" ? client.ws.ping : null;
  const status = ping === null ? "degraded" : ping < 250 ? "healthy" : "degraded";
  return {
    name: "shards",
    status,
    latencyMs: Math.max(1, Date.now() - start),
    shardIds: ids,
    totalShards: total,
    gatewayPingMs: ping,
  };
}

async function checkMemory() {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const usagePct = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0;
  const status = usagePct > 90 ? "unhealthy" : usagePct > 75 ? "degraded" : "healthy";
  return {
    name: "memory",
    status,
    latencyMs: 0,
    detail: { heapUsedMB, heapTotalMB, rssMB, usagePercent: usagePct },
  };
}

module.exports = function (client) {
  const router = express.Router();

  telemetry.register(router, client);
  economy.register(router, client);
  music.register(router, client);
  activity.register(router, client);
  admin.register(router, client);

  // --- Health Detailed Endpoint ---
  // Melaporkan status tiap dependensi eksternal secara paralel, masing-masing
  // dibungkus try/catch dengan timeout agar satu dependensi down tidak menunda
  // seluruh respons. Data bersumber dari Gateway WebSocket, memori Node.js, dan
  // status DB aktual, bukan metrik buatan.
  router.get("/health/detailed", async (req, res) => {
    const startedAt = Date.now();

    const results = await Promise.allSettled([
      withTimeout(checkDatabase(), HEALTH_CHECK_TIMEOUT_MS),
      withTimeout(checkRedis(), HEALTH_CHECK_TIMEOUT_MS),
      withTimeout(checkMongo(), HEALTH_CHECK_TIMEOUT_MS),
      withTimeout(checkLavalink(client), HEALTH_CHECK_TIMEOUT_MS),
      withTimeout(checkAiProviders(), HEALTH_CHECK_TIMEOUT_MS),
      withTimeout(checkShards(client), HEALTH_CHECK_TIMEOUT_MS),
      withTimeout(checkMemory(), HEALTH_CHECK_TIMEOUT_MS),
    ]);

    const names = [
      "database",
      "redis",
      "mongodb",
      "lavalink",
      "ai",
      "shards",
      "memory",
    ];
    const services = {};
    let overall = "healthy";

    names.forEach((name, i) => {
      const settled = results[i];
      let entry = {
        status: "unhealthy",
        latencyMs: null,
        error: null,
        detail: {},
      };
      if (settled.status === "fulfilled") {
        entry = settled.value;
        entry.status = entry.status || "healthy";
      } else {
        entry.status = "unhealthy";
        entry.error = String(
          (settled.reason && settled.reason.message) || settled.reason,
        );
      }
      if (entry.status === "unhealthy") overall = "unhealthy";
      else if (entry.status === "degraded" && overall === "healthy")
        overall = "degraded";
      services[name] = entry;
    });

    let metrics = null;
    try {
      metrics = await metricsManager.getMetrics();
    } catch {}

    const healthSnapshot = metricsManager.getHealthSnapshot();

    const response = {
      status: overall,
      timestamp: Date.now(),
      latencyMs: Math.max(1, Date.now() - startedAt),
      services,
    };

    if (metrics && metrics.errors) {
      response.errors = metrics.errors;
    }

    response.process = healthSnapshot;

    res.json(response);
  });

  // ------------------------------------------------------------------
  // External API Health Check
  // ------------------------------------------------------------------
  router.get("/api/health/external", async (req, res) => {
    try {
      const apiHealthService = require("../../src/services/apiHealthService");
      const report = await apiHealthService.runHealthCheck();
      res.json(report);
    } catch (err) {
      logger.error("[API External Health] Error:", err);
      res.status(500).json({ error: "Failed to run health check" });
    }
  });

  router.get("/api/health/circuit-breakers", async (req, res) => {
    try {
      const { getAllBreakers } = require("../../src/utils/circuitBreaker");
      const breakers = getAllBreakers();
      res.json({ circuitBreakers: breakers });
    } catch (err) {
      logger.error("[API Circuit Breakers] Error:", err);
      res.status(500).json({ error: "Failed to get circuit breaker status" });
    }
  });

  return router;
};

