// Truth or Dare bareng Naura.
//
// Perbaikan penting dibanding versi lama:
// - `row` tidak pernah dibuat sehingga /minigame tod langsung ReferenceError.
// - Ada DUA `collector.on('collect')` terpasang pada collector yang sama, dan
//   handler pertama sudah memanggil deferUpdate untuk semua tombol sehingga
//   handler kedua tidak pernah dapat giliran. Kini hanya satu handler.
// - Opsi `fetchReply: true` sudah tidak didukung discord.js v14, jadi pesan
//   diambil lewat interaction.fetchReply().
// - Seluruh tahap memakai Container V2.

const { ComponentType } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { todTruths, todDares } = require('./minigameData');
const { buttonRow, pick } = require('./minigameCommon');

const SESSION_TIME = 180000;

function mainRow() {
    return buttonRow([
        { id: 'tod_truth', label: 'Truth', style: 'primary' },
        { id: 'tod_dare', label: 'Dare', style: 'danger' },
        { id: 'tod_spin', label: 'Acak Saja', style: 'secondary' },
        { id: 'tod_done', label: 'Sudahi', style: 'secondary' }
    ]);
}

function nextRow() {
    return buttonRow([
        { id: 'tod_next_turn', label: 'Giliran Berikutnya', style: 'success' },
        { id: 'tod_done', label: 'Sudahi', style: 'secondary' }
    ]);
}

async function runTod(interaction) {
    const host = interaction.user;
    const friend = interaction.options.getUser('teman');

    const players = [host];
    if (friend && !friend.bot && friend.id !== host.id) players.push(friend);

    let turn = 0;

    const currentPlayer = () => players[turn % players.length];

    const promptPayload = () => buildContainerV2({
        accentColorHex: '#ec4899',
        expression: 'love',
        authorName: 'Truth or Dare',
        iconURL: host.displayAvatarURL(),
        title: `Giliran ${currentPlayer().username}`,
        description: players.length > 1
            ? `Sekarang giliran <@${currentPlayer().id}>. Mau pilih **Truth** atau berani ambil **Dare**?`
            : `Ayo <@${currentPlayer().id}>, pilih **Truth** atau **Dare**. Naura sudah siapkan banyak pertanyaan seru!`,
        buttonsRow: mainRow(),
        footerText: 'Sesi berlangsung 3 menit yaa~'
    });

    await interaction.editReply(promptPayload());
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: SESSION_TIME
    });

    let closed = false;

    collector.on('collect', async i => {
        const isPlayer = players.some(p => p.id === i.user.id);
        if (!isPlayer) return ui.sendError(i, 'err_sys_3', true);

        if (i.customId === 'tod_done') {
            closed = true;
            collector.stop('done');

            return i.update({
                content: null,
                ...buildContainerV2({
                    accentColorHex: '#f59e0b',
                    expression: 'info',
                    title: 'Sesi ditutup',
                    description: 'Seru banget mainnya! Terima kasih sudah menemani Naura, sampai jumpa lagi yaa~',
                    footerText: ui.getFooter('core')
                })
            });
        }

        if (i.customId === 'tod_next_turn') {
            turn += 1;
            collector.resetTimer();
            return i.update({ content: null, ...promptPayload() });
        }

        if (i.user.id !== currentPlayer().id) {
            return ui.sendError(i, 'err_sys_3', true);
        }

        let mode = i.customId === 'tod_spin'
            ? (Math.random() > 0.5 ? 'truth' : 'dare')
            : i.customId.split('_')[1];

        const isTruth = mode === 'truth';
        const question = isTruth ? pick(todTruths) : pick(todDares);

        collector.resetTimer();

        return i.update({
            content: null,
            ...buildContainerV2({
                accentColorHex: isTruth ? '#3b82f6' : '#ef4444',
                expression: isTruth ? 'info' : 'celebrate',
                authorName: `${currentPlayer().username} memilih ${isTruth ? 'Truth' : 'Dare'}`,
                iconURL: currentPlayer().displayAvatarURL(),
                title: isTruth ? 'Pertanyaan jujur' : 'Tantangan seru',
                description: `**${question}**\n\nJawab atau lakukan di chat yaa~ Kalau sudah, tekan giliran berikutnya!`,
                buttonsRow: nextRow(),
                footerText: ui.getFooter('core')
            })
        });
    });

    collector.on('end', (collected, reason) => {
        if (closed || reason === 'done') return;

        interaction.editReply({
            content: null,
            ...buildContainerV2({
                accentColorHex: '#f59e0b',
                expression: 'cooldown',
                title: 'Sesi berakhir',
                description: 'Waktu bermainnya sudah habis. Panggil Naura lagi kalau mau main Truth or Dare yaa~',
                footerText: ui.getFooter('core')
            })
        }).catch(() => { });
    });
}

module.exports = { runTod };
