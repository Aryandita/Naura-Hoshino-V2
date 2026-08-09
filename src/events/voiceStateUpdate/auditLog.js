const { PermissionFlagsBits, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { logger } = require('../../managers/logger');
const cacheManager = require('../../managers/cacheManager');
const ui = require('../../config/ui');

// Audit log di-cache sebentar. Tanpa ini, satu ruangan yang bubar berisi 20
// orang memicu 20 panggilan fetchAuditLogs beruntun, dan semuanya menanyakan
// entri yang sama persis.
const auditLogCache = new Map();
const AUDIT_CACHE_MS = 5000;

async function fetchRecentAuditEntry(guild, type) {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

    const cacheKey = `${guild.id}:${type}`;
    const cached = auditLogCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < AUDIT_CACHE_MS) return cached.entry;

    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type }).catch(() => null);
    const entry = fetchedLogs ? fetchedLogs.entries.first() : null;
    auditLogCache.set(cacheKey, { entry, fetchedAt: Date.now() });
    return entry;
}

module.exports = {
    name: 'auditLog',
    async execute(oldState, newState, client) {
        const { member, guild } = newState;
        if (!member || member.user.bot) return;

        try {
            const settings = await cacheManager.getGuildSettings(guild.id);
            const automod = settings?.settings?.automod;

            const logChannelId = automod?.logChannel || automod?.logChannelId;

            if (logChannelId) {
                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel) {

                    if (!oldState.channelId && newState.channelId) {
                        // 🟢 JOIN VOICE
                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('success'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('online') || '🔊'} Terhubung ke Voice`)
                            .setDescription(`>>> <@${member.id}> telah bergabung ke dalam saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi') || '📍'} Saluran Suara`, value: `<#${newState.channelId}>`, inline: true }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});

                    } else if (oldState.channelId && !newState.channelId) {
                        // 🔴 LEAVE / DISCONNECT VOICE
                        const disconnectLog = await fetchRecentAuditEntry(guild, AuditLogEvent.MemberDisconnect);

                        let executorTag = `Keluar Sendiri`;
                        if (disconnectLog && (Date.now() - disconnectLog.createdTimestamp < 5000)) {
                            executorTag = `Diputus oleh: ${disconnectLog.executor.globalName || disconnectLog.executor.username}`;
                        }

                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('error'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('offline') || '🔇'} Keluar dari Voice`)
                            .setDescription(`>>> <@${member.id}> telah meninggalkan saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi') || '📍'} Channel Terakhir`, value: `<#${oldState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('info') || 'ℹ️'} Keterangan`, value: `\`${executorTag}\``, inline: true }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});

                    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                        // 🔄 MOVE VOICE (Pindah Channel)
                        const moveLog = await fetchRecentAuditEntry(guild, AuditLogEvent.MemberMove);

                        let executorTag = `Pindah Sendiri`;
                        if (moveLog && (Date.now() - moveLog.createdTimestamp < 5000)) {
                            executorTag = `Dipindah oleh: ${moveLog.executor.globalName || moveLog.executor.username}`;
                        }

                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('primary'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('move') || '🔄'} Pindah Channel Voice`)
                            .setDescription(`>>> <@${member.id}> berpindah saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi') || '📍'} Dari`, value: `<#${oldState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('lokasi') || '📍'} Ke`, value: `<#${newState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('info') || 'ℹ️'} Keterangan`, value: `\`${executorTag}\``, inline: false }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});
                    }
                }
            }
        } catch (error) {
            logger.error('[VOICE LOG ERROR]', error);
        }
    }
};
