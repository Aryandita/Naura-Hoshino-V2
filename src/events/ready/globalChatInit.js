const GuildSettings = require('../../models/GuildSettings');
const redisManager = require('../../managers/redisManager');
const { logger } = require('../../managers/logger');

module.exports = {
    name: 'globalChatInit',
    execute(client) {
        // ==========================================
        // 🌐 INITIALIZE GLOBAL CHAT CACHE & PUBSUB
        // ==========================================
        (async () => {
            try {
                client.globalChatChannels = new Map();
                
                const allSettings = await GuildSettings.findAll();
                for (const settings of allSettings) {
                    const parsed = typeof settings.settings === 'string' ? JSON.parse(settings.settings) : (settings.settings || {});
                    if (parsed.globalChat && parsed.globalChat.enabled && parsed.globalChat.channelId) {
                        client.globalChatChannels.set(parsed.globalChat.channelId, settings.guildId);
                    }
                }
                console.log(`\x1b[42m\x1b[30m 🌐 GLOBAL CHAT \x1b[0m \x1b[32mBerhasil memuat ${client.globalChatChannels.size} channel Global Chat.\x1b[0m`);

                // Redis Pub/Sub untuk Cross-Shard Global Chat
                if (redisManager.client && redisManager.client.isReady) {
                    await redisManager.initPubSub('naura:globalchat', async (payload) => {
                        if (!payload || !client.globalChatChannels) return;
                        for (const [chanId] of client.globalChatChannels.entries()) {
                            if (chanId === payload.sourceChannelId) continue;
                            const targetChannel = client.channels.cache.get(chanId);
                            if (targetChannel && targetChannel.isTextBased()) {
                                await targetChannel.send({ embeds: [payload.embedData], components: [payload.componentsData] }).catch(() => {});
                            }
                        }
                    });
                }
            } catch (err) {
                logger.error('[GLOBAL CHAT INIT ERROR]', err);
            }
        })();
    }
};
