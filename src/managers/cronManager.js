const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const { logger } = require('../../src/managers/logger');
const { buildContainerV2 } = require('../utils/NauraContainerBuilder');
const ui = require('../config/ui');
const GuildSettings = require('../models/GuildSettings');
const UserBirthday = require('../models/UserBirthday');
const Giveaway = require('../models/Giveaway');

module.exports = {
    init(client) {
        const isMasterShard = !client.shard || (client.shard.ids && client.shard.ids.includes(0));
        if (!isMasterShard) {
            logger.info(`[Cron] Secondary Shard #${client.shard?.ids?.join(',') || '?'} active. Master scheduled tasks (Backup/QOTD/Giveaways) delegated to Shard #0.`);
            return;
        }

        logger.info('[Cron] Initializing scheduled tasks on Master Shard #0...');

        // 0. Auto Backup Database - Runs every day at 02:00 AM
        cron.schedule('0 2 * * *', async () => {
            logger.info('[Cron] Running Auto Backup Database...');
            const backupManager = require('./backupManager');
            await backupManager.runBackup();
        });

        // 1. QOTD Scheduler - Runs every minute to check if it's time to post
        let isQotdRunning = false;
        cron.schedule('* * * * *', async () => {
            if (isQotdRunning) return;
            isQotdRunning = true;
            
            const now = new Date();
            const currentHourStr = now.getHours().toString().padStart(2, '0');
            const currentMinStr = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${currentHourStr}:${currentMinStr}`;
            const todayStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;

            try {
                // Find all guilds with QOTD enabled
                // Optimized: Only fetch guilds where QOTD or Announcements might be enabled
                const allSettings = await GuildSettings.findAll({
                    attributes: ['guildId', 'settings']
                });

                for (const guildData of allSettings) {
                    if (!guildData.settings || !guildData.settings.qotd || !guildData.settings.qotd.enabled) continue;

                    const qotdConf = guildData.settings.qotd;

                    // If it's time, and we haven't asked today, and we have questions
                    if (qotdConf.time === currentTime && qotdConf.lastAsked !== todayStr && qotdConf.questions.length > 0) {
                        const channel = client.channels.cache.get(qotdConf.channelId);
                        if (!channel) continue;

                        // Pilih pertanyaan secara acak
                        const qIndex = Math.floor(Math.random() * qotdConf.questions.length);
                        const question = qotdConf.questions[qIndex];

                        // Konversi ke Components V2 (sesuai Rule 1.6 & AGENTS.md)
                        const qotdPayload = buildContainerV2({
                            accentColorHex: '#ff9ff3',
                            authorName: 'Naura Daily Engagement',
                            title: '❓ Question of the Day',
                            description: `> ${question}\n\n-# Jawab pertanyaan ini di kolom reply! 💬`,
                            footerText: ui.getFooter('core')
                        });

                        // Kirim dengan mention @everyone sebagai content terpisah (boleh bersamaan dengan CV2)
                        await channel.send({ content: '@everyone Waktunya QOTD!', ...qotdPayload }).catch(() => {});

                        // Update db
                        const currentSettings = guildData.settings;
                        currentSettings.qotd.lastAsked = todayStr;
                        // Optionally remove the question so it doesn't repeat:
                        // currentSettings.qotd.questions.splice(qIndex, 1);

                        guildData.settings = currentSettings;
                        guildData.changed('settings', true);
                        await guildData.save();
                    }
                }
            } catch (err) {
                logger.error('[Cron QOTD Error]', err);
            } finally {
                isQotdRunning = false;
            }
        });

        // 2. Birthday Announcer - Runs at 00:00 every day
        cron.schedule('0 0 * * *', async () => {
            logger.info('[Cron] Checking for birthdays...');
            const today = new Date();
            const d = today.getDate();
            const m = today.getMonth() + 1; // 1-12

            try {
                const birthdaysToday = await UserBirthday.findAll({ where: { day: d, month: m } });
                if (birthdaysToday.length === 0) return;

                // Kumpulkan semua userId birthday hari ini untuk batch fetch
                const birthdayUserIds = birthdaysToday.map(b => b.userId);

                const allSettings = await GuildSettings.findAll({
                    attributes: ['guildId', 'settings']
                });

                for (const guildData of allSettings) {
                    if (!guildData.settings || !guildData.settings.announcementChannel) continue;

                    const guild = client.guilds.cache.get(guildData.guildId);
                    if (!guild) continue;

                    const channel = guild.channels.cache.get(guildData.settings.announcementChannel);
                    if (!channel) continue;

                    // ✅ FIX N+1: Batch fetch semua member sekaligus per guild
                    let fetchedMembers;
                    try {
                        fetchedMembers = await guild.members.fetch({ user: birthdayUserIds });
                    } catch {
                        continue;
                    }

                    let bdayMsg = '';
                    for (const bday of birthdaysToday) {
                        const member = fetchedMembers.get(bday.userId);
                        if (member) {
                            let ageText = '';
                            if (bday.year) {
                                const age = today.getFullYear() - bday.year;
                                ageText = ` yang ke-${age}`;
                            }
                            bdayMsg += `🎉 Selamat Ulang Tahun${ageText} kepada <@${member.id}>!\n`;
                        }
                    }

                    if (bdayMsg.length > 0) {
                        const bdayPayload = buildContainerV2({
                            accentColorHex: '#ff9ff3',
                            authorName: 'Naura Birthday Reminder',
                            title: '🎂 Hari Ulang Tahun!',
                            description: bdayMsg,
                            footerText: ui.getFooter('core')
                        });
                        await channel.send(bdayPayload).catch(() => {});
                    }
                }
            } catch (err) {
                logger.error('[Cron Birthday Error]', err);
            }
        });

        // 3. Friendship Streak Checker - Runs every hour to reset lost streaks
        cron.schedule('0 * * * *', async () => {
            logger.info('[Cron] Checking friendship streaks...');
            try {
                const UserFriend = require('../models/UserFriend');
                const { Op } = require('sequelize');

                const now = new Date();
                const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

                // Reset streak if last interaction is older than 48 hours and streak > 0
                await UserFriend.update(
                    { streak: 0 },
                    {
                        where: {
                            status: 'accepted',
                            streak: { [Op.gt]: 0 },
                            lastInteraction: { [Op.lt]: fortyEightHoursAgo }
                        }
                    }
                );
            } catch (err) {
                logger.error('[Cron Streak Reset Error]', err);
            }
        });

        // 4. Stale Cooldown Cleanup - Runs every day at 04:00 AM
        cron.schedule('0 4 * * *', async () => {
            logger.info('[Cron] Cleaning up expired cooldowns entries...');
            try {
                const UserProfile = require('../models/UserProfile');
                const now = Date.now();
                const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
                const BATCH_SIZE = 200; // ✅ FIX OOM: batching agar tidak load semua profil ke memory

                let offset = 0;
                let hasMore = true;

                while (hasMore) {
                    const profiles = await UserProfile.findAll({
                        attributes: ['userId', 'cooldowns'],
                        limit: BATCH_SIZE,
                        offset
                    });

                    if (profiles.length < BATCH_SIZE) hasMore = false;
                    offset += BATCH_SIZE;

                    for (const profile of profiles) {
                        if (!profile.cooldowns || typeof profile.cooldowns !== 'object') continue;
                        let modified = false;
                        const newCooldowns = { ...profile.cooldowns };

                        for (const [key, ts] of Object.entries(newCooldowns)) {
                            const cooldownTime = new Date(ts).getTime();
                            if (isNaN(cooldownTime) || (now - cooldownTime > SEVEN_DAYS_MS)) {
                                delete newCooldowns[key];
                                modified = true;
                            }
                        }

                        if (modified) {
                            profile.cooldowns = newCooldowns;
                            profile.changed('cooldowns', true);
                            await profile.save();
                        }
                    }
                }
            } catch (err) {
                logger.error('[Cron Cooldown Cleanup Error]', err);
            }
        });

        // 5. Premium VIP Lifecycle Manager - Runs every day at 08:00 WIB (01:00 UTC)
        cron.schedule('0 1 * * *', async () => {
            logger.info('[Cron] Running Premium VIP Lifecycle check...');
            try {
                const UserProfile = require('../models/UserProfile');
                const { Op } = require('sequelize');
                const now = new Date();

                // ── 5A. Cabut status EXPIRED ─────────────────────────
                const expiredUsers = await UserProfile.findAll({
                    where: {
                        isPremium: true,
                        premiumUntil: { [Op.lte]: now }
                    },
                    attributes: ['userId', 'premiumUntil']
                });

                for (const profile of expiredUsers) {
                    try {
                        profile.isPremium = false;
                        profile.premiumUntil = null;
                        await profile.save();

                        // Kirim DM notifikasi expired
                        const user = await client.users.fetch(profile.userId).catch(() => null);
                        if (!user) continue;

                        const expiredPayload = buildContainerV2({
                            accentColorHex: '#8e98b0',
                            authorName: 'Naura V.I.P Service',
                            title: '🔔 Langganan V.I.P Kamu Telah Berakhir',
                            description: [
                                `Hei **${user.username}**!`,
                                ``,
                                `Masa aktif **V.I.P Premium** kamu telah berakhir. Akses ke fitur eksklusif seperti Musik 24/7, Dungeon Unlimited, dan Bonus Economy kini kembali ke mode reguler.`,
                                ``,
                                `Perpanjang langgananmu dengan \`/premium info\` — hanya mulai dari **Rp 25.000** untuk 30 hari!`,
                                ``,
                                `-# Terima kasih telah mendukung Naura Project. Kami berharap bertemu kembali! 💎`
                            ].join('\n'),
                            footerText: ui.getFooter('premium')
                        });

                        await user.send(expiredPayload).catch(() => {});
                        logger.info(`[Cron Premium] Status expired dicabut: ${profile.userId}`);
                    } catch (userErr) {
                        logger.error(`[Cron Premium Expiry] Error untuk userId ${profile.userId}:`, userErr);
                    }
                }

                if (expiredUsers.length > 0) {
                    logger.info(`[Cron Premium] Total expired & dicabut: ${expiredUsers.length} user.`);
                }

                // ── 5B. Warning H-3 untuk yang akan expired ──────────
                const threeDaysLater = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
                const twoDaysLater = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));

                const expiringUsers = await UserProfile.findAll({
                    where: {
                        isPremium: true,
                        premiumUntil: {
                            [Op.gt]: twoDaysLater,
                            [Op.lte]: threeDaysLater
                        }
                    },
                    attributes: ['userId', 'premiumUntil']
                });

                for (const profile of expiringUsers) {
                    try {
                        const user = await client.users.fetch(profile.userId).catch(() => null);
                        if (!user) continue;

                        const expTs = Math.floor(profile.premiumUntil.getTime() / 1000);
                        const warningPayload = buildContainerV2({
                            accentColorHex: ui.getColor('premium_vip'),
                            authorName: 'Naura V.I.P Service',
                            title: '⏳ Masa Aktif V.I.P Hampir Berakhir!',
                            description: [
                                `Hei **${user.username}**!`,
                                ``,
                                `Langganan **V.I.P Premium** kamu akan berakhir dalam **3 Hari** (<t:${expTs}:R>).`,
                                ``,
                                `Perpanjang sekarang agar tidak kehilangan akses ke:`,
                                `・ 🎵 Musik 24/7 tanpa henti`,
                                `・ ⚔️ Dungeon Unlimited beyond Floor 50`,
                                `・ 💰 Bonus Gaji & Bunga Deposito`,
                                `・ 🎨 Gold Glow Card & AI Studio`,
                                ``,
                                `Gunakan \`/premium info\` untuk melihat paket perpanjangan!`,
                                ``,
                                `-# Harga mulai dari Rp 25.000 / 30 hari. Terima kasih atas dukunganmu! 💎`
                            ].join('\n'),
                            footerText: ui.getFooter('premium')
                        });

                        await user.send(warningPayload).catch(() => {});
                    } catch (_) {}
                }

                if (expiringUsers.length > 0) {
                    logger.info(`[Cron Premium] Warning H-3 dikirim ke ${expiringUsers.length} user.`);
                }

            } catch (err) {
                logger.error('[Cron Premium Lifecycle Error]', err);
            }
        });

    }
};
