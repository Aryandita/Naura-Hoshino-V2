'use strict';

const { ActivityType, PresenceUpdateStatus } = require('discord.js');

/**
 * Konfigurasi rotasi aktivitas Naura Hoshino v2.1.0
 *
 * ── Placeholder Dinamis ─────────────────────────────────────────────────────
 *   {users}          - jumlah user unik di semua guild
 *   {servers}        - jumlah guild aktif
 *   {ping}           - WebSocket latency (ms)
 *   {uptime}         - waktu aktif  (contoh: "3h 12m")
 *   {playing_tracks} - jumlah track yang sedang diputar di semua voice
 *   {lavalink}       - status Lavalink node (UP / DOWN)
 *   {guilds_today}   - guild baru hari ini
 *
 * ── Presence Status ─────────────────────────────────────────────────────────
 *   PresenceUpdateStatus.Online  🟢  penuh aktif
 *   PresenceUpdateStatus.Idle    🌙  mode santai / menunggu
 *   PresenceUpdateStatus.Dnd     🔴  sibuk / maintenance
 */
module.exports = {
    ownerId: '795241173009825853',

    /** Interval rotasi dalam milidetik (default 15 detik di activityManager) */
    intervalMs: 15_000,

    activities: [

        // ╔══════════════════════════════════════════════════════╗
        // ║  📊  LIVE STATS — Ditampilkan bergantian tiap siklus  ║
        // ╚══════════════════════════════════════════════════════╝

        {
            // Jumlah komunitas yang dipercaya Naura
            name: 'Custom Status',
            state: '🌸 {servers} server  ·  {users} pengguna aktif',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Telemetri real-time: latensi + uptime
            name: 'Custom Status',
            state: '⚡ Ping {ping}ms  ·  Online selama {uptime}',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Status musik live
            name: 'Custom Status',
            state: '🎵 {playing_tracks} lagu diputar sekarang  ·  Lavalink {lavalink}',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },

        // ╔═══════════════════════════════════════════════╗
        // ║  🎵  MUSIK & AUDIO                            ║
        // ╚═══════════════════════════════════════════════╝

        {
            // Nuansa rileks & ambient
            name: 'Lofi Hip-Hop  ·  Chillwave Radio 🎧',
            type: ActivityType.Listening,
            status: PresenceUpdateStatus.Idle,
        },
        {
            // NCS / Electronic
            name: 'NCS: No Copyright Sounds 🎶',
            type: ActivityType.Listening,
            status: PresenceUpdateStatus.Online,
        },

        // ╔═══════════════════════════════════════════════╗
        // ║  🎮  GAMES & RPG                              ║
        // ╚═══════════════════════════════════════════════╝

        {
            // Survival RPG — fitur inti Naura
            name: 'Survival RPG  ·  Tambang & Eksplorasi Hutan 🏕️',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online,
        },
        {
            // AI Dungeon — fitur premium
            name: 'AI Dungeon Master  ·  Mode Petualangan 🗡️',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Gacha & ekonomi
            name: 'Gacha & Giveaway V2  ·  Coba Keberuntunganmu! 🎰',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online,
        },
        {
            // World Boss event
            name: 'World Boss Event  ·  Serang Bersama! 🐉',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online,
        },

        // ╔═══════════════════════════════════════════════╗
        // ║  🧠  AI & KECERDASAN                          ║
        // ╚═══════════════════════════════════════════════╝

        {
            // Branding AI engine
            name: 'Custom Status',
            state: '🧠 Naura Intelligent Systems  ·  Gemini 2.0 Flash 🔮',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            // AI memory feature
            name: 'Custom Status',
            state: '💾 AI Persistent Memory aktif  ·  Aku ingat kamu! 🌸',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },

        // ╔═══════════════════════════════════════════════╗
        // ║  👀  WATCHING                                 ║
        // ╚═══════════════════════════════════════════════╝

        {
            // Community engagement
            name: 'Tingkah lucu para member server 🍿',
            type: ActivityType.Watching,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Leaderboard
            name: 'Papan Peringkat & Skor Level Server 📊',
            type: ActivityType.Watching,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Moderation
            name: 'Aktivitas Server  ·  Memantau Keamanan 🛡️',
            type: ActivityType.Watching,
            status: PresenceUpdateStatus.Online,
        },

        // ╔═══════════════════════════════════════════════╗
        // ║  🏆  KOMPETITIF                               ║
        // ╚═══════════════════════════════════════════════╝

        {
            // Speed challenge
            name: 'Speed-Run Command Challenge 🏆',
            type: ActivityType.Competing,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Ekonomi persaingan
            name: 'Kompetisi Saldo Terkaya di Server 💰',
            type: ActivityType.Competing,
            status: PresenceUpdateStatus.Online,
        },

        // ╔═══════════════════════════════════════════════╗
        // ║  💡  CALL-TO-ACTION & BRANDING                ║
        // ╚═══════════════════════════════════════════════╝

        {
            // Help CTA
            name: 'Custom Status',
            state: '💡 /help  ·  Semua perintah Naura ada di sini 🌸',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Greeting branding
            name: 'Custom Status',
            state: '✨ Halo! Aku Naura  ·  Bot multifungsi versi 2.1 💖',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Premium invitation
            name: 'Custom Status',
            state: '👑 Upgrade ke Naura Premium  ·  Fitur eksklusif menantimu!',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },

    ],
};
