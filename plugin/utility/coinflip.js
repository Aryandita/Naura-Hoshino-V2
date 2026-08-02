const { SlashCommandBuilder } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('🪙 Lempar koin (Heads / Tails).'),

    async execute(interaction) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const imgUrl = result === 'Heads'
            ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/2006_Quarter_Proof.png/244px-2006_Quarter_Proof.png'
            : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/2006_Quarter_Reverse_Proof.png/244px-2006_Quarter_Reverse_Proof.png';

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#f1c40f',
            authorName: `${interaction.user.username} melempar koin...`,
            iconURL: interaction.user.displayAvatarURL(),
            description: `Dan hasilnya adalah... **${result}**!`,
            footerText: ui.getFooter('core')
        });

        await interaction.reply(payload);
    }
};
