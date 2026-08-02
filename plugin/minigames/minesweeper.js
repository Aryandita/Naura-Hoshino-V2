const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ui = require('../../src/config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('minesweeper')
        .setDescription('💣 Mainkan game Minesweeper klasik di Discord!')
        .addIntegerOption(opt => opt.setName('ukuran').setDescription('Ukuran grid (5-14)').setRequired(false).setMinValue(5).setMaxValue(14))
        .addIntegerOption(opt => opt.setName('bom').setDescription('Jumlah bom').setRequired(false).setMinValue(1)),

    async execute(interaction) {
        let size = interaction.options.getInteger('ukuran') || 9;
        let bombs = interaction.options.getInteger('bom') || Math.floor(size * size * 0.15); // 15% bomb density

        if (bombs >= size * size) {
            bombs = (size * size) - 1;
        }

        const grid = Array.from({ length: size }, () => Array(size).fill(0));

        // Place bombs
        let bombsPlaced = 0;
        while (bombsPlaced < bombs) {
            const r = Math.floor(Math.random() * size);
            const c = Math.floor(Math.random() * size);
            if (grid[r][c] !== 'B') {
                grid[r][c] = 'B';
                bombsPlaced++;
            }
        }

        // Calculate numbers
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c] === 'B') continue;

                let count = 0;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        if (r + i >= 0 && r + i < size && c + j >= 0 && c + j < size) {
                            if (grid[r + i][c + j] === 'B') count++;
                        }
                    }
                }
                grid[r][c] = count;
            }
        }

        const numberEmojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

        let boardString = '';
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = grid[r][c];
                const emoji = cell === 'B' ? '💥' : numberEmojis[cell];
                boardString += `||${emoji}||`;
            }
            boardString += '\n';
        }

        if (boardString.length > 4000) {
            return interaction.reply({ content: '❌ Grid terlalu besar, melebihi batas karakter Discord.', ephemeral: true });
        }

        const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#95a5a6',
            authorName: 'Naura Minesweeper Engine',
            title: `💣 Minesweeper (${size}x${size}) - ${bombs} Bom`,
            description: `Klik blok spoiler di bawah ini untuk mengungkap bidang!\n\n${boardString}`,
            footerText: ui.getFooter('core')
        });

        await interaction.reply(payload);
    }
};
