const { SlashCommandBuilder } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('📖 Dapatkan kutipan inspirasional acak.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const response = await fetch('https://api.quotable.io/random');
            if (!response.ok) {
                throw new Error('API down');
            }
            const data = await response.json();

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('accent') || '#9b59b6',
                authorName: '💡 Kutipan Hari Ini',
                title: data.author ? `Quote oleh ${data.author}` : 'Kutipan Inspirasional',
                description: `*"${data.content}"*\n\n— **${data.author}**`,
                footerText: data.tags && data.tags.length > 0 ? `Tags: ${data.tags.join(', ')}` : ui.getFooter('utility')
            });

            await interaction.editReply(payload);
        } catch (error) {
            const fallbacks = [
                { content: "Keberhasilan bukanlah akhir, kegagalan bukanlah hal yang fatal: keberanian untuk melanjutkannya yang paling penting.", author: "Winston S. Churchill" },
                { content: "Cara terbaik untuk memprediksi masa depan adalah dengan menciptakannya.", author: "Abraham Lincoln" },
                { content: "Satu-satunya cara untuk melakukan pekerjaan hebat adalah dengan mencintai apa yang Anda lakukan.", author: "Steve Jobs" }
            ];
            const data = fallbacks[Math.floor(Math.random() * fallbacks.length)];

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('accent') || '#9b59b6',
                authorName: '💡 Kutipan Hari Ini',
                title: `Quote oleh ${data.author}`,
                description: `*"${data.content}"*\n\n— **${data.author}**`,
                footerText: ui.getFooter('utility')
            });

            await interaction.editReply(payload);
        }
    }
};
