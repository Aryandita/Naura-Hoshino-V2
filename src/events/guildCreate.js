'use strict';

const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder } = require('discord.js');
const { buildContainerV2 } = require('../utils/NauraContainerBuilder');
const { logger } = require('../managers/logger');
const path = require('path');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        logger.info(`[GUILD JOIN] Joined ${guild.name} (${guild.id}). Members: ${guild.memberCount}`);

        try {
            // Temukan channel yang bisa dikirimi pesan
            const channel = guild.channels.cache.find(c => 
                c.type === 0 && 
                c.permissionsFor(guild.members.me).has(['SendMessages', 'ViewChannel'])
            ) || guild.systemChannel;

            if (!channel || !channel.permissionsFor(guild.members.me).has('SendMessages')) return;

            // Tombol Preset Setup
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_preset_community')
                    .setLabel('👥 Preset Komunitas')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('setup_preset_gaming')
                    .setLabel('🎮 Preset Gaming')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('setup_preset_minimal')
                    .setLabel('🍃 Preset Minimalis')
                    .setStyle(ButtonStyle.Success)
            );

            // Asset gambar (banner Naura)
            const assetPath = path.join(process.cwd(), 'assets', 'naura_gallery', 'Girl_character_school_uniform_glasses_202607251632.jpeg');
            const attachment = new AttachmentBuilder(assetPath, { name: 'naura_onboarding.jpeg' });

            const container = buildContainerV2({
                title: '✨ Terima Kasih Telah Mengundang Naura!',
                description: `Halo semuanya! Namaku **Naura Hoshino** (≧▽≦)\n\nTerima kasih ya sudah memberikan Naura tempat di server **${guild.name}**. Naura siap membantu kakak mengatur server ini menjadi jauh lebih seru dan rapi!\n\nUntuk memulai, silakan pilih salah satu **Preset Setup Cepat** di bawah ini agar Naura bisa menyesuaikan fitur-fiturnya dengan kebutuhan server kakak.`,
                color: '#FFB6C1',
                buttonsRow: row,
                bannerAttachmentName: 'naura_onboarding.jpeg'
            });

            await channel.send({ ...container, files: [attachment] });
        } catch (error) {
            logger.error(`[GUILD CREATE] Error sending onboarding wizard: ${error.message}`);
        }
    }
};
