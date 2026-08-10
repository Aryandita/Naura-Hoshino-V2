const { Op } = require('sequelize');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../models/UserProfile');
const ui = require('../../config/ui');
const { logger } = require('../../managers/logger');

module.exports = {
    name: 'dailyReminder',
    execute(client) {
        // ==========================================
        // 🎁 NOTIFIKASI DAILY REWARD OTOMATIS
        // ==========================================
        setInterval(async () => {
            try {
                const now = new Date();

                // Cooldown durasi (dalam ms) - sesuaikan dengan logika command asli
                const DAILY_COOLDOWN_MS   = 24 * 60 * 60 * 1000; // 24 jam
                const WORK_COOLDOWN_MS    =  4 * 60 * 60 * 1000; //  4 jam
                const MINING_COOLDOWN_MS  =  2 * 60 * 60 * 1000; //  2 jam

                // Ambil semua user yang belum opt-out dari notifikasi
                const users = await UserProfile.findAll({
                    where: {
                        // Hanya kirim ke user yang tidak opt-out (kolom dailyNotify: true / null berarti aktif)
                        // Dan belum di-remind (dailyReminded: false / null)
                        dailyNotify: { [Op.or]: [true, null] },
                        dailyReminded: { [Op.or]: [false, null] }
                    }
                });

                for (const profile of users) {
                    const cooldowns = profile.cooldowns || {};
                    const reminders = [];

                    // Cek cooldown daily
                    const dailyTs = cooldowns.daily ? new Date(cooldowns.daily).getTime() : 0;
                    if (now.getTime() - dailyTs >= DAILY_COOLDOWN_MS) {
                        reminders.push(`${ui.getEmoji('reward') || '🎁'} **Daily** sudah bisa diklaim!`);
                    }

                    // Cek cooldown work
                    const workTs = cooldowns.work ? new Date(cooldowns.work).getTime() : 0;
                    if (now.getTime() - workTs >= WORK_COOLDOWN_MS) {
                        reminders.push(`${ui.getEmoji('coin') || '💼'} **Work** sudah bisa dikerjakan!`);
                    }

                    // Cek cooldown mining
                    const miningTs = cooldowns.mining ? new Date(cooldowns.mining).getTime() : 0;
                    if (now.getTime() - miningTs >= MINING_COOLDOWN_MS) {
                        reminders.push(`${ui.getEmoji('lootbox') || '📦'} **Mining** sudah bisa dijalankan!`);
                    }

                    // Jika tidak ada reminder yang perlu dikirim, lewati
                    if (reminders.length === 0) continue;

                    try {
                        const user = await client.users.fetch(profile.userId);
                        if (!user || user.bot) continue;

                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('economy'))
                            .setTitle(`${ui.getEmoji('reward') || '🎁'} Waktunya Klaim Hadiah!`)
                            .setDescription(
                                `Hai **${user.username}**! Kamu punya aktivitas yang sudah bisa diklaim nih:\n\n` +
                                reminders.join('\n') +
                                `\n\n> Segera klaim sebelum kehabisan waktu ya! ${ui.getEmoji('vip') || '💎'}`
                            )
                            .setFooter({ text: 'Naura Daily Reminder • Klik tombol di bawah untuk menonaktifkan notifikasi ini' })
                            .setTimestamp();

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`daily_notify_off_${profile.userId}`)
                                .setLabel('🔕 Matikan Notifikasi Ini')
                                .setStyle(ButtonStyle.Secondary)
                        );

                        await user.send({ embeds: [embed], components: [row] });
                        
                        profile.dailyReminded = true;
                        await profile.save({ fields: ['dailyReminded'] });

                    } catch (dmErr) {
                        // DM tertutup atau user tidak dapat dihubungi, abaikan
                    }
                }

            } catch (error) {
                logger.error('[DAILY REMINDER ERROR]', error.message);
            }
        }, 60 * 60 * 1000); // Jalankan setiap jam

        console.log('\x1b[45m\x1b[37m 🎁 REMINDER \x1b[0m \x1b[35mSistem notifikasi Daily Reward berhasil diaktifkan.\x1b[0m');
    }
};
