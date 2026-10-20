const { createClient } = require("redis");
const { logger } = require("../managers/logger");

class RedisManager {
  constructor() {
    // Guard: Jangan buat Redis client jika URL tidak dikonfigurasi
    const redisUrl = require("../config/env").REDIS_URL;
    if (!redisUrl) {
      this.client = null;
      return;
    }

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          // Exponential backoff dengan jitter, batas maksimal 15 detik
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

    // Kompatibilitas alias untuk pemanggilan command dengan format lowercase
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
  }

  /** Satu-satunya sumber kebenaran untuk mengecek kesiapan Redis. */
  get isReady() {
    return Boolean(this.client && this.client.isReady);
  }

  /**
   * Mengembalikan status koneksi dan mode operasional Redis.
   * @returns {{connected: boolean, configured: boolean, mode: string}}
   */
  getStatus() {
    return {
      connected: this.isReady,
      configured: Boolean(this.client),
      mode: this.isReady ? "redis_cluster" : "in_memory_fallback",
    };
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
      await this.client.connect();
    } catch (error) {
      logger.warn(
        "[Redis] Gagal terhubung ke Redis server, sistem cache berjalan dalam mode memori fallback.",
      );
    }
  }

  async setCache(key, data, expirationInSeconds = 3600) {
    if (!this.isReady) return;
    try {
      await this.client.setEx(key, expirationInSeconds, JSON.stringify(data));
    } catch (error) {
      logger.error("[Redis] Gagal menyimpan cache:", error.message);
    }
  }

  async getCache(key) {
    if (!this.isReady) return null;
    try {
      const data = await this.client.get(key);
      if (data) return JSON.parse(data);
      return null;
    } catch (error) {
      logger.error("[Redis] Gagal membaca cache:", error.message);
      return null;
    }
  }

  async zAdd(key, score, value) {
    if (!this.isReady) return null;
    try {
      return await this.client.zAdd(key, [{ score: Number(score), value: String(value) }]);
    } catch (error) {
      logger.error("[Redis] Gagal menjalankan zAdd:", error.message);
      return null;
    }
  }

  async zRevRangeWithScores(key, start = 0, stop = -1) {
    if (!this.isReady) return [];
    try {
      return await this.client.zRangeWithScores(key, start, stop, { REV: true });
    } catch (error) {
      logger.error("[Redis] Gagal membaca zRevRangeWithScores:", error.message);
      return [];
    }
  }

  async zCard(key) {
    if (!this.isReady) return 0;
    try {
      return await this.client.zCard(key);
    } catch (error) {
      logger.error("[Redis] Gagal membaca zCard:", error.message);
      return 0;
    }
  }

  async zScore(key, member) {
    if (!this.isReady) return null;
    try {
      return await this.client.zScore(key, String(member));
    } catch (error) {
      logger.error("[Redis] Gagal membaca zScore:", error.message);
      return null;
    }
  }

  async zRevRank(key, member) {
    if (!this.isReady) return null;
    try {
      return await this.client.zRevRank(key, String(member));
    } catch (error) {
      logger.error("[Redis] Gagal membaca zRevRank:", error.message);
      return null;
    }
  }

  async deleteCache(key) {
    if (!this.isReady) return;
    try {
      await this.client.del(key);
    } catch (error) {
      // Tanpa penjaga ini, Redis yang putus di tengah invalidasi cache akan
      // menjadi unhandled rejection dan bisa menjatuhkan seluruh shard.
      logger.error("[Redis] Gagal menghapus cache:", error.message);
    }
  }

  async deleteByPattern(pattern) {
    if (!this.isReady) return;
    try {
      const keys = [];
      for await (const key of this.client.scanIterator({
        MATCH: pattern,
        COUNT: 100,
      })) {
        keys.push(key);
      }
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error(
        "[Redis] Gagal menghapus cache dengan pattern:",
        error.message,
      );
    }
  }

  /**
   * Menaikkan counter secara atomik. TTL hanya dipasang saat counter pertama kali
   * dibuat, sehingga window tetap tetap (fixed window) dan tidak ikut mundur
   * setiap kali ada request baru.
   *
   * @param {string} key
   * @param {number} [expirationInSeconds]
   * @returns {Promise<number|null>} Nilai counter setelah dinaikkan, atau null bila Redis tidak siap.
   */
  async increment(key, expirationInSeconds) {
    if (!this.isReady) return null;
    try {
      const value = await this.client.incr(key);
      if (value === 1 && expirationInSeconds) {
        await this.client.expire(key, expirationInSeconds);
      }
      return value;
    } catch (error) {
      logger.error("[Redis] Gagal menaikkan counter:", error.message);
      return null;
    }
  }

  /** Sisa umur sebuah key dalam detik. -1 bila tanpa TTL, -2 bila tidak ada. */
  async getTtl(key) {
    if (!this.isReady) return -2;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error("[Redis] Gagal membaca TTL:", error.message);
      return -2;
    }
  }

  // Mempermudah integrasi cache ke sistem lain tanpa kode redundan
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
      return await fetchFunction(); // Fallback langsung ke database jika redis bermasalah
    }
  }

  async lpush(key, value) {
    if (!this.isReady) return 0;
    try {
      if (typeof this.client.lPush === "function") {
        return await this.client.lPush(key, value);
      }
      return await this.client.lpush(key, value);
    } catch (err) {
      logger.error("[Redis] lpush error:", err.message);
      return 0;
    }
  }

  async ltrim(key, start, stop) {
    if (!this.isReady) return null;
    try {
      if (typeof this.client.lTrim === "function") {
        return await this.client.lTrim(key, start, stop);
      }
      return await this.client.ltrim(key, start, stop);
    } catch (err) {
      logger.error("[Redis] ltrim error:", err.message);
      return null;
    }
  }

  async lrange(key, start, stop) {
    if (!this.isReady) return [];
    try {
      if (typeof this.client.lRange === "function") {
        return await this.client.lRange(key, start, stop);
      }
      return await this.client.lrange(key, start, stop);
    } catch (err) {
      logger.error("[Redis] lrange error:", err.message);
      return [];
    }
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
    if (!this.isReady) return 0;
    try {
      if (typeof this.client.hIncrBy === "function") {
        return await this.client.hIncrBy(key, field, increment);
      }
      if (typeof this.client.hincrby === "function") {
        return await this.client.hincrby(key, field, increment);
      }
      return 0;
    } catch (err) {
      logger.error("[Redis] hIncrBy error:", err.message);
      return 0;
    }
  }

  async hincrby(key, field, increment = 1) {
    return this.hIncrBy(key, field, increment);
  }

  async hGetAll(key) {
    if (!this.isReady) return {};
    try {
      if (typeof this.client.hGetAll === "function") {
        return (await this.client.hGetAll(key)) || {};
      }
      if (typeof this.client.hgetall === "function") {
        return (await this.client.hgetall(key)) || {};
      }
      return {};
    } catch (err) {
      logger.error("[Redis] hGetAll error:", err.message);
      return {};
    }
  }

  async hgetall(key) {
    return this.hGetAll(key);
  }

  // ==========================================
  // 📡 REDIS PUB/SUB SYSTEM (Cross-Shard IPC)
  // ==========================================

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
