const { EmbedBuilder, AuditLogEvent, Collection } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const cacheManager = require('../managers/cacheManager');
const ui = require('../config/ui');

const SNIPE_TTL_MS = 10 * 60 * 1000;

function ensureSnipeStore(client) {
    if (!client.snipes) client.snipes = new Collection();
    return client.snipes;
}

function scheduleSnipeCleanup(client, channelId) {
    const cleanupTimer = setTimeout(() => {
        const snip = client.snipes?.get(channelId);
        if (snip && Date.now() - snip.timestamp >= SNIPE_TTL_MS) {
            client.snipes.delete(channelId);
        }
    }, SNIPE_TTL_MS);

    if (cleanupTimer.unref) cleanupTimer.unref();
}

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        if (message.author?.bot || !message.guild) return;

        // Snipe system. Cache ini bersifat sementara dan setiap entry punya cleanup TTL.
        const hasSensitiveData = /(password|sandi|sandi=|pw|token|apikey|http|www\.)/gi.test(message.content);
        if (!hasSensitiveData) {
            const snipes = ensureSnipeStore(client);
            snipes.set(message.channel.id, {
                content: message.content,
                author: message.author,
                image: message.attachments.first()?.proxyURL || null,
                timestamp: Date.now()
            });
            scheduleSnipeCleanup(client, message.channel.id);
        }

        try {
            // Ambil settingan log dari cache GuildSettings.
            const settings = await cacheManager.getGuildSettings(message.guild.id);
            const logChannelId = settings?.settings?.automod?.logChannelId;
            if (!logChannelId) return;

            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            // Cek apakah dihapus oleh moderator atau diri sendiri.
            const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete }).catch(() => null);
            const deletionLog = fetchedLogs ? fetchedLogs.entries.first() : null;
            
            let executorTag = `Diri Sendiri (@${message.author.username})`; 
            // Jika ada log mod menghapus pesan dan targetnya adalah pembuat pesan ini.
            if (deletionLog && deletionLog.target.id === message.author.id) {
                const executor = deletionLog.executor;
                executorTag = `Moderator: ${executor.globalName || executor.username} (@${executor.username})`;
            }

            const attachmentInfo = message.attachments.size > 0 
                ? `\n\n📁 **[Terdapat ${message.attachments.size} Lampiran/Gambar]**` 
                : '';

            const embed = new EmbedBuilder()
                .setColor(ui.getColor('error'))
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setTitle(`${ui.getEmoji('error') || '❌'} Pesan Lenyap / Dihapus`)
                .setDescription(`>>> Pesan milik <@${message.author.id}> di <#${message.channel.id}> telah dihapus.`)
                .addFields(
                    { name: `${ui.getEmoji('info') || 'ℹ️'} Dihapus Oleh`, value: `\`${executorTag}\``, inline: false },
                    { name: `${ui.getEmoji('desc') || '📋'} Konten Terakhir`, value: message.content ? `\`\`\`text\n${message.content.substring(0, 1000)}\n\`\`\`${attachmentInfo}` : '*Hanya berisi lampiran/embed/stiker*' }
                )
                .setFooter({ text: `User ID: ${message.author.id} • Channel ID: ${message.channel.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        } catch (e) {
            logger.error('[MSG DELETE LOG ERROR]', e);
        }
    }
};