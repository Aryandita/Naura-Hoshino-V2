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
      } catch (e) {}
    }
    if (this.client) {
      try {
        await this.client.quit();
        logger.info("[Redis] Koneksi Redis ditutup dengan aman.");
      } catch (e) {}
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
