'use strict';

const ui = require('../config/ui');

function emoji(name, fallback = '') {
    return ui.getEmoji(name) || fallback;
}

function normalizeText(text) {
    return String(text || '').trim();
}

function joinEmoji(icon, text) {
    const body = normalizeText(text);
    return icon ? `${icon} ${body}` : body;
}

/**
 * Helper copywriting terpusat untuk menjaga suara Naura tetap konsisten.
 *
 * Prinsip:
 * - gunakan emoji dari ui.js lebih dulu, fallback unicode hanya untuk keamanan;
 * - kalimat dibuat hangat, ceria, dan langsung memberi arahan;
 * - helper ini hanya merangkai teks, bukan payload Discord.
 */
const nauraText = {
    success(text) {
        return joinEmoji(emoji('success', '✅'), `Berhasil! ${normalizeText(text)}`);
    },

    error(text) {
        return joinEmoji(emoji('error', '❌'), `Aduh, Naura belum bisa melanjutkan. ${normalizeText(text)}`);
    },

    warning(text) {
        return joinEmoji(emoji('warning', '⚠️'), `Hmm, Naura perlu perhatianmu sebentar. ${normalizeText(text)}`);
    },

    info(text) {
        return joinEmoji(emoji('info', 'ℹ️'), normalizeText(text));
    },

    loading(text) {
        return joinEmoji(emoji('loading', '⏳'), normalizeText(text) || 'Naura sedang memproses permintaanmu. Tunggu sebentar ya.');
    },

    empty(text) {
        return joinEmoji(emoji('info', 'ℹ️'), `Belum ada data di sini. ${normalizeText(text)}`);
    },

    cooldown(time) {
        return joinEmoji(emoji('warning', '⚠️'), `Pelan-pelan ya! Coba lagi dalam ${time}.`);
    },

    permissionDenied(text) {
        return joinEmoji(emoji('lock', '🔒'), normalizeText(text) || 'Kamu belum punya izin yang cukup untuk melakukan ini.');
    },

    premiumRequired(text) {
        return joinEmoji(emoji('premium_badge', '💎'), normalizeText(text) || 'Fitur ini tersedia untuk pengguna premium Naura.');
    },

    confirm(text) {
        return joinEmoji(emoji('question', '❔'), normalizeText(text));
    }
};

module.exports = nauraText;
