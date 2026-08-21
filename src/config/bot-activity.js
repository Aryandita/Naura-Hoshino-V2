'use strict';

const { ActivityType, PresenceUpdateStatus } = require('discord.js');

/**
 * Konfigurasi aktivitas bot yang dirotasi secara otomatis.
 *
 * Format placeholder dinamis:
 *   {users}          → jumlah user unik di semua guild
 *   {servers}        → jumlah guild
 *   {ping}           → WebSocket latency (ms)
 *   {uptime}         → waktu aktif bot (e.g. "3d 4h 12m")
 *   {playing_tracks} → jumlah track yang sedang diputar
 *   {lavalink}       → status node Lavalink
 *   {prefix}         → prefix command teks
 *
 * Status Discord yang tersedia:
 *   PresenceUpdateStatus.Online  → 🟢
 *   PresenceUpdateStatus.Idle    → 🌙
 *   PresenceUpdateStatus.Dnd     → 🔴
 */
module.exports = {
    ownerId: '795241173009825853',

    activities: [

        // ── 📊 Live Stats (Dynamic Ticker) ─────────────────────────────────

        {
            // Jumlah komunitas yang dilayani
            name: 'Custom Status',
            state: '🌸 {servers} server  ·  {users} pengguna aktif',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Telemetri performa real-time
            name: 'Custom Status',
            state: '⚡ Ping {ping}ms  ·  Uptime {uptime}',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },

        // ── 🎵 Musik & Audio ────────────────────────────────────────────────

        {
            // Streaming aktif
            name: 'Custom Status',
            state: '🎵 {playing_tracks} lagu diputar  ·  Lavalink {lavalink}',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            // Nuansa santai / ambient
            name: 'Lofi Hip-Hop  ·  Radio 24/7',
            type: ActivityType.Listening,
            status: PresenceUpdateStatus.Idle,
        },

        // ── 🎮 Games & RPG ──────────────────────────────────────────────────

        {
            name: 'Survival RPG  ·  Tambang & Hutan 🏕️',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online,
        },
        {
            name: 'Dungeon Master  ·  AI Adventure Mode 🗡️',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online,
        },
        {
            name: 'Casino Blackjack & Slots 🎰',
            type: ActivityType.Playing,
            status: PresenceUpdateStatus.Online,
        },

        // ── 🧠 AI & Kecerdasan ──────────────────────────────────────────────

        {
            name: 'Custom Status',
            state: '🧠 Naura Intelligent Systems  ·  Gemini-powered 🔮',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },

        // ── 👀 Watching ─────────────────────────────────────────────────────

        {
            name: 'Tingkah lucu member di server 🍿',
            type: ActivityType.Watching,
            status: PresenceUpdateStatus.Online,
        },
        {
            name: 'Skor papan peringkat server 📊',
            type: ActivityType.Watching,
            status: PresenceUpdateStatus.Online,
        },

        // ── 🏆 Kompetitif ───────────────────────────────────────────────────

        {
            name: 'Lomba Command Tercepat 🏆',
            type: ActivityType.Competing,
            status: PresenceUpdateStatus.Online,
        },

        // ── 💡 Call-to-Action ───────────────────────────────────────────────

        {
            name: 'Custom Status',
            state: '💡 Ketik /help untuk daftar lengkap perintah Naura 🌸',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
        {
            name: 'Custom Status',
            state: '✨ Halo! Aku Naura Hoshino  ·  Discord bot serba bisa 💖',
            type: ActivityType.Custom,
            status: PresenceUpdateStatus.Online,
        },
    ],
};
