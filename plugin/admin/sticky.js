const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const GuildSettings = require('../../src/models/GuildSettings');
const cacheManager = require('../../src/managers/cacheManager');
const ui = require('../../src/config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Mengatur pesan lengket (sticky message) di channel ini.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('set').setDescription('Pasang sticky message baru').addStringOption(opt => opt.setName('pesan').setDescription('Isi pesan sticky').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Hapus sticky message dari server ini')),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();
        let [settings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
        
        let newSettings;
        try { newSettings = typeof settings.settings === 'string' ? JSON.parse(settings.settings) : (settings.settings || {}); } 
        catch (e) { newSettings = {}; }

        if (!newSettings.stickyMessage) newSettings.stickyMessage = { channelId: null, message: null, lastId: null };

        if (sub === 'set') {
            const msg = interaction.options.getString('pesan');
            newSettings.stickyMessage = { channelId: interaction.channel.id, message: msg, lastId: null };
            settings.settings = newSettings;
            settings.changed('settings', true);
            await settings.save();
            await cacheManager.invalidateGuildSettings(interaction.guild.id).catch(() => {});
            return interaction.editReply(`${ui.getEmoji('success') || '✅'} Sticky message berhasil dipasang di channel ini!`);
        } else {
            newSettings.stickyMessage = { channelId: null, message: null, lastId: null };
            settings.settings = newSettings;
            settings.changed('settings', true);
            await settings.save();
            await cacheManager.invalidateGuildSettings(interaction.guild.id).catch(() => {});
            return interaction.editReply(`${ui.getEmoji('success') || '✅'} Sticky message berhasil dihapus.`);
        }
    }
};