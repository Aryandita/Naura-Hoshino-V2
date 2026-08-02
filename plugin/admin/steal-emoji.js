const { SlashCommandBuilder, PermissionFlagsBits, parseEmoji } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('Mencuri emoji custom untuk dimasukkan ke server ini')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
        .addStringOption(opt => opt
            .setName('emoji')
            .setDescription('Ketik atau paste emoji custom yang ingin dicuri')
            .setRequired(true)
        )
        .addStringOption(opt => opt
            .setName('nama')
            .setDescription('Nama baru untuk emoji ini (Opsional)')
            .setRequired(false)
        ),

    async execute(interaction) {
        const rawEmoji = interaction.options.getString('emoji');
        const customName = interaction.options.getString('nama');

        const parsed = parseEmoji(rawEmoji);

        if (!parsed || !parsed.id) {
            const errPayload = buildErrorContainerV2({ title: 'Emoji Tidak Valid', description: `${ui.getEmoji('error') || '❌'} Itu bukan emoji custom yang valid!`, footerText: ui.getFooter('core') });
            return interaction.reply({ ...errPayload, ephemeral: true });
        }

        const extension = parsed.animated ? 'gif' : 'png';
        const emojiUrl = `https://cdn.discordapp.com/emojis/${parsed.id}.${extension}`;
        const emojiName = customName || parsed.name;

        await interaction.deferReply();

        try {
            const newEmoji = await interaction.guild.emojis.create({ attachment: emojiUrl, name: emojiName });

            const successPayload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: '🕵️‍♂️ Pencurian Berhasil!',
                iconURL: emojiUrl,
                description: `Berhasil menyusup dan mengambil aset! Emoji ${newEmoji} telah di-import ke server ini dengan nama **${newEmoji.name}**.\n\n> *Gunakan \`:${newEmoji.name}:\` untuk memanggilnya.*`,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(successPayload);
        } catch (error) {
            logger.error('Gagal mencuri emoji:', error);
            const errPayload = buildErrorContainerV2({ title: 'Gagal Import Emoji', description: `${ui.getEmoji('error') || '❌'} Gagal menambahkan emoji. Mungkin slot emoji server sudah penuh?`, footerText: ui.getFooter('core') });
            await interaction.editReply(errPayload);
        }
    }
};
