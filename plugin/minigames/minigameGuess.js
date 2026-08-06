// Tiga permainan tebak-tebakan: susun kata, tebak gambar, dan teka teki silang.
//
// Perbaikan penting dibanding versi lama:
// - Anti-curang memanggil `gameStartTime` yang tidak pernah dideklarasikan,
//   sehingga pemain yang menjawab BENAR justru memicu ReferenceError. Stempel
//   waktu kini dibuat lewat startTimer().
// - Tebak gambar menyebut "gambar di atas" padahal `gameData.url` tidak pernah
//   dipakai sama sekali. Sekarang gambarnya benar-benar ditampilkan.
// - Seluruh balasan memakai Container V2.

const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { anagramDB, tebakGambarDB, ttsDB } = require('./minigameData');
const { startTimer, isSuspiciouslyFast, payout, coinOf, shuffle, pick } = require('./minigameCommon');

const MIN_HUMAN_MS = 1500;

function resultPayload(options) {
    return buildContainerV2({
        accentColorHex: options.color,
        expression: options.expression,
        title: options.title,
        description: options.description,
        footerText: ui.getFooter('core')
    });
}

/**
 * Kerangka bersama ketiga permainan: satu soal, satu jawaban lewat chat.
 */
async function playTextRound(interaction, profile, config) {
    const user = interaction.user;
    const coinEmoji = coinOf();
    const startedAt = startTimer();

    await interaction.editReply(buildContainerV2({
        accentColorHex: config.color || ((ui.colors && ui.colors.primary) || '#00FFFF'),
        expression: 'info',
        authorName: config.authorName,
        iconURL: user.displayAvatarURL(),
        title: config.title,
        description: config.description,
        mediaAttachmentNames: [],
        footerText: `Waktu menjawab ${config.time / 1000} detik`
    }));

    const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === user.id,
        time: config.time,
        max: 1
    });

    collector.on('collect', async m => {
        const answered = m.content.trim().toUpperCase();

        if (answered !== config.answer.toUpperCase()) {
            return m.reply(resultPayload({
                color: '#ef4444',
                expression: 'error',
                title: 'Belum tepat~',
                description: `Jawaban yang benar adalah **${config.answer}**. Tetap semangat yaa, Naura yakin kamu bisa!`
            })).catch(() => { });
        }

        if (isSuspiciouslyFast(startedAt, MIN_HUMAN_MS)) {
            return m.reply(resultPayload({
                color: '#f59e0b',
                expression: 'denied',
                title: 'Hmm, terlalu cepat...',
                description: 'Jawabannya benar, tapi datangnya kurang dari 1,5 detik. Naura tahan dulu hadiahnya yaa, main jujur lebih seru kok!'
            })).catch(() => { });
        }

        const reward = payout(profile, config.reward);
        profile.economy_wallet += reward;
        await profile.save();

        return m.reply(resultPayload({
            color: '#22c55e',
            expression: 'success',
            title: 'Tepat sekali!',
            description: `${config.winNote}\n\nJawabannya memang **${config.answer}**.\n\n> Kamu dapat **${reward.toLocaleString()}** ${coinEmoji}`
        })).catch(() => { });
    });

    collector.on('end', collected => {
        if (collected.size > 0) return;

        interaction.followUp(resultPayload({
            color: '#f59e0b',
            expression: 'cooldown',
            title: 'Waktunya habis~',
            description: `Naura tunggu tapi belum ada jawaban. Yang benar adalah **${config.answer}** yaa!`
        })).catch(() => { });
    });
}

async function runTebakKata(interaction, profile) {
    const diff = interaction.options.getString('kesulitan');
    const word = pick(anagramDB[diff] || anagramDB.mudah);
    const scrambled = shuffle(word.split('')).join(' ');
    const reward = diff === 'sulit' ? 300 : 100;

    return playTextRound(interaction, profile, {
        authorName: `Susun Kata [${diff.toUpperCase()}]`,
        title: 'Huruf-huruf ini acak, susun jadi kata yang benar!',
        description: `**${scrambled}**\n\nKetik jawabanmu langsung di chat yaa~\n\n> Hadiah: **${reward}** ${coinOf()}`,
        answer: word,
        reward,
        time: 30000,
        color: '#a855f7',
        winNote: 'Wah, cepat sekali menyusunnya! Naura kagum \u2728'
    });
}

async function runTebakGambar(interaction, profile) {
    const data = pick(tebakGambarDB);
    const reward = 250;

    // Gambar dikirim sebagai tautan di dalam deskripsi karena sumbernya berupa
    // URL eksternal, bukan lampiran lokal yang dibutuhkan mediaAttachmentNames.
    return playTextRound(interaction, profile, {
        authorName: 'Tebak Gambar',
        title: 'Objek apa yang ada di gambar ini?',
        description: `[\ud83d\uddbc\ufe0f Buka gambarnya di sini](${data.url})\n\nKetik jawabanmu di chat yaa~\n\n> Petunjuk: **${data.hint}**\n> Hadiah: **${reward}** ${coinOf()}`,
        answer: data.answer,
        reward,
        time: 20000,
        color: '#0ea5e9',
        winNote: 'Mata kamu jeli banget! Naura suka \u2728'
    });
}

async function runTts(interaction, profile) {
    const data = pick(ttsDB);
    const reward = 400;

    return playTextRound(interaction, profile, {
        authorName: 'Teka Teki Silang Mini',
        title: data.clue,
        description: `Pola jawabannya: **${data.pattern}**\n\nKetik jawabanmu di chat yaa~\n\n> Hadiah: **${reward}** ${coinOf()}`,
        answer: data.answer,
        reward,
        time: 25000,
        color: '#f97316',
        winNote: 'Pintar sekali! Naura sampai kagum \u2728'
    });
}

module.exports = { runTebakKata, runTebakGambar, runTts };
