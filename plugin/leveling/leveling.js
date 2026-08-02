// Lokasi: src/utils/leveling.js
// ==========================================
// 🌟 SISTEM LEVELING NAURA - CHAT XP ENGINE
// ==========================================
// Memberikan XP setiap kali user aktif chat di server.
// Premium user mendapat 2x XP boost otomatis.
// Notifikasi level up dikirim ke channel yang ditentukan oleh admin.

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const redisManager = require('../../src/managers/redisManager');
const UserLeveling = require('../../src/models/UserLeveling');
const UserProfile = require('../../src/models/UserProfile');
const GuildSettings = require('../../src/models/GuildSettings');
const cacheManager = require('../../src/managers/cacheManager');
const CanvasUtils = require('../canvas/CanvasUtils');
const ui = require('../../src/config/ui');

// ==========================================
// ⚙️ KONFIGURASI SISTEM XP
// ==========================================
const CONFIG = {
    BASE_XP: 100, // XP dasar untuk level 1 → 2
    MULTIPLIER: 1.5, // Pengali kesulitan per level
    MSG_COOLDOWN: 60000, // Jeda minimum antar XP (1 menit, anti-spam)
    MSG_XP: { min: 15, max: 25 } // Range XP per pesan
};

/**
 * Hitung total XP yang dibutuhkan untuk naik ke level berikutnya.
 * Semakin tinggi level, semakin besar tantangannya!
 */
function getNextLevelXp(level) {
    // Formula Kuadratik: 5 * lvl^2 + 50 * lvl + 100
    // Jauh lebih adil dan tidak eksponensial ekstrem
    return Math.floor((5 * Math.pow(level, 2)) + (50 * level) + 100);
}

/**
 * Tentukan gelar / badge berdasarkan level user.
 * Gelar ini muncul di kartu rank mereka.
 */
function getRoleBadge(level, isPremium) {
    if (isPremium) return '👑 V.I.P Premium';
    if (level >= 100) return '✦ Legenda Abadi ✦';
    if (level >= 50) return '✧ Pahlawan Senior';
    if (level >= 25) return '✧ Petualang Tangguh';
    if (level >= 10) return '✧ Pengembara Berbakat';
    return '✧ Pendatang Baru';
}

/**
 * Berikan XP ke user setelah mengirim pesan.
 * Dipanggil dari event messageCreate setiap kali ada pesan masuk.
 */
async function awardXp(user, guild, currentChannel, messageContent = '') {
    if (user.bot || !guild) return;

    // Cegah spam karakter pendek (harus bermakna)
    if (messageContent.length < 5) return;

    // Gunakan Redis Cache untuk mengecek cooldown sebelum memanggil MySQL
    const redisKey = `xp_cooldown_${guild.id}_${user.id}`;
    if (redisManager.client && redisManager.client.isReady) {
        const isCooldown = await redisManager.getCache(redisKey);
        if (isCooldown) return; // Belum 1 menit
        await redisManager.setCache(redisKey, true, Math.floor(CONFIG.MSG_COOLDOWN / 1000));
    }


    let [profile] = await UserLeveling.findOrCreate({
        where: { userId: user.id, guildId: guild.id },
        defaults: {
            xp: 0,
            level: 1,
            messageCount: 0,
            lastActivity: new Date(0)
        }
    });

    // Cooldown MySQL dihapus, pindah ke Redis

    // Hitung XP yang didapat secara acak dalam range
    let gained = Math.floor(Math.random() * (CONFIG.MSG_XP.max - CONFIG.MSG_XP.min + 1)) + CONFIG.MSG_XP.min;

    // Cek status Premium → dapat 2x XP Boost! 🚀
    const globalProfile = await cacheManager.getUserProfile(user.id);
    if (globalProfile?.isPremium && globalProfile?.premiumUntil && new Date(globalProfile.premiumUntil) > new Date()) {
        gained *= 2;
    }

    const now = new Date();
    profile.xp = (profile.xp || 0) + gained;
    profile.messageCount = (profile.messageCount || 0) + 1;
    profile.lastActivity = now;

    await checkLevelUp(profile, user, guild, currentChannel);
    await profile.save();
}

/**
 * Cek apakah user layak naik level setelah mendapat XP baru.
 * Jika iya, kirim notifikasi keren ke channel level-up server!
 */
async function checkLevelUp(profile, user, guild, currentChannel) {
    profile.level = profile.level || 1;
    let nextXp = getNextLevelXp(profile.level);
    let hasLeveledUp = false;

    // Loop untuk menghandle multi-level up sekaligus (misal skip level)
    while (profile.xp >= nextXp) {
        profile.level++;
        profile.xp -= nextXp;
        nextXp = getNextLevelXp(profile.level);
        hasLeveledUp = true;
    }

    if (!hasLeveledUp) return;

    try {
        // Cari channel khusus level-up (jika admin sudah mengaturnya)
        let targetChannel = currentChannel;
        const settingsData = await cacheManager.getGuildSettings(guild.id);
        const levelUpChannelId = settingsData?.channels?.levelUp || settingsData?.settings?.channels?.levelUp;

        if (levelUpChannelId) {
            const specificChannel = guild.channels.cache.get(levelUpChannelId);
            if (specificChannel) targetChannel = specificChannel;
        }

        // Generate kartu level-up menggunakan Canvas
        const canvas = await CanvasUtils.generateLevel(user, profile.level);
        const buffer = canvas.encodeSync ? canvas.encodeSync('webp') : canvas.toBuffer();
        const attachment = new AttachmentBuilder(buffer, { name: 'naura-levelup.webp' });

        // Tentukan gelar baru setelah level up
        const globalProfile = await cacheManager.getUserProfile(user.id);
        const isPremium = globalProfile?.isPremium && globalProfile?.premiumUntil && new Date(globalProfile.premiumUntil) > new Date();
        const newBadge = getRoleBadge(profile.level, isPremium);

        const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            authorName: '✦ LEVEL UP! ✦',
            iconURL: user.displayAvatarURL(),
            description: `Selamat **${user.username}**! 🎉\n` +
                `Kamu baru aja naik ke **Level ${profile.level}** - terus semangat ya!\n\n` +
                `> 🏅 Gelar baru kamu sekarang: **${newBadge}**\n` +
                `> ✨ XP berikutnya: **${getNextLevelXp(profile.level).toLocaleString('id-ID')} XP**`,
            bannerAttachmentName: 'naura-levelup.webp',
            footerText: 'Makin aktif, makin kuat! Teruslah chat dan raih puncaknya~ 🌟'
        });

        if (targetChannel) {
            await targetChannel.send({ content: `<@${user.id}>`, ...payload, files: [attachment] })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 15000));
        }
    } catch (e) {
        logger.error('[LEVELING ERROR]', e);
        // Fallback sederhana jika canvas gagal render
        if (currentChannel) {
            await currentChannel
                .send(`🎉 Hore! **${user.username}** baru aja naik ke **Level ${profile.level}**!`)
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 15000))
                .catch(() => {});
        }
    }
}

module.exports = { awardXp, getNextLevelXp, getRoleBadge, checkLevelUp, CONFIG };
