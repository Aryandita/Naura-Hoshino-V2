const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const UserReminder = require('../../src/models/UserReminder');
const ui = require('../../src/config/ui');
const parseDuration = require('parse-duration');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('⏰ Atur pengingat agar Naura mengingatkanmu nanti.')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Buat pengingat baru.')
                .addStringOption(opt => opt.setName('durasi').setDescription('Contoh: 1h, 30m, 1d').setRequired(true))
                .addStringOption(opt => opt.setName('pesan').setDescription('Pesan yang ingin diingatkan').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Lihat daftar pengingatmu yang sedang aktif.')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Hapus pengingat berdasarkan ID.')
                .addIntegerOption(opt => opt.setName('id').setDescription('ID Pengingat').setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'create') {
            const durasi = interaction.options.getString('durasi');
            const pesan = interaction.options.getString('pesan');

            const ms = parseDuration(durasi);
            if (!ms) {
                const errPayload = buildErrorContainerV2({
                    title: 'Format Durasi Salah',
                    description: 'Format durasi tidak valid. Gunakan format seperti `1h`, `30m`, atau `1d`.',
                    footerText: ui.getFooter('utility')
                });
                return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
            }

            const remindAt = new Date(Date.now() + ms);

            await UserReminder.create({
                userId: interaction.user.id,
                channelId: interaction.channel.id,
                message: pesan,
                remindAt: remindAt
            });

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#00FF00',
                title: '⏰ Pengingat Disetel',
                description: `Baiklah! Aku akan mengingatkanmu tentang:\n**"${pesan}"**\nPada: <t:${Math.floor(remindAt.getTime() / 1000)}:F>`,
                footerText: ui.getFooter('utility')
            });

            await interaction.reply(payload);
        } else if (subcommand === 'list') {
            const reminders = await UserReminder.findAll({ where: { userId: interaction.user.id } });

            if (reminders.length === 0) {
                return interaction.reply({ content: 'Kamu tidak memiliki pengingat yang aktif saat ini.', flags: MessageFlags.Ephemeral });
            }

            let desc = '';
            for (const rem of reminders) {
                desc += `**ID: ${rem.id}** | <t:${Math.floor(new Date(rem.remindAt).getTime() / 1000)}:R>\n> ${rem.message}\n\n`;
            }

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: '⏰ Daftar Pengingat Aktif',
                description: desc.trim(),
                footerText: ui.getFooter('utility')
            });

            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        } else if (subcommand === 'delete') {
            const id = interaction.options.getInteger('id');
            const reminder = await UserReminder.findOne({ where: { id: id, userId: interaction.user.id } });

            if (!reminder) {
                const errPayload = buildErrorContainerV2({
                    title: 'Pengingat Tidak Ditemukan',
                    description: 'Pengingat dengan ID tersebut tidak ditemukan atau bukan milikmu.',
                    footerText: ui.getFooter('utility')
                });
                return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
            }

            await reminder.destroy();

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#00FF00',
                title: '✅ Pengingat Dihapus',
                description: `Pengingat dengan ID **${id}** berhasil dihapus dari sistem.`,
                footerText: ui.getFooter('utility')
            });

            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        }
    }
};
