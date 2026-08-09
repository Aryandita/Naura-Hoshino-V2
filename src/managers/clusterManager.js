const { logger } = require('./logger');

/**
 * ClusterManager
 * Memusatkan semua pemanggilan lintas-shard (broadcastEval, shard fetch, dll).
 * Saat ini meng-wrap discord.js ShardingManager asli (via client.shard), 
 * namun didesain agar mudah dimigrasi ke discord-hybrid-sharding.
 */
class ClusterManager {
    
    /**
     * Mengecek apakah instance saat ini adalah Master Shard (Shard 0)
     * Digunakan untuk tugas cron yang hanya boleh berjalan sekali (Backup, QOTD, Giveaway).
     * @param {import('discord.js').Client} client 
     * @returns {boolean}
     */
    isMasterShard(client) {
        if (!client.shard) return true; // Jika tidak di-shard, otomatis master
        return client.shard.ids && client.shard.ids.includes(0);
    }

    /**
     * Broadcast eval function ke seluruh shard
     * @param {import('discord.js').Client} client 
     * @param {Function} script - Fungsi yang akan dieksekusi di setiap shard
     * @param {Object} context - Konteks opsional untuk diteruskan
     * @returns {Promise<Array<any>>}
     */
    async broadcastEval(client, script, context = {}) {
        if (!client.shard) {
            // Fallback simulasi jika bot berjalan tanpa sharding
            return [await script(client, context)];
        }
        return await client.shard.broadcastEval(script, { context });
    }

    /**
     * Mengambil nilai dari property (misal: 'guilds.cache.size') dari seluruh shard
     * @param {import('discord.js').Client} client 
     * @param {string} property 
     * @returns {Promise<Array<any>>}
     */
    async fetchClientValues(client, property) {
        if (!client.shard) {
            const props = property.split('.');
            let val = client;
            for (const prop of props) {
                if (val === undefined) break;
                val = val[prop];
            }
            return [val];
        }
        return await client.shard.fetchClientValues(property);
    }

    /**
     * Mengambil String ID dari Shard yang sedang aktif
     * @param {import('discord.js').Client} client 
     * @returns {string}
     */
    getShardIds(client) {
        if (!client.shard) return '0';
        return client.shard.ids ? client.shard.ids.join(',') : '0';
    }

    /**
     * Mengambil total jumlah shard
     * @param {import('discord.js').Client} client 
     * @returns {number}
     */
    getTotalShards(client) {
        if (!client.shard) return 1;
        return client.shard.count || 1;
    }
}

module.exports = new ClusterManager();
