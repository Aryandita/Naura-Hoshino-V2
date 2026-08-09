'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const tempVoiceRegistry = require('../../src/managers/tempVoiceRegistry');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const ui = require('../../src/config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Manajemen Temp Voice milikmu')
        .addSubcommand(sub => sub.setName('transfer').setDescription('Transfer kepemilikan ruangan suaramu ke orang lain').addUserOption(opt => opt.setName('target').setDescription('Orang yang akan menjadi pemilik baru').setRequired(true)))
        .addSubcommand(sub => sub.setName('lock').setDescription('Kunci ruangan suara agar tidak ada yang bisa masuk (Toggle)'))
        .addSubcommand(sub => sub.setName('kick').setDescription('Keluarkan seseorang dari ruangan suaramu').addUserOption(opt => opt.setName('target').setDescription('Orang yang ingin dikeluarkan').setRequired(true))),
        
    async execute(interaction, client) {
        await interaction.deferReply();
        
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const errPayload = buildErrorContainerV2({ title: 'Tidak di Voice Channel', description: `❌ | Kakak harus berada di ruangan suara terlebih dahulu!`, footerText: ui.getFooter('utility') });
            return interaction.editReply(errPayload);
        }
        
        const ownerId = await tempVoiceRegistry.getOwner(voiceChannel.id);
        if (!ownerId) {
            const errPayload = buildErrorContainerV2({ title: 'Bukan Temp Voice', description: `❌ | Ruangan ini bukan Temp Voice yang bisa diatur.`, footerText: ui.getFooter('utility') });
            return interaction.editReply(errPayload);
        }
        
        if (ownerId !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            const errPayload = buildErrorContainerV2({ title: 'Tidak Memiliki Akses', description: `🛡️ | Hanya pemilik ruangan <@${ownerId}> atau Admin yang bisa menggunakan perintah ini.`, footerText: ui.getFooter('utility') });
            return interaction.editReply(errPayload);
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'transfer') {
            const target = interaction.options.getUser('target');
            if (target.id === interaction.user.id || target.bot) {
                const errPayload = buildErrorContainerV2({ title: 'Target Tidak Valid', description: `❌ | Tidak bisa mentransfer ke diri sendiri atau bot.`, footerText: ui.getFooter('utility') });
                return interaction.editReply(errPayload);
            }
            
            await tempVoiceRegistry.setOwner(voiceChannel.id, target.id);
            const payload = buildContainerV2({ 
                title: 'Transfer Berhasil', 
                description: `✅ | Kepemilikan ruangan suara ini telah ditransfer kepada <@${target.id}>.`, 
                color: '#10B981', 
                footerText: ui.getFooter('utility') 
            });
            return interaction.editReply(payload);
        }

        if (subcommand === 'lock') {
            // Cek permission bit
            const everyoneRole = interaction.guild.roles.everyone;
            const currentPerms = voiceChannel.permissionsFor(everyoneRole);
            const isLocked = currentPerms.has(PermissionFlagsBits.Connect) === false;

            if (isLocked) {
                await voiceChannel.permissionOverwrites.edit(everyoneRole, { Connect: null });
                const payload = buildContainerV2({ title: 'Ruangan Dibuka', description: `🔓 | Ruangan suara sekarang terbuka untuk umum.`, color: '#10B981', footerText: ui.getFooter('utility') });
                return interaction.editReply(payload);
            } else {
                await voiceChannel.permissionOverwrites.edit(everyoneRole, { Connect: false });
                const payload = buildContainerV2({ title: 'Ruangan Dikunci', description: `🔒 | Ruangan suara sekarang dikunci!`, color: '#EF4444', footerText: ui.getFooter('utility') });
                return interaction.editReply(payload);
            }
        }

        if (subcommand === 'kick') {
            const target = interaction.options.getMember('target');
            if (!target || !target.voice.channel || target.voice.channel.id !== voiceChannel.id) {
                const errPayload = buildErrorContainerV2({ title: 'Member Tidak Ditemukan', description: `❌ | Orang tersebut tidak berada di ruangan ini.`, footerText: ui.getFooter('utility') });
                return interaction.editReply(errPayload);
            }
            if (target.id === interaction.user.id) {
                const errPayload = buildErrorContainerV2({ title: 'Tidak Valid', description: `❌ | Kakak tidak bisa menendang diri sendiri.`, footerText: ui.getFooter('utility') });
                return interaction.editReply(errPayload);
            }
            
            try {
                await target.voice.disconnect();
                const payload = buildContainerV2({ title: 'Member Dikeluarkan', description: `👢 | Berhasil mengeluarkan <@${target.id}> dari ruangan.`, color: '#EF4444', footerText: ui.getFooter('utility') });
                return interaction.editReply(payload);
            } catch (error) {
                const errPayload = buildErrorContainerV2({ title: 'Gagal', description: `❌ | Gagal mengeluarkan member. Mungkin Naura tidak memiliki akses.`, footerText: ui.getFooter('utility') });
                return interaction.editReply(errPayload);
            }
        }
    }
};
