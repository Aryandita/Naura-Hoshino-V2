// Perekam analitik musik per pengguna.

const { logger } = require('../../src/managers/logger');
const cacheManager = require('../../src/managers/cacheManager');

// Batas jumlah kunci per kantong. Tanpa ini kolom JSON tumbuh tanpa henti
// dan ditulis ulang penuh setiap lagu berakhir.
const LIMITS = { tracks: 50, servers: 25, friends: 50 };

const MIN_DURATION_MS = 5000;
const MAX_DURATION_MS = 360000000; // 100 jam, penyaring radio dan siaran langsung

// Data lama menyimpan angka mentah, data baru menyimpan objek bernama.
// Kedua bentuk harus tetap terbaca.
function msOf(value) {
    if (value && typeof value === 'object') return Number(value.durationMs) || 0;
    return Number(value) || 0;
}

function labelOf(key, value) {
    if (value && typeof value === 'object' && value.name) return value.name;
    return key;
}

function bump(bucket, key, label, durationMs) {
    const previous = bucket[key];
    bucket[key] = {
        name: labelOf(label, previous),
        durationMs: msOf(previous) + durationMs
    };
}

function prune(bucket, limit) {
    const keys = Object.keys(bucket);
    if (keys.length <= limit) return bucket;

    const kept = keys.sort((a, b) => msOf(bucket[b]) - msOf(bucket[a])).slice(0, limit);
    const trimmed = {};
    for (const key of kept) trimmed[key] = bucket[key];
    return trimmed;
}

function topOf(bucket, fallback) {
    let best = { name: fallback, durationMs: 0 };
    for (const [key, value] of Object.entries(bucket)) {
        const ms = msOf(value);
        if (ms > best.durationMs) best = { name: labelOf(key, value), durationMs: ms };
    }
    return best;
}

function normalizeBuckets(raw) {
    let data = raw;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = {};
        }
    }
    if (!data || typeof data !== 'object') data = {};

    return {
        tracks: data.tracks && typeof data.tracks === 'object' ? data.tracks : {},
        servers: data.servers && typeof data.servers === 'object' ? data.servers : {},
        friends: data.friends && typeof data.friends === 'object' ? data.friends : {}
    };
}

class MusicAnalytics {
    static markStart(player) {
        if (!player) return;
        player.analyticsStartTime = Date.now();
    }

    static async recordEnd(client, player, track) {
        if (!client || !player || !track || !track.info) return;
        if (!track.info.requester || track.info.requester.bot) return;

        const startTime = player.analyticsStartTime || Date.now();
        const position = Number(player.position) || 0;
        let durationMs = position > 0 ? position : Date.now() - startTime;

        player.analyticsStartTime = null;

        if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) return;

        // Jangan melebihi panjang asli lagunya.
        if (!track.info.isStream && track.info.length && durationMs > track.info.length) {
            durationMs = track.info.length;
        }

        const guild = client.guilds.cache.get(player.guildId);
        const voiceChannel = guild ? guild.channels.cache.get(player.voiceChannel) : null;

        try {
            const userId = track.info.requester.id;
            const profile = await cacheManager.getUserProfile(userId);
            if (!profile) return;

            const buckets = normalizeBuckets(profile.music_trackingData);

            const title = String(track.info.title || 'Tanpa Judul');
            bump(buckets.tracks, title.substring(0, 80), title.substring(0, 80), durationMs);

            const guildKey = guild ? guild.id : 'dm';
            const guildName = guild ? guild.name.substring(0, 80) : 'Pesan Pribadi';
            bump(buckets.servers, guildKey, guildName, durationMs);

            if (voiceChannel && voiceChannel.members) {
                voiceChannel.members.forEach(m => {
                    if (m.user.bot || m.id === userId) return;
                    bump(buckets.friends, m.id, m.user.username, durationMs);
                });
            }

            buckets.tracks = prune(buckets.tracks, LIMITS.tracks);
            buckets.servers = prune(buckets.servers, LIMITS.servers);
            buckets.friends = prune(buckets.friends, LIMITS.friends);

            await cacheManager.incrementUserProfile(userId, {
                music_tracksListened: 1,
                music_totalDurationMs: Math.round(durationMs)
            });
            await cacheManager.updateUserProfile(userId, {
                music_lastListened: title.substring(0, 100),
                music_trackingData: buckets,
                music_topTrack: topOf(buckets.tracks, 'Belum ada data'),
                music_topServer: topOf(buckets.servers, 'Belum ada server'),
                music_topFriend: topOf(buckets.friends, 'Belum mabar')
            });
        } catch (error) {
            logger.error('[MusicAnalytics] Gagal merekam analitik:', error.message);
        }
    }
}

module.exports = MusicAnalytics;
