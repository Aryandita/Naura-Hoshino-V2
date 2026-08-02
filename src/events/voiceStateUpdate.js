const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, AuditLogEvent } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const UserLeveling = require('../models/UserLeveling');
const GuildSettings = require('../models/GuildSettings');
const cacheManager = require('../managers/cacheManager');
const UserProfile = require('../models/UserProfile');
const env = require('../config/env');
const ui = require('../config/ui');
const { checkLevelUp } = require('../../plugin/leveling/leveling');

const voiceSessions = new Collection(); 
const trackedTempChannels = new Set(); // Melacak ID Voice yang DIBUAT oleh bot

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const { member, guild } = newState;
        if (!member || member.user.bot) return;

        const userId = member.id;
        const guildId = guild.id;

        // ==========================================
        // 🛡️ SISTEM AUDIT LOG (KELUAR MASUK VOICE)
        // ==========================================
        try {
            const settings = await cacheManager.getGuildSettings(guild.id);
            const logChannelId = settings?.settings?.automod?.logChannelId;
            
            if (logChannelId) {
                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    
                    if (!oldState.channelId && newState.channelId) {
                        // 🟢 JOIN VOICE 
                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('success'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('online') || '🔊'} Terhubung ke Voice`)
                            .setDescription(`>>> <@${member.id}> telah bergabung ke dalam saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi') || '📍'} Saluran Suara`, value: `<#${newState.channelId}>`, inline: true }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});
                        
                    } else if (oldState.channelId && !newState.channelId) {
                        // 🔴 LEAVE / DISCONNECT VOICE
                        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberDisconnect }).catch(() => null);
                        const disconnectLog = fetchedLogs ? fetchedLogs.entries.first() : null;
                        
                        let executorTag = `Keluar Sendiri`;
                        if (disconnectLog && (Date.now() - disconnectLog.createdTimestamp < 5000)) {
                            executorTag = `Diputus oleh: ${disconnectLog.executor.globalName || disconnectLog.executor.username}`;
                        }

                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('error'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('offline') || '🔇'} Keluar dari Voice`)
                            .setDescription(`>>> <@${member.id}> telah meninggalkan saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi') || '📍'} Channel Terakhir`, value: `<#${oldState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('info') || 'ℹ️'} Keterangan`, value: `\`${executorTag}\``, inline: true }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});

                    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                        // 🔄 MOVE VOICE (Pindah Channel)
                        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove }).catch(() => null);
                        const moveLog = fetchedLogs ? fetchedLogs.entries.first() : null;
                        
                        let executorTag = `Pindah Sendiri`;
                        if (moveLog && (Date.now() - moveLog.createdTimestamp < 5000)) {
                            executorTag = `Dipindah oleh: ${moveLog.executor.globalName || moveLog.executor.username}`;
                        }

                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('primary'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('move') || '🔄'} Pindah Channel Voice`)
                            .setDescription(`>>> <@${member.id}> berpindah saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi') || '📍'} Dari`, value: `<#${oldState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('lokasi') || '📍'} Ke`, value: `<#${newState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('info') || 'ℹ️'} Keterangan`, value: `\`${executorTag}\``, inline: false }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});
                    }
                }
            }
        } catch (error) {
            logger.error('[VOICE LOG ERROR]', error);
        }

        // ==========================================
        // 📈 SISTEM VOICE XP TRACKING
        // ==========================================
        if (!oldState.channelId && newState.channelId) {
            voiceSessions.set(`${guildId}-${userId}`, Date.now());
        }

        if (oldState.channelId && !newState.channelId) {
            const joinTime = voiceSessions.get(`${guildId}-${userId}`);
            if (joinTime) {
                const durationMinutes = Math.floor((Date.now() - joinTime) / 60000);
                if (durationMinutes >= 1) {
                    try {
                        const [profile] = await UserLeveling.findOrCreate({ where: { userId, guildId } });
                        profile.xp += (durationMinutes * 10);
                        profile.voiceMinutes += durationMinutes;

                        const guildObj = oldState.guild || newState.guild;
                        const memberObj = oldState.member || newState.member;
                        const channelObj = oldState.channel || newState.channel;
                        if (guildObj && memberObj && channelObj) {
                            await checkLevelUp(profile, memberObj.user, guildObj, channelObj);
                        }

                        await profile.save();
                    } catch (err) {}
                }
                voiceSessions.delete(`${guildId}-${userId}`);
            }
        }

        // ==========================================
        // 🎛️ SISTEM TEMP VOICE (PRIVATE ROOM)
        // ==========================================
        let tempConfig = null;
        try {
            const settings = await cacheManager.getGuildSettings(guildId);
            if (settings && settings.settings) {
                tempConfig = settings.settings.tempVoice || settings.settings.tempvoice;
            }
        } catch (error) {}

        if (!tempConfig || !tempConfig.enabled || !tempConfig.triggerChannelId) return;

        // LOGIKA C: SISTEM NOTIFIKASI VIP WAITING ROOM
        // Cek jika user join ke waiting room (bukan trigger channel)
        if (newState.channelId && oldState.channelId !== newState.channelId) {
            const channelJoined = newState.channel;
            if (channelJoined && channelJoined.name.startsWith('⏳ Wait - ')) {
                const ownerName = channelJoined.name.replace('⏳ Wait - ', '').replace(/「🌟」・|「👑」・|🔊 /g, '').replace(/ VIP Voice| Owner Voice| voice/g, '');

                // Cari channel owner yang sebenarnya
                const ownerChannel = guild.channels.cache.find(c => c.parentId === tempConfig.categoryId && (c.name.includes(`🔊 ${ownerName} voice`) || c.name.includes(`「🌟」・${ownerName} VIP Voice`) || c.name.includes(`「👑」・${ownerName} Owner Voice`)));

                if (ownerChannel) {
                    // Cari user pemilik dari channel tersebut
                    const ownerMember = ownerChannel.members.find(m => m.user.username === ownerName);
                    if (ownerMember) {
                        try {
                            // Cek apakah owner adalah user premium atau owner bot
                            const ownerProfile = await UserProfile.findOne({ where: { userId: ownerMember.id } });
                            const isBotOwner = env.OWNER_IDS && env.OWNER_IDS.includes(ownerMember.id);

                            if ((ownerProfile && ownerProfile.isPremium) || isBotOwner) {
                                // Kirim DM ke owner
                                const dmEmbed = new EmbedBuilder()
                                    .setColor(ui.getColor('premium-gold') || '#FFD700')
                                    .setTitle('🔔 Tamu TempVoice Lounge')
                                    .setDescription(`Halo **${ownerName}**! Seseorang bernama **${member.user.username}** sedang menunggu di **Waiting Room** milikmu.\n\nSilakan cek panel kontrol TempVoice untuk mengizinkan mereka masuk.`);
                                await ownerMember.send({ embeds: [dmEmbed] }).catch(() => {});
                            }
                        } catch (e) {
                            logger.error("[VIP Waiting Room Notif Error]:", e);
                        }
                    }
                }
            }
        }

        // LOGIKA A: PEMBUATAN RUANGAN BARU
        if (newState.channelId === tempConfig.triggerChannelId) {
            try {
                // Cek status premium pembuat
                const [userProfile] = await UserProfile.findOrCreate({ where: { userId } });
                const isPremium = userProfile.isPremium;
                const isBotOwner = env.OWNER_IDS && env.OWNER_IDS.includes(userId);

                const triggerChannel = newState.channel;

                // Atur Bitrate & Nama berdasarkan status
                const maxBitrate = guild.maximumBitrate || 96000;
                let roomBitrate = 64000; // Default 64kbps
                let roomName = `🔊 ${member.user.username} voice`;

                if (isBotOwner) {
                    roomBitrate = Math.min(384000, maxBitrate);
                    roomName = `「👑」・${member.user.username} Owner Voice`;
                } else if (isPremium) {
                    roomBitrate = Math.min(384000, maxBitrate); // Set ke maksimum yang didukung guild untuk kualitas Ultra
                    roomName = `「🌟」・${member.user.username} VIP Voice`;
                }

                // Setup Permissions Dasar
                const permissionOverwrites = [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.Connect], // By default bisa lihat & connect, kecuali diubah panel
                    },
                    {
                        id: userId,
                        allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.Connect],
                    }
                ];

                // Jika Premium atau Owner, tambahkan izin kirim file di Voice Text Chat
                if (isPremium || isBotOwner) {
                    permissionOverwrites.find(p => p.id === userId).allow.push(PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks);
                }

                const tempChannel = await guild.channels.create({
                    name: roomName,
                    type: ChannelType.GuildVoice,
                    parent: tempConfig.categoryId || triggerChannel.parentId,
                    bitrate: roomBitrate,
                    permissionOverwrites: permissionOverwrites,
                });

                trackedTempChannels.add(tempChannel.id); // Lacak channel
                client.trackedTempChannels = trackedTempChannels; // Simpan di client untuk diakses dari file lain

                await member.voice.setChannel(tempChannel);

                // Notifikasi ke pembuat jika ia premium atau owner
                if (isPremium || isBotOwner) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setDescription(`✨ **${isBotOwner ? 'Owner' : 'VIP'} Lounge Aktif!**\nRuanganmu di-boost ke **Kualitas Audio Ultra** (${Math.round(roomBitrate/1000)}kbps)!\nKamu juga memiliki akses "Invisible Mode" eksklusif di Panel Kontrol.`);
                    await tempChannel.send({ embeds: [welcomeEmbed] }).catch(() => {});
                }

            } catch (error) {
                logger.error('\x1b[31m[VOICE ERROR]\x1b[0m Gagal memproses TempVoice:', error);
            }
        }

        // LOGIKA B: PENGHAPUSAN RUANGAN KOSONG (Hanya hapus yang dilacak bot)
        if (oldState.channelId) {
            const oldChannel = oldState.channel;
            
            if (oldChannel && trackedTempChannels.has(oldChannel.id) && oldChannel.members.size === 0) {
                // Menangani penghapusan Waiting Room dengan nama VIP/Owner maupun reguler
                let waitingRoomNameBase = oldChannel.name.replace('🔊 ', '').replace(" voice", "");
                if (oldChannel.name.includes('「🌟」・')) {
                    waitingRoomNameBase = oldChannel.name.replace('「🌟」・', '').replace(" VIP Voice", "");
                } else if (oldChannel.name.includes('「👑」・')) {
                    waitingRoomNameBase = oldChannel.name.replace('「👑」・', '').replace(" Owner Voice", "");
                }
                const waitingRoomName = `⏳ Wait - ${waitingRoomNameBase}`;

                const waitingRoom = oldChannel.guild.channels.cache.find(c => c.name === waitingRoomName && c.parentId === tempConfig.categoryId);

                await oldChannel.delete().catch(() => {});
                trackedTempChannels.delete(oldChannel.id);

                if (waitingRoom && waitingRoom.members.size === 0) {
                    await waitingRoom.delete().catch(() => {});
                    trackedTempChannels.delete(waitingRoom.id);
                }
            }
        }

        // ==========================================
        // 🎵 LOGIKA AUTO-DISCONNECT MUSIC (3 MENIT ALONE GUARD)
        // ==========================================
        if (!client.aloneDisconnectTimers) client.aloneDisconnectTimers = new Map();

        const checkChannelAlone = (voiceChan) => {
            if (!voiceChan || !guild) return;
            const botInChan = voiceChan.members.has(client.user.id);
            if (!botInChan) return;

            const nonBotMembers = voiceChan.members.filter(m => !m.user.bot);
            const timerKey = `${guild.id}:${voiceChan.id}`;

            if (nonBotMembers.size === 0) {
                // Bot sendirian di voice channel! Pasang timer 3 menit
                if (!client.aloneDisconnectTimers.has(timerKey)) {
                    logger.info(`[MUSIC ALONE] Bot sendirian di VC ${voiceChan.name} (${guild.name}). Memasang timer disconnect 3 menit...`);
                    const timer = setTimeout(async () => {
                        client.aloneDisconnectTimers.delete(timerKey);
                        const currentChan = guild.channels.cache.get(voiceChan.id);
                        if (currentChan && currentChan.members.has(client.user.id)) {
                            const aloneMembers = currentChan.members.filter(m => !m.user.bot);
                            if (aloneMembers.size === 0) {
                                logger.info(`[MUSIC ALONE] 3 menit berlalu, memutus koneksi music player di ${guild.name}...`);
                                const poru = client.musicManager?.poru;
                                const player = poru?.players?.get(guild.id);
                                if (player) {
                                    const textChanId = player.textChannel;
                                    player.destroy();
                                    if (textChanId) {
                                        const textChan = guild.channels.cache.get(textChanId);
                                        if (textChan) {
                                            const { buildContainerV2 } = require('../utils/NauraContainerBuilder');
                                            const payload = buildContainerV2({
                                                accentColorHex: ui.getColor('warning') || '#FFA500',
                                                authorName: 'Naura Voice Guard',
                                                title: '📻 Otomatis Disconnect',
                                                description: 'Naura telah keluar dari Voice Channel karena sendirian selama **3 menit** untuk menghemat resource server. Silakan panggil kembali dengan `/music play`!',
                                                footerText: ui.getFooter('music')
                                            });
                                            textChan.send(payload).catch(() => {});
                                        }
                                    }
                                }
                            }
                        }
                    }, 3 * 60 * 1000);
                    
                    if (timer.unref) timer.unref();
                    client.aloneDisconnectTimers.set(timerKey, timer);
                }
            } else {
                // Ada user lain di voice channel, batalkan timer jika ada
                if (client.aloneDisconnectTimers.has(timerKey)) {
                    logger.info(`[MUSIC ALONE] User bergabung kembali di VC ${voiceChan.name}. Membatalkan timer disconnect.`);
                    clearTimeout(client.aloneDisconnectTimers.get(timerKey));
                    client.aloneDisconnectTimers.delete(timerKey);
                }
            }
        };

        if (oldState.channel) checkChannelAlone(oldState.channel);
        if (newState.channel) checkChannelAlone(newState.channel);
    }
};
