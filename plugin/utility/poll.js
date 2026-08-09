const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('📊 Buat sistem voting interaktif.')
        .addStringOption(opt => opt.setName('pertanyaan').setDescription('Pertanyaan untuk polling').setRequired(true))
        .addStringOption(opt => opt.setName('pilihan_1').setDescription('Pilihan pertama').setRequired(true))
        .addStringOption(opt => opt.setName('pilihan_2').setDescription('Pilihan kedua').setRequired(true))
        .addStringOption(opt => opt.setName('pilihan_3').setDescription('Pilihan ketiga').setRequired(false))
        .addStringOption(opt => opt.setName('pilihan_4').setDescription('Pilihan keempat').setRequired(false))
        .addBooleanOption(opt => opt.setName('multi_vote').setDescription('Boleh memilih lebih dari satu? (Default: False)').setRequired(false))
        .addIntegerOption(opt => opt.setName('durasi').setDescription('Durasi polling dalam menit (Default: 60)').setRequired(false)),

    async execute(interaction) {
        const question = interaction.options.getString('pertanyaan');
        const multiVote = interaction.options.getBoolean('multi_vote') || false;
        const durationMin = interaction.options.getInteger('durasi') || 60;

        const options = [];
        for (let i = 1; i <= 4; i++) {
            const opt = interaction.options.getString(`pilihan_${i}`);
            if (opt) options.push(opt);
        }

        const votes = new Map();

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            authorName: '📊 Polling Baru!',
            iconURL: interaction.user.displayAvatarURL(),
            title: question,
            description: `Pilih salah satu opsi di bawah ini!\n${multiVote ? '*(Kamu bisa memilih lebih dari satu)*' : '*(Hanya bisa memilih satu)*'}\n\nBerakhir <t:${Math.floor(Date.now() / 1000) + (durationMin * 60)}:R>`,
            footerText: `Dibuat oleh ${interaction.user.username}`
        });

        const rows = [];
        let currentRow = new ActionRowBuilder();

        options.forEach((opt, index) => {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_opt_${index}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        if (currentRow.components.length > 0) rows.push(currentRow);

        const pollMessage = await interaction.reply({ ...payload, components: rows, fetchReply: true });

        const collector = pollMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: durationMin * 60 * 1000 });

        collector.on('collect', async i => {
            const optIndex = parseInt(i.customId.split('_')[2]);
            const userId = i.user.id;

            if (!votes.has(userId)) {
                votes.set(userId, new Set());
            }

            const userVotes = votes.get(userId);

            if (!multiVote && userVotes.size > 0 && !userVotes.has(optIndex)) {
                return i.reply({ content: `${ui.getEmoji('cross') || '❌'} Kamu hanya bisa memilih satu opsi pada polling ini.`, flags: MessageFlags.Ephemeral });
            }

            if (userVotes.has(optIndex)) {
                userVotes.delete(optIndex);
                await i.reply({ content: `Kamu telah membatalkan pilihanmu untuk: **${options[optIndex]}**`, flags: MessageFlags.Ephemeral });
            } else {
                userVotes.add(optIndex);
                await i.reply({ content: `Kamu memilih: **${options[optIndex]}**`, flags: MessageFlags.Ephemeral });
            }
        });

        collector.on('end', async () => {
            const results = new Array(options.length).fill(0);
            let totalVotes = 0;

            for (const [userId, userVotes] of votes.entries()) {
                for (const idx of userVotes) {
                    results[idx]++;
                    totalVotes++;
                }
            }

            let resultDesc = `**Total Suara: ${totalVotes}**\n\n`;
            options.forEach((opt, index) => {
                const percentage = totalVotes === 0 ? 0 : Math.round((results[index] / totalVotes) * 100);
                const barLength = Math.round(percentage / 10);
                const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
                resultDesc += `**${opt}** - ${results[index]} suara (${percentage}%)\n\`${bar}\`\n\n`;
            });

            const resultPayload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                authorName: '📊 Polling Berakhir',
                iconURL: interaction.user.displayAvatarURL(),
                title: question,
                description: resultDesc,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply({ ...resultPayload, components: [] });
        });
    }
};
