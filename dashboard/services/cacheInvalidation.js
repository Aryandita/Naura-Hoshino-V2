"use strict";

const eventBus = require("../../src/core/eventBus");
const redisManager = require("../../src/managers/redisManager");
const { logger } = require("../../src/managers/logger");

const CACHE_TTL_POLICIES = {
  "user:profile:*": { ttl: 3600, strategy: "event-driven" },
  "user:survival:*": { ttl: 1800, strategy: "event-driven" },
  "guild:settings:*": { ttl: 300, strategy: "time-based" },
  "leaderboard:*": { ttl: 60, strategy: "time-based" },
  "music:state:*": { ttl: 30, strategy: "event-driven" },
  "economy:market:*": { ttl: 300, strategy: "hybrid" },
};

const INVALIDATION_EVENTS = {
  "economy:transaction": ["user:profile:*", "leaderboard:*"],
  "economy:transfer": ["user:profile:*", "leaderboard:*"],
  "survival:update": ["user:survival:*"],
  "survival:inventory": ["user:survival:*"],
  "music:state:change": ["music:state:*"],
  "guild:settings:update": ["guild:settings:*"],
  "cache:force:invalidate": ["*"],
};

class CacheInvalidationService {
  constructor(options = {}) {
    this.realtimeBridge = options.realtimeBridge || null;
    this._setupEventListeners();
    this._startTTLRefreshLoop();
  }

  _setupEventListeners() {
    for (const [eventName, patterns] of Object.entries(INVALIDATION_EVENTS)) {
      eventBus.on(eventName, async (data) => {
        await this._handleInvalidation(eventName, patterns, data);
      });
    }
  }

  async _handleInvalidation(eventName, patterns, data) {

    for (const pattern of patterns) {
      try {
        if (pattern === "*") {
          await this._invalidateAll();
        } else if (pattern.endsWith(":*")) {
          const prefix = pattern.slice(0, -1);
          const specificKey = this._resolveSpecificKey(prefix, data);
          if (specificKey) {
            await this._invalidateKey(specificKey);
          } else {
            await this._invalidatePattern(prefix);
          }
        } else {
          await this._invalidateKey(pattern);
        }

        logger.debug(`[CacheInvalidation] ${eventName} -> invalidated ${pattern}`);
      } catch (err) {
        logger.error(`[CacheInvalidation] Failed to invalidate ${pattern}: ${err.message}`);
      }
    }

    if (this.realtimeBridge) {
      this.realtimeBridge.invalidateCache(patterns.join(","), eventName);
    }
  }

  _resolveSpecificKey(prefix, data) {
    if (prefix === "user:profile:" && data.userId) {
      return `user:profile:${data.userId}`;
    }
    if (prefix === "user:survival:" && data.userId) {
      return `user:survival:${data.userId}`;
    }
    if (prefix === "guild:settings:" && data.guildId) {
      return `guild:settings:${data.guildId}`;
    }
    if (prefix === "music:state:" && data.guildId) {
      return `music:state:${data.guildId}`;
    }
    return null;
  }

  async _invalidateKey(key) {
    await redisManager.deleteCache(key);
  }

  async _invalidatePattern(prefix) {
    try {
      const keys = await redisManager.getKeysByPattern(`${prefix}*`);
      if (keys && keys.length > 0) {
        await redisManager.deleteMultiple(keys);
        logger.debug(`[CacheInvalidation] Deleted ${keys.length} keys matching ${prefix}*`);
      }
    } catch (err) {
      logger.warn(`[CacheInvalidation] Pattern delete failed for ${prefix}: ${err.message}`);
    }
  }

  async _invalidateAll() {
    try {
      await redisManager.flushAll();
      logger.info("[CacheInvalidation] Full cache flush executed");
    } catch (err) {
      logger.error(`[CacheInvalidation] Full flush failed: ${err.message}`);
    }
  }

  _startTTLRefreshLoop() {
    const REFRESH_INTERVAL_MS = 60_000;

    setInterval(async () => {
      try {
        const timeBasedPatterns = Object.entries(CACHE_TTL_POLICIES)
          .filter(([, policy]) => policy.strategy === "time-based" || policy.strategy === "hybrid")
          .map(([pattern]) => pattern);

        for (const pattern of timeBasedPatterns) {
          const prefix = pattern.endsWith(":*") ? pattern.slice(0, -1) : pattern;
          const keys = await redisManager.getKeysByPattern(`${prefix}*`);

          if (keys && keys.length > 0) {
            for (const key of keys) {
              const ttl = await redisManager.getTTL(key);
              if (ttl !== null && ttl < 0) {
                await redisManager.deleteCache(key);
              }
            }
          }
        }
      } catch (err) {
        logger.debug(`[CacheInvalidation] TTL refresh error: ${err.message}`);
      }
    }, REFRESH_INTERVAL_MS).unref();
  }

  getPolicyForPattern(pattern) {
    for (const [key, policy] of Object.entries(CACHE_TTL_POLICIES)) {
      if (key === pattern || (key.endsWith(":*") && pattern.startsWith(key.slice(0, -1)))) {
        return policy;
      }
    }
    return { ttl: 300, strategy: "time-based" };
  }

  async forceInvalidate(pattern) {
    eventBus.emit("cache:force:invalidate", { pattern, timestamp: Date.now() }, { broadcast: true });
  }
}

module.exports = CacheInvalidationService;
