const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const GuildSettings = require('../../src/models/GuildSettings');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qotd')
        .setDescription('❓ Atur Question of the Day (Pertanyaan Harian).')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('setup')
            .setDescription('Aktifkan QOTD dan pilih channel pengiriman.')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel untuk mengirim QOTD').setRequired(true))
            .addStringOption(opt => opt.setName('jam').setDescription('Jam pengiriman (Format HH:MM, contoh 08:00)').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('add')
            .setDescription('Tambahkan daftar pertanyaan ke bank QOTD.')
            .addStringOption(opt => opt.setName('pertanyaan').setDescription('Pertanyaannya').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
            .setDescription('Lihat daftar pertanyaan di bank QOTD.')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
            .setDescription('Matikan fitur QOTD otomatis.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            let [settings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
            const currentSettings = settings.settings || {};

            if (!currentSettings.qotd) {
                currentSettings.qotd = { enabled: false, channelId: null, questions: [], lastAsked: null, time: '08:00' };
            }

            if (subcommand === 'setup') {
                const channel = interaction.options.getChannel('channel');
                const time = interaction.options.getString('jam') || '08:00';

                if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                    const errPayload = buildErrorContainerV2({ title: 'Format Salah', description: '❌ Format jam tidak valid. Gunakan format `HH:MM` (contoh: 08:30).', footerText: ui.getFooter('core') });
                    return interaction.editReply(errPayload);
                }

                currentSettings.qotd.enabled = true;
                currentSettings.qotd.channelId = channel.id;
                currentSettings.qotd.time = time;

                settings.settings = currentSettings;
                settings.changed('settings', true);
                await settings.save();

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: 'QOTD Aktif',
                    description: `✅ QOTD berhasil diaktifkan! Pertanyaan akan dikirim ke <#${channel.id}> setiap jam **${time}**.`,
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(successPayload);
            }
            else if (subcommand === 'add') {
                const q = interaction.options.getString('pertanyaan');
                currentSettings.qotd.questions.push(q);

                settings.settings = currentSettings;
                settings.changed('settings', true);
                await settings.save();

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: 'Pertanyaan Ditambahkan',
                    description: `✅ Pertanyaan ditambahkan! Sekarang ada **${currentSettings.qotd.questions.length}** pertanyaan di bank QOTD.`,
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(successPayload);
            }
            else if (subcommand === 'list') {
                const qs = currentSettings.qotd.questions;
                if (!qs || qs.length === 0) {
                    const errPayload = buildErrorContainerV2({ title: 'Bank Kosong', description: '❌ Bank QOTD kosong.', footerText: ui.getFooter('core') });
                    return interaction.editReply(errPayload);
                }

                const listPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#2b2d31',
                    title: `❓ Bank QOTD (${qs.length} Total)`,
                    description: qs.map((q, i) => `**${i+1}.** ${q}`).join('\n').substring(0, 4000),
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(listPayload);
            }
            else if (subcommand === 'disable') {
                currentSettings.qotd.enabled = false;

                settings.settings = currentSettings;
                settings.changed('settings', true);
                await settings.save();

                const disablePayload = buildContainerV2({
                    accentColorHex: ui.getColor('secondary') || '#6b7280',
                    title: 'QOTD Dimatikan',
                    description: '✅ QOTD otomatis telah dimatikan.',
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(disablePayload);
            }
        } catch (error) {
            logger.error('[QOTD Error]', error);
            const errPayload = buildErrorContainerV2({ title: 'Gagal System', description: '❌ Terjadi kesalahan saat mengelola QOTD.', footerText: ui.getFooter('core') });
            await interaction.editReply(errPayload);
        }
    }
};
