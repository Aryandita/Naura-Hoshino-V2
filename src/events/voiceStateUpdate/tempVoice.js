const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logger } = require('../../managers/logger');
const cacheManager = require('../../managers/cacheManager');
const tempVoiceRegistry = require('../../managers/tempVoiceRegistry');
const UserProfile = require('../../models/UserProfile');
const env = require('../../config/env');
const ui = require('../../config/ui');

// Dipertahankan hanya karena berkas lain (ready.js) membaca client.trackedTempChannels.
// Sumber kebenaran kepemilikan sekarang ada di tempVoiceRegistry.
const trackedTempChannels = new Set();

module.exports = {
    name: 'tempVoice',
    async execute(oldState, newState, client) {
        const { member, guild } = newState;
        if (!member || member.user.bot) return;

        const userId = member.id;
        const guildId = guild.id;

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
                    roomBitrate = Math.min(384000, maxBitrate);
                    roomName = `「🌟」・${member.user.username} VIP Voice`;
                    tier = 'premium';
                }

                // Setup Permissions Dasar
                const permissionOverwrites = [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.Connect],
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

                await tempVoiceRegistry.register(tempChannel.id, {
                    ownerId: userId,
                    guildId,
                    tier,
                    createdAt: Date.now(),
                });

                trackedTempChannels.add(tempChannel.id);
                // Also update client set for ready.js
                client.trackedTempChannels = new Set([...(client.trackedTempChannels || new Set()), ...trackedTempChannels]);

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
                if (client.trackedTempChannels) client.trackedTempChannels.delete(oldChannel.id);
                await tempVoiceRegistry.unregister(oldChannel.id);

                if (waitingRoom && waitingRoom.members.size === 0) {
                    await waitingRoom.delete().catch(() => {});
                    trackedTempChannels.delete(waitingRoom.id);
                    if (client.trackedTempChannels) client.trackedTempChannels.delete(waitingRoom.id);
                    await tempVoiceRegistry.unregister(waitingRoom.id);
                }
            }
        }
    }
};
