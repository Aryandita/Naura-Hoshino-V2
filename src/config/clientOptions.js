// Opsi konstruksi Client dipisahkan agar intent, partial, dan batas cache mudah diaudit.
const { GatewayIntentBits, Options, Partials } = require('discord.js');

// Setiap intent di bawah ini punya event pemakai yang nyata di src/events.
// Jangan menambah intent tanpa event pemakainya, karena setiap intent memperbesar
// aliran data gateway sekaligus isi cache di memori.
//
// Guilds                : dasar. Dipakai channelCreate/Delete/Update dan roleCreate/Delete.
// GuildVoiceStates      : voiceStateUpdate, yaitu temp voice dan pemutar musik.
// GuildMessages         : messageCreate (prefix command), messageUpdate, messageDelete.
// GuildMessageReactions : messageReactionAdd dan messageReactionRemove. Tanpa intent ini
//                         Discord tidak pernah mengirim kedua event tersebut.
// MessageContent        : privileged. Wajib selama bot masih melayani prefix command.
// GuildMembers          : privileged. Dipakai guildMemberAdd, guildMemberRemove,
//                         guildMemberUpdate, dan pencarian member pada perintah admin.
// DirectMessages        : modmail dan notifikasi pribadi. Butuh Partials.Channel.
//
// GuildPresences SENGAJA tidak diaktifkan karena tidak ada fitur yang membutuhkannya.
// Konsekuensinya src/events/presenceUpdate.js tidak pernah terpanggil. Berkas itu
// sekarang kode mati dan sudah dicatat di TODO.md untuk dihapus atau diaktifkan sadar.
const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
];

// Partials.Reaction diperlukan agar reaksi pada pesan lama yang tidak lagi ada di cache
// tetap sampai ke handler.
const partials = [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction];

// Batas cache. Secara bawaan discord.js menyimpan hampir semuanya tanpa batas, sehingga
// pemakaian memori tumbuh mengikuti jumlah guild dan lama uptime, bukan mengikuti beban
// kerja yang sebenarnya. Angka 0 berarti tidak pernah disimpan di memori; pemanggilan
// fetch() tetap berfungsi karena tetap menembak REST API.
//
// Yang TIDAK dibatasi di sini dan alasannya:
// - ChannelManager dan GuildManager: dipakai hampir setiap perintah dan cron.
// - RoleManager: dipakai pemeriksaan izin di banyak tempat.
// - ReactionUserManager: belum dibatasi karena handler reaksi belum diaudit apakah
//   membaca reaction.users.cache. Membatasinya sekarang berisiko mengubah perilaku diam-diam.
const CACHE_LIMITS = {
    // Cache pesan hanya dibutuhkan oleh log edit dan log hapus. Nilai bawaan 200 per
    // channel dikalikan jumlah channel aktif adalah penyumbang memori terbesar.
    MessageManager: 100,

    // keepOverLimit menjaga entri bot sendiri tetap ada. Tanpa itu client.user bisa
    // tergusur dari cache dan pemeriksaan izin bot sendiri jadi gagal.
    GuildMemberManager: {
        maxSize: 200,
        keepOverLimit: member => member.id === member.client.user.id
    },
    UserManager: {
        maxSize: 500,
        keepOverLimit: user => user.id === user.client.user.id
    },

    // Intent GuildPresences tidak aktif, jadi cache ini tidak akan pernah terisi.
    PresenceManager: 0,

    // Semua manager di bawah ini tidak pernah dibaca dari cache oleh kode bot.
    GuildBanManager: 0,
    GuildInviteManager: 0,
    GuildScheduledEventManager: 0,
    StageInstanceManager: 0,
    ThreadMemberManager: 0,
    AutoModerationRuleManager: 0,
    GuildStickerManager: 0
};

// DefaultMakeCacheSettings harus disebar lebih dulu. cacheWithLimits tidak menggabungkan
// nilai bawaan secara otomatis, jadi manager yang tidak disebut akan kembali tanpa batas.
const makeCache = Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    ...CACHE_LIMITS
});

// Batas ukuran saja tidak cukup, karena entri yang sudah tidak relevan tetap menempati
// kuota sampai tergusur. Penyapu membuang yang basi berdasarkan umur.
//
// Member dan user SENGAJA tidak disapu. Menyapu member bisa membuang member yang sedang
// berada di voice channel, dan itu merusak pelacakan temp voice.
const sweepers = {
    ...Options.DefaultSweeperSettings,
    messages: {
        interval: 600,
        lifetime: 1800
    },
    threads: {
        interval: 3600,
        lifetime: 14400
    }
};

module.exports = { intents, partials, makeCache, sweepers, CACHE_LIMITS };
