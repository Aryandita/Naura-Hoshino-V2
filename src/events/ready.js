const { Events } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../config/ui');
const botActivity = require('../config/bot-activity');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`\x1b[44m\x1b[37m 🤖 SYSTEM \x1b[0m \x1b[34mNaura Hoshino Online! Terhubung sebagai \x1b[36m${client.user.tag}\x1b[0m`);

        // ==========================================
        // 🧹 IN-BOOT TEMP VOICE GARBAGE COLLECTION
        // ==========================================
        try {
            const { ChannelType } = require('discord.js');
            client.trackedTempChannels = client.trackedTempChannels || new Set();

            client.guilds.cache.forEach(async (guild) => {
                const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
                
                for (const [id, channel] of voiceChannels) {
                    const name = channel.name;
                    const isTempVoice = name.startsWith('🔊 ') || name.startsWith('「🌟」・') || name.startsWith('「👑」・') || name.startsWith('⏳ Wait - ');
                    
                    if (isTempVoice) {
                        if (channel.members.size === 0) {
                            await channel.delete('Boot cleanup: empty ghost temp voice channel').catch(() => {});
                        } else {
                            client.trackedTempChannels.add(channel.id);
                        }
                    }
                }
            });
            console.log('\x1b[46m\x1b[30m 🔊 TEMPVOICE \x1b[0m \x1b[36mPembersihan awal ghost temp voice channel berhasil.\x1b[0m');
        } catch (err) {
            logger.error('[TEMPVOICE BOOT CLEANUP ERROR]', err);
        }

        // Initialize the music manager jika file dan fungsi tersedia
        try {
            if (client.musicManager && typeof client.musicManager.initialize === 'function') {
                client.musicManager.initialize();
                console.log('\x1b[45m\x1b[37m 🎵 MUSIC \x1b[0m \x1b[35mMusic Manager siap!\x1b[0m');
            }
        } catch (err) {
            logger.error('[MUSIC MANAGER INIT ERROR]', err);
        }

        // ==========================================
        // 🔄 ROTASI STATUS BOT (DARI BOT-ACTIVITY.JS)
        // ==========================================
        const activities = botActivity.activities;

        if (activities && activities.length > 0) {
            let currentIndex = 0;
            const env = require('../config/env');

            const formatUptime = (ms) => {
                if (ms < 1000) return '0m';
                const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                let result = [];
                if (days > 0) result.push(`${days}d`);
                if (hours > 0) result.push(`${hours}h`);
                if (minutes > 0) result.push(`${minutes}m`);
                return result.length > 0 ? result.join(' ') : '0m';
            };

            // --- 📊 EVENT LOOP LAG MONITOR ---
            let isSystemLagging = false;
            setInterval(async () => {
                const start = Date.now();
                await new Promise(resolve => setImmediate(resolve));
                const lag = Date.now() - start;

                if (lag > 150) {
                    if (!isSystemLagging) {
                        isSystemLagging = true;
                        console.log(`\x1b[41m\x1b[37m ⚠️ EVENT LOOP \x1b[0m \x1b[31mTerdeteksi lag tinggi pada event loop: ${lag}ms! Mengubah status bot ke DND.\x1b[0m`);
                    }
                } else {
                    if (isSystemLagging && lag < 50) {
                        isSystemLagging = false;
                        console.log(`\x1b[42m\x1b[30m ⚡ EVENT LOOP \x1b[0m \x1b[32mLag event loop kembali normal: ${lag}ms. Memulihkan status.\x1b[0m`);
                    }
                }
            }, 5000);

            // --- 🏷️ DYNAMIC GUILD PREFIX CACHE ---
            let guildPrefixes = [];
            let prefixCycleIndex = 0;

            (async () => {
                try {
                    const GuildSettings = require('../models/GuildSettings');
                    const allSettings = await GuildSettings.findAll();
                    const uniquePrefixes = new Set();
                    for (const gs of allSettings) {
                        const parsed = typeof gs.settings === 'string' ? JSON.parse(gs.settings) : (gs.settings || {});
                        if (parsed.prefix && parsed.prefix !== env.PREFIX) {
                            uniquePrefixes.add(parsed.prefix);
                        }
                    }
                    guildPrefixes = [...uniquePrefixes];
                    if (guildPrefixes.length > 0) {
                        console.log(`\x1b[45m\x1b[37m 🏷️ PREFIX \x1b[0m \x1b[35mDimuat ${guildPrefixes.length} prefiks kustom guild untuk rotasi status.\x1b[0m`);
                    }
                } catch (e) {
                    // Database belum siap atau tabel belum ada, gunakan fallback
                }
            })();

            setInterval(() => {
                const activity = activities[currentIndex];

                // Resolve Lavalink & Music telemetry values
                let lavalinkStatus = '0/0';
                let playingTracks = 0;
                if (client.musicManager && client.musicManager.poru) {
                    const nodes = client.musicManager.poru.nodes;
                    const connected = [...nodes.values()].filter(n => n.isConnected).length;
                    lavalinkStatus = `${connected}/${nodes.size}`;

                    const players = client.musicManager.poru.players;
                    playingTracks = [...players.values()].filter(p => p.isPlaying && !p.isPaused).length;
                }

                // Resolve dynamic prefix (cycle through custom guild prefixes)
                let currentPrefix = env.PREFIX || 'n!';
                if (guildPrefixes.length > 0) {
                    currentPrefix = guildPrefixes[prefixCycleIndex % guildPrefixes.length];
                    prefixCycleIndex++;
                }
                
                const replacePlaceholders = (str) => {
                    if (!str) return str;
                    return str
                        .replace(/{servers}/g, client.guilds.cache.size.toLocaleString('id-ID'))
                        .replace(/{users}/g, client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0).toLocaleString('id-ID') || client.users.cache.size.toLocaleString('id-ID'))
                        .replace(/{ping}/g, Math.round(client.ws.ping))
                        .replace(/{uptime}/g, formatUptime(client.uptime))
                        .replace(/{prefix}/g, currentPrefix)
                        .replace(/{lavalink}/g, lavalinkStatus)
                        .replace(/{playing_tracks}/g, playingTracks);
                };

                const finalName = replacePlaceholders(activity.name);
                const finalState = replacePlaceholders(activity.state);
                const targetStatus = isSystemLagging ? 'dnd' : (activity.status || 'online');

                client.user.setPresence({
                    activities: [{
                        name: finalName,
                        state: finalState || null,
                        type: activity.type,
                        url: activity.url || null
                    }],
                    status: targetStatus
                });

                currentIndex = (currentIndex + 1) % activities.length;
            }, 15000); // Berganti setiap 15 detik

            console.log('\x1b[45m\x1b[37m ✨ PRESENCE \x1b[0m \x1b[35mRotasi status Naura berhasil diaktifkan.\x1b[0m');
        } else {
            console.log('\x1b[43m\x1b[30m ⚠️ PRESENCE \x1b[0m \x1b[33mTidak ada daftar status yang ditemukan di konfigurasi bot-activity.js.\x1b[0m');
        }

        // ==========================================
        // 🧹 AUTO-CLEANUP MODMAIL TERBENGKALAI (48 JAM)
        // ==========================================
        setInterval(async () => {
            try {
                const { Op } = require('sequelize');
                const ModMail = require('../models/ModMail');
                const { EmbedBuilder } = require('discord.js');

                const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
                const abandonedTickets = await ModMail.findAll({
                    where: {
                        closed: false,
                        updatedAt: { [Op.lt]: twoDaysAgo }
                    }
                });

                for (const ticket of abandonedTickets) {
                    const guild = client.guilds.cache.get(ticket.guildId);
                    if (!guild) continue;
                    const channel = guild.channels.cache.get(ticket.channelId);

                    ticket.closed = true;
                    await ticket.save();

                    try {
                        const user = await client.users.fetch(ticket.userId);
                        const embed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle(`🔒 ${ui.getEmoji('ticket') || '🎫'} Tiket Otomatis Ditutup`)
                            .setDescription(`Tiketmu dengan **${guild.name}** telah ditutup otomatis karena tidak ada aktivitas selama 48 jam.`)
                            .setTimestamp();
                        await user.send({ embeds: [embed] });
                    } catch (e) {}

                    if (channel) {
                        await channel.send('⏳ Tiket ditutup otomatis karena tidak ada aktivitas selama 48 jam. Channel akan dihapus dalam 10 detik.');
                        setTimeout(() => channel.delete().catch(() => {}), 10000);
                    }
                }
            } catch (error) {
                logger.error('[MODMAIL CLEANUP ERROR]', error);
            }
        }, 60 * 60 * 1000); // Check every 1 hour

        // ==========================================
        // 🎁 NOTIFIKASI DAILY REWARD OTOMATIS
        // ==========================================
        // Setiap jam, cek user yang cooldown-nya sudah habis dan belum diklaim.
        // Kirim DM pengingat dengan tombol opt-out agar user tidak terganggu.
        setInterval(async () => {
            try {
                const { Op } = require('sequelize');
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const UserProfile = require('../models/UserProfile');

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
                        await profile.save();

                    } catch (dmErr) {
                        // DM tertutup atau user tidak dapat dihubungi, abaikan
                    }
                }

            } catch (error) {
                logger.error('[DAILY REMINDER ERROR]', error.message);
            }
        }, 60 * 60 * 1000); // Jalankan setiap jam

        console.log('\x1b[45m\x1b[37m 🎁 REMINDER \x1b[0m \x1b[35mSistem notifikasi Daily Reward berhasil diaktifkan.\x1b[0m');

        // ==========================================
        // 🗑️ GARBAGE COLLECTOR TEMP VOICE (Setiap 5 Menit)
        // ==========================================
        setInterval(async () => {
            if (!client.trackedTempChannels || client.trackedTempChannels.size === 0) return;

            for (const channelId of client.trackedTempChannels) {
                try {
                    const channel = await client.channels.fetch(channelId).catch(() => null);
                    if (!channel) {
                        client.trackedTempChannels.delete(channelId);
                        continue;
                    }

                    if (channel.isVoiceBased() && channel.members.size === 0) {
                        await channel.delete('Auto-cleanup empty temp voice channel').catch(() => {});
                        client.trackedTempChannels.delete(channelId);
                    }
                } catch (e) {}
            }
        }, 5 * 60 * 1000);

        // ==========================================
        // 🌐 INITIALIZE GLOBAL CHAT CACHE & PUBSUB
        // ==========================================
        (async () => {
            try {
                const GuildSettings = require('../models/GuildSettings');
                client.globalChatChannels = new Map();
                
                const allSettings = await GuildSettings.findAll();
                for (const settings of allSettings) {
                    const parsed = typeof settings.settings === 'string' ? JSON.parse(settings.settings) : (settings.settings || {});
                    if (parsed.globalChat && parsed.globalChat.enabled && parsed.globalChat.channelId) {
                        client.globalChatChannels.set(parsed.globalChat.channelId, settings.guildId);
                    }
                }
                console.log(`\x1b[42m\x1b[30m 🌐 GLOBAL CHAT \x1b[0m \x1b[32mBerhasil memuat ${client.globalChatChannels.size} channel Global Chat.\x1b[0m`);

                // Redis Pub/Sub untuk Cross-Shard Global Chat
                const redisManager = require('../managers/redisManager');
                if (redisManager.client && redisManager.client.isReady) {
                    await redisManager.initPubSub('naura:globalchat', async (payload) => {
                        if (!payload || !client.globalChatChannels) return;
                        for (const [chanId] of client.globalChatChannels.entries()) {
                            if (chanId === payload.sourceChannelId) continue;
                            const targetChannel = client.channels.cache.get(chanId);
                            if (targetChannel && targetChannel.isTextBased()) {
                                await targetChannel.send({ embeds: [payload.embedData], components: [payload.componentsData] }).catch(() => {});
                            }
                        }
                    });
                }
            } catch (err) {
                logger.error('[GLOBAL CHAT INIT ERROR]', err);
            }
        })();
    },
};
