const { SlashCommandBuilder } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qr')
        .setDescription('📱 Buat QR Code dari teks atau URL.')
        .addStringOption(opt => opt.setName('teks').setDescription('Teks atau URL yang ingin diubah menjadi QR Code').setRequired(true)),

    async execute(interaction) {
        const text = interaction.options.getString('teks');

        // Encode text to ensure it's URL safe
        const encodedText = encodeURIComponent(text);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodedText}`;

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: '📱 QR Code Dihasilkan',
            description: `**Isi:** \`${text}\``,
            mediaAttachmentNames: [qrUrl],
            footerText: ui.getFooter('utility')
        });

        await interaction.reply(payload);
    }
};
