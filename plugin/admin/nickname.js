const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nickname')
        .setDescription('✏️ Paksa ganti nama panggilan (nickname) member.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageNicknames)
        .addUserOption(opt => opt.setName('user').setDescription('User yang ingin diubah namanya').setRequired(true))
        .addStringOption(opt => opt.setName('nama_baru').setDescription('Nama baru (kosongkan untuk mereset ke nama asli)').setRequired(false)),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const newName = interaction.options.getString('nama_baru') || '';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            const errPayload = buildErrorContainerV2({ title: 'User Tidak Ada', description: '❌ User tidak ditemukan di server.', footerText: ui.getFooter('core') });
            return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        if (member.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            const errPayload = buildErrorContainerV2({ title: 'Role Lebih Tinggi', description: '❌ Aku tidak bisa mengubah nama user ini karena rolenya lebih tinggi atau sama dengan role-ku.', footerText: ui.getFooter('core') });
            return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        try {
            const oldName = member.displayName;
            await member.setNickname(newName, `Diminta oleh ${interaction.user.tag}`);

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: '✏️ Nickname Berhasil Diubah',
                iconURL: interaction.user.displayAvatarURL(),
                description: `Berhasil ${newName === '' ? 'mereset' : 'mengubah'} nama untuk **${user.username}**.\n\n**Sebelum:** \`${oldName}\`\n**Sesudah:** \`${newName === '' ? user.username : newName}\``,
                footerText: ui.getFooter('core')
            });

            await interaction.reply(payload);
        } catch (error) {
            logger.error('[Nickname Error]', error);
            const errPayload = buildErrorContainerV2({ title: 'Gagal Ganti Nama', description: '❌ Gagal mengubah nama. Mungkin ada masalah dengan permission.', footerText: ui.getFooter('core') });
            await interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }
    }
};
