// Batu Gunting Kertas dan Tic-Tac-Toe melawan Naura.
//
// Perbaikan penting dibanding versi lama:
// - Baris tombol RPS (`row`) tidak pernah dibuat sehingga /minigame rps selalu
//   melempar ReferenceError.
// - Tic-Tac-Toe memotong koin saat SERI padahal pesannya bilang dikembalikan.
// - Pesan hadiah menyebut dua kali lipat taruhan padahal yang ditambahkan hanya
//   sebesar taruhan. Angka pada pesan kini sama dengan yang masuk ke dompet.
// - Papan Tic-Tac-Toe dikirim sebagai Container V2, bukan pesan teks polos.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { buttonRow, payout, coinOf, makeSendError } = require('./minigameCommon');

const RPS_CHOICES = ['batu', 'gunting', 'kertas'];
const RPS_TIME = 15000;
const TTT_TIME = 60000;

function beats(a, b) {
    return (a === 'batu' && b === 'gunting')
        || (a === 'gunting' && b === 'kertas')
        || (a === 'kertas' && b === 'batu');
}

async function runRps(interaction, profile) {
    const user = interaction.user;
    const sendError = makeSendError(interaction);
    const taruhan = interaction.options.getInteger('taruhan');
    const opponent = interaction.options.getUser('lawan');
    const coinEmoji = coinOf();

    if (!taruhan || taruhan <= 0) return sendError('Taruhannya harus lebih dari nol yaa~');
    if (profile.economy_wallet < taruhan) return sendError('Saldo koinmu belum cukup untuk taruhan sebesar itu. Kumpulkan dulu yuk!');

    if (opponent && !opponent.bot && opponent.id !== user.id) {
        const soonPayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'info',
            title: 'Belum bisa PvP dulu yaa~',
            description: 'Mode lawan pemain nyata masih Naura siapkan. Untuk sekarang, ayo main lawan Naura saja!',
            footerText: ui.getFooter('core')
        });
        return interaction.editReply(soonPayload);
    }

    const moveRow = buttonRow([
        { id: 'rps_batu', label: 'Batu', style: 'primary' },
        { id: 'rps_gunting', label: 'Gunting', style: 'primary' },
        { id: 'rps_kertas', label: 'Kertas', style: 'primary' }
    ]);

    const payload = buildContainerV2({
        accentColorHex: (ui.colors && ui.colors.primary) || '#00FFFF',
        expression: 'info',
        authorName: 'Batu Gunting Kertas',
        iconURL: user.displayAvatarURL(),
        description: `Kamu bertaruh **${taruhan.toLocaleString()}** ${coinEmoji}.\nAyo pilih gerakanmu dalam **15 detik**, Naura sudah siap!`,
        buttonsRow: moveRow,
        footerText: ui.getFooter('core')
    });

    await interaction.editReply(payload);
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: RPS_TIME
    });

    collector.on('collect', async i => {
        if (i.user.id !== user.id) return ui.sendError(i, 'err_sys_6', true);

        const userChoice = i.customId.split('_')[1];
        const botChoice = RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)];

        let color = '#FFFF00';
        let expression = 'info';
        let result = `Seri! Kita sama-sama memilih **${userChoice}**. Koin taruhanmu aman kok~`;

        if (beats(userChoice, botChoice)) {
            const reward = payout(profile, taruhan);
            profile.economy_wallet += reward;
            profile.minigame_rpsWin += 1;
            color = '#22c55e';
            expression = 'success';
            result = `Yeay, kamu menang! Naura memilih **${botChoice}**.\n\nKamu dapat tambahan **${reward.toLocaleString()}** ${coinEmoji}!`;
        } else if (beats(botChoice, userChoice)) {
            profile.economy_wallet -= taruhan;
            color = '#ef4444';
            expression = 'error';
            result = `Naura memilih **${botChoice}** dan kali ini Naura menang~\n\nKamu kehilangan **${taruhan.toLocaleString()}** ${coinEmoji}. Jangan sedih, coba lagi yaa!`;
        }

        await profile.save();

        const resultPayload = buildContainerV2({
            accentColorHex: color,
            expression,
            title: `Kamu: ${userChoice.toUpperCase()} vs Naura: ${botChoice.toUpperCase()}`,
            description: result,
            footerText: ui.getFooter('core')
        });

        await i.update({ content: null, ...resultPayload });
        collector.stop('done');
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'done' || collected.size > 0) return;

        const timeoutPayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'cooldown',
            title: 'Waktunya habis~',
            description: 'Kamu belum sempat memilih, jadi taruhannya Naura batalkan yaa. Koinmu utuh kok!',
            footerText: ui.getFooter('core')
        });

        interaction.editReply({ content: null, ...timeoutPayload }).catch(() => { });
    });
}

function checkWin(board) {
    const wins = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    for (const w of wins) {
        if (board[w[0]] === board[w[1]] && board[w[1]] === board[w[2]]) return board[w[0]];
    }

    if (board.every(c => c === 'X' || c === 'O')) return 'DRAW';
    return null;
}

function buildBoardRows(board, disabled = false) {
    const rows = [];

    for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();

        for (let j = 0; j < 3; j++) {
            const idx = (i * 3) + j;
            const val = board[idx];
            const btn = new ButtonBuilder().setCustomId(`ttt_${idx}`).setDisabled(disabled || val === 'X' || val === 'O');

            if (val === 'X') btn.setLabel('\u274c').setStyle(ButtonStyle.Primary);
            else if (val === 'O') btn.setLabel('\u2b55').setStyle(ButtonStyle.Danger);
            else btn.setLabel('\u2796').setStyle(ButtonStyle.Secondary);

            row.addComponents(btn);
        }

        rows.push(row);
    }

    return rows;
}

function boardPayload(board, description, options = {}) {
    return buildContainerV2({
        accentColorHex: options.color || ((ui.colors && ui.colors.primary) || '#00FFFF'),
        expression: options.expression || 'info',
        title: options.title || 'Tic-Tac-Toe bareng Naura',
        description,
        buttonsRow: buildBoardRows(board, Boolean(options.disabled)),
        footerText: ui.getFooter('core')
    });
}

async function runTicTacToe(interaction, profile) {
    const user = interaction.user;
    const sendError = makeSendError(interaction);
    const taruhan = interaction.options.getInteger('taruhan');
    const opponent = interaction.options.getUser('lawan');
    const coinEmoji = coinOf();

    if (!taruhan || taruhan <= 0) return sendError('Taruhannya harus lebih dari nol yaa~');
    if (profile.economy_wallet < taruhan) return sendError('Saldo koinmu belum cukup untuk taruhan sebesar itu. Kumpulkan dulu yuk!');

    if (opponent && !opponent.bot && opponent.id !== user.id) {
        const soonPayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'info',
            title: 'Belum bisa PvP dulu yaa~',
            description: 'Mode lawan pemain nyata masih Naura siapkan. Kosongkan pilihan lawan untuk bermain melawan Naura!',
            footerText: ui.getFooter('core')
        });
        return interaction.editReply(soonPayload);
    }

    const board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const intro = `Taruhan: **${taruhan.toLocaleString()}** ${coinEmoji}\n\nKamu memegang \u274c dan Naura memegang \u2b55. Silakan jalan duluan!`;

    await interaction.editReply(boardPayload(board, intro));
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: TTT_TIME
    });

    collector.on('collect', async i => {
        if (i.user.id !== user.id) return ui.sendError(i, 'err_sys_7', true);

        board[parseInt(i.customId.split('_')[1], 10)] = 'X';
        let status = checkWin(board);

        if (!status) {
            const empty = board.filter(s => s !== 'X' && s !== 'O');
            if (empty.length > 0) {
                board[empty[Math.floor(Math.random() * empty.length)]] = 'O';
                status = checkWin(board);
            }
        }

        if (!status) {
            await i.update({ content: null, ...boardPayload(board, intro) });
            return collector.resetTimer();
        }

        let description;
        let color;
        let expression;

        if (status === 'X') {
            const reward = payout(profile, taruhan);
            profile.economy_wallet += reward;
            profile.minigame_tttWin += 1;
            color = '#22c55e';
            expression = 'success';
            description = `Kamu menang! Naura kalah telak~\n\nKamu dapat tambahan **${reward.toLocaleString()}** ${coinEmoji}.`;
        } else if (status === 'O') {
            profile.economy_wallet -= taruhan;
            color = '#ef4444';
            expression = 'error';
            description = `Naura menang kali ini! Kamu kehilangan **${taruhan.toLocaleString()}** ${coinEmoji}.\n\nAyo main lagi, Naura tunggu!`;
        } else {
            color = '#FFFF00';
            expression = 'info';
            description = 'Seri! Papannya penuh dan tidak ada yang menang. Koin taruhanmu tetap utuh kok~';
        }

        await profile.save();

        await i.update({
            content: null,
            ...boardPayload(board, description, { color, expression, disabled: true, title: 'Permainan Selesai' })
        });

        collector.stop('done');
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'done' || checkWin(board) !== null) return;

        profile.economy_wallet -= taruhan;
        await profile.save().catch(() => { });

        const timeoutPayload = boardPayload(board, `Kamu berhenti di tengah permainan, jadi taruhan **${taruhan.toLocaleString()}** ${coinEmoji} hangus yaa~`, {
            color: '#f59e0b',
            expression: 'cooldown',
            disabled: true,
            title: 'Waktunya habis'
        });

        interaction.editReply({ content: null, ...timeoutPayload }).catch(() => { });
    });
}

module.exports = { runRps, runTicTacToe };
