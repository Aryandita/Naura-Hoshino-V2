"use strict";

const { ActivityType, PresenceUpdateStatus } = require("discord.js");

/**
 * Konfigurasi rotasi aktivitas Naura Hoshino v2.4.0
 *
 * ── Placeholder Dinamis ─────────────────────────────────────────────────────
 *   {users}            - jumlah user unik di semua guild
 *   {servers}          - jumlah guild aktif
 *   {ping}             - WebSocket latency (ms)
 *   {uptime}           - waktu aktif  (contoh: "3h 12m")
 *   {playing_tracks}   - jumlah track yang sedang diputar di semua voice
 *   {lavalink}         - status Lavalink node (connected/total)
 *   {prefix}           - prefix guild kustom (jika ada)
 *   {vip_active}       - jumlah user VIP aktif (cached 1 min)
 *   {online_voice}     - jumlah user di voice channel (cached 1 min)
 *   {active_guilds_today} - guild baru hari ini (cached 1 min)
 *   {commands_hour}    - estimasi command digunakan jam ini (cached 5 min)
 *   {current_track}    - lagu yang sedang diputar (auto-detect dari Lavalink)
 *   {spotify_link}     - link Spotify playlist preset
 *
 * ── Time Periods ────────────────────────────────────────────────────────────
 *   morning   : 05:00 - 10:00 🌅
 *   afternoon : 10:00 - 15:00 ☀️
 *   evening   : 15:00 - 19:00 🌆
 *   night     : 19:00 - 05:00 🌙
 *
 * ── Priority System ─────────────────────────────────────────────────────────
 *   Higher priority activities appear first in their time slot
 *   Default priority: 0 (no priority field)
 *
 * ── Presence Status ─────────────────────────────────────────────────────────
 *   PresenceUpdateStatus.Online  🟢  penuh aktif
 *   PresenceUpdateStatus.Idle    🌙  mode santai / menunggu
 *   PresenceUpdateStatus.Dnd     🔴  sibuk / maintenance
 */
module.exports = {
  ownerId: "795241173009825853",

  /** Interval rotasi dalam milidetik (default 15 detik di presenceRotation) */
  intervalMs: 15_000,

  // ═══════════════════════════════════════════════════════════════════
  // 🎵 SPOTIFY INTEGRATION CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  
  spotify: {
    enabled: true,
    
    // Preset playlists untuk fallback saat tidak ada musik diputar
    playlists: {
      chill: "https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn", // Lofi Beats
      ncs: "https://open.spotify.com/playlist/37i9dQZF1DX9tPFwDAOaN1", // NCS Top
      anime: "https://open.spotify.com/playlist/37i9dQZF1DX4WY6IRo99wj", // Anime OST
      gaming: "https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675", // Gaming Mix
      indonesian: "https://open.spotify.com/playlist/37i9dQZF1DXa2EiRgXGjBp", // Indo Hits
    },
    
    // Playlist default berdasarkan time period
    timeBasedPlaylists: {
      morning: "chill",
      afternoon: "ncs",
      evening: "gaming",
      night: "chill",
    },
    
    // Template pesan Spotify activity
    templates: {
      nowPlaying: "🎵 Sedang memutar: {track_name}",
      playlist: "🎧 Dengarkan playlist: {playlist_name}",
      radio: "📻 Naura Radio FM · Live on Spotify",
    },
  },

  activities: [
    // ╔══════════════════════════════════════════════════════╗
    // ║  📊  LIVE STATS - Data Real-time yang Informatif     ║
    // ╚══════════════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "🌸 Menemani {servers} komunitas · {users} teman baru",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 10,
    },
    {
      name: "Custom Status",
      state: "⚡ Respon cepat {ping}ms · Setia online {uptime}",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 8,
    },
    {
      name: "Custom Status",
      state: "🎵 Memutar {playing_tracks} lagu · Musik tak pernah berhenti",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 9,
    },
    {
      name: "Custom Status",
      state: "👑 {vip_active} VIP aktif · Bergabung dengan elite!",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 7,
    },
    {
      name: "Custom Status",
      state: "🎤 {online_voice} orang di voice · Gabung sekarang!",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 6,
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  🎵  MUSIK & AUDIO - Teman Dengar Musikmu     ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Lofi beats buat nemenin belajar 📚☕",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Idle,
      priority: 5,
    },
    {
      name: "Playlist NCS favorit kalian 🎶✨",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Online,
      priority: 4,
    },
    {
      name: "Chillwave Radio · Santai sejenak 🌊",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Idle,
      priority: 3,
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  🎧  SPOTIFY INTEGRATION - Listen Along!      ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "🎵 Now Playing: {current_track}",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 20,
      spotify: "nowPlaying",
    },
    {
      name: "Custom Status",
      state: "🎧 Chill Vibes · spoti.fi/naura-chill",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Idle,
      priority: 15,
      spotify: "chill",
    },
    {
      name: "Custom Status",
      state: "🎶 NCS Top Hits · spoti.fi/naura-ncs",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 14,
      spotify: "ncs",
    },
    {
      name: "Custom Status",
      state: "🌸 Anime OST Collection · spoti.fi/naura-anime",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 13,
      spotify: "anime",
    },
    {
      name: "Custom Status",
      state: "🎮 Gaming Mode ON · spoti.fi/naura-gaming",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 12,
      spotify: "gaming",
    },
    {
      name: "Custom Status",
      state: "🇮🇩 Indonesian Hits · spoti.fi/naura-indo",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 11,
      spotify: "indonesian",
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  🎮  GAMES & RPG - Petualangan Seru Bareng    ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Eksplorasi Naura Wilds 🏕️ · Tambang harta karun!",
      type: ActivityType.Playing,
      status: PresenceUpdateStatus.Online,
      priority: 8,
    },
    {
      name: "AI Dungeon Master 🗡️ · Ceritamu, petualanganmu",
      type: ActivityType.Playing,
      status: PresenceUpdateStatus.Online,
      priority: 7,
    },
    {
      name: "Gacha time! 🎰 Siapa tahu hari ini beruntung?",
      type: ActivityType.Playing,
      status: PresenceUpdateStatus.Online,
      priority: 6,
    },
    {
      name: "World Boss Draken 🐉 · Butuh bantuanmu sekarang!",
      type: ActivityType.Playing,
      status: PresenceUpdateStatus.Dnd,
      priority: 10,
    },
    {
      name: "Town Square Sukamaju 🏘️ · Ngobrol & jualan bareng",
      type: ActivityType.Playing,
      status: PresenceUpdateStatus.Online,
      priority: 5,
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  🧠  AI & KECERDASAN - Aku Ingat Kamu!        ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "🧠 Belajar dari obrolan kita · Makin pintar tiap hari",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 6,
    },
    {
      name: "Custom Status",
      state: "💾 Ingatan AI aktif · Kenangan kita tersimpan rapi",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 5,
    },
    {
      name: "AI DJ Companion 🎙️ · Request lagu kesukaanmu!",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Online,
      priority: 7,
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  👀  WATCHING - Memperhatikan Kalian           ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Tingkah lucu kalian di server 🍿😂",
      type: ActivityType.Watching,
      status: PresenceUpdateStatus.Online,
      priority: 4,
    },
    {
      name: "Leaderboard server 📊 · Siapa yang paling rajin?",
      type: ActivityType.Watching,
      status: PresenceUpdateStatus.Online,
      priority: 5,
    },
    {
      name: "Keamanan server 🛡️ · Tetap aman dan nyaman",
      type: ActivityType.Watching,
      status: PresenceUpdateStatus.Online,
      priority: 6,
    },
    {
      name: "Soundboard Studio 🎙️ · Bikin meme audio seru!",
      type: ActivityType.Playing,
      status: PresenceUpdateStatus.Online,
      priority: 5,
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  🏆  KOMPETITIF - Tunjukkan Skillmu!          ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Speed-run command ⚡ · Seberapa cepat kamu?",
      type: ActivityType.Competing,
      status: PresenceUpdateStatus.Online,
      priority: 6,
    },
    {
      name: "Kompetisi saldo terkaya 💰 · Jadi sultan server!",
      type: ActivityType.Competing,
      status: PresenceUpdateStatus.Online,
      priority: 7,
    },
    {
      name: "Clan War sedang berlangsung ⚔️ · Bela klammu!",
      type: ActivityType.Competing,
      status: PresenceUpdateStatus.Dnd,
      priority: 9,
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  🌟  EVENT SPESIAL - Jangan Sampai Terlewat!   ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "🌟 WEEKEND ASTRAL SURGE! Bonus 2x kupon menantimu",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 10,
    },
    {
      name: "Custom Status",
      state: "🎁 Festival event aktif! Hadiah eksklusif terbatas",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 9,
    },
    {
      name: "Live Event Naura 🎬 · Saksikan sekarang!",
      type: ActivityType.Streaming,
      url: "https://twitch.tv/naura_hoshino",
      status: PresenceUpdateStatus.Online,
      priority: 10,
    },

    // ╔═══════════════════════════════════════════════╗
    // ║  💡  AJAKAN & BRANDING - Yuk Coba!            ║
    // ╚═══════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "💡 Ketik /help · Semua fitur ada di sini",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 8,
    },
    {
      name: "Custom Status",
      state: "✨ Hai! Aku Naura · Siap jadi temanmu hari ini",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 7,
    },
    {
      name: "Custom Status",
      state: "👑 Naura Premium · Fitur eksklusif buat kamu yang spesial",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 6,
    },
    {
      name: "Custom Status",
      state: "🎨 Dashboard web baru! Cek profil & statistikmu",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      priority: 5,
    },

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  🌅  TIME-AWARE MORNING (05:00 - 10:00)                  ║
    // ╚═══════════════════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "🌅 Selamat pagi! Semangat menjalani hari ini",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      timePeriod: "morning",
      priority: 15,
    },
    {
      name: "Morning Vibes ☕ · Siap bantu aktivitasmu!",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Online,
      timePeriod: "morning",
      priority: 12,
    },
    {
      name: "Custom Status",
      state: "☀️ Hari baru, petualangan baru! Mulai eksplorasi",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      timePeriod: "morning",
      priority: 10,
    },

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  ☀️  TIME-AWARE AFTERNOON (10:00 - 15:00)                ║
    // ╚═══════════════════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "☀️ Siang yang cerah! Istirahat dulu yuk",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      timePeriod: "afternoon",
      priority: 15,
    },
    {
      name: "Productivity Beats 🎧 · Fokus kerja/belajar",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Online,
      timePeriod: "afternoon",
      priority: 12,
    },
    {
      name: "Custom Status",
      state: "⚡ Peak hours! {commands_hour} command jam ini",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Online,
      timePeriod: "afternoon",
      priority: 10,
    },

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  🌆  TIME-AWARE EVENING (15:00 - 19:00)                  ║
    // ╚═══════════════════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "🌆 Sore santai · Waktunya chill bareng Naura",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Idle,
      timePeriod: "evening",
      priority: 15,
    },
    {
      name: "Sunset Lofi 🌇 · Relax setelah seharian",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Idle,
      timePeriod: "evening",
      priority: 12,
    },
    {
      name: "Custom Status",
      state: "🎮 Waktunya gaming! Join voice channel yuk",
      type: ActivityType.Playing,
      status: PresenceUpdateStatus.Online,
      timePeriod: "evening",
      priority: 10,
    },

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  🌙  TIME-AWARE NIGHT (19:00 - 05:00)                    ║
    // ╚═══════════════════════════════════════════════════════════╝

    {
      name: "Custom Status",
      state: "🌙 Malam tenang · Masih setia menemanimu",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Idle,
      timePeriod: "night",
      priority: 15,
    },
    {
      name: "Lofi Night Radio 🌙 · Teman begadangmu",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Idle,
      timePeriod: "night",
      priority: 14,
    },
    {
      name: "Midnight Chill ✨ · Musik pelantar tidur",
      type: ActivityType.Listening,
      status: PresenceUpdateStatus.Idle,
      timePeriod: "night",
      priority: 12,
    },
    {
      name: "Custom Status",
      state: "💤 Jangan lupa istirahat ya! Kesehatan nomor satu",
      type: ActivityType.Custom,
      status: PresenceUpdateStatus.Idle,
      timePeriod: "night",
      priority: 10,
    },
  ],
};
