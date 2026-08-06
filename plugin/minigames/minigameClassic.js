// Dua permainan klasik: Hangman dan Memory Match.
//
// Perbaikan penting dibanding versi lama:
// - Memory Match mengirim papan lewat `components` mentah sehingga menimpa
//   struktur Container V2. Sekarang papan dikirim lewat buttonsRow.
// - Hangman menolak huruf berulang lewat followUp ephemeral pada pesan biasa;
//   kini balasannya konsisten memakai pesan galat standar.
// - Hadiah kemenangan ditulis sesuai jumlah yang benar-benar masuk ke dompet.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { hangmanWords, memoryEmojis } = require('./minigameData');
const { payout, coinOf, shuffle, pick } = require('./minigameCommon');

const ROUND_TIME = 60000;
const BASE_PRIZE = 500;
const MAX_WRONG = 6;

const HANGMAN_STAGES = [
    '\n\n\n\n\n\n=========',
    '\n      |\n      |\n      |\n      |\n      |\n=========',
    '  +---+\n      |\n      |\n      |\n      |\n      |\n=========',
    '  +---+\n  O   |\n      |\n      |\n      |\n      |\n=========',
    '  +---+\n  O   |\n  |   |\n      |\n      |\n      |\n=========',
    '  +---+\n  O   |\n /|\\  |\n      |\n      |\n      |\n=========',
    '  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n      |\n========='
];

async function runHangman(interaction, profile) {
    const user = interaction.user;
    const word = pick(hangmanWords);
    const guessed = [];
    const coinEmoji = coinOf();
    let wrong = 0;

    const masked = () => word.split('').map(c => (guessed.includes(c) ? c : '_')).join(' ');

    const boardPayload = (options = {}) => buildContainerV2({
        accentColorHex: options.color || ((ui.colors && ui.colors.primary) || '#00FFFF'),
        expression: options.expression || 'info',
        title: options.title || 'Hangman bareng Naura',
        description: options.description || `Ketik satu huruf untuk menebak kata berikut yaa~\n\n**${masked()}**\n\n\`\`\`${HANGMAN_STAGES[wrong]}\`\`\`\n\n${guessed.length ? `Huruf tertebak: ${guessed.join(', ')}\n` : ''}Kesempatan tersisa: **${MAX_WRONG - wrong}**`,
        footerText: ui.getFooter('core')
    });

    await interaction.editReply(boardPayload());

    const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === user.id && m.content.trim().length === 1 && /[a-zA-Z]/.test(m.content.trim()),
        time: ROUND_TIME
    });

    let finished = false;

    collector.on('collect', async m => {
        const char = m.content.trim().toUpperCase();
        m.delete().catch(() => { });

        if (guessed.includes(char)) return;

        guessed.push(char);
        if (!word.includes(char)) wrong += 1;

        if (word.split('').every(c => guessed.includes(c))) {
            finished = true;

            const reward = payout(profile, BASE_PRIZE);
            profile.economy_wallet += reward;
            await profile.save();

            await interaction.editReply(boardPayload({
                color: '#22c55e',
                expression: 'success',
                title: 'Berhasil ditebak!',
                description: `Katanya memang **${word}**. Kamu keren banget \u2728\n\n> Kamu dapat **${reward.toLocaleString()}** ${coinEmoji}`
            })).catch(() => { });

            return collector.stop('win');
        }

        if (wrong >= MAX_WRONG) {
            finished = true;

            await interaction.editReply(boardPayload({
                color: '#ef4444',
                expression: 'error',
                title: 'Yah, kesempatannya habis',
                description: `Kata yang benar adalah **${word}**.\n\n\`\`\`${HANGMAN_STAGES[wrong]}\`\`\`\n\nJangan menyerah yaa, ayo coba lagi!`
            })).catch(() => { });

            return collector.stop('lose');
        }

        await interaction.editReply(boardPayload()).catch(() => { });
        collector.resetTimer();
    });

    collector.on('end', (collected, reason) => {
        if (finished || reason !== 'time') return;

        interaction.editReply(boardPayload({
            color: '#f59e0b',
            expression: 'cooldown',
            title: 'Waktunya habis~',
            description: `Kata yang Naura sembunyikan adalah **${word}**. Main lagi kapan-kapan yaa!`
        })).catch(() => { });
    });
}

async function runMemory(interaction, profile) {
    const user = interaction.user;
    const board = shuffle([...memoryEmojis, ...memoryEmojis]);
    const coinEmoji = coinOf();
    let flipped = [];
    let matched = [];
    let attempts = 0;

    const boardRows = (lockAll = false) => {
        const rows = [];

        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();

            for (let j = 0; j < 4; j++) {
                const idx = (i * 4) + j;
                const isOpen = flipped.includes(idx) || matched.includes(idx);

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mem_${idx}`)
                        .setLabel(isOpen ? board[idx] : '\u2753')
                        .setStyle(matched.includes(idx) ? ButtonStyle.Success : (isOpen ? ButtonStyle.Primary : ButtonStyle.Secondary))
                        .setDisabled(lockAll || isOpen)
                );
            }

            rows.push(row);
        }

        return rows;
    };

    const boardPayload = (options = {}) => buildContainerV2({
        accentColorHex: options.color || ((ui.colors && ui.colors.primary) || '#00FFFF'),
        expression: options.expression || 'info',
        title: options.title || 'Memory Match',
        description: options.description || `Cocokkan semua pasangan emoji yaa~\n\n> Percobaan: **${attempts}**`,
        buttonsRow: boardRows(Boolean(options.lockAll)),
        footerText: ui.getFooter('core')
    });

    await interaction.editReply(boardPayload());
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: ROUND_TIME
    });

    let finished = false;

    collector.on('collect', async i => {
        if (i.user.id !== user.id) return ui.sendError(i, 'err_sys_9', true);

        const idx = parseInt(i.customId.split('_')[1], 10);
        if (flipped.includes(idx) || matched.includes(idx)) return i.deferUpdate().catch(() => { });

        flipped.push(idx);

        if (flipped.length < 2) {
            await i.update({ content: null, ...boardPayload() });
            return collector.resetTimer();
        }

        attempts += 1;
        await i.update({ content: null, ...boardPayload({ lockAll: true }) });

        const [first, second] = flipped;
        if (board[first] === board[second]) matched.push(first, second);

        setTimeout(async () => {
            flipped = [];

            if (matched.length === board.length) {
                finished = true;

                const reward = payout(profile, BASE_PRIZE);
                profile.economy_wallet += reward;
                await profile.save().catch(() => { });

                await interaction.editReply(boardPayload({
                    color: '#22c55e',
                    expression: 'success',
                    title: 'Semua pasangan ketemu!',
                    description: `Hebat! Kamu menyelesaikannya dalam **${attempts}** percobaan \u2728\n\n> Kamu dapat **${reward.toLocaleString()}** ${coinEmoji}`,
                    lockAll: true
                })).catch(() => { });

                return collector.stop('win');
            }

            await interaction.editReply(boardPayload()).catch(() => { });
        }, 1000);

        collector.resetTimer();
    });

    collector.on('end', (collected, reason) => {
        if (finished || reason !== 'time') return;

        interaction.editReply(boardPayload({
            color: '#f59e0b',
            expression: 'cooldown',
            title: 'Waktunya habis~',
            description: `Kamu berhasil mencocokkan **${matched.length / 2}** pasang. Lumayan! Ayo coba lagi kapan-kapan yaa~`,
            lockAll: true
        })).catch(() => { });
    });
}

module.exports = { runHangman, runMemory };
