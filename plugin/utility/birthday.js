const { SlashCommandBuilder } = require('discord.js');
const UserBirthday = require('../../src/models/UserBirthday');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('🎂 Atur dan lihat tanggal ulang tahun member.')
        .addSubcommand(sub =>
            sub.setName('set')
            .setDescription('Atur tanggal ulang tahunmu.')
            .addIntegerOption(opt => opt.setName('tanggal').setDescription('Tanggal lahir (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
            .addIntegerOption(opt => opt.setName('bulan').setDescription('Bulan lahir (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
            .addIntegerOption(opt => opt.setName('tahun').setDescription('Tahun lahir (Opsional)').setRequired(false).setMinValue(1900).setMaxValue(new Date().getFullYear()))
        )
        .addSubcommand(sub =>
            sub.setName('check')
            .setDescription('Cek ulang tahun seseorang.')
            .addUserOption(opt => opt.setName('user').setDescription('Pilih user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('upcoming')
            .setDescription('Lihat siapa saja yang akan berulang tahun di server ini dalam waktu dekat.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const day = interaction.options.getInteger('tanggal');
            const month = interaction.options.getInteger('bulan');
            const year = interaction.options.getInteger('tahun');

            const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            const daysInMonth = [31, (year && isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

            if (day > daysInMonth[month - 1]) {
                return interaction.reply({ content: `${ui.getEmoji('cross') || '❌'} Tanggal tidak valid! Bulan ${month} hanya memiliki ${daysInMonth[month - 1]} hari.`, flags: MessageFlags.Ephemeral });
            }

            let [bday, created] = await UserBirthday.findOrCreate({
                where: { userId: interaction.user.id },
                defaults: { day, month, year }
            });

            if (!created) {
                bday.day = day;
                bday.month = month;
                bday.year = year;
                await bday.save();
            }

            const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            await interaction.reply({ content: `${ui.getEmoji('success') || '✅'} Berhasil mencatat ulang tahunmu pada **${day} ${monthNames[month - 1]}${year ? ` ${year}` : ''}**!` });
        }
        else if (subcommand === 'check') {
            const user = interaction.options.getUser('user');
            const bday = await UserBirthday.findByPk(user.id);

            if (!bday) {
                return interaction.reply({ content: `${ui.getEmoji('cross') || '❌'} **${user.username}** belum mengatur tanggal ulang tahunnya.`, flags: MessageFlags.Ephemeral });
            }

            const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            const today = new Date();
            let nextBday = new Date(today.getFullYear(), bday.month - 1, bday.day);
            if (today > nextBday) {
                nextBday.setFullYear(today.getFullYear() + 1);
            }

            const daysLeft = Math.ceil((nextBday - today) / (1000 * 60 * 60 * 24));
            let footerText = ui.getFooter('core');
            if (bday.year) {
                const age = today.getFullYear() - bday.year - (today < new Date(today.getFullYear(), bday.month - 1, bday.day) ? 1 : 0);
                footerText = `Usia saat ini: ${age} tahun`;
            }

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                authorName: `🎂 Ulang Tahun ${user.username}`,
                iconURL: user.displayAvatarURL(),
                description: `Lahir pada: **${bday.day} ${monthNames[bday.month - 1]}${bday.year ? ` ${bday.year}` : ''}**\n\nUlang tahun berikutnya dalam **${daysLeft} hari**! 🎉`,
                footerText
            });

            await interaction.reply(payload);
        }
        else if (subcommand === 'upcoming') {
            await interaction.deferReply();

            const members = await interaction.guild.members.fetch();
            const memberIds = members.map(m => m.id);

            const birthdays = await UserBirthday.findAll({
                where: { userId: memberIds }
            });

            if (birthdays.length === 0) {
                return interaction.editReply(`${ui.getEmoji('cross') || '❌'} Belum ada member di server ini yang mendaftarkan ulang tahun mereka.`);
            }

            const today = new Date();

            const sortedBirthdays = birthdays.map(b => {
                let nextBday = new Date(today.getFullYear(), b.month - 1, b.day);
                if (today > nextBday) nextBday.setFullYear(today.getFullYear() + 1);

                const daysLeft = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return { ...b.toJSON(), daysLeft, nextBday };
            }).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 10);

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

            const desc = sortedBirthdays.map((b, i) => {
                const isToday = b.daysLeft === 0;
                return `**${i + 1}.** <@${b.userId}> - **${b.day} ${monthNames[b.month - 1]}** ${isToday ? '**(HARI INI!)**' : `(Dalam ${b.daysLeft} hari)`}`;
            }).join('\n');

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('accent') || '#FFB6C1',
                title: '🎉 10 Ulang Tahun Terdekat di Server Ini',
                description: desc,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(payload);
        }
    }
};
