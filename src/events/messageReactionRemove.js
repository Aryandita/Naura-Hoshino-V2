const { logger } = require('../managers/logger');
const cacheManager = require('../managers/cacheManager');

// Bentuknya sengaja dibuat sama dengan messageReactionAdd agar keduanya
// mudah dibaca bersamaan.
const STAR_EMOJI = '\u2b50';
const HISTORY_LIMIT = 100;

module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        try {
            // Pencabutan bintang pada pesan lama juga datang dalam bentuk parsial.
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();

            if (reaction.emoji.name !== STAR_EMOJI) return;

            const message = reaction.message;
            if (!message.guild) return;
            if (user && user.bot) return;

            const settings = await cacheManager.getGuildSettings(message.guild.id);
            const config = settings && settings.settings ? settings.settings.starboard : null;
            if (!config || !config.enabled || !config.channelId) return;

            const starboardChannel = message.guild.channels.cache.get(config.channelId);
            if (!starboardChannel) return;
            if (message.channel.id === starboardChannel.id) return;

            const botId = message.client.user.id;
            const history = await starboardChannel.messages
                .fetch({ limit: HISTORY_LIMIT })
                .catch(() => null);
            if (!history) return;

            const existing = history.find(m =>
                m.author.id === botId &&
                m.embeds.length === 1 &&
                m.embeds[0].footer &&
                typeof m.embeds[0].footer.text === 'string' &&
                m.embeds[0].footer.text.includes(message.id)
            );

            // Tidak ada entri starboard untuk pesan ini, jadi tidak ada yang perlu
            // dikoreksi.
            if (!existing) return;

            const threshold = config.threshold || 3;
            const count = reaction.count || 0;

            if (count < threshold) {
                await existing.delete().catch(err =>
                    logger.warn(`[Starboard] Gagal menghapus entri: ${err.message}`)
                );
                return;
            }

            const content = `${STAR_EMOJI} **${count}** | <#${message.channel.id}>`;
            await existing.edit({ content }).catch(err =>
                logger.warn(`[Starboard] Gagal menurunkan hitungan: ${err.message}`)
            );
        } catch (error) {
            logger.error('[Starboard Remove Error]', error);
        }
    }
};
