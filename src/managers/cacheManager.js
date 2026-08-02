// src/managers/cacheManager.js
const redisManager = require('./redisManager');
const { logger } = require('../../src/managers/logger');
const UserProfile = require('../models/UserProfile');
const UserSurvival = require('../models/UserSurvival');
const GuildSettings = require('../models/GuildSettings');

/**
 * CacheManager: Read-Through and Write-Behind Caching Layer
 * Bertujuan untuk mengurangi beban database utama dengan menjadikan Redis
 * sebagai jembatan utama untuk Read dan Write data pengguna yang sering berubah.
 */
class CacheManager {

    constructor() {
        this.writeQueue = new Map();
        this.isProcessingQueue = false;
    }

    _addToWriteQueue(userId, updateData) {
        if (!this.writeQueue.has(userId)) {
            this.writeQueue.set(userId, {});
        }
        const currentUserData = this.writeQueue.get(userId);
        Object.assign(currentUserData, updateData);

        if (!this.isProcessingQueue) {
            this._processWriteQueue();
        }
    }

    async _processWriteQueue() {
        if (this.writeQueue.size === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const entries = Array.from(this.writeQueue.entries());
        this.writeQueue.clear();

        for (const [userId, updateData] of entries) {
            await this._asyncDbUpdate(userId, updateData);
        }

        // Process any new items added while we were processing
        this._processWriteQueue();
    }

    /**
     * Mengambil UserProfile dari Cache. Jika tidak ada, fetch dari DB dan set ke Cache.
     * @param {string} userId - ID Discord User
     * @returns {Promise<Object>} Data profil pengguna (JSON)
     */
    async getUserProfile(userId) {
        if (!userId) return null;
        const cacheKey = `user:profile:${userId}`;

        try {
            // 1. Coba ambil dari Redis
            const cachedProfile = await redisManager.getCache(cacheKey);
            if (cachedProfile) return cachedProfile;

            // 2. Jika tidak ada di Redis, ambil dari Database Utama (findOrCreate)
            const [dbProfile] = await UserProfile.findOrCreate({ where: { userId } });
            if (dbProfile) {
                const profileData = dbProfile.toJSON();
                // Simpan ke cache selama 1 jam (3600 detik)
                await redisManager.setCache(cacheKey, profileData, 3600);
                return profileData;
            }

            return null;
        } catch (error) {
            logger.error('[CacheManager] Error getUserProfile:', error.message);
            // Fallback: Jika redis down, tembak DB langsung
            try {
                const [dbProfile] = await UserProfile.findOrCreate({ where: { userId } });
                return dbProfile ? dbProfile.toJSON() : null;
            } catch (dbError) {
                return null;
            }
        }
    }

    /**
     * Menyimpan/Memperbarui UserProfile. Update ke Cache langsung (cepat),
     * lalu jalankan async update ke Database Utama di background (Write-Behind).
     * @param {string} userId - ID Discord User
     * @param {Object} updateData - Key/Value pasang untuk diupdate
     * @returns {Promise<boolean>} Status keberhasilan cache
     */
    async updateUserProfile(userId, updateData) {
        if (!userId || !updateData) return false;
        const cacheKey = `user:profile:${userId}`;

        try {
            // 1. Dapatkan profile saat ini (dari cache atau DB)
            let profile = await this.getUserProfile(userId);

            if (!profile) {
                // Jika belum ada, buat baru di DB dulu untuk memastikan konsistensi
                try {
                     const [newDbProfile] = await UserProfile.findOrCreate({ where: { userId }, defaults: updateData });
                     profile = newDbProfile.toJSON();
                } catch(e) {
                     return false;
                }
            }

            // 2. Gabungkan data baru ke profile
            Object.assign(profile, updateData);

            // 3. Update Redis Cache (Immediate return)
            await redisManager.setCache(cacheKey, profile, 3600);

            // 4. Update Database di Background (Write-Behind / Fire-and-Forget)
            this._addToWriteQueue(userId, updateData);

            return true;
        } catch (error) {
             logger.error('[CacheManager] Error updateUserProfile:', error.message);
             // Fallback langsung tembak DB jika redis fail
             this._addToWriteQueue(userId, updateData);
             return false;
        }
    }

    /**
     * Internal: Mengeksekusi update ke Database Utama tanpa memblokir thread (Fire & Forget).
     */
    async _asyncDbUpdate(userId, updateData) {
        try {
            await UserProfile.update(updateData, { where: { userId } });
        } catch (error) {
            logger.error(`[CacheManager] Background DB Update Failed for ${userId}:`, error.message);
        }
    }

    // ==========================================
    // 🏠 GUILD SETTINGS CACHE (Rule 1.9)
    // ==========================================

    /**
     * Mengambil GuildSettings dari Cache. Jika tidak ada, fetch dari DB dan set ke Cache.
     * Wajib digunakan di messageCreate dan interactionCreate, bukan GuildSettings.findOne() langsung.
     * @param {string} guildId - ID Discord Guild
     * @returns {Promise<Object|null>} Settings JSON atau null jika guild belum terdaftar
     */
    async getGuildSettings(guildId) {
        if (!guildId) return null;
        const cacheKey = `guild:settings:${guildId}`;

        try {
            // 1. Coba ambil dari Redis (TTL 5 menit)
            const cached = await redisManager.getCache(cacheKey);
            if (cached) return cached;

            // 2. Fallback ke Database
            const [db] = await GuildSettings.findOrCreate({ where: { guildId } });
            if (db) {
                const settingsData = db.toJSON();
                await redisManager.setCache(cacheKey, settingsData, 300); // TTL 5 menit
                return settingsData;
            }

            return null;
        } catch (error) {
            logger.error('[CacheManager] Error getGuildSettings:', error.message);
            // Fallback langsung ke DB jika Redis down
            try {
                const [db] = await GuildSettings.findOrCreate({ where: { guildId } });
                return db ? db.toJSON() : null;
            } catch (dbError) {
                return null;
            }
        }
    }

    /**
     * Menghapus cache GuildSettings untuk guild tertentu.
     * WAJIB dipanggil setelah setiap perubahan setting via /setup atau command admin.
     * @param {string} guildId - ID Discord Guild
     */
    async invalidateGuildSettings(guildId) {
        if (!guildId) return;
        const cacheKey = `guild:settings:${guildId}`;
        try {
            await redisManager.deleteCache(cacheKey);
        } catch (error) {
            logger.error('[CacheManager] Error invalidateGuildSettings:', error.message);
        }
    }

    // ==========================================
    // ⚔️ USER SURVIVAL CACHE
    // ==========================================

    /**
     * Mengambil UserSurvival dari Cache / DB.
     * @param {string} userId - ID Discord User
     * @returns {Promise<Object>} Data survival pengguna (JSON)
     */
    async getUserSurvival(userId) {
        if (!userId) return null;
        const cacheKey = `user:survival:${userId}`;

        try {
            const cached = await redisManager.getCache(cacheKey);
            if (cached) return cached;

            const [db] = await UserSurvival.findOrCreate({ where: { userId } });
            if (db) {
                const data = db.toJSON();
                await redisManager.setCache(cacheKey, data, 1800); // 30 menit TTL
                return data;
            }
            return null;
        } catch (error) {
            logger.error('[CacheManager] Error getUserSurvival:', error.message);
            try {
                const [db] = await UserSurvival.findOrCreate({ where: { userId } });
                return db ? db.toJSON() : null;
            } catch { return null; }
        }
    }

    /**
     * Memperbarui UserSurvival di Cache (Immediate) dan Database (Async).
     * @param {string} userId - ID Discord User
     * @param {Object} updateData - Data yang diupdate
     */
    async updateUserSurvival(userId, updateData) {
        if (!userId || !updateData) return false;
        const cacheKey = `user:survival:${userId}`;

        try {
            let survival = await this.getUserSurvival(userId);
            if (!survival) return false;

            Object.assign(survival, updateData);
            await redisManager.setCache(cacheKey, survival, 1800);

            // Update DB Async
            UserSurvival.update(updateData, { where: { userId } }).catch(err => {
                logger.error(`[CacheManager] DB UserSurvival Update Error for ${userId}:`, err.message);
            });

            return true;
        } catch (error) {
            logger.error('[CacheManager] Error updateUserSurvival:', error.message);
            return false;
        }
    }
}

module.exports = new CacheManager();
