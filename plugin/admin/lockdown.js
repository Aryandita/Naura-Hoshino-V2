const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('🔒 Mengunci channel atau server untuk mencegah pesan dari member biasa.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels | PermissionsBitField.Flags.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('channel')
            .setDescription('Kunci channel ini.')
            .addStringOption(opt => opt.setName('alasan').setDescription('Alasan lockdown').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('server')
            .setDescription('Kunci SELURUH SERVER (Hati-hati!).')
            .addStringOption(opt => opt.setName('alasan').setDescription('Alasan lockdown server').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('unlock')
            .setDescription('Buka kunci channel atau server yang sedang di-lockdown.')
            .addStringOption(opt => opt.setName('target').setDescription('Apa yang ingin di-unlock?').setRequired(true).addChoices(
                { name: 'Channel Ini', value: 'channel' },
                { name: 'Seluruh Server', value: 'server' }
            ))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const reason = interaction.options.getString('alasan') || 'Keadaan Darurat / Moderasi';
        const everyoneRole = interaction.guild.roles.everyone;

        await interaction.deferReply();

        try {
            if (subcommand === 'channel') {
                await interaction.channel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: false
                });

                const channelLockPayload = buildContainerV2({
                    accentColorHex: ui.getColor('error') || '#ff0000',
                    title: `${ui.getEmoji('lock') || '🔒'} CHANNEL LOCKED`,
                    description: `Channel ini telah dikunci oleh staff.\n**Alasan:** ${reason}`,
                    footerText: ui.getFooter('core')
                });
                await interaction.channel.send(channelLockPayload);

                const payload = buildContainerV2({
                    accentColorHex: ui.getColor('error') || '#ff0000',
                    title: `${ui.getEmoji('lock') || '🔒'} CHANNEL LOCKED`,
                    description: `Channel ini telah dikunci sementara oleh moderator.\n> **Alasan:** ${reason}`,
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(payload);
            }
            else if (subcommand === 'server') {
                const channels = await interaction.guild.channels.fetch();
                let lockedCount = 0;

                for (const [, channel] of channels) {
                    if (channel && channel.isTextBased() && channel.permissionsFor(everyoneRole).has(PermissionsBitField.Flags.ViewChannel)) {
                        await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }).catch(() => {});
                        lockedCount++;
                    }
                }

                const payload = buildContainerV2({
                    accentColorHex: ui.getColor('error') || '#ff0000',
                    title: `${ui.getEmoji('alert') || '🚨'} SERVER LOCKDOWN ${ui.getEmoji('alert') || '🚨'}`,
                    description: `Seluruh server telah dikunci. Member biasa tidak bisa mengirim pesan di ${lockedCount} channel.\n> **Alasan:** ${reason}`,
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(payload);
            }
            else if (subcommand === 'unlock') {
                const target = interaction.options.getString('target');

                if (target === 'channel') {
                    await interaction.channel.permissionOverwrites.edit(everyoneRole, {
                        SendMessages: null
                    });

                    const payload = buildContainerV2({
                        accentColorHex: ui.getColor('success') || '#22c55e',
                        title: `${ui.getEmoji('unlock') || '🔓'} CHANNEL UNLOCKED`,
                        description: 'Kunci channel ini telah dibuka.',
                        footerText: ui.getFooter('core')
                    });

                    await interaction.editReply(payload);
                } else {
                    const channels = await interaction.guild.channels.fetch();
                    let unlockedCount = 0;

                    for (const [, channel] of channels) {
                        if (channel && channel.isTextBased()) {
                            await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null }).catch(() => {});
                            unlockedCount++;
                        }
                    }

                    const payload = buildContainerV2({
                        accentColorHex: ui.getColor('success') || '#22c55e',
                        title: `${ui.getEmoji('unlock') || '🔓'} SERVER UNLOCKED`,
                        description: `Lockdown server telah dicabut. ${unlockedCount} channel dikembalikan ke pengaturan awal.`,
                        footerText: ui.getFooter('core')
                    });

                    await interaction.editReply(payload);
                }
            }
        } catch (error) {
            logger.error('[Lockdown Error]', error);
            const errPayload = buildErrorContainerV2({ title: 'Gagal Lockdown', description: `${ui.getEmoji('error') || '❌'} Gagal melakukan lockdown. Pastikan bot memiliki izin Administrator atau Manage Channels/Roles yang cukup.`, footerText: ui.getFooter('core') });
            await interaction.editReply(errPayload);
        }
    }
};
