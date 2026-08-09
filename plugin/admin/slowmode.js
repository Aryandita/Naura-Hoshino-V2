const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const parseDuration = require('parse-duration');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('🐌 Atur mode lambat (slowmode) di channel ini.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
        .addStringOption(opt => opt.setName('durasi').setDescription('Durasi slowmode (contoh: 5s, 10s, 1m, 1h, off)').setRequired(true))
        .addStringOption(opt => opt.setName('alasan').setDescription('Alasan mengatur slowmode').setRequired(false)),

    async execute(interaction) {
        const durasiStr = interaction.options.getString('durasi').toLowerCase();
        const alasan = interaction.options.getString('alasan') || 'Tidak ada alasan diberikan';

        let seconds = 0;
        if (durasiStr !== 'off' && durasiStr !== '0') {
            const ms = parseDuration(durasiStr);
            if (!ms) {
                const errPayload = buildErrorContainerV2({ title: 'Format Salah', description: '❌ Format durasi tidak valid. Gunakan format seperti `5s`, `10s`, `1m`, `1h`, atau `off`.', footerText: ui.getFooter('core') });
                return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
            }
            seconds = Math.floor(ms / 1000);

            if (seconds > 21600) {
                const errPayload = buildErrorContainerV2({ title: 'Batas Maksimum', description: '❌ Durasi maksimum untuk slowmode adalah 6 jam (21600 detik).', footerText: ui.getFooter('core') });
                return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
            }
        }

        try {
            await interaction.channel.setRateLimitPerUser(seconds, alasan);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: '🐌 Slowmode Diperbarui',
                iconURL: interaction.user.displayAvatarURL(),
                description: `Slowmode di channel ini telah disetel ke **${seconds === 0 ? 'Mati (Off)' : `${seconds} detik`}**.\n> **Alasan:** ${alasan}`,
                footerText: ui.getFooter('core')
            });

            await interaction.reply(payload);
        } catch (error) {
            logger.error('[Slowmode Error]', error);
            const errPayload = buildErrorContainerV2({ title: 'Gagal Set Slowmode', description: '❌ Gagal mengatur slowmode. Pastikan bot memiliki izin Manage Channels.', footerText: ui.getFooter('core') });
            await interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }
    }
};
