const redisManager = require("../managers/redisManager");

// In-memory fallback store, dipakai hanya bila Redis tidak tersedia.
// Catatan: fallback ini per-proses, jadi pada mode sharding batasnya berlaku
// per shard, bukan global. Redis tetap jalur yang disarankan di produksi.
const inMemoryStore = new Map();

// Cleanup otomatis: hapus entries yang sudah melewati window-nya
const cleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of inMemoryStore.entries()) {
      if (now >= record.resetAt) {
        inMemoryStore.delete(key);
      }
    }
  },
  10 * 60 * 1000,
); // Jalankan setiap 10 menit
if (cleanupTimer.unref) cleanupTimer.unref();

class RateLimiter {
  /**
   * Memeriksa sekaligus mencatat satu pemakaian kuota.
   *
   * Sebelumnya jalur Redis memakai getCache lalu setCache. Dua langkah itu tidak
   * atomik sehingga burst request bisa lolos bersamaan, dan setCache menulis ulang
   * TTL pada setiap hit sehingga window ikut mundur terus. Sekarang memakai INCR
   * dengan EXPIRE yang hanya dipasang pada hit pertama.
   *
   * @param {string} userId
   * @param {string} commandName
   * @param {number} limit - Jumlah maksimum request dalam satu window.
   * @param {number} windowInSeconds
   * @returns {Promise<{ limited: boolean, remaining: number, retryAfter: number }>}
   */
  static async consume(userId, commandName, limit, windowInSeconds) {
    const key = `ratelimit:${commandName}:${userId}`;

    if (redisManager.isReady) {
      const current = await redisManager.increment(key, windowInSeconds);
      if (current !== null) {
        const limited = current > limit;
        let retryAfter = 0;
        if (limited) {
          const ttl = await redisManager.getTtl(key);
          retryAfter = ttl > 0 ? ttl : windowInSeconds;
        }
        return { limited, remaining: Math.max(0, limit - current), retryAfter };
      }
      // current === null berarti Redis gagal; lanjut ke fallback di bawah.
    }

    // In-memory fixed window fallback
    const now = Date.now();
    const record = inMemoryStore.get(key);

    if (!record || now >= record.resetAt) {
      inMemoryStore.set(key, {
        count: 1,
        resetAt: now + windowInSeconds * 1000,
      });
      return {
        limited: false,
        remaining: Math.max(0, limit - 1),
        retryAfter: 0,
      };
    }

    record.count++;
    const limited = record.count > limit;
    return {
      limited,
      remaining: Math.max(0, limit - record.count),
      retryAfter: limited ? Math.ceil((record.resetAt - now) / 1000) : 0,
    };
  }

  /**
   * Bentuk ringkas dari consume(). Dipertahankan agar seluruh pemanggil lama
   * tetap bekerja tanpa perubahan.
   *
   * @returns {Promise<boolean>} True bila user sedang kena limit.
   */
  static async isRateLimited(userId, commandName, limit, windowInSeconds) {
    const { limited } = await RateLimiter.consume(
      userId,
      commandName,
      limit,
      windowInSeconds,
    );
    return limited;
  }
}

module.exports = RateLimiter;
