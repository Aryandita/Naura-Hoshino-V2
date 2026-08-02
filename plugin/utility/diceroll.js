const { SlashCommandBuilder } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diceroll')
        .setDescription('🎲 Lempar dadu (pilih jumlah sisi).')
        .addIntegerOption(opt => opt.setName('sisi').setDescription('Jumlah sisi dadu (contoh: 6, 20)').setRequired(false).setMinValue(2).setMaxValue(100)),

    async execute(interaction) {
        const sides = interaction.options.getInteger('sisi') || 6;
        const result = Math.floor(Math.random() * sides) + 1;

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#e74c3c',
            authorName: '🎲 Roll Dadu',
            title: `Dadu D${sides}`,
            iconURL: interaction.user.displayAvatarURL(),
            description: `Kamu melempar dadu **D${sides}** dan mendapatkan angka:\n\n# 🎲 ${result}`,
            footerText: ui.getFooter('utility')
        });

        await interaction.reply(payload);
    }
};
