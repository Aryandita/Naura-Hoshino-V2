const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Membuat panel tombol untuk Role otomatis (Reaction/Button Role).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(opt => opt.setName('pesan').setDescription('Pesan yang akan ditampilkan').setRequired(true))
        .addRoleOption(opt => opt.setName('role1').setDescription('Role pertama').setRequired(true))
        .addStringOption(opt => opt.setName('label1').setDescription('Label tombol pertama').setRequired(false))
        .addRoleOption(opt => opt.setName('role2').setDescription('Role kedua').setRequired(false))
        .addStringOption(opt => opt.setName('label2').setDescription('Label tombol kedua').setRequired(false))
        .addRoleOption(opt => opt.setName('role3').setDescription('Role ketiga').setRequired(false))
        .addStringOption(opt => opt.setName('label3').setDescription('Label tombol ketiga').setRequired(false)),

    async execute(interaction) {
        const message = interaction.options.getString('pesan');
        const roles = [
            { role: interaction.options.getRole('role1'), label: interaction.options.getString('label1') },
            { role: interaction.options.getRole('role2'), label: interaction.options.getString('label2') },
            { role: interaction.options.getRole('role3'), label: interaction.options.getString('label3') }
        ];

        const row = new ActionRowBuilder();
        roles.forEach((r) => {
            if (r.role) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`role_assign_${r.role.id}`)
                        .setLabel(r.label || r.role.name)
                        .setStyle(ButtonStyle.Primary)
                );
            }
        });

        const panelPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: '🎯 Silakan Pilih Role Anda',
            description: message,
            buttonsRow: row,
            footerText: ui.getFooter('core')
        });

        await interaction.channel.send(panelPayload);

        const replyPayload = buildContainerV2({
            accentColorHex: ui.getColor('success') || '#22c55e',
            title: 'Panel Berhasil Dibuat',
            description: `${ui.getEmoji('success') || '✅'} Panel Reaction Role berhasil dibuat!`,
            footerText: ui.getFooter('core')
        });

        await interaction.reply({ ...replyPayload, ephemeral: true });
    }
};
