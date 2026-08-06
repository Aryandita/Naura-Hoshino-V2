const { ChannelType, PermissionFlagsBits, EmbedBuilder, Collection, AuditLogEvent } = require('discord.js');
const { logger } = require('../managers/logger');
const UserLeveling = require('../models/UserLeveling');
const cacheManager = require('../managers/cacheManager');
const tempVoiceRegistry = require('../managers/tempVoiceRegistry');
const UserProfile = require('../models/UserProfile');
const env = require('../config/env');
const ui = require('../config/ui');
const { checkLevelUp } = require('../../plugin/leveling/leveling');

const voiceSessions = new Collection();

// Dipertahankan hanya karena berkas lain membaca client.trackedTempChannels.
// Sumber kebenaran kepemilikan sekarang ada di tempVoiceRegistry.
const trackedTempChannels = new Set();

// Audit log di-cache sebentar. Tanpa ini, satu ruangan yang bubar berisi 20
// orang memicu 20 panggilan fetchAuditLogs beruntun, dan semuanya menanyakan
// entri yang sama persis.
const auditLogCache = new Map();
const AUDIT_CACHE_MS = 5000;

async function fetchRecentAuditEntry(guild, type) {
    // Tanpa izin ini, panggilannya pasti ditolak Discord. Memeriksa lebih dulu
    // menghemat satu request gagal per event.
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

    const cacheKey = `${guild.id}:${type}`;
    const cached = auditLogCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < AUDIT_CACHE_MS) return cached.entry;

    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type }).catch(() => null);
    const entry = fetchedLogs ? fetchedLogs.entries.first() : null;
    auditLogCache.set(cacheKey, { entry, fetchedAt: Date.now() });
    return entry;
}

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
            const automod = settings?.settings?.automod;

            // Alur /setup menulis `logChannel`, sedangkan berkas ini dulu membaca
            // `logChannelId`. Kunci yang tidak pernah cocok itu membuat seluruh
            // log audit voice tidak pernah terkirim ke mana pun. Keduanya dibaca
            // supaya server yang terlanjur menyimpan bentuk lama tetap jalan.
            const logChannelId = automod?.logChannel || automod?.logChannelId;

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
                        const disconnectLog = await fetchRecentAuditEntry(guild, AuditLogEvent.MemberDisconnect);

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
                        const moveLog = await fetchRecentAuditEntry(guild, AuditLogEvent.MemberMove);

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

                        // Dulu di sini `profile.xp += n` lalu `profile.save()`.
                        // Pola itu menimpa perubahan yang terjadi di antara baca
                        // dan tulis, misalnya XP dari mengetik di chat pada saat
                        // yang sama, atau dari shard lain. increment() menyerahkan
                        // penjumlahannya ke SQL sehingga tidak ada yang hilang.
                        await UserLeveling.increment(
                            { xp: durationMinutes * 10, voiceMinutes: durationMinutes },
                            { where: { userId, guildId } }
                        );
                        await profile.reload();

                        const guildObj = oldState.guild || newState.guild;
                        const memberObj = oldState.member || newState.member;
                        const channelObj = oldState.channel || newState.channel;
                        if (guildObj && memberObj && channelObj) {
                            await checkLevelUp(profile, memberObj.user, guildObj, channelObj);
                        }
                    } catch (err) {
                        // Dulu blok ini kosong, jadi setiap kegagalan XP voice
                        // hilang tanpa jejak sama sekali.
                        logger.error('[VOICE XP ERROR]', err);
                    }
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
        } catch (error) {
            logger.error('[TEMPVOICE CONFIG ERROR]', error);
        }

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
                    try {
                        // Pemiliknya diambil dari registry. Sebelumnya baris ini
                        // mencocokkan username terhadap daftar member di dalam
                        // channel, yang berarti notifikasi gagal total begitu
                        // pemiliknya sedang tidak berada di ruangannya sendiri.
                        const entry = await tempVoiceRegistry.get(ownerChannel.id);
                        const ownerId = entry?.ownerId;
                        const ownerMember = ownerId
                            ? await guild.members.fetch(ownerId).catch(() => null)
                            : ownerChannel.members.find(m => m.user.username === ownerName);

                        if (ownerMember) {
                            // Cek apakah owner adalah user premium atau owner bot
                            const ownerProfile = await UserProfile.findOne({ where: { userId: ownerMember.id } });
                            const isBotOwner = env.OWNER_IDS && env.OWNER_IDS.includes(ownerMember.id);

                            if ((ownerProfile && ownerProfile.isPremium) || isBotOwner) {
                                // Kirim DM ke owner
                                const dmEmbed = new EmbedBuilder()
                                    .setColor(ui.getColor('premium-gold') || '#FFD700')
                                    .setTitle('🔔 Tamu TempVoice Lounge')
                                    .setDescription(`Halo **${ownerMember.user.username}**! Seseorang bernama **${member.user.username}** sedang menunggu di **Waiting Room** milikmu.\n\nSilakan cek panel kontrol TempVoice untuk mengizinkan mereka masuk.`);
                                await ownerMember.send({ embeds: [dmEmbed] }).catch(() => {});
                            }
                        }
                    } catch (e) {
                        logger.error("[VIP Waiting Room Notif Error]:", e);
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
                let tier = 'standard';

                if (isBotOwner) {
                    roomBitrate = Math.min(384000, maxBitrate);
                    roomName = `「👑」・${member.user.username} Owner Voice`;
                    tier = 'owner';
                } else if (isPremium) {
                    roomBitrate = Math.min(384000, maxBitrate); // Set ke maksimum yang didukung guild untuk kualitas Ultra
                    roomName = `「🌟」・${member.user.username} VIP Voice`;
                    tier = 'premium';
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

                // Inilah satu-satunya tempat kepemilikan ditetapkan. Semua
                // pemeriksaan izin panel nanti membaca dari sini.
                await tempVoiceRegistry.register(tempChannel.id, {
                    ownerId: userId,
                    guildId,
                    tier,
                    createdAt: Date.now(),
                });

                trackedTempChannels.add(tempChannel.id);
                client.trackedTempChannels = trackedTempChannels;

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

        // LOGIKA B: PENGHAPUSAN RUANGAN KOSONG
        if (oldState.channelId) {
            const oldChannel = oldState.channel;

            // Pemeriksaannya sekarang lewat registry, bukan Set di memori.
            // Perbedaannya terasa setelah restart: dengan Set, setiap ruangan
            // yang dibuat sebelum restart tidak pernah dikenali lagi dan
            // tertinggal kosong selamanya di daftar channel.
            const isTracked = oldChannel
                ? (trackedTempChannels.has(oldChannel.id) || await tempVoiceRegistry.isTracked(oldChannel.id))
                : false;

            if (oldChannel && isTracked && oldChannel.members.size === 0) {
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
                await tempVoiceRegistry.unregister(oldChannel.id);

                if (waitingRoom && waitingRoom.members.size === 0) {
                    await waitingRoom.delete().catch(() => {});
                    trackedTempChannels.delete(waitingRoom.id);
                    await tempVoiceRegistry.unregister(waitingRoom.id);
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
