// Kuis trivia dan matematika.
//
// Perbaikan penting dibanding versi lama:
// - Baris tombol trivia (`row`) tidak pernah dibuat sehingga /minigame trivia
//   selalu melempar ReferenceError. Sekarang dibangun lewat buttonRow().
// - Anti-curang math memakai `gameStartTime` dan `difficulty` yang tidak ada.
//   Keduanya kini nyata lewat startTimer() dan variabel diff.
// - Klien AI dibuat malas supaya bot tetap bisa boot tanpa GEMINI_API_KEY.
// - Seluruh balasan memakai Container V2, termasuk pesan menang dan kalah.

const { ComponentType } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { triviaDBFallback, rewards } = require('./minigameData');
const {
    buttonRow, startTimer, isSuspiciouslyFast, payout, coinOf, shuffle, pick, generateMath
} = require('./minigameCommon');

const MIN_HUMAN_MS = 1500;

let aiClient = null;

function getAi() {
    if (!aiClient) {
        const { GoogleGenAI } = require('@google/genai');
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
}

async function askNauraForQuestion(diff) {
    const prompt = `Buatkan 1 soal kuis trivia pengetahuan umum yang menarik, berbahasa Indonesia, secara acak dengan tingkat kesulitan: ${diff.toUpperCase()}. Balas HANYA dengan JSON murni tanpa markdown, dengan struktur: {"q": "pertanyaan", "options": ["A", "B", "C", "D"], "a": "jawaban benar yang sama persis dengan salah satu options"}`;

    const response = await getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    const jsonText = String(response.text).replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(jsonText);

    if (!parsed.q || !Array.isArray(parsed.options) || !parsed.a || !parsed.options.includes(parsed.a)) {
        throw new Error('Format JSON dari AI rusak');
    }

    return parsed;
}

async function runTrivia(interaction, profile) {
    const user = interaction.user;
    const diff = interaction.options.getString('kesulitan');
    const conf = rewards[diff];
    const coinEmoji = coinOf();

    let qData;
    try {
        qData = await askNauraForQuestion(diff);
    } catch (error) {
        logger.warn(`[Minigame] Soal AI gagal dibuat, memakai soal cadangan: ${error.message}`);
        qData = pick(triviaDBFallback[diff]);
    }

    const options = shuffle(qData.options);
    const correctIndex = options.indexOf(qData.a);

    const answerRow = buttonRow(options.map((opt, index) => ({
        id: `ans_${index}`,
        label: String(opt).slice(0, 80),
        style: 'primary'
    })));

    const payload = buildContainerV2({
        accentColorHex: conf.color,
        expression: 'info',
        authorName: `Kuis Trivia bareng Naura [${diff.toUpperCase()}]`,
        iconURL: user.displayAvatarURL(),
        title: qData.q,
        description: `Pilih jawaban yang menurutmu benar yaa~ Naura kasih waktu **${conf.time / 1000} detik**.\n\n> Hadiah: **${conf.coin}** ${coinEmoji}\n> Skor: **+${conf.score}** Poin`,
        buttonsRow: answerRow,
        footerText: 'Soal ini disiapkan langsung oleh Naura'
    });

    await interaction.editReply(payload);
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: conf.time
    });

    collector.on('collect', async i => {
        if (i.user.id !== user.id) return ui.sendError(i, 'err_sys_5', true);

        const selectedIndex = parseInt(i.customId.split('_')[1], 10);
        const isCorrect = selectedIndex === correctIndex;

        const closedRow = buttonRow(options.map((opt, index) => ({
            id: `done_${index}`,
            label: String(opt).slice(0, 80),
            disabled: true,
            style: index === correctIndex ? 'success' : (index === selectedIndex ? 'danger' : 'secondary')
        })));

        let reward = 0;
        if (isCorrect) {
            reward = payout(profile, conf.coin);
            profile.economy_wallet += reward;
            profile.minigame_triviaScore += conf.score;
            await profile.save();
        }

        const resultPayload = buildContainerV2({
            accentColorHex: isCorrect ? '#22c55e' : '#ef4444',
            expression: isCorrect ? 'success' : 'error',
            title: isCorrect ? 'Tepat sekali!' : 'Belum tepat~',
            description: isCorrect
                ? `Wah, kamu hebat! Naura bangga banget \u2728\n\nJawabannya memang **${qData.a}**.\n\n> Kamu dapat **${reward.toLocaleString()}** ${coinEmoji}\n> Skor trivia **+${conf.score}** Poin`
                : `Yah, belum pas. Jawaban yang benar adalah **${qData.a}**.\n\nJangan patah semangat yaa, coba lagi bareng Naura!`,
            buttonsRow: closedRow,
            footerText: ui.getFooter('core')
        });

        await i.update({ content: null, ...resultPayload });
        collector.stop('answered');
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'answered') return;

        const expiredRow = buttonRow(options.map((opt, index) => ({
            id: `exp_${index}`,
            label: String(opt).slice(0, 80),
            disabled: true,
            style: index === correctIndex ? 'success' : 'secondary'
        })));

        const timeoutPayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'cooldown',
            title: 'Waktunya habis~',
            description: `Naura tunggu-tunggu tapi belum ada jawaban. Jawaban yang benar adalah **${qData.a}** yaa!`,
            buttonsRow: expiredRow,
            footerText: ui.getFooter('core')
        });

        interaction.editReply({ content: null, ...timeoutPayload }).catch(() => { });
    });
}

async function runMath(interaction, profile) {
    const user = interaction.user;
    const diff = interaction.options.getString('kesulitan');
    const conf = rewards[diff];
    const coinEmoji = coinOf();
    const mathData = generateMath(diff);
    const startedAt = startTimer();

    const payload = buildContainerV2({
        accentColorHex: conf.color,
        expression: 'info',
        authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
        iconURL: user.displayAvatarURL(),
        title: `Berapa hasil dari ${mathData.question}?`,
        description: `Ketik jawabanmu langsung di chat ini yaa~ Naura kasih waktu **${conf.time / 1000} detik**.\n\n> Hadiah: **${conf.coin}** ${coinEmoji}\n> Skor: **+${conf.score}** Poin`,
        footerText: ui.getFooter('core')
    });

    await interaction.editReply(payload);

    const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === user.id,
        time: conf.time,
        max: 1
    });

    collector.on('collect', async m => {
        const answered = m.content.replace(/\s+/g, '').trim();

        if (answered !== mathData.answer) {
            const wrongPayload = buildContainerV2({
                accentColorHex: '#ef4444',
                expression: 'error',
                title: 'Belum tepat~',
                description: `Jawaban yang benar adalah **${mathData.answer}**. Ayo coba lagi, Naura yakin kamu bisa!`,
                footerText: ui.getFooter('core')
            });
            return m.reply(wrongPayload).catch(() => { });
        }

        if (diff === 'grandmaster' && isSuspiciouslyFast(startedAt, MIN_HUMAN_MS)) {
            const cheatPayload = buildContainerV2({
                accentColorHex: '#f59e0b',
                expression: 'denied',
                title: 'Hmm, terlalu cepat...',
                description: 'Soal serumit ini dijawab kurang dari 1,5 detik? Naura curiga ada bantuan alat. Hadiahnya Naura tahan dulu yaa~',
                footerText: ui.getFooter('core')
            });
            await m.reply(cheatPayload).catch(() => { });
            return collector.stop('cheat');
        }

        const reward = payout(profile, conf.coin);
        profile.economy_wallet += reward;
        profile.minigame_mathScore += conf.score;
        await profile.save();

        const winPayload = buildContainerV2({
            accentColorHex: '#22c55e',
            expression: 'success',
            title: 'Benar sekali!',
            description: `Jawabannya memang **${mathData.answer}**. Cepat banget, Naura kagum \u2728\n\n> Kamu dapat **${reward.toLocaleString()}** ${coinEmoji}\n> Skor matematika **+${conf.score}** Poin`,
            footerText: ui.getFooter('core')
        });

        await m.reply(winPayload).catch(() => { });
    });

    collector.on('end', collected => {
        if (collected.size > 0) return;

        const timeoutPayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'cooldown',
            title: 'Waktunya habis~',
            description: `Tidak apa-apa, lain kali pasti bisa! Jawaban yang benar adalah **${mathData.answer}**.`,
            footerText: ui.getFooter('core')
        });

        interaction.followUp(timeoutPayload).catch(() => { });
    });
}

module.exports = { runTrivia, runMath };
