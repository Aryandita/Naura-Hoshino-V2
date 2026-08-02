// Lokasi: src/helpers/MusicAnalytics.js

const UserProfile = require('../../src/models/UserProfile');
const { logger } = require('../../src/managers/logger');

class MusicAnalytics {
    /**
     * Panggil ini saat lagu baru saja dimulai (trackStart)
     */
    static markStart(player) {
        if (!player) return;
        player.analyticsStartTime = Date.now();
    }

    /**
     * Panggil ini saat lagu selesai, di-skip, atau dihentikan (trackEnd)
     * Helper ini akan kebal dari segala jenis error JSON MySQL.
     */
    static async recordEnd(client, player, track) {
        // 1. Validasi Dasar (Mencegah Error)
        if (!client || !player || !track || !track.info) return;
        if (!track.info.requester || track.info.requester.bot) return;

        // 2. Kalkulasi Durasi Asli (Seperti Jockie Music)
        // Menggunakan posisi Lavalink asli, atau fallback ke Stopwatch
        const startTime = player.analyticsStartTime || Date.now();
        let durationMs = player.position || (Date.now() - startTime);

        // Reset waktu agar tidak bocor ke lagu selanjutnya
        player.analyticsStartTime = null;

        // Filter Keamanan:
        // - Abaikan jika kurang dari 5 detik (User cuma numpang skip)
        // - Abaikan jika lebih dari 100 jam (Lagu Live Stream/Radio)
        if (durationMs < 5000 || durationMs > 360000000) return;
        
        // Batasi durasi agar tidak melebihi panjang asli lagunya
        if (durationMs > track.info.length && !track.info.isStream) {
            durationMs = track.info.length;
        }

        const guild = client.guilds.cache.get(player.guildId);
        const voiceChannel = guild ? guild.channels.cache.get(player.voiceChannel) : null;

        try {
            const userId = track.info.requester.id;
            const cacheManager = require('../../src/managers/cacheManager');
            const profile = await cacheManager.getUserProfile(userId);
            if (!profile) return;

            // 3. Update Statistik Dasar
            const tracksListened = (profile.music_tracksListened || 0) + 1;
            const totalDurationMs = (BigInt(profile.music_totalDurationMs || 0) + BigInt(durationMs)).toString();
            const lastListened = track.info.title.substring(0, 100);

            // 4. Penanganan Super Aman untuk JSON MySQL (Anti-Bug)
            let trackingData = profile.music_trackingData;
            if (typeof trackingData === 'string') {
                try { trackingData = JSON.parse(trackingData); } catch (e) { trackingData = {}; }
            }
            if (!trackingData || typeof trackingData !== 'object') trackingData = {};

            if (!trackingData.tracks) trackingData.tracks = {};
            if (!trackingData.servers) trackingData.servers = {};
            if (!trackingData.friends) trackingData.friends = {};

            const trackKey = track.info.title.substring(0, 80);
            trackingData.tracks[trackKey] = (trackingData.tracks[trackKey] || 0) + durationMs;

            const guildName = guild ? guild.name.substring(0, 80) : 'Private DM';
            trackingData.servers[guildName] = (trackingData.servers[guildName] || 0) + durationMs;

            if (voiceChannel && voiceChannel.members) {
                voiceChannel.members.forEach(m => {
                    if (!m.user.bot && m.id !== userId) {
                        trackingData.friends[m.user.username] = (trackingData.friends[m.user.username] || 0) + durationMs;
                    }
                });
            }

            const getTop = (obj) => {
                let maxVal = 0;
                let topName = 'Belum Ada';
                for (const [key, val] of Object.entries(obj)) {
                    if (val > maxVal) {
                        maxVal = val;
                        topName = key;
                    }
                }
                return { name: topName, durationMs: maxVal };
            };

            await cacheManager.updateUserProfile(userId, {
                music_tracksListened: tracksListened,
                music_totalDurationMs: totalDurationMs,
                music_lastListened: lastListened,
                music_trackingData: trackingData,
                music_topTrack: getTop(trackingData.tracks),
                music_topServer: getTop(trackingData.servers),
                music_topFriend: getTop(trackingData.friends)
            });
        } catch (error) {
            logger.error('[Helper] Gagal merekam analitik musik:', error.message);
        }
    }
}

module.exports = MusicAnalytics;