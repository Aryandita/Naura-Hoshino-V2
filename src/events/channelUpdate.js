const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const GuildSettings = require('../models/GuildSettings');
const cacheManager = require('../managers/cacheManager');
const ui = require('../config/ui');

module.exports = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel, client) {
        if (!oldChannel || !newChannel || !oldChannel.guild) return;
        const guild = oldChannel.guild;

        try {
            const settings = await cacheManager.getGuildSettings(guild.id);
            const logChannelId = settings?.settings?.automod?.logChannelId;

            if (!logChannelId) return;

            const logChannel = guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            // Kita cari tahu apa yang berubah
            let changes = [];
            
            if (oldChannel.name !== newChannel.name) {
                changes.push(`**Nama:** \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
            }
            if (oldChannel.topic !== newChannel.topic) {
                changes.push(`**Topik:** ${oldChannel.topic ? `\`${oldChannel.topic}\`` : '*Kosong*'} ➔ ${newChannel.topic ? `\`${newChannel.topic}\`` : '*Kosong*'}`);
            }
            if (oldChannel.nsfw !== newChannel.nsfw) {
                changes.push(`**NSFW:** \`${oldChannel.nsfw ? 'Ya' : 'Tidak'}\` ➔ \`${newChannel.nsfw ? 'Ya' : 'Tidak'}\``);
            }
            if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
                changes.push(`**Slowmode:** \`${oldChannel.rateLimitPerUser || 0}s\` ➔ \`${newChannel.rateLimitPerUser || 0}s\``);
            }
            if (oldChannel.parentId !== newChannel.parentId) {
                changes.push(`**Kategori:** ${oldChannel.parent ? `\`${oldChannel.parent.name}\`` : '*Tidak ada*'} ➔ ${newChannel.parent ? `\`${newChannel.parent.name}\`` : '*Tidak ada*'}`);
            }

            // Jika tidak ada perubahan yang signifikan yang kita pantau, abaikan
            if (changes.length === 0) return;

            // Ambil data dari Audit Log untuk tahu siapa pelakunya
            let executorTag = 'Tidak diketahui';
            let executorIcon = null;
            try {
                const fetchedLogs = await guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.ChannelUpdate,
                });
                const auditLog = fetchedLogs.entries.first();

                if (auditLog && auditLog.target.id === newChannel.id && (Date.now() - auditLog.createdTimestamp < 5000)) {
                    executorTag = auditLog.executor.tag;
                    executorIcon = auditLog.executor.displayAvatarURL();
                }
            } catch (error) {
                // Abaikan jika tidak punya akses audit log
            }

            const embed = new EmbedBuilder()
                .setColor(ui.getColor('primary'))
                .setTitle(`${ui.getEmoji('info') || '📝'} Saluran Diperbarui`)
                .setDescription(`>>> Saluran <#${newChannel.id}> (\`${newChannel.name}\`) baru saja mengalami perubahan pengaturan.`)
                .addFields({ name: `${ui.getEmoji('id') || '📋'} Perincian Perubahan`, value: changes.join('\n') })
                .setFooter({ text: `Diubah oleh: ${executorTag}`, iconURL: executorIcon })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});

        } catch (error) {
            logger.error('[AUDIT LOG ERROR]', error);
        }
    }
};
