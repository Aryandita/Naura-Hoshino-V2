'use strict';
const { MessageFlags } = require('discord.js');
const UserProfile = require('../../models/UserProfile');
const cacheManager = require('../../managers/cacheManager');

module.exports = [
    {
        prefix: 'daily_notify_off_',
        label: 'daily-notify-off',
        onError: 'Terjadi kesalahan saat mematikan notifikasi.',
        async handler(interaction) {
            const targetUserId = interaction.customId.split('_')[3];

            if (interaction.user.id !== targetUserId) {
                return interaction.reply({ content: '\u274c Tombol ini bukan untukmu.', flags: MessageFlags.Ephemeral });
            }

            await cacheManager.updateUserProfile(targetUserId, 'dailyNotify', false);

            return interaction.reply({
                content: '\ud83d\udd15 Notifikasi Daily Reminder telah dimatikan. Kamu tidak akan menerima pesan ini lagi.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
];
