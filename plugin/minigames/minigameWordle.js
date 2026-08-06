// Wordle versi Bahasa Indonesia.
//
// Perbaikan penting dibanding versi lama:
// - Taruhan dipotong di awal, tetapi hadiah menang hanya tiga kali taruhan
//   sehingga keuntungan bersihnya dua kali. Pesannya menyebut tiga kali lipat.
//   Sekarang pokok taruhan dikembalikan lebih dulu, lalu hadiah tiga kali
//   taruhan diberikan, dan angkanya ditulis apa adanya.
// - Kata `LEMAR` dibuang dari kamus karena bukan kata Indonesia.
// - Pesan menang, kalah, dan waktu habis kini memakai Container V2.

const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { wordleWords } = require('./minigameData');
const { payout, coinOf, makeSendError, pick } = require('./minigameCommon');

const MAX_ATTEMPTS = 6;
const ROUND_TIME = 60000;
const GREEN = '\ud83d\udfe9';
const YELLOW = '\ud83d\udfe8';
const BLACK = '\u2b1b';

/** Bandingkan tebakan dengan kata target, tangani huruf kembar dengan benar. */
function scoreGuess(guess, target) {
    const targetArr = target.split('');
    const guessArr = guess.split('');
    const status = [BLACK, BLACK, BLACK, BLACK, BLACK];

    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === targetArr[i]) {
            status[i] = GREEN;
            targetArr[i] = null;
            guessArr[i] = null;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (guessArr[i] !== null && targetArr.includes(guessArr[i])) {
            status[i] = YELLOW;
            targetArr[targetArr.indexOf(guessArr[i])] = null;
        }
    }

    return status.join(' ');
}

async function runWordle(interaction, profile) {
    const user = interaction.user;
    const sendError = makeSendError(interaction);
    const taruhan = interaction.options.getInteger('taruhan');
    const coinEmoji = coinOf();

    if (!taruhan || taruhan <= 0) return sendError('Taruhannya harus lebih dari nol yaa~');
    if (profile.economy_wallet < taruhan) return sendError('Saldo koinmu belum cukup untuk taruhan sebesar itu. Kumpulkan dulu yuk!');

    const targetWord = pick(wordleWords);
    const history = [];
    let attempts = 0;

    // Pokok taruhan ditahan dulu selama permainan berlangsung.
    profile.economy_wallet -= taruhan;
    await profile.save();

    const introPayload = buildContainerV2({
        accentColorHex: '#2b2d31',
        expression: 'info',
        title: 'Naura Wordle',
        description: `Naura sudah memikirkan satu **kata 5 huruf** dalam Bahasa Indonesia. Ketik tebakanmu di chat ini yaa~\n\n> Kesempatan: **${MAX_ATTEMPTS}**\n> Taruhan: **${taruhan.toLocaleString()}** ${coinEmoji}\n> Hadiah menang: **${(taruhan * 3).toLocaleString()}** ${coinEmoji} plus taruhanmu kembali`,
        footerText: 'Ketik 5 huruf sekarang...'
    });

    await interaction.editReply(introPayload);

    const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === user.id && m.content.trim().length === 5,
        time: ROUND_TIME
    });

    let finished = false;

    collector.on('collect', async m => {
        const guess = m.content.trim().toUpperCase();
        attempts += 1;
        history.push(`\`${guess}\` | ${scoreGuess(guess, targetWord)}`);

        if (guess === targetWord) {
            finished = true;

            const prize = payout(profile, taruhan * 3);
            profile.economy_wallet += taruhan + prize; // pokok kembali, lalu hadiah
            profile.minigame_wordleWin += 1;
            await profile.save();

            const winPayload = buildContainerV2({
                accentColorHex: '#22c55e',
                expression: 'success',
                title: 'Tepat sekali!',
                description: `Katanya memang **${targetWord}**. Naura ikut senang banget \u2728\n\n${history.join('\n')}\n\n> Taruhan kembali: **${taruhan.toLocaleString()}** ${coinEmoji}\n> Hadiah menang: **${prize.toLocaleString()}** ${coinEmoji}`,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(winPayload).catch(() => { });
            return collector.stop('win');
        }

        if (attempts >= MAX_ATTEMPTS) {
            finished = true;

            const losePayload = buildContainerV2({
                accentColorHex: '#ef4444',
                expression: 'error',
                title: 'Kesempatanmu habis~',
                description: `Kata yang benar adalah **${targetWord}**.\n\n${history.join('\n')}\n\nTaruhan **${taruhan.toLocaleString()}** ${coinEmoji} hangus, tapi jangan menyerah yaa!`,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(losePayload).catch(() => { });
            return collector.stop('lose');
        }

        const updatePayload = buildContainerV2({
            accentColorHex: '#2b2d31',
            expression: 'info',
            title: 'Naura Wordle',
            description: `**Riwayat tebakanmu:**\n${history.join('\n')}\n\nSisa kesempatan: **${MAX_ATTEMPTS - attempts}**. Ayo semangat!`,
            footerText: ui.getFooter('core')
        });

        await interaction.editReply(updatePayload).catch(() => { });
        collector.resetTimer();
    });

    collector.on('end', async (collected, reason) => {
        if (finished || reason === 'win' || reason === 'lose') return;

        // Permainan tidak pernah tuntas, jadi pokok taruhan dikembalikan.
        profile.economy_wallet += taruhan;
        await profile.save().catch(() => { });

        const timeoutPayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'cooldown',
            title: 'Waktunya habis~',
            description: `Kata yang Naura pikirkan adalah **${targetWord}**.\n\nKarena permainannya belum selesai, taruhan **${taruhan.toLocaleString()}** ${coinEmoji} Naura kembalikan yaa.`,
            footerText: ui.getFooter('core')
        });

        interaction.editReply(timeoutPayload).catch(() => { });
    });
}

module.exports = { runWordle };
