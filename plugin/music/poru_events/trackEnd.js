// Lokasi: src/events/poru/trackEnd.js
const LyricsManager = require('../LyricsManager');
const MusicAnalytics = require('../MusicAnalytics');
const { clearTransitionTimers } = require('./autoplayUtils');

module.exports = {
    async execute(manager, player, track) {
        // Hentikan fade-out watcher / interval fade dari lagu yang baru saja selesai,
        // supaya tidak "tabrakan" dengan fade-in lagu berikutnya di trackStart
        clearTransitionTimers(player);

        // PERBAIKAN: Simpan history untuk mencegah AI memutar lagu yang sama berulang kali
        if (!player.playedHistory) player.playedHistory = new Set();
        if (track && track.info && track.info.identifier) player.playedHistory.add(track.info.identifier);

        // Prune playedHistory if larger than 50 entries (FIFO limit to prevent memory leak & stale autoplay blocking)
        if (player.playedHistory.size > 50) {
            const historyArray = Array.from(player.playedHistory);
            player.playedHistory = new Set(historyArray.slice(historyArray.length - 25));
        }

        // Rekam statistik musik ke UserProfile (single source of truth via MusicAnalytics)
        MusicAnalytics.recordEnd(manager.client, player, track).catch(() => {});

        // Hapus sisa-sisa lirik dari memori saat lagu berakhir
        try {
            const lyricsEngine = new LyricsManager(manager.client);
            lyricsEngine.clearLyrics(player.guildId);
        } catch (e) {
            // Abaikan jika terjadi error kecil saat pembersihan lirik
        }

        // Cek jika ada resumePosition (lagu utama yang di-pause sementara karena soundboard)
        try {
            if (track && track.info && track.info.resumePosition) {
                setTimeout(() => {
                    if (player.currentTrack && player.currentTrack.info.identifier === track.info.identifier) {
                        player.seekTo(track.info.resumePosition);
                    }
                }, 1000);
            }
        } catch (e) {}
    }
};