const { createClient } = require('redis');
const { logger } = require('../../src/managers/logger');

class RedisManager {
    constructor() {
        // Guard: Jangan buat Redis client jika URL tidak dikonfigurasi
        const redisUrl = require('../config/env').REDIS_URL;
        if (!redisUrl) {
            this.client = null;
            return;
        }

        this.client = createClient({ url: redisUrl });

        this.client.on('error', err => logger.error('[Redis] Connection error:', err.message));
        this.client.on('connect', () => logger.success('[Redis] Terhubung ke Redis Cache System.'));
        this.client.on('reconnecting', () => logger.warn('[Redis] Mencoba reconnect ke Redis...'));
    }

    async connect() {
        if (!this.client) return;
        await this.client.connect();
    }

    async setCache(key, data, expirationInSeconds = 3600) {
        if (!this.client || !this.client.isReady) return;
        try {
            await this.client.setEx(key, expirationInSeconds, JSON.stringify(data));
        } catch (error) {
            logger.error('[Redis] Gagal menyimpan cache:', error.message);
        }
    }

    async getCache(key) {
        if (!this.client || !this.client.isReady) return null;
        try {
            const data = await this.client.get(key);
            if (data) return JSON.parse(data);
            return null;
        } catch (error) {
            logger.error('[Redis] Gagal membaca cache:', error.message);
            return null;
        }
    }

    async deleteCache(key) {
        if (!this.client || !this.client.isReady) return;
        await this.client.del(key);
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
            logger.error('[Redis] Gagal eksekusi getOrSetCache:', error.message);
            return await fetchFunction(); // Fallback langsung ke database jika redis bermasalah
        }
    }

    // ==========================================
    // 📡 REDIS PUB/SUB SYSTEM (Cross-Shard IPC)
    // ==========================================

    async initPubSub(channelName, onMessageCallback) {
        if (!this.client || !this.client.isReady) return;
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
            logger.error('[Redis PubSub] Failed to subscribe:', error.message);
        }
    }

    async publish(channelName, data) {
        if (!this.client || !this.client.isReady) return;
        try {
            const payload = typeof data === 'string' ? data : JSON.stringify(data);
            await this.client.publish(channelName, payload);
        } catch (error) {
            logger.error('[Redis PubSub] Failed to publish:', error.message);
        }
    }
}

module.exports = new RedisManager();

