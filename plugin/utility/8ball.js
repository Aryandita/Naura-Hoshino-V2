const { SlashCommandBuilder } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('🎱 Tanyakan sesuatu pada bola ajaib.')
        .addStringOption(opt => opt.setName('pertanyaan').setDescription('Pertanyaan Yes/No kamu').setRequired(true)),

    async execute(interaction) {
        const question = interaction.options.getString('pertanyaan');

        const answers = [
            'Tentu saja!', 'Itu sudah pasti.', 'Tanpa ragu lagi.', 'Ya, pastinya.',
            'Bisa diandalkan.', 'Menurutku begitu.', 'Kelihatannya bagus.', 'Iya.',
            'Sangat mungkin.', 'Firasatku mengatakan ya.', 'Coba tanya lagi nanti.',
            'Sebaiknya jangan kuberitahu sekarang.', 'Tidak bisa diprediksi sekarang.',
            'Konsentrasi dan tanya lagi.', 'Jangan terlalu berharap.', 'Jawabannya tidak.',
            'Sumberku mengatakan tidak.', 'Kelihatannya tidak bagus.', 'Sangat meragukan.'
        ];

        const answer = answers[Math.floor(Math.random() * answers.length)];

        let color = ui.getColor('primary') || '#2b2d31';
        if (answers.indexOf(answer) < 10) color = ui.getColor('success') || '#22c55e';
        else if (answers.indexOf(answer) < 14) color = '#f1c40f';
        else color = ui.getColor('error') || '#ef4444';

        const payload = buildContainerV2({
            accentColorHex: color,
            authorName: '🎱 Magic 8-Ball',
            description: `**Pertanyaan:**\n${question}\n\n**Jawaban:**\n**${answer}**`,
            footerText: `Ditanyakan oleh ${interaction.user.username}`
        });

        await interaction.reply(payload);
    }
};
