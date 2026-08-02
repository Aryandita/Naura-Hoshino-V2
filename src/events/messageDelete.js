const { EmbedBuilder, AuditLogEvent, Collection } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const GuildSettings = require('../models/GuildSettings'); // Ambil database
const cacheManager = require('../managers/cacheManager');
const ui = require('../config/ui');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        if (message.author?.bot || !message.guild) return;

        // Snipe system
        const hasSensitiveData = /(password|sandi|sandi=|pw|token|apikey|http|www\.)/gi.test(message.content);
        if (!hasSensitiveData) {
            if (!client.snipes) client.snipes = new Collection();
            client.snipes.set(message.channel.id, {
                content: message.content,
                author: message.author,
                image: message.attachments.first()?.proxyURL || null,
                timestamp: Date.now()
            });
            // Auto cleanup snipes older than 10 minutes (Rule 1.8 Memory Safety)
            setTimeout(() => {
                const snip = client.snipes.get(message.channel.id);
                if (snip && Date.now() - snip.timestamp >= 600000) {
                    client.snipes.delete(message.channel.id);
                }
            }, 600000).unref?.();
        }

        try {
            // Ambil settingan log dari database Automod
            const settings = await cacheManager.getGuildSettings(message.guild.id);
            const logChannelId = settings?.settings?.automod?.logChannelId;
            if (!logChannelId) return;

            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

           // 🔍 CEK APAKAH DIHAPUS OLEH MOD ATAU DIRI SENDIRI
            const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete }).catch(() => null);
            const deletionLog = fetchedLogs ? fetchedLogs.entries.first() : null;
            
            let executorTag = `Diri Sendiri (@${message.author.username})`; 
            // Jika ada log mod menghapus pesan dan targetnya adalah pembuat pesan ini
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