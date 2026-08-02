const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildSettings = require('../../src/models/GuildSettings');
const cacheManager = require('../../src/managers/cacheManager');
const ui = require('../../src/config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Mengatur role otomatis saat member baru masuk.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub => sub.setName('set').setDescription('Pasang auto role baru')
            .addRoleOption(opt => opt.setName('role').setDescription('Role yang akan diberikan').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Matikan fitur auto role')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        const [settings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
        
        if (sub === 'set') {
            const role = interaction.options.getRole('role');

            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.editReply(`${ui.getEmoji('error') || '❌'} **Akses Ditolak:** Aku tidak bisa memberikan role yang posisinya lebih tinggi dari role-ku. Pindahkan role Naura ke atas role tersebut.`);
            }
            if (role.managed) {
                return interaction.editReply(`${ui.getEmoji('error') || '❌'} **Akses Ditolak:** Tidak bisa memberikan role integrasi/bot (Managed Role).`);
            }
            settings.settings = { ...settings.settings, autoRole: role.id };
            settings.changed('settings', true);
            await settings.save();
            await cacheManager.invalidateGuildSettings(interaction.guild.id).catch(() => {});
            return interaction.editReply(`${ui.getEmoji('success') || '✅'} Auto Role berhasil diatur ke ${role}!`);
        } else {
            settings.settings = { ...settings.settings, autoRole: null };
            settings.changed('settings', true);
            await settings.save();
            await cacheManager.invalidateGuildSettings(interaction.guild.id).catch(() => {});
            return interaction.editReply(`${ui.getEmoji('success') || '✅'} Fitur Auto Role telah dimatikan.`);
        }
    }
};
