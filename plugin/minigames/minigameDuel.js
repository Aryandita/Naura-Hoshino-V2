// Duel matematika real-time antar pemain.
//
// Perbaikan penting dibanding versi lama:
// - `rowInvite` dan `rowGame` tidak pernah dibuat, sehingga /minigame duel
//   selalu gagal dengan ReferenceError sebelum undangan terkirim.
// - Pemenang bisa dihitung dua kali karena collector belum dihentikan saat
//   jawaban benar diproses. Sekarang dijaga bendera `settled`.
// - Saldo penantang dan lawan diperiksa ulang tepat sebelum koin berpindah.
// - Seluruh tahap memakai Container V2, termasuk penolakan dan waktu habis.

const { ComponentType } = require('discord.js');
const UserProfile = require('../../src/models/UserProfile');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { buttonRow, payout, coinOf, makeSendError, shuffle } = require('./minigameCommon');

const INVITE_TIME = 30000;
const GAME_TIME = 15000;
const DUEL_POINTS = 10;

async function runDuel(interaction, profile) {
    const user = interaction.user;
    const sendError = makeSendError(interaction);
    const opponent = interaction.options.getUser('lawan');
    const taruhan = interaction.options.getInteger('taruhan') || 0;
    const coinEmoji = coinOf();

    if (!opponent) return sendError('Naura belum tahu siapa yang mau kamu tantang~');
    if (opponent.bot) return sendError('Naura dan teman-teman robotnya tidak bisa ditantang duel yaa~');
    if (opponent.id === user.id) return sendError('Tidak bisa menantang diri sendiri dong~ Ajak temanmu yuk!');

    const [opponentProfile] = await UserProfile.findOrCreate({ where: { userId: opponent.id } });

    if (taruhan > 0) {
        if (profile.economy_wallet < taruhan) return sendError(`Saldo koinmu belum cukup untuk bertaruh **${taruhan.toLocaleString()}** ${coinEmoji}.`);
        if (opponentProfile.economy_wallet < taruhan) return sendError(`Saldo <@${opponent.id}> belum cukup untuk taruhan sebesar itu.`);
    }

    const inviteRow = buttonRow([
        { id: 'duel_accept', label: 'Terima Tantangan', style: 'success' },
        { id: 'duel_decline', label: 'Nanti Saja', style: 'danger' }
    ]);

    const invitePayload = buildContainerV2({
        accentColorHex: (ui.colors && ui.colors.primary) || '#00FFFF',
        expression: 'info',
        title: 'Ada tantangan duel!',
        description: `<@${user.id}> menantang <@${opponent.id}> adu cepat berhitung!\n\n> Taruhan: **${taruhan.toLocaleString()}** ${coinEmoji}\n\nBerani terima tantangannya?`,
        buttonsRow: inviteRow,
        footerText: 'Tantangan ini berlaku 30 detik yaa~'
    });

    const response = await interaction.editReply({ content: `<@${opponent.id}>`, ...invitePayload });

    const inviteCollector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === opponent.id,
        time: INVITE_TIME
    });

    let accepted = false;

    inviteCollector.on('collect', async i => {
        if (i.customId === 'duel_decline') {
            accepted = true; // cukup untuk menghentikan pesan waktu habis
            inviteCollector.stop('declined');

            const declinePayload = buildContainerV2({
                accentColorHex: '#ef4444',
                expression: 'info',
                title: 'Tantangan ditolak',
                description: `<@${opponent.id}> memilih tidak ikut duel kali ini. Tidak apa-apa, lain kali yaa~`,
                footerText: ui.getFooter('core')
            });

            return i.update({ content: null, ...declinePayload });
        }

        if (i.customId !== 'duel_accept') return;

        accepted = true;
        inviteCollector.stop('accepted');
        await i.deferUpdate();

        const n1 = Math.floor(Math.random() * 50) + 10;
        const n2 = Math.floor(Math.random() * 50) + 10;
        const answer = n1 + n2;
        const choices = shuffle([answer, answer + 5, answer - 3, answer + 10]);

        const gameRow = buttonRow(choices.map(value => ({
            id: `duelans_${value}`,
            label: String(value),
            style: 'primary'
        })));

        const gamePayload = buildContainerV2({
            accentColorHex: '#FF0000',
            expression: 'info',
            title: 'Pertandingan dimulai!',
            description: `Siapa yang paling cepat menekan jawaban benar?\n\n**Soal:** Berapa hasil dari **${n1} + ${n2}**?`,
            buttonsRow: gameRow,
            footerText: 'Cepat yaa, waktunya hanya 15 detik!'
        });

        await interaction.editReply({ content: `<@${user.id}> vs <@${opponent.id}>`, ...gamePayload });

        const gameCollector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: GAME_TIME
        });

        let settled = false;

        gameCollector.on('collect', async gi => {
            if (gi.user.id !== user.id && gi.user.id !== opponent.id) {
                return ui.sendError(gi, 'err_sys_3', true);
            }

            if (settled) return gi.deferUpdate().catch(() => { });

            const chosen = parseInt(gi.customId.split('_')[1], 10);

            if (chosen !== answer) {
                return ui.sendError(gi, 'err_sys_4', true);
            }

            settled = true;
            gameCollector.stop('win');

            const winner = gi.user;
            const loser = winner.id === user.id ? opponent : user;

            const [winProf] = await UserProfile.findOrCreate({ where: { userId: winner.id } });
            const [loseProf] = await UserProfile.findOrCreate({ where: { userId: loser.id } });

            winProf.minigame_duelScore += DUEL_POINTS;

            let moved = 0;
            if (taruhan > 0 && loseProf.economy_wallet >= taruhan) {
                moved = payout(winProf, taruhan);
                winProf.economy_wallet += moved;
                loseProf.economy_wallet -= taruhan;
            }

            await winProf.save();
            await loseProf.save();

            const winPayload = buildContainerV2({
                accentColorHex: '#22c55e',
                expression: 'success',
                title: 'Pemenang duel!',
                description: `Refleks <@${winner.id}> memang paling cepat \u2728\n\n> Jawaban benar: **${answer}**\n> Poin duel: **+${DUEL_POINTS}**\n> Koin: ${moved > 0 ? `**+${moved.toLocaleString()}** ${coinEmoji}` : 'tanpa taruhan'}`,
                footerText: ui.getFooter('core')
            });

            await gi.update({ content: null, ...winPayload });
        });

        gameCollector.on('end', (collected, reason) => {
            if (settled || reason === 'win') return;

            const drawPayload = buildContainerV2({
                accentColorHex: '#f59e0b',
                expression: 'cooldown',
                title: 'Waktunya habis~',
                description: `Tidak ada yang menjawab benar, jadi duelnya Naura batalkan. Jawabannya **${answer}** yaa!`,
                footerText: ui.getFooter('core')
            });

            interaction.editReply({ content: null, ...drawPayload }).catch(() => { });
        });
    });

    inviteCollector.on('end', () => {
        if (accepted) return;

        const expiredPayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'cooldown',
            title: 'Tantangan kedaluwarsa',
            description: `<@${opponent.id}> belum sempat menjawab tantangan. Coba ajak lagi nanti yaa~`,
            footerText: ui.getFooter('core')
        });

        interaction.editReply({ content: null, ...expiredPayload }).catch(() => { });
    });
}

module.exports = { runDuel };
