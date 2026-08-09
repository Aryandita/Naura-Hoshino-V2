const redisManager = require('./redisManager');
const UserLeveling = require('../models/UserLeveling');
const { logger } = require('./logger');

const XP_KEY = 'xp_buffer:xp';
const MSG_KEY = 'xp_buffer:msg';

/**
 * Menggunakan Redis untuk menampung (buffer) XP dan Message Count sementara,
 * lalu menuliskannya ke MySQL secara bulk untuk mengurangi beban query
 * pada setiap `messageCreate`.
 */
class XpBufferManager {
    constructor() {
        this.isFlushing = false;
    }

    /**
     * Tambahkan XP ke buffer di Redis.
     * Menggunakan HINCRBY sehingga atomik dan sangat cepat.
     * @param {string} guildId 
     * @param {string} userId 
     * @param {number} xpGained 
     * @returns {Promise<number>} total XP buffer saat ini
     */
    async addXp(guildId, userId, xpGained) {
        if (!redisManager.client || !redisManager.client.isReady) {
            // Jika Redis mati, ini bisa mengembalikan null atau fallback ke DB (ditangani di leveling.js)
            return null;
        }

        const field = `${guildId}:${userId}`;
        
        try {
            // Buffer XP
            const currentXpBuffer = await redisManager.client.hIncrBy(XP_KEY, field, xpGained);
            
            // Buffer Message Count
            await redisManager.client.hIncrBy(MSG_KEY, field, 1);
            
            return currentXpBuffer;
        } catch (e) {
            logger.error('[XP BUFFER] Gagal mencatat ke Redis:', e);
            return null;
        }
    }

    /**
     * Tulis semua buffer ke MySQL. Dipanggil melalui cron (contoh: setiap 3 menit).
     */
    async flush() {
        if (this.isFlushing) return;
        if (!redisManager.client || !redisManager.client.isReady) return;

        try {
            // Cek apakah ada data yang perlu diflush
            const existsXp = await redisManager.client.exists(XP_KEY);
            const existsMsg = await redisManager.client.exists(MSG_KEY);

            if (!existsXp && !existsMsg) return;

            this.isFlushing = true;

            const processingXpKey = `${XP_KEY}:processing_${Date.now()}`;
            const processingMsgKey = `${MSG_KEY}:processing_${Date.now()}`;

            // Rename key agar messageCreate baru mencatat ke key baru, menghindari race condition.
            if (existsXp) await redisManager.client.rename(XP_KEY, processingXpKey).catch(() => {});
            if (existsMsg) await redisManager.client.rename(MSG_KEY, processingMsgKey).catch(() => {});

            // Ambil semua data
            const xpData = await redisManager.client.hGetAll(processingXpKey).catch(() => ({}));
            const msgData = await redisManager.client.hGetAll(processingMsgKey).catch(() => ({}));

            const fields = new Set([...Object.keys(xpData), ...Object.keys(msgData)]);
            
            if (fields.size === 0) {
                this.isFlushing = false;
                return;
            }

            let successCount = 0;

            // Karena Sequelize bulkCreate + updateOnDuplicate tidak mudah untuk penambahan (increment),
            // kita lakukan per-user findOrCreate lalu increment di memori dan save().
            // Ini tetap jauh lebih efisien karena mengelompokkan ribuan pesan dalam satu batch DB write
            // dan tidak dipanggil setiap detik.
            for (const field of fields) {
                const [guildId, userId] = field.split(':');
                const xpToAdd = parseInt(xpData[field] || '0', 10);
                const msgToAdd = parseInt(msgData[field] || '0', 10);

                if (xpToAdd === 0 && msgToAdd === 0) continue;

                try {
                    const [profile] = await UserLeveling.findOrCreate({
                        where: { userId, guildId },
                        defaults: { xp: 0, level: 1, messageCount: 0, lastActivity: new Date() }
                    });

                    profile.xp = (profile.xp || 0) + xpToAdd;
                    profile.messageCount = (profile.messageCount || 0) + msgToAdd;
                    profile.lastActivity = new Date();

                    // Level kalkulasi sebenarnya akan diproses di leveling.js saat pesan masuk, 
                    // tetapi kita juga bisa menyimpannya secara valid. 
                    // Kita asumsikan level.js bertanggung jawab memperbarui 'level' field kalau naik level.
                    // Di sini kita hanya mengamankan XP.

                    await profile.save({ fields: ['xp', 'messageCount', 'lastActivity'] });
                    successCount++;
                } catch (e) {
                    logger.error(`[XP BUFFER] Gagal flush data untuk ${guildId}:${userId}`, e);
                }
            }

            // Hapus processing keys setelah berhasil ditulis semua
            if (existsXp) await redisManager.client.del(processingXpKey);
            if (existsMsg) await redisManager.client.del(processingMsgKey);

            if (successCount > 0) {
                logger.info(`[XP BUFFER] Berhasil mem-flush data XP untuk ${successCount} user(s).`);
            }

        } catch (error) {
            logger.error('[XP BUFFER ERROR] Gagal melakukan proses flush:', error);
        } finally {
            this.isFlushing = false;
        }
    }
}

module.exports = new XpBufferManager();
