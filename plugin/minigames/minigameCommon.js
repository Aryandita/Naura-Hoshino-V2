// Helper bersama seluruh minigame.
//
// Berkas ini juga menutup dua bug lama:
// 1. Beberapa permainan memakai variabel `gameStartTime` yang tidak pernah
//    dideklarasikan, sehingga pemain yang menjawab BENAR justru memicu
//    ReferenceError. Sekarang stempel waktu dibuat lewat startTimer().
// 2. Baris tombol (`row`, `rowInvite`, `rowGame`) juga tidak pernah dibuat.
//    buttonRow() menjadi pembuat baris tombol tunggal untuk semua permainan.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

const STYLE_MAP = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger
};

/**
 * Bangun satu baris tombol.
 * @param {Array<{id: string, label: string, style?: string, disabled?: boolean}>} items
 */
function buttonRow(items) {
    const row = new ActionRowBuilder();

    items.forEach(item => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(item.id)
                .setLabel(item.label)
                .setStyle(STYLE_MAP[item.style] || ButtonStyle.Secondary)
                .setDisabled(Boolean(item.disabled))
        );
    });

    return row;
}

/** Gabungkan flag ephemeral tanpa merusak flag Container V2. */
function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

/** Stempel waktu awal permainan, dipakai pemeriksaan anti-curang. */
function startTimer() {
    return Date.now();
}

/**
 * Benarkah jawaban datang terlalu cepat untuk ukuran manusia?
 * @param {number} startedAt hasil startTimer()
 * @param {number} minMs batas wajar tercepat
 */
function isSuspiciouslyFast(startedAt, minMs) {
    if (!startedAt) return false;
    return (Date.now() - startedAt) < minMs;
}

/** Hadiah koin, digandakan untuk pemilik V.I.P. */
function payout(profile, amount) {
    return profile && profile.isPremium ? amount * 2 : amount;
}

/** Emoji koin dengan cadangan aman. */
function coinOf() {
    return (ui.emojis && ui.emojis.coin) || '\ud83e\ude99';
}

/**
 * Pembuat pengirim pesan galat bergaya Naura untuk satu sesi permainan.
 * Selalu lewat editReply karena seluruh subcommand sudah melakukan defer.
 */
function makeSendError(interaction) {
    return (message) => {
        const payload = buildErrorContainerV2({
            title: 'Maaf yaa~',
            description: message,
            footerText: ui.getFooter('core')
        });

        return interaction.editReply(payload).catch(() => { });
    };
}

/** Acak isi larik tanpa mengubah larik aslinya. */
function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
}

/** Ambil satu anggota larik secara acak. */
function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

/** Soal matematika sesuai tingkat kesulitan. */
function generateMath(difficulty) {
    let num1;
    let num2;
    let num3;
    let question;
    let answer;

    switch (difficulty) {
        case 'pemula':
            num1 = Math.floor(Math.random() * 50) + 1;
            num2 = Math.floor(Math.random() * 50) + 1;
            if (Math.random() > 0.5) {
                question = `${num1} + ${num2}`;
                answer = num1 + num2;
            } else {
                question = `${num1} + ${num2} - ${Math.floor(num1 / 2)}`;
                answer = (num1 + num2) - Math.floor(num1 / 2);
            }
            break;

        case 'lanjut':
            num1 = Math.floor(Math.random() * 20) + 1;
            num2 = Math.floor(Math.random() * 15) + 1;
            question = `${num1} x ${num2}`;
            answer = num1 * num2;
            break;

        case 'master':
            num1 = Math.floor(Math.random() * 20) + 10;
            num2 = Math.floor(Math.random() * 10) + 2;
            num3 = Math.floor(Math.random() * 50) + 10;
            question = `(${num1} x ${num2}) + ${num3}`;
            answer = (num1 * num2) + num3;
            break;

        case 'grandmaster':
        default:
            num1 = Math.floor(Math.random() * 50) + 20;
            num2 = Math.floor(Math.random() * 30) + 10;
            num3 = Math.floor(Math.random() * 100) + 50;
            question = `${num1} x ${num2} - ${num3} + 125`;
            answer = (num1 * num2) - num3 + 125;
            break;
    }

    return { question, answer: answer.toString() };
}

module.exports = {
    buttonRow,
    ephemeral,
    startTimer,
    isSuspiciouslyFast,
    payout,
    coinOf,
    makeSendError,
    shuffle,
    pick,
    generateMath
};
