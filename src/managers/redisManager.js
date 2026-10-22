const { createClient } = require("redis");
const { logger } = require("../managers/logger");

// ==========================================
// KONFIGURASI RETRY DENGAN EXPONENTIAL BACKOFF
// 3 percobaan, jeda 2s, 4s, 8s antara percobaan.
// ==========================================
const RETRY_MAX = 3;
const BACKOFF_SEQUENCE_MS = [2000, 4000, 8000];

// Script Lua untuk pelepasan lock atomik: hanya hapus jika token cocok
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Jalankan fungsi async dengan retry exponential backoff.
 * Saat semua percobaan gagal, error terakhir dilempar untuk ditangani
 * pemanggil (biasanya diarahkan ke fallback in-memory).
 * @param {Function} fn - Fungsi async yang akan diulang.
 * @param {Object} [options]
 * @param {number} [options.max=RETRY_MAX] Jumlah percobaan maksimal.
 * @param {string} [options.label] Label untuk log.
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, options = {}) {
  const max = options.max ?? RETRY_MAX;
  const label = options.label ?? "operasi Redis";
  let lastErr;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < max - 1) {
        const delay =
          BACKOFF_SEQUENCE_MS[attempt] ??
          BACKOFF_SEQUENCE_MS[BACKOFF_SEQUENCE_MS.length - 1];
        logger.warn(
          `[Redis] ${label} gagal (percobaan ${attempt + 1}/${max}), retry dalam ${delay}ms: ${err.message}`,
        );
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

class RedisManager {
  constructor() {
    const redisUrl = require("../config/env").REDIS_URL;
    if (!redisUrl) {
      this.client = null;
      this.memoryCache = new Map();
      this.memoryLocks = new Map();
      return;
    }

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          const jitter = Math.floor(Math.random() * 200);
          const delay = Math.min(retries * 500 + jitter, 15000);
          if (retries % 5 === 0) {
            logger.warn(
              `[Redis] Percobaan reconnect #${retries} (${delay}ms)... Fallback in-memory tetap aktif.`,
            );
          }
          return delay;
        },
        connectTimeout: 10000,
        keepAlive: 30000,
      },
    });

    this.client.on("error", (err) =>
      logger.warn("[Redis] Connection error:", err.message),
    );
    this.client.on("connect", () =>
      logger.success("[Redis] Terhubung ke Redis Cache System."),
    );
    this.client.on("reconnecting", () =>
      logger.warn("[Redis] Mencoba reconnect ke Redis..."),
    );

    this.memoryCache = new Map();
    this.memoryLocks = new Map();

    this.client.hincrby = (...args) => {
      if (typeof this.client.hIncrBy === "function") {
        return this.client.hIncrBy(...args);
      }
    };
    this.client.hgetall = (...args) => {
      if (typeof this.client.hGetAll === "function") {
        return this.client.hGetAll(...args);
      }
    };
    this.client.hset = (...args) => {
      if (typeof this.client.hSet === "function") {
        return this.client.hSet(...args);
      }
    };
    this.client.hget = (...args) => {
      if (typeof this.client.hGet === "function") {
        return this.client.hGet(...args);
      }
    };
    this.client.zadd = (key, score, value) => {
      if (typeof this.client.zAdd === "function") {
        return this.client.zAdd(key, [{ score: Number(score), value: String(value) }]);
      }
    };

    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiry && now > entry.expiry) {
          this.memoryCache.delete(key);
        }
      }
      for (const [key, lock] of this.memoryLocks.entries()) {
        if (lock.expiry && now > lock.expiry) {
          this.memoryLocks.delete(key);
        }
      }
    }, 60000);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  get isReady() {
    return Boolean(this.client && this.client.isReady);
  }

  getStatus() {
    return {
      connected: this.isReady,
      configured: Boolean(this.client),
      mode: this.isReady ? "redis_cluster" : "in_memory_fallback",
      memoryCacheSize: this.memoryCache ? this.memoryCache.size : 0,
      memoryLockSize: this.memoryLocks ? this.memoryLocks.size : 0,
    };
  }

  _memoryGet(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value;
  }

  _memorySet(key, value, ttlSeconds) {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
    this.memoryCache.set(key, { value, expiry });
    return "OK";
  }

  _memoryDel(key) {
    const existed = this.memoryCache.has(key);
    this.memoryCache.delete(key);
    return existed ? 1 : 0;
  }

  _memoryIncrement(key, ttlSeconds) {
    const now = Date.now();
    const entry = this.memoryCache.get(key);
    let value = 1;
    if (entry && (!entry.expiry || now <= entry.expiry)) {
      value = Number(entry.value || 0) + 1;
    }
    const expiry = ttlSeconds ? now + ttlSeconds * 1000 : 0;
    this.memoryCache.set(key, { value, expiry });
    return value;
  }

  _memoryGetTtl(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return -2;
    if (!entry.expiry) return -1;
    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  _memoryAcquireLock(key, token, ttlMs) {
    const now = Date.now();
    const existing = this.memoryLocks.get(key);
    if (!existing || existing.expiry <= now) {
      this.memoryLocks.set(key, { token, expiry: now + ttlMs });
      return true;
    }
    return false;
  }

  _memoryReleaseLock(key, token) {
    const existing = this.memoryLocks.get(key);
    if (existing && existing.token === token) {
      this.memoryLocks.delete(key);
      return true;
    }
    return false;
  }

  async ping() {
    if (!this.isReady) return false;
    try {
      const res = await this.client.ping();
      return res === "PONG";
    } catch (e) {
      return false;
    }
  }

  async disconnect() {
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch (e) {
        logger.warn("[redisManager:disconnect] Operasi cache Redis gagal: " + (e?.message || e));
      }
    }
    if (this.client) {
      try {
        await this.client.quit();
        logger.info("[Redis] Koneksi Redis ditutup dengan aman.");
      } catch (e) {
        logger.warn("[redisManager:disconnect] Operasi cache Redis gagal: " + (e?.message || e));
      }
    }
  }

  async connect() {
    if (!this.client) return;
    try {
      await retryWithBackoff(() => this.client.connect(), {
        label: "koneksi Redis",
      });
    } catch (error) {
      logger.warn(
        "[Redis] Gagal terhubung ke Redis setelah 3 percobaan, sistem cache berjalan dalam mode memori fallback.",
      );
    }
  }

  async setCache(key, data, expirationInSeconds = 3600) {
    if (this.isReady) {
      try {
        await retryWithBackoff(
          () =>
            this.client.setEx(
              key,
              expirationInSeconds,
              JSON.stringify(data),
            ),
          { label: `setCache ${key}` },
        );
        return "OK";
      } catch (error) {
        logger.error(
          "[Redis] Gagal menyimpan cache setelah retry:",
          error.message,
        );
        return this._memorySet(key, data, expirationInSeconds);
      }
    }
    return this._memorySet(key, data, expirationInSeconds);
  }

  async getCache(key) {
    if (this.isReady) {
      try {
        const raw = await retryWithBackoff(() => this.client.get(key), {
          label: `getCache ${key}`,
        });
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch (parseErr) {
          logger.error("[Redis] Gagal parse cache JSON:", parseErr.message);
          return null;
        }
      } catch (error) {
        logger.error("[Redis] Gagal membaca cache setelah retry:", error.message);
        return this._memoryGet(key);
      }
    }
    return this._memoryGet(key);
  }

  async zAdd(key, score, value) {
    if (this.isReady) {
      try {
        return await retryWithBackoff(
          () =>
            this.client.zAdd(key, [{ score: Number(score), value: String(value) }]),
          { label: `zAdd ${key}` },
        );
      } catch (error) {
        logger.error("[Redis] Gagal menjalankan zAdd setelah retry:", error.message);
        return null;
      }
    }
    return null;
  }

  async zRevRangeWithScores(key, start = 0, stop = -1) {
    if (this.isReady) {
      try {
        return await retryWithBackoff(
          () => this.client.zRangeWithScores(key, start, stop, { REV: true }),
          { label: `zRevRangeWithScores ${key}` },
        );
      } catch (error) {
        logger.error("[Redis] Gagal membaca zRevRangeWithScores:", error.message);
        return [];
      }
    }
    return [];
  }

  async zCard(key) {
    if (this.isReady) {
      try {
        return await retryWithBackoff(() => this.client.zCard(key), {
          label: `zCard ${key}`,
        });
      } catch (error) {
        logger.error("[Redis] Gagal membaca zCard:", error.message);
        return 0;
      }
    }
    return 0;
  }

  async zScore(key, member) {
    if (this.isReady) {
      try {
        return await retryWithBackoff(() => this.client.zScore(key, String(member)), {
          label: `zScore ${key}`,
        });
      } catch (error) {
        logger.error("[Redis] Gagal membaca zScore:", error.message);
        return null;
      }
    }
    return null;
  }

  async zRevRank(key, member) {
    if (this.isReady) {
      try {
        return await retryWithBackoff(() => this.client.zRevRank(key, String(member)), {
          label: `zRevRank ${key}`,
        });
      } catch (error) {
        logger.error("[Redis] Gagal membaca zRevRank:", error.message);
        return null;
      }
    }
    return null;
  }

  async deleteCache(key) {
    if (this.isReady) {
      try {
        await retryWithBackoff(() => this.client.del(key), {
          label: `deleteCache ${key}`,
        });
        return;
      } catch (error) {
        logger.error("[Redis] Gagal menghapus cache setelah retry:", error.message);
        this._memoryDel(key);
        return;
      }
    }
    this._memoryDel(key);
  }

  async deleteByPattern(pattern) {
    if (this.isReady) {
      try {
        const keys = [];
        for await (const key of this.client.scanIterator({
          MATCH: pattern,
          COUNT: 100,
        })) {
          keys.push(key);
        }
        if (keys.length > 0) {
          await retryWithBackoff(() => this.client.del(keys), {
            label: `deleteByPattern ${pattern}`,
          });
        }
        return;
      } catch (error) {
        logger.error(
          "[Redis] Gagal menghapus cache dengan pattern setelah retry:",
          error.message,
        );
        return;
      }
    }
    return;
  }

  async increment(key, expirationInSeconds) {
    if (this.isReady) {
      try {
        const value = await retryWithBackoff(() => this.client.incr(key), {
          label: `increment ${key}`,
        });
        if (value === 1 && expirationInSeconds) {
          try {
            await this.client.expire(key, expirationInSeconds);
          } catch (expireErr) {
            logger.error("[Redis] Gagal pasang TTL counter:", expireErr.message);
          }
        }
        return value;
      } catch (error) {
        logger.error(
          "[Redis] Gagal menaikkan counter setelah retry:",
          error.message,
        );
        return this._memoryIncrement(key, expirationInSeconds);
      }
    }
    return this._memoryIncrement(key, expirationInSeconds);
  }

  async getTtl(key) {
    if (this.isReady) {
      try {
        return await retryWithBackoff(() => this.client.ttl(key), {
          label: `getTtl ${key}`,
        });
      } catch (error) {
        logger.error("[Redis] Gagal membaca TTL:", error.message);
        return this._memoryGetTtl(key);
      }
    }
    return this._memoryGetTtl(key);
  }

  async getOrSetCache(key, expirationInSeconds, fetchFunction) {
    try {
      const cachedData = await this.getCache(key);
      if (cachedData) return cachedData;

      const freshData = await fetchFunction();
      if (freshData) {
        await this.setCache(key, freshData, expirationInSeconds);
      }
      return freshData;
    } catch (error) {
      logger.error("[Redis] Gagal eksekusi getOrSetCache:", error.message);
      return await fetchFunction();
    }
  }

  async lpush(key, value) {
    if (this.isReady) {
      try {
        if (typeof this.client.lPush === "function") {
          return await retryWithBackoff(
            () => this.client.lPush(key, value),
            { label: `lpush ${key}` },
          );
        }
        return await retryWithBackoff(
          () => this.client.lpush(key, value),
          { label: `lpush ${key}` },
        );
      } catch (err) {
        logger.error("[Redis] lpush error:", err.message);
        return 0;
      }
    }
    return 0;
  }

  async ltrim(key, start, stop) {
    if (this.isReady) {
      try {
        if (typeof this.client.lTrim === "function") {
          return await retryWithBackoff(
            () => this.client.lTrim(key, start, stop),
            { label: `ltrim ${key}` },
          );
        }
        return await retryWithBackoff(
          () => this.client.ltrim(key, start, stop),
          { label: `ltrim ${key}` },
        );
      } catch (err) {
        logger.error("[Redis] ltrim error:", err.message);
        return null;
      }
    }
    return null;
  }

  async lrange(key, start, stop) {
    if (this.isReady) {
      try {
        if (typeof this.client.lRange === "function") {
          return await retryWithBackoff(
            () => this.client.lRange(key, start, stop),
            { label: `lrange ${key}` },
          );
        }
        return await retryWithBackoff(
          () => this.client.lrange(key, start, stop),
          { label: `lrange ${key}` },
        );
      } catch (err) {
        logger.error("[Redis] lrange error:", err.message);
        return [];
      }
    }
    return [];
  }

  async get(key) {
    return this.getCache(key);
  }

  async set(key, value, ...args) {
    let ttl = 3600;
    if (args.length >= 2 && typeof args[0] === "string" && args[0].toUpperCase() === "EX") {
      ttl = Number(args[1]) || 3600;
    } else if (typeof args[0] === "number") {
      ttl = args[0];
    } else if (args[0] && typeof args[0] === "object") {
      if (args[0].EX) ttl = Number(args[0].EX) || 3600;
      else if (args[0].ttl) ttl = Number(args[0].ttl) || 3600;
    }
    return this.setCache(key, value, ttl);
  }

  async del(key) {
    return this.deleteCache(key);
  }

  async hIncrBy(key, field, increment = 1) {
    if (this.isReady) {
      try {
        if (typeof this.client.hIncrBy === "function") {
          return await retryWithBackoff(
            () => this.client.hIncrBy(key, field, increment),
            { label: `hIncrBy ${key}` },
          );
        }
        if (typeof this.client.hincrby === "function") {
          return await retryWithBackoff(
            () => this.client.hincrby(key, field, increment),
            { label: `hIncrBy ${key}` },
          );
        }
        return 0;
      } catch (err) {
        logger.error("[Redis] hIncrBy error:", err.message);
        return 0;
      }
    }
    return 0;
  }

  async hincrby(key, field, increment = 1) {
    return this.hIncrBy(key, field, increment);
  }

  async hGetAll(key) {
    if (this.isReady) {
      try {
        if (typeof this.client.hGetAll === "function") {
          return (
            (await retryWithBackoff(() => this.client.hGetAll(key), {
              label: `hGetAll ${key}`,
            })) || {}
          );
        }
        if (typeof this.client.hgetall === "function") {
          return (
            (await retryWithBackoff(() => this.client.hgetall(key), {
              label: `hGetAll ${key}`,
            })) || {}
          );
        }
        return {};
      } catch (err) {
        logger.error("[Redis] hGetAll error:", err.message);
        return {};
      }
    }
    return {};
  }

  async hgetall(key) {
    return this.hGetAll(key);
  }

  async acquireLock(key, token, ttlMs = 5000) {
    if (this.isReady) {
      try {
        const result = await retryWithBackoff(
          () => this.client.set(key, token, { NX: true, PX: ttlMs }),
          { label: `acquireLock ${key}` },
        );
        return result === "OK";
      } catch (error) {
        logger.error("[Redis] Gagal acquire lock setelah retry:", error.message);
        return this._memoryAcquireLock(key, token, ttlMs);
      }
    }
    return this._memoryAcquireLock(key, token, ttlMs);
  }

  async releaseLock(key, token) {
    if (!key || !token) return false;
    if (this.isReady) {
      try {
        const res = await retryWithBackoff(
          () =>
            this.client.eval(RELEASE_LOCK_LUA, {
              keys: [key],
              arguments: [token],
            }),
          { label: `releaseLock ${key}` },
        );
        return res === 1;
      } catch (error) {
        logger.error("[Redis] Gagal release lock setelah retry:", error.message);
        return this._memoryReleaseLock(key, token);
      }
    }
    return this._memoryReleaseLock(key, token);
  }

  async initPubSub(channelName, onMessageCallback) {
    if (!this.isReady) return;
    try {
      if (!this.subscriber) {
        this.subscriber = this.client.duplicate();
        await this.subscriber.connect();
      }
      await this.subscriber.subscribe(channelName, (message) => {
        try {
          const parsed = JSON.parse(message);
          onMessageCallback(parsed);
        } catch (e) {
          onMessageCallback(message);
        }
      });
      logger.success(`[Redis PubSub] Subscribed to channel '${channelName}'`);
    } catch (error) {
      logger.error("[Redis PubSub] Failed to subscribe:", error.message);
    }
  }

  async publish(channelName, data) {
    if (!this.isReady) return;
    try {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      await this.client.publish(channelName, payload);
    } catch (error) {
      logger.error("[Redis PubSub] Failed to publish:", error.message);
    }
  }
}

module.exports = new RedisManager();
