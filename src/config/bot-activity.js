const { ActivityType, PresenceUpdateStatus } = require('discord.js');

module.exports = {
    ownerId: '795241173009825853',
    activities: [
        // --- 👥 LIVE STATS DIAGNOSTICS (Dynamic Ticker) ---
        {
            name: 'Custom Status',
            state: '🌸 Melayani {users} pengguna di {servers} server! ✨',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online
        },
        {
            name: 'Custom Status',
            state: '⚡ Latensi: {ping}ms | Waktu Aktif: {uptime} 💖',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online
        },

        // --- 🧠 AI & INTELLIGENCE ---
        {
            name: 'Custom Status',
            state: '🧠 Kecerdasan Naura Intelligent Systems 🔮',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online
        },

        // --- 🎵 MUSIC TELEMETRY ---
        {
            name: 'Custom Status',
            state: '🎵 Musik: {playing_tracks} lagu diputar | Lavalink: {lavalink} 🎧',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online
        },

        // --- 🎮 GAMES & RPG ADVENTURE ---
        {
            name: 'Survival RPG | Tambang & Hutan 🏕️',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online
        },
        {
            name: 'Casino Blackjack & Slots 🎰',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online
        },

        // --- 🎧 MUSIC & LAVALINK ---
        {
            name: 'Radio Lofi Girl 24/7 / NCS Stream 🎧',
            type: ActivityType.Listening,
            status: PresenceUpdateStatus.Idle
        },

        // --- 🍿 WATCHING & COMMUNITY ---
        {
            name: 'Tingkah lucu member di server 🍿',
            type: ActivityType.Watching,
            status: PresenceUpdateStatus.Online
        },

        // --- 🏆 COMPETITIVE ---
        {
            name: 'Lomba Jawab Command Tercepat 🏆',
            type: ActivityType.Competing,
            status: PresenceUpdateStatus.Online
        },

        // --- 💡 HELP CALL TO ACTION ---
        {
            name: 'Custom Status',
            state: 'Ketik {prefix}help atau /core help untuk bantuan! 🌸',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online
        }
    ]
};
