"use strict";

/**
 * @file redisLockHelper.js
 * @description Helper Distributed Mutex Lock berbasis Redis SET NX EX dengan fallback in-memory aman.
 * Melindungi mutasi saldo dan transaksi sensitif lintas proses cluster dari race condition.
 */

const crypto = require("node:crypto");
const redisManager =
  require("../managers/logger") && require("../managers/redisManager");
const { logger } = require("../managers/logger");
const DomainError = require("../errors/DomainError");

// Fallback in-memory jika Redis sedang offline
const inMemoryLocks = new Map();

// Script Lua untuk pelepasan lock atomik: hanya hapus jika token cocok
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

/**
 * Tunggu selama ms milidetik
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Coba mengunci resource (Acquire lock)
 * @param {string} lockKey - Kunci lock unik (contoh: 'lock:economy:user:123')
 * @param {number} [ttlMs=5000] - Durasi time-to-live kunci dalam milidetik
 * @param {number} [retryCount=5] - Jumlah percobaan jika lock sedang dipakai
 * @param {number} [retryDelayMs=150] - Jeda antar percobaan dalam milidetik
 * @returns {Promise<string|null>} Token unik pelepasan kunci, atau null jika gagal
 */
async function acquireLock(
  lockKey,
  ttlMs = 5000,
  retryCount = 5,
  retryDelayMs = 150,
) {
  const lockToken = crypto.randomUUID();
  const attempts = Math.max(1, retryCount);

  for (let attempt = 0; attempt < attempts; attempt++) {
    // 1. Jalur Redis Client
    if (redisManager && redisManager.isReady && redisManager.client) {
      try {
        const result = await redisManager.client.set(lockKey, lockToken, {
          NX: true,
          PX: ttlMs,
        });
        if (result === "OK") {
          return lockToken;
        }
      } catch (err) {
        logger.warn(`[RedisLock] Gagal acquire lock di Redis: ${err.message}`);
      }
    } else {
      // 2. Jalur In-Memory Fallback
      const now = Date.now();
      const existing = inMemoryLocks.get(lockKey);
      if (!existing || existing.expiresAt <= now) {
        inMemoryLocks.set(lockKey, {
          token: lockToken,
          expiresAt: now + ttlMs,
        });
        return lockToken;
      }
    }

    if (attempt < attempts - 1) {
      await delay(retryDelayMs);
    }
  }

  return null;
}

/**
 * Lepas kunci resource secara aman (Release lock)
 * @param {string} lockKey - Kunci lock unik
 * @param {string} lockToken - Token yang dikembalikan saat acquire
 * @returns {Promise<boolean>} True jika berhasil dilepas, false jika sudah kadaluwarsa atau token tidak cocok
 */
async function releaseLock(lockKey, lockToken) {
  if (!lockKey || !lockToken) return false;

  // 1. Jalur Redis Client
  if (redisManager && redisManager.isReady && redisManager.client) {
    try {
      const res = await redisManager.client.eval(RELEASE_LOCK_LUA, {
        keys: [lockKey],
        arguments: [lockToken],
      });
      return res === 1;
    } catch (err) {
      logger.warn(`[RedisLock] Gagal release lock di Redis: ${err.message}`);
    }
  }

  // 2. Jalur In-Memory Fallback
  const existing = inMemoryLocks.get(lockKey);
  if (existing && existing.token === lockToken) {
    inMemoryLocks.delete(lockKey);
    return true;
  }

  return false;
}

/**
 * Eksekusi fungsi bisnis dengan perlindungan distributed lock otomatis
 * @template T
 * @param {string} lockKey - Kunci lock unik
 * @param {number} ttlMs - Masa berlaku maksimal lock dalam milidetik
 * @param {() => Promise<T>} workFn - Fungsi async yang akan dijalankan di dalam lock
 * @param {object} [options] - Opsi tambahan
 * @param {number} [options.retryCount=5] - Jumlah percobaan acquire lock
 * @param {number} [options.retryDelayMs=150] - Jeda antar percobaan
 * @returns {Promise<T>} Hasil dari workFn
 */
async function withDistributedLock(lockKey, ttlMs, workFn, options = {}) {
  const { retryCount = 5, retryDelayMs = 150 } = options;
  const token = await acquireLock(lockKey, ttlMs, retryCount, retryDelayMs);

  if (!token) {
    throw new DomainError(
      "RESOURCE_LOCKED",
      "Transaksi atau aksi ini sedang diproses di tempat lain. Silakan coba kembali dalam beberapa detik.",
      { lockKey },
    );
  }

  try {
    return await workFn();
  } finally {
    await releaseLock(lockKey, token);
  }
}

/**
 * Jalankan pekerjaan dengan multi-kunci terdistribusi (Anti-Deadlock Canonical Ordering)
 * @param {string[]} lockKeys - Array kunci lock unik
 * @param {Function} workFn - Callback asynchronous
 * @param {number} [ttlMs=5000]
 * @returns {Promise<*>}
 */
async function withMultiLock(lockKeys, workFn, ttlMs = 5000) {
  if (!Array.isArray(lockKeys) || lockKeys.length === 0) {
    return workFn();
  }

  // Urutkan kunci secara leksikografis (canonical sorting) untuk mencegah deadlock
  const sortedKeys = [...new Set(lockKeys.filter(Boolean))].sort();
  const acquired = [];

  try {
    for (const key of sortedKeys) {
      const token = await acquireLock(key, ttlMs);
      if (!token) {
        throw new DomainError(
          "RESOURCE_LOCKED",
          "Salah satu resource transaksi sedang diproses di tempat lain. Silakan coba sesaat lagi.",
          { key, sortedKeys },
        );
      }
      acquired.push({ key, token });
    }

    return await workFn();
  } finally {
    // Lepas seluruh lock secara terbalik
    for (let i = acquired.length - 1; i >= 0; i--) {
      await releaseLock(acquired[i].key, acquired[i].token).catch(() => {});
    }
  }
}

// Pembersihan berkala kunci memori yang telah kadaluwarsa (setiap 60 detik)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of inMemoryLocks.entries()) {
    if (val && val.expiresAt <= now) {
      inMemoryLocks.delete(key);
    }
  }
}, 60000).unref();

/**
 * Mengambil ringkasan status in-memory locks
 */
function getLockStats() {
  return {
    activeInMemoryLocks: inMemoryLocks.size,
  };
}

module.exports = {
  acquireLock,
  releaseLock,
  withDistributedLock,
  withMultiLock,
  withDistributedMultiLock: withMultiLock,
  inMemoryLocks,
  getLockStats,
};
