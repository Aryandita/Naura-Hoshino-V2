const { EmbedBuilder } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const GuildSettings = require('../models/GuildSettings');
const cacheManager = require('../managers/cacheManager');

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user, client) {
        // Hanya pedulikan reaksi bintang
        if (reaction.emoji.name !== '⭐') return;

        // Pastikan pesannya utuh
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                logger.error('[Starboard] Something went wrong when fetching the message: ', error);
                return;
            }
        }

        const message = reaction.message;
        if (!message.guild) return; // Ignore DMs
        if (message.author.bot) return; // Optional: Jangan starboard pesan bot

        // Cek setting guild
        try {
            const settings = await cacheManager.getGuildSettings(message.guild.id);
            if (!settings || !settings.settings || !settings.settings.starboard || !settings.settings.starboard.enabled) return;

            const starboardConfig = settings.settings.starboard;
            const threshold = starboardConfig.threshold || 3;

            // Cek apakah jumlah star memenuhi syarat
            if (reaction.count < threshold) return;

            const starboardChannel = message.guild.channels.cache.get(starboardConfig.channelId);
            if (!starboardChannel) return; // Channel dihapus / ga ketemu

            // Jangan biarkan pesan dari starboard di-starboard lagi
            if (message.channel.id === starboardChannel.id) return;

            // Ambil history starboard channel (50 pesan terakhir) untuk cek apakah pesan ini udah di-starboard sebelumnya
            const fetchedMessages = await starboardChannel.messages.fetch({ limit: 50 });

            // Cek apakah sudah ada pesan dengan ID original message
            const existingStarMessage = fetchedMessages.find(m =>
                m.embeds.length === 1 &&
                m.embeds[0].footer &&
                m.embeds[0].footer.text.includes(message.id)
            );

            // Kalau udah ada, update count-nya aja
            if (existingStarMessage) {
                const starMsg = `⭐ **${reaction.count}** | <#${message.channel.id}>`;
                await existingStarMessage.edit({ content: starMsg });
                return;
            }

            // Kalau belum ada, bikin embed baru
            const embed = new EmbedBuilder()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setColor('#f1c40f')
                .setDescription(message.content ? message.content : '*[No text content]*')
                .addFields({ name: 'Source', value: `[Lompat ke Pesan](${message.url})` })
                .setFooter({ text: `ID: ${message.id}` })
                .setTimestamp(message.createdTimestamp);

            // Pasang attachment gambar kalau ada
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                    embed.setImage(attachment.url);
                }
            }

            const starMsgContent = `⭐ **${reaction.count}** | <#${message.channel.id}>`;
            await starboardChannel.send({ content: starMsgContent, embeds: [embed] });

        } catch (error) {
            logger.error('[Starboard Process Error]', error);
        }
    }
};
