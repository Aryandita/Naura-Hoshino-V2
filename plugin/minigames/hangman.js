const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const ui = require('../../src/config/ui');

const words = [
    'DISCORD', 'JAVASCRIPT', 'PROGRAMMING', 'BOT', 'SERVER',
    'INDONESIA', 'COMPUTER', 'INTERNET', 'DEVELOPER', 'KEYBOARD',
    'GAMING', 'ANIME', 'MUSIC', 'SYSTEM', 'DATABASE'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('🔤 Main game tebak kata (Hangman) interaktif.'),

    async execute(interaction) {
        const word = words[Math.floor(Math.random() * words.length)];
        let guessed = new Set();
        let mistakes = 0;
        const maxMistakes = 6;

        const stages = [
            `\n\n\n\n\n===`,
            `\n  |\n  |\n  |\n  |\n===`,
            `  +---+\n  |\n  |\n  |\n  |\n===`,
            `  +---+\n  |   O\n  |\n  |\n  |\n===`,
            `  +---+\n  |   O\n  |   |\n  |\n  |\n===`,
            `  +---+\n  |   O\n  |  /|\\\n  |\n  |\n===`,
            `  +---+\n  |   O\n  |  /|\\\n  |  / \\\n  |\n===`
        ];

        const generateBoard = () => {
            const displayWord = word.split('').map(char => guessed.has(char) ? char : '_').join(' ');
            return `\`\`\`\n${stages[mistakes]}\n\nKata: ${displayWord}\n\nTebakan: ${Array.from(guessed).join(', ')}\n\`\`\``;
        };

        const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

        const generatePayload = () => {
            return buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#3498db',
                authorName: 'Naura Hangman System',
                title: `🔤 Hangman Game (Sisa Nyawa: ${maxMistakes - mistakes})`,
                description: `${generateBoard()}\n\n> *Ketik 1 huruf di chat untuk menebak!*`,
                footerText: ui.getFooter('core')
            });
        };

        await interaction.reply(generatePayload());

        const filter = m => m.author.id === interaction.user.id && m.content.length === 1 && /[a-zA-Z]/.test(m.content);
        const collector = interaction.channel.createMessageCollector({ filter, time: 300000 });

        collector.on('collect', async m => {
            const char = m.content.toUpperCase();
            m.delete().catch(() => {});

            if (guessed.has(char)) {
                return; // Already guessed
            }

            guessed.add(char);

            if (!word.includes(char)) {
                mistakes++;
            }

            const isWin = word.split('').every(c => guessed.has(c));
            const isLose = mistakes >= maxMistakes;

            if (isWin || isLose) {
                collector.stop();

                const finalPayload = buildContainerV2({
                    accentColorHex: isWin ? (ui.getColor('success') || '#00FF00') : (ui.getColor('error') || '#FF0000'),
                    authorName: 'Naura Hangman System',
                    title: isWin ? '🏆 Kamu Menang!' : '💀 Kamu Kalah!',
                    description: `\`\`\`\n${stages[mistakes]}\n\nKata yang benar adalah: ${word}\n\`\`\``,
                    footerText: ui.getFooter('core')
                });

                await interaction.editReply(finalPayload);
            } else {
                await interaction.editReply(generatePayload());
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                const timeoutPayload = buildContainerV2({
                    accentColorHex: '#FF0000',
                    authorName: 'Naura Hangman System',
                    title: '⏰ Waktu Habis',
                    description: `Kamu terlalu lama berpikir! Kata yang benar adalah: **${word}**`,
                    footerText: ui.getFooter('core')
                });
                interaction.editReply(timeoutPayload).catch(() => {});
            }
        });
    }
};
