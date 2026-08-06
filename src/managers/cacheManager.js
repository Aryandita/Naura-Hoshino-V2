// src/managers/cacheManager.js
const redisManager = require('./redisManager');
const { logger } = require('../../src/managers/logger');
const UserProfile = require('../models/UserProfile');
const UserSurvival = require('../models/UserSurvival');
const GuildSettings = require('../models/GuildSettings');

// Jeda pengumpulan tulisan sebelum dikirim ke database. Semakin besar semakin
// hemat query, tetapi semakin banyak data yang berisiko hilang bila proses mati
// mendadak. Lima detik adalah kompromi yang aman karena shutdown() mem-flush antrean.
const FLUSH_INTERVAL_MS = 5000;

const PROFILE_TTL = 3600; // 1 jam
const SURVIVAL_TTL = 1800; // 30 menit
const GUILD_TTL = 300; // 5 menit

/**
 * CacheManager: Read-Through and Write-Behind Caching Layer
 *
 * Dua aturan penting:
 * 1. Nilai absolut (nama, status, timestamp) memakai update*(). Nilai yang bersifat
 *    akumulatif (koin, XP, HP) WAJIB memakai increment*() supaya perubahan dari dua
 *    shard tidak saling menimpa.
 * 2. Semua tulisan tertunda harus bisa di-flush lewat flushAll() saat shutdown.
 */
class CacheManager {

    constructor() {
        // userId -> { set: {...}, inc: {...} }
        this.writeQueue = new Map(); // UserProfile
        this.survivalQueue = new Map(); // UserSurvival
        this.flushTimer = null;
        this.isFlushing = false;
        this._currentFlush = null;
    }

    /** Jumlah user yang masih menunggu ditulis ke database. */
    get pendingWrites() {
        return this.writeQueue.size + this.survivalQueue.size;
    }

    // ==========================================
    // ✍️ ANTREAN TULIS (WRITE-BEHIND)
    // ==========================================

    _enqueue(queue, userId, { set = null, inc = null } = {}) {
        if (!queue.has(userId)) queue.set(userId, { set: {}, inc: {} });
        const entry = queue.get(userId);

        if (set) {
            for (const [field, value] of Object.entries(set)) {
                entry.set[field] = value;
                // Nilai absolut yang lebih baru membatalkan delta yang belum ditulis.
                delete entry.inc[field];
            }
        }

        if (inc) {
            for (const [field, delta] of Object.entries(inc)) {
                const amount = Number(delta) || 0;
                if (Object.prototype.hasOwnProperty.call(entry.set, field)) {
                    // Sudah ada nilai absolut menunggu; majukan nilainya saja.
                    entry.set[field] = (Number(entry.set[field]) || 0) + amount;
                } else {
                    entry.inc[field] = (entry.inc[field] || 0) + amount;
                }
            }
        }

        this._scheduleFlush();
    }

    _scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushAll().catch(err =>
                logger.error('[CacheManager] Flush terjadwal gagal:', err.message)
            );
        }, FLUSH_INTERVAL_MS);
        if (this.flushTimer.unref) this.flushTimer.unref();
    }

    /**
     * Menulis seluruh antrean ke database. Aman dipanggil berkali-kali; pemanggilan
     * yang tumpang tindih akan menunggu putaran yang sedang berjalan.
     */
    async flushAll() {
        if (this.isFlushing && this._currentFlush) {
            await this._currentFlush;
        }
        if (this.pendingWrites === 0) return;

        this.isFlushing = true;
        this._currentFlush = Promise.all([
            this._flushQueue(this.writeQueue, UserProfile, 'UserProfile'),
            this._flushQueue(this.survivalQueue, UserSurvival, 'UserSurvival')
        ]);

        try {
            await this._currentFlush;
        } finally {
            this.isFlushing = false;
            this._currentFlush = null;
        }
    }

    async _flushQueue(queue, Model, label) {
        if (queue.size === 0) return;

        const entries = Array.from(queue.entries());
        queue.clear();

        for (const [userId, { set, inc }] of entries) {
            try {
                if (Object.keys(set).length > 0) {
                    await Model.update(set, { where: { userId } });
                }
                if (Object.keys(inc).length > 0) {
                    // increment() menghasilkan `kolom = kolom + delta` di level SQL,
                    // sehingga aman terhadap balapan antar shard maupun antar command.
                    await Model.increment(inc, { where: { userId } });
                }
            } catch (error) {
                logger.error(`[CacheManager] Gagal menulis ${label} untuk ${userId}:`, error.message);
            }
        }
    }

    /** @deprecated Dipertahankan untuk pemanggil lama. Gunakan flushAll(). */
    async _processWriteQueue() {
        return this.flushAll();
    }

    /** Helper bersama untuk increment atomik pada model mana pun. */
    async _increment(userId, deltas, { cacheKey, ttl, loader, queue }) {
        if (!userId || !deltas || Object.keys(deltas).length === 0) return false;

        try {
            const current = await loader();
            if (current) {
                for (const [field, delta] of Object.entries(deltas)) {
                    current[field] = (Number(current[field]) || 0) + (Number(delta) || 0);
                }
                await redisManager.setCache(cacheKey, current, ttl);
            }
        } catch (error) {
            logger.error('[CacheManager] Gagal memperbarui cache saat increment:', error.message);
        }

        // Database tetap menerima delta, bukan hasil hitungan lokal.
        this._enqueue(queue, userId, { inc: deltas });
        return true;
    }

    // ==========================================
    // 👤 USER PROFILE CACHE
    // ==========================================

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
                await redisManager.setCache(cacheKey, profileData, PROFILE_TTL);
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
     * Menyimpan nilai ABSOLUT pada UserProfile.
     * Untuk nilai akumulatif (koin, XP), pakai incrementUserProfile().
     *
     * @param {string} userId - ID Discord User
     * @param {Object} updateData - Key/Value pasang untuk diupdate
     * @returns {Promise<boolean>} Status keberhasilan cache
     */
    async updateUserProfile(userId, updateData) {
        if (!userId || !updateData) return false;
        const cacheKey = `user:profile:${userId}`;

        try {
            let profile = await this.getUserProfile(userId);

            if (!profile) {
                try {
                    const [newDbProfile] = await UserProfile.findOrCreate({ where: { userId }, defaults: updateData });
                    profile = newDbProfile.toJSON();
                } catch (e) {
                    return false;
                }
            }

            Object.assign(profile, updateData);
            await redisManager.setCache(cacheKey, profile, PROFILE_TTL);
            this._enqueue(this.writeQueue, userId, { set: updateData });

            return true;
        } catch (error) {
            logger.error('[CacheManager] Error updateUserProfile:', error.message);
            this._enqueue(this.writeQueue, userId, { set: updateData });
            return false;
        }
    }

    /**
     * Menambah/mengurangi kolom numerik UserProfile secara atomik di level SQL.
     * Gunakan ini untuk economy_wallet, economy_bank, leveling_xp, dan sejenisnya.
     *
     * @param {string} userId
     * @param {Object<string, number>} deltas - Contoh: { economy_wallet: -250, leveling_xp: 15 }
     */
    async incrementUserProfile(userId, deltas) {
        return this._increment(userId, deltas, {
            cacheKey: `user:profile:${userId}`,
            ttl: PROFILE_TTL,
            loader: () => this.getUserProfile(userId),
            queue: this.writeQueue
        });
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
            const cached = await redisManager.getCache(cacheKey);
            if (cached) return cached;

            const [db] = await GuildSettings.findOrCreate({ where: { guildId } });
            if (db) {
                const settingsData = db.toJSON();
                await redisManager.setCache(cacheKey, settingsData, GUILD_TTL);
                return settingsData;
            }

            return null;
        } catch (error) {
            logger.error('[CacheManager] Error getGuildSettings:', error.message);
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
                await redisManager.setCache(cacheKey, data, SURVIVAL_TTL);
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
     * Menyimpan nilai ABSOLUT pada UserSurvival.
     *
     * Sebelumnya update di sini ditembakkan langsung ke database dengan .catch()
     * tanpa antrean, sehingga tidak ikut ter-flush saat shutdown dan progres RPG
     * bisa hilang di setiap restart. Sekarang memakai antrean yang sama.
     *
     * @param {string} userId - ID Discord User
     * @param {Object} updateData - Data yang diupdate
     */
    async updateUserSurvival(userId, updateData) {
        if (!userId || !updateData) return false;
        const cacheKey = `user:survival:${userId}`;

        try {
            const survival = await this.getUserSurvival(userId);
            if (!survival) return false;

            Object.assign(survival, updateData);
            await redisManager.setCache(cacheKey, survival, SURVIVAL_TTL);
            this._enqueue(this.survivalQueue, userId, { set: updateData });

            return true;
        } catch (error) {
            logger.error('[CacheManager] Error updateUserSurvival:', error.message);
            this._enqueue(this.survivalQueue, userId, { set: updateData });
            return false;
        }
    }

    /**
     * Menambah/mengurangi kolom numerik UserSurvival secara atomik.
     * Gunakan untuk starFragments, hp, hunger, thirst, stamina, survival_xp.
     *
     * @param {string} userId
     * @param {Object<string, number>} deltas - Contoh: { starFragments: 120, hunger: -5 }
     */
    async incrementUserSurvival(userId, deltas) {
        return this._increment(userId, deltas, {
            cacheKey: `user:survival:${userId}`,
            ttl: SURVIVAL_TTL,
            loader: () => this.getUserSurvival(userId),
            queue: this.survivalQueue
        });
    }
}

module.exports = new CacheManager();
