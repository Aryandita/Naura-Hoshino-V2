const redisManager = require('../managers/redisManager');
const { logger } = require('../../src/managers/logger');

// In-memory fallback store — dibersihkan setiap 10 menit untuk mencegah memory leak
const inMemoryStore = new Map();

// Cleanup otomatis: hapus entries yang sudah melewati window-nya
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of inMemoryStore.entries()) {
        if (now - record.startTime > record.windowMs) {
            inMemoryStore.delete(key);
        }
    }
}, 10 * 60 * 1000); // Jalankan setiap 10 menit

class RateLimiter {
    /**
     * Checks if a user has exceeded the rate limit.
     * @param {string} userId - The ID of the user.
     * @param {string} commandName - The name of the command.
     * @param {number} limit - The maximum number of requests allowed.
     * @param {number} windowInSeconds - The time window in seconds.
     * @returns {Promise<boolean>} True if rate limited, false otherwise.
     */
    static async isRateLimited(userId, commandName, limit, windowInSeconds) {
        const key = `ratelimit:${commandName}:${userId}`;

        if (redisManager.client && redisManager.client.isReady) {
            try {
                const currentRequests = (await redisManager.getCache(key)) || 0;
                if (currentRequests >= limit) {
                    return true;
                }
                await redisManager.setCache(key, currentRequests + 1, windowInSeconds);
                return false;
            } catch (error) {
                logger.error('[RateLimiter Redis Error]', error);
            }
        }

        // In-memory fallback
        const now = Date.now();
        const userRecord = inMemoryStore.get(key);
        if (!userRecord || now - userRecord.startTime > windowInSeconds * 1000) {
            // Simpan windowMs juga agar cleanup interval bisa membandingkan TTL
            inMemoryStore.set(key, { count: 1, startTime: now, windowMs: windowInSeconds * 1000 });
            return false;
        }

        if (userRecord.count >= limit) {
            return true;
        }

        userRecord.count++;
        return false;
    }
}

module.exports = RateLimiter;
