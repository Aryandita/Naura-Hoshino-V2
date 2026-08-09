// ==========================================
// SISTEM LEVELING NAURA - MESIN XP CHAT
// ==========================================
// Memberi XP setiap kali pengguna aktif mengobrol di server.
// Pengguna premium mendapat penggandaan XP otomatis.

const { AttachmentBuilder } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const redisManager = require('../../src/managers/redisManager');
const UserLeveling = require('../../src/models/UserLeveling');
const cacheManager = require('../../src/managers/cacheManager');
const CanvasUtils = require('../canvas/CanvasUtils');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const xpBuffer = require('./xpBuffer');

const CONFIG = {
    BASE_XP: 100,
    MULTIPLIER: 1.5,
    MSG_COOLDOWN: 60000, // Jeda minimum antar XP, satu menit
    MSG_XP: { min: 15, max: 25 },
    MIN_LENGTH: 5,
    NOTICE_TTL: 15000
};

// Formula kuadratik: 5 * lvl^2 + 50 * lvl + 100
function getNextLevelXp(level) {
    return Math.floor(5 * Math.pow(level, 2) + 50 * level + 100);
}

function getRoleBadge(level, isPremium) {
    if (isPremium) return '\ud83d\udc51 V.I.P Premium';
    if (level >= 100) return '\u2726 Legenda Abadi \u2726';
    if (level >= 50) return '\u2727 Pahlawan Senior';
    if (level >= 25) return '\u2727 Petualang Tangguh';
    if (level >= 10) return '\u2727 Pengembara Berbakat';
    return '\u2727 Pendatang Baru';
}

async function isPremiumUser(userId) {
    const profile = await cacheManager.getUserProfile(userId);
    if (!profile || !profile.isPremium || !profile.premiumUntil) return false;
    return new Date(profile.premiumUntil) > new Date();
}

// Perhitungan murni tanpa await, supaya hasilnya bisa langsung disimpan
// sebelum notifikasi yang lambat dijalankan.
function applyLevelUp(profile) {
    profile.level = profile.level || 1;
    let gainedLevels = 0;
    let nextXp = getNextLevelXp(profile.level);

    while (profile.xp >= nextXp) {
        profile.level += 1;
        profile.xp -= nextXp;
        nextXp = getNextLevelXp(profile.level);
        gainedLevels += 1;
    }

    return gainedLevels;
}

async function resolveTargetChannel(guild, fallbackChannel) {
    try {
        const data = await cacheManager.getGuildSettings(guild.id);
        const channelId =
            (data && data.channels && data.channels.levelUp) ||
            (data && data.settings && data.settings.channels && data.settings.channels.levelUp);
        if (!channelId) return fallbackChannel;
        return guild.channels.cache.get(channelId) || fallbackChannel;
    } catch (e) {
        return fallbackChannel;
    }
}

async function announceLevelUp(profile, user, guild, currentChannel) {
    let targetChannel = currentChannel;

    try {
        targetChannel = await resolveTargetChannel(guild, currentChannel);
        if (!targetChannel) return;

        const canvas = await CanvasUtils.generateLevel(user, profile.level);
        const buffer = canvas.encodeSync ? canvas.encodeSync('webp') : canvas.toBuffer();
        const attachment = new AttachmentBuilder(buffer, { name: 'naura-levelup.webp' });

        const badge = getRoleBadge(profile.level, await isPremiumUser(user.id));
        const nextXp = getNextLevelXp(profile.level).toLocaleString('id-ID');

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            authorName: '\u2726 LEVEL UP! \u2726',
            iconURL: user.displayAvatarURL(),
            expression: 'levelup',
            description:
                `Yeay, selamat ya **${user.username}**!\n` +
                `Kamu baru naik ke **Level ${profile.level}**. Naura ikut senang banget~\n\n` +
                `> Gelar baru kamu: **${badge}**\n` +
                `> XP berikutnya: **${nextXp} XP**`,
            bannerAttachmentName: 'naura-levelup.webp',
            footerText: 'Makin sering ngobrol, makin kuat. Naura temani terus ya!'
        });

        const sent = await targetChannel.send({
            content: `<@${user.id}>`,
            ...payload,
            files: [attachment]
        });
        setTimeout(() => sent.delete().catch(() => {}), CONFIG.NOTICE_TTL);
    } catch (e) {
        logger.error('[LEVELING] Gagal mengirim notifikasi naik level:', e);

        if (!targetChannel) return;
        await targetChannel
            .send(`Hore! **${user.username}** baru naik ke **Level ${profile.level}**!`)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), CONFIG.NOTICE_TTL))
            .catch(() => {});
    }
}

// Dipertahankan untuk pemanggil lama: menghitung, menyimpan, lalu mengumumkan.
async function checkLevelUp(profile, user, guild, currentChannel) {
    const gained = applyLevelUp(profile);
    if (gained === 0) return 0;

    if (typeof profile.save === 'function') {
        await profile.save().catch(err =>
            logger.error('[LEVELING] Gagal menyimpan level baru:', err.message)
        );
    }

    await announceLevelUp(profile, user, guild, currentChannel);
    return gained;
}

async function rollXp(userId) {
    const span = CONFIG.MSG_XP.max - CONFIG.MSG_XP.min + 1;
    let gained = Math.floor(Math.random() * span) + CONFIG.MSG_XP.min;
    if (await isPremiumUser(userId)) gained *= 2;
    return gained;
}

/**
 * Jalur lama: satu pesan sama dengan satu baca dan satu tulis ke database.
 * Dipakai hanya bila Redis mati, atau bila penulisan ke penyangga gagal.
 *
 * @param {number|null} precomputedGain XP yang sudah diundi. Bila terisi, jeda
 * berbasis lastActivity dilewati karena kunci jeda di Redis sudah lolos.
 */
async function awardXpDirect(user, guild, currentChannel, precomputedGain = null) {
    const [profile] = await UserLeveling.findOrCreate({
        where: { userId: user.id, guildId: guild.id },
        defaults: { xp: 0, level: 1, messageCount: 0, lastActivity: new Date(0) }
    });

    // Cadangan bila Redis mati. Tanpa ini setiap pesan memberi XP penuh.
    if (precomputedGain === null) {
        const lastActivity = profile.lastActivity ? new Date(profile.lastActivity).getTime() : 0;
        if (Date.now() - lastActivity < CONFIG.MSG_COOLDOWN) return;
    }

    const gained = precomputedGain === null ? await rollXp(user.id) : precomputedGain;

    profile.xp = (profile.xp || 0) + gained;
    profile.messageCount = (profile.messageCount || 0) + 1;
    profile.lastActivity = new Date();

    const gainedLevels = applyLevelUp(profile);

    // Simpan lebih dahulu. Notifikasi berisi render kanvas yang lambat dan
    // pernah menyebabkan XP hilang karena tertimpa pesan berikutnya.
    await profile.save();

    if (gainedLevels > 0) {
        await announceLevelUp(profile, user, guild, currentChannel);
    }
}

/**
 * Memberi XP atas satu pesan.
 *
 * Bila Redis siap, XP hanya ditambahkan ke penyangga dan database disentuh saat
 * flush berkala atau saat pengguna benar-benar naik level. Nilai dasar dibaca
 * dari cache sehingga obrolan ramai tidak lagi memicu satu findOrCreate dan satu
 * UPDATE untuk setiap pesan.
 */
async function awardXp(user, guild, currentChannel, messageContent = '') {
    if (user.bot || !guild) return;
    if (!messageContent || messageContent.length < CONFIG.MIN_LENGTH) return;

    const cooldownKey = `xp_cooldown_${guild.id}_${user.id}`;

    if (!xpBuffer.isEnabled()) {
        await awardXpDirect(user, guild, currentChannel);
        return;
    }

    const onCooldown = await redisManager.getCache(cooldownKey);
    if (onCooldown) return;
    await redisManager.setCache(cooldownKey, true, Math.floor(CONFIG.MSG_COOLDOWN / 1000));

    const gained = await rollXp(user.id);
    const pending = await xpBuffer.addXp(guild.id, user.id, gained);

    // Redis tumbang tepat setelah jeda tercatat. Jangan buang XP-nya.
    if (pending === null) {
        await awardXpDirect(user, guild, currentChannel, gained);
        return;
    }

    const base = await xpBuffer.readBase(guild.id, user.id);
    if (base.xp + pending < getNextLevelXp(base.level)) return;

    // Ambang terlampaui. Setor sekarang supaya pengumuman naik level tidak
    // tertunda sampai flush berikutnya.
    const row = await xpBuffer.settleUser(guild.id, user.id);
    if (!row) return;

    const gainedLevels = applyLevelUp(row);
    if (gainedLevels === 0) return;

    await row.save();
    await xpBuffer.invalidateBase(guild.id, user.id);
    await announceLevelUp(row, user, guild, currentChannel);
}

module.exports = {
    awardXp,
    awardXpDirect,
    rollXp,
    getNextLevelXp,
    getRoleBadge,
    applyLevelUp,
    checkLevelUp,
    announceLevelUp,
    xpBuffer,
    CONFIG
};
