"use strict";

const fs = require("node:fs");
const path = require("node:path");
const redisManager = require("../../../src/managers/redisManager");

let pluginStatsCache = null;
let lastPluginScan = 0;

function scanPluginDirectory() {
  const now = Date.now();
  if (pluginStatsCache && now - lastPluginScan < 60000) {
    return pluginStatsCache;
  }
  try {
    const pluginDir = path.join(__dirname, "..", "..", "..", "plugin");
    const categories = fs.readdirSync(pluginDir).filter((d) => {
      try {
        return fs.statSync(path.join(pluginDir, d)).isDirectory();
      } catch (_) {
        return false;
      }
    });

    let totalCommands = 0;
    const categoryCounts = {};

    for (const cat of categories) {
      const files = fs
        .readdirSync(path.join(pluginDir, cat))
        .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js"));
      categoryCounts[cat] = files.length;
      totalCommands += files.length;
    }

    const categoryDistribution = Object.entries(categoryCounts)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalCommands > 0 ? Math.round((count / totalCommands) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    pluginStatsCache = {
      totalModules: categories.length,
      totalCommands,
      categoryDistribution,
    };
    lastPluginScan = now;
    return pluginStatsCache;
  } catch (_) {
    return {
      totalModules: 13,
      totalCommands: 55,
      categoryDistribution: [],
    };
  }
}

// Helper validasi URL aman untuk mencegah Server-Side Request Forgery (SSRF)
function isSafeWebhookUrl(inputUrl) {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0"
    )
      return false;
    if (
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".lan")
    )
      return false;
    if (host === "169.254.169.254" || host.startsWith("169.254.")) return false;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return false;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

// ------------------------------------------------------------------
// State Konsolidasi Redis & In-Memory Fallback (Task 3)
// ------------------------------------------------------------------

// Arcade Cooldown & Daily Cap
const memoryArcadeCooldowns = new Map();
const memoryArcadeDailyRecords = new Map();
const ARCADE_COOLDOWN_MS = 20 * 1000;
const ARCADE_DAILY_CAP = 500;

const arcadeState = {
  COOLDOWN_MS: ARCADE_COOLDOWN_MS,
  DAILY_CAP: ARCADE_DAILY_CAP,

  async getCooldown(userId) {
    if (redisManager && redisManager.isReady) {
      const val = await redisManager.getCache(`arcade:cd:${userId}`);
      if (val !== null && val !== undefined) return Number(val);
    }
    return memoryArcadeCooldowns.get(userId) || 0;
  },

  async setCooldown(userId, timestamp, ttlMs = ARCADE_COOLDOWN_MS) {
    memoryArcadeCooldowns.set(userId, timestamp);
    if (redisManager && redisManager.isReady) {
      await redisManager.setCache(
        `arcade:cd:${userId}`,
        timestamp,
        Math.ceil(ttlMs / 1000),
      );
    }
  },

  async getDaily(userId, today) {
    if (redisManager && redisManager.isReady) {
      const val = await redisManager.getCache(`arcade:daily:${today}:${userId}`);
      if (val) return val;
    }
    const mem = memoryArcadeDailyRecords.get(userId);
    if (mem && mem.date === today) return mem;
    return { date: today, claimed: 0 };
  },

  async setDaily(userId, dailyRecord) {
    memoryArcadeDailyRecords.set(userId, dailyRecord);
    if (redisManager && redisManager.isReady) {
      await redisManager.setCache(
        `arcade:daily:${dailyRecord.date}:${userId}`,
        dailyRecord,
        86400,
      );
    }
  },
};

// Web Push Subscriptions
const MAX_PUSH_SUBSCRIPTIONS = 1000;
const memoryPushSubscriptions = new Map();

const pushState = {
  MAX_SUBSCRIPTIONS: MAX_PUSH_SUBSCRIPTIONS,

  async hasSubscription(userId) {
    if (memoryPushSubscriptions.has(userId)) return true;
    if (redisManager && redisManager.isReady) {
      const cached = await redisManager.getCache(`push:sub:${userId}`);
      return Boolean(cached);
    }
    return false;
  },

  async getSubscription(userId) {
    const mem = memoryPushSubscriptions.get(userId);
    if (mem) return mem;
    if (redisManager && redisManager.isReady) {
      return await redisManager.getCache(`push:sub:${userId}`);
    }
    return null;
  },

  async setSubscription(userId, subscription) {
    if (
      memoryPushSubscriptions.size >= MAX_PUSH_SUBSCRIPTIONS &&
      !memoryPushSubscriptions.has(userId)
    ) {
      const oldestKey = memoryPushSubscriptions.keys().next().value;
      memoryPushSubscriptions.delete(oldestKey);
    }
    memoryPushSubscriptions.set(userId, subscription);
    if (redisManager && redisManager.isReady) {
      await redisManager.setCache(
        `push:sub:${userId}`,
        subscription,
        30 * 86400,
      );
    }
  },

  async getSubscribersCount() {
    return memoryPushSubscriptions.size;
  },

  async getAllSubscriptions() {
    return Array.from(memoryPushSubscriptions.entries()).map(([userId, subData]) => ({
      userId,
      ...(subData || {}),
    }));
  },

  async deleteSubscription(userId) {
    memoryPushSubscriptions.delete(userId);
    if (redisManager && redisManager.isReady) {
      await redisManager.deleteCache(`push:sub:${userId}`);
    }
  },
};

async function resolveUsername(client, userId) {
  if (!userId) return "Explorer";
  if (client?.users?.cache?.has(userId)) {
    return client.users.cache.get(userId).username;
  }
  try {
    const u = await client?.users?.fetch(userId);
    if (u) return u.username;
  } catch (_) {}
  return `Petualang #${String(userId).slice(-4)}`;
}

module.exports = {
  scanPluginDirectory,
  isSafeWebhookUrl,
  arcadeState,
  pushState,
  resolveUsername,
};

