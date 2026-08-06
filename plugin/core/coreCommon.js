/**
 * @namespace: plugin/core/coreCommon.js
 * @type: Helper
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Konstanta, helper emoji, dan resolusi bahasa untuk seluruh modul core.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ui = require('../../src/config/ui');
const nauraExpression = require('../../src/utils/nauraExpression');
const GuildSettings = require('../../src/models/GuildSettings');
const logger = require('../../src/managers/logger');

const locales = {
    id: require('./locales/id.json'),
    en: require('./locales/en.json')
};

const SUPPORTED = ['id', 'en'];

// Nilai tanpa skema cukup diberi awalan http://. Versi lama membungkusnya
// dengan kurung kurawal ganda sehingga tautannya tidak sah dan ditolak
// ButtonBuilder.setURL saat tombol navigasi dirakit.
const rawDashboard = ui.dashboards || 'http://92.118.206.166:30398';
const LINKS = {
    SUPPORT: ui.support_server || 'https://dsc.gg/naura-hoshino',
    DASHBOARD: rawDashboard.startsWith('http') ? rawDashboard : `http://${rawDashboard}`,
    INVITE: ui.invite || 'https://discord.com/api/oauth2/authorize?client_id=1483665745727721543&permissions=8&scope=bot%20applications.commands'
};

/**
 * Urutan kategori help. Dulu daftar ini ditulis dua kali dengan isi berbeda
 * sehingga indeksnya bergeser. Sekarang perakit tampilan dan collector
 * membaca satu sumber yang sama.
 */
const HELP_CATEGORY_KEYS = ['core', 'music', 'minigame', 'survival', 'admin'];

/** Emoji dari ui.js dengan cadangan sederhana bila kuncinya belum terisi. */
function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

/** Emoji wajah Naura, dengan emoji status ui.js sebagai cadangan. */
function face(mood, fallback) {
    return nauraExpression.getEmoji(mood) || ui.getEmoji(mood) || fallback;
}

/** Menangani ms < 1000 agar memunculkan teks "Baru saja mulai". */
function formatUptime(ms) {
    const sparkle = e('sparkle', '\\u2728');
    if (ms < 1000) return `Baru saja mulai ${sparkle}`;

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    const result = [];
    if (days > 0) result.push(`${days}d`);
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0) result.push(`${minutes}m`);
    if (seconds > 0) result.push(`${seconds}s`);

    return result.length > 0 ? result.join(' ') : `Baru saja mulai ${sparkle}`;
}

function createNavButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Support Server').setURL(LINKS.SUPPORT).setStyle(ButtonStyle.Link).setEmoji(e('support', '\\uD83D\\uDCAC')),
        new ButtonBuilder().setLabel('Web Dashboard').setURL(LINKS.DASHBOARD).setStyle(ButtonStyle.Link).setEmoji(e('dashboard', '\\uD83C\\uDF10')),
        new ButtonBuilder().setLabel('Invite Naura').setURL(LINKS.INVITE).setStyle(ButtonStyle.Link).setEmoji(e('invite', '\\uD83D\\uDCE9'))
    );
}

function formatHelpContent(text) {
    if (!text) return '';
    return text.replace(/\\{emoji:(\\w+)(?:\\|([^}]+))?\\}/g, (match, key, fallback) => {
        return ui.getEmoji(key) || fallback || match;
    });
}

/** Bahasa server dari GuildSettings.system.language, null bila belum diatur. */
async function resolveGuildLanguage(guildId) {
    if (!guildId) return null;
    try {
        const settings = await GuildSettings.findOne({ where: { guildId } });
        if (settings && settings.system && SUPPORTED.includes(settings.system.language)) {
            return settings.system.language;
        }
    } catch (err) {
        logger.warn(`[Core] Gagal membaca bahasa server: ${err.message}`);
    }
    return null;
}

/** Bahasa pribadi user lewat languageManager, kanon di seluruh ekosistem. */
async function resolveUserLanguage(userId) {
    if (!userId) return null;
    try {
        const languageManager = require('../../src/managers/languageManager');
        const code = await languageManager.getUserLanguage(userId);
        if (SUPPORTED.includes(code)) return code;
    } catch (err) {
        logger.warn(`[Core] Gagal membaca bahasa user: ${err.message}`);
    }
    return null;
}

/**
 * Bahasa pribadi menang atas bahasa server, lalu jatuh ke Bahasa Indonesia.
 * @returns {Promise<{ code: string, lang: object }>}
 */
async function resolveLocale(userId, guildId) {
    const code = (await resolveUserLanguage(userId)) || (await resolveGuildLanguage(guildId)) || 'id';
    return { code, lang: locales[code] || locales.id };
}

/**
 * Menyimpan pilihan bahasa user. languageManager memegang cache ber-TTL,
 * jadi ia harus dipanggil lebih dulu supaya pilihan langsung berlaku.
 */
async function persistUserLanguage(userId, code) {
    if (!userId || !SUPPORTED.includes(code)) return false;
    try {
        const languageManager = require('../../src/managers/languageManager');
        await languageManager.setUserLanguage(userId, code);
    } catch (err) {
        logger.warn(`[Core] Gagal menyimpan bahasa user: ${err.message}`);
        return false;
    }
    try {
        const cacheManager = require('../../src/managers/cacheManager');
        await cacheManager.updateUserProfile(userId, { language: code });
    } catch (err) {
        logger.warn(`[Core] Gagal menyegarkan cache profil bahasa: ${err.message}`);
    }
    return true;
}

module.exports = {
    locales,
    SUPPORTED,
    LINKS,
    HELP_CATEGORY_KEYS,
    e,
    face,
    formatUptime,
    createNavButtons,
    formatHelpContent,
    resolveGuildLanguage,
    resolveUserLanguage,
    resolveLocale,
    persistUserLanguage
};
