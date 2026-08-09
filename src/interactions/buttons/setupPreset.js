'use strict';

const { MessageFlags } = require('discord.js');
const { getGuildSettings, invalidateGuildSettings } = require('../../managers/cacheManager');
const GuildSettings = require('../../models/GuildSettings');
const { buildContainerV2 } = require('../../utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, customId, client) {
        if (!customId.startsWith('setup_preset_')) return false;

        // Hanya administrator (atau orang yg memiliki manage guild) yang bisa mengatur
        if (!interaction.member.permissions.has('ManageGuild')) {
            await interaction.reply({
                content: '❌ Maaf, hanya Admin server yang bisa menggunakan tombol setup ini.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        const preset = customId.split('_')[2];
        const guildId = interaction.guild.id;

        try {
            let [guildData] = await GuildSettings.findOrCreate({ where: { guildId } });
            
            // Setel fitur default berdasarkan preset
            const features = guildData.settings.features || { leveling: false, economy: false, music: true };
            
            let description = '';
            
            if (preset === 'community') {
                features.leveling = true;
                features.economy = true;
                features.music = true;
                description = 'Semua fitur sosial (Leveling, Economy, Music) telah diaktifkan!';
            } else if (preset === 'gaming') {
                features.leveling = true;
                features.economy = false;
                features.music = true;
                description = 'Fitur Leveling dan Musik telah diaktifkan untuk pengalaman gaming yang asyik!';
            } else if (preset === 'minimal') {
                features.leveling = false;
                features.economy = false;
                features.music = true;
                description = 'Hanya fitur Musik inti yang aktif agar server tetap rapi dan tidak berisik.';
            }

            guildData.settings.features = features;
            guildData.changed('settings', true);
            await guildData.save();

            // Render container hasil
            const container = buildContainerV2({
                title: `✅ Preset ${preset.toUpperCase()} Berhasil Diterapkan!`,
                description: `Terima kasih! Naura sudah menyesuaikan fitur server sesuai pilihan kakak:\n\n**Status Fitur:**\n- 🌟 Leveling: **${features.leveling ? 'ON' : 'OFF'}**\n- 💰 Ekonomi: **${features.economy ? 'ON' : 'OFF'}**\n- 🎵 Musik: **${features.music ? 'ON' : 'OFF'}**\n\nUntuk pengaturan lebih detail, kakak bisa gunakan \`/setup\`.`,
                color: '#10B981'
            });

            await interaction.update({
                ...container,
                components: [], // Hapus tombol
                files: [] // Hapus gambar jika ada
            });

        } catch (error) {
            await interaction.reply({
                content: '❌ Terjadi kesalahan saat menyimpan pengaturan preset.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        return true;
    }
};
