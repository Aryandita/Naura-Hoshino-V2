const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');
const cacheManager = require('../managers/cacheManager');
const ui = require('../config/ui');

// In-memory Regex Cache
const regexCache = new Map();
function getCompiledRegex(patternStr, flags = 'gi') {
    const key = `${patternStr}:${flags}`;
    if (!regexCache.has(key)) {
        regexCache.set(key, new RegExp(patternStr, flags));
    }
    return regexCache.get(key);
}

// Kamus leet-speak untuk menetralisir pesan yang disensor/alay
const leetMap = {
    0: 'o',
    1: 'i',
    2: 'z',
    3: 'e',
    4: 'a',
    5: 's',
    6: 'g',
    7: 't',
    8: 'b',
    9: 'g',
    '@': 'a',
    '!': 'i',
    $: 's',
    '+': 's',
    '&': 'a'
};

// Fungsi pembersih teks
function normalizeText(text) {
    let normalized = text.toLowerCase();
    for (const [key, value] of Object.entries(leetMap)) {
        normalized = normalized.split(key).join(value);
    }
    // Hapus spasi, titik, koma, dsb (hanya sisakan huruf & angka)
    return normalized.replace(/[^a-z0-9]/g, '');
}

async function handleAutomod(message, client) {
    // Abaikan jika pesan dari bot atau DM
    if (message.author.bot || !message.guild) return false;

    // Bypass untuk Admin (Jangan filter pesan admin)
    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

    // Ambil pengaturan server dari cache Redis / in-memory
    const settings = await cacheManager.getGuildSettings(message.guild.id);
    const automod = settings?.settings?.automod || settings?.automod;

    // Jika automod dimatikan di server ini, skip pengecekan
    if (!automod || !automod.enabled) return false;

    let isViolating = false;
    let reason = '';

    // 1. Cek Anti Invite (Mencegah user promosi server Discord lain)
    if (automod.antiInvite) {
        const inviteRegex = getCompiledRegex('(https?:\\/\\/)?(www\\.)?(discord\\.(gg|io|me|li)|discordapp\\.com\\/invite)\\/.+[a-z]', 'gi');
        if (inviteRegex.test(message.content)) {
            isViolating = true;
            reason = 'Mempromosikan link Discord lain (Anti-Invite).';
        }
    }

    // 2. Cek Kata Kasar (Badwords) yang di-set kustom per server
    if (!isViolating && automod.badWords && automod.badWords.length > 0) {
        const normalizedMsg = normalizeText(message.content);
        for (const word of automod.badWords) {
            const normalizedBadword = normalizeText(word);
            if (normalizedMsg.includes(normalizedBadword)) {
                isViolating = true;
                reason = 'Menggunakan kata yang dilarang di server ini.';
                break;
            }
        }
    }

    // Eksekusi hukuman jika melanggar
    if (isViolating) {
        await message.delete().catch(() => {}); // Hapus pesan pelanggar

        const warnEmbed = new EmbedBuilder()
            .setColor(ui.getColor ? ui.getColor('error') : '#FF0000')
            .setTitle('🚨 Peringatan AutoMod')
            .setDescription(`<@${message.author.id}>, pesanmu otomatis dihapus karena:\n**${reason}**`);

        // Kirim notifikasi, lalu otomatis hapus notifikasinya setelah 5 detik agar chat tidak kotor
        const warnMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => {});
        if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);

        return true; // Beri tahu messageCreate.js bahwa pesan ini melanggar, HENTIKAN proses command.
    }

    return false; // Pesan aman
}

module.exports = { handleAutomod, normalizeText };
