// Akinator: Naura menebak karakter yang ada di pikiran pemain.
//
// Perbaikan penting dibanding versi lama:
// - `require('aki-api')` dibungkus try/catch supaya paket yang belum terpasang
//   tidak menjatuhkan seluruh subcommand tanpa penjelasan.
// - Tombol tebakan dibangun lewat buttonRow sehingga gayanya seragam.
// - Semua tahap, termasuk galat koneksi, memakai Container V2.

const ui = require('../../src/config/ui');
const { logger } = require('../../src/managers/logger');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { buttonRow } = require('./minigameCommon');

const AKI_ICON = 'https://i.imgur.com/2U5K1r1.png';
const SESSION_TIME = 120000;
const WIN_PROGRESS = 85;
const MAX_STEPS = 79;

function notice(title, description, expression = 'error', color = '#ef4444') {
    return buildContainerV2({
        accentColorHex: color,
        expression,
        title,
        description,
        footerText: ui.getFooter('core')
    });
}

async function runAkinator(interaction) {
    const user = interaction.user;

    let Aki;
    try {
        ({ Aki } = require('aki-api'));
    } catch (error) {
        logger.error(`[Minigame] Paket aki-api tidak tersedia: ${error.message}`);
        return interaction.editReply(notice(
            'Akinator belum siap',
            'Maaf yaa, lampu ajaib Naura sedang tidak bisa dipanggil. Coba permainan lain dulu yuk!'
        ));
    }

    const aki = new Aki({ region: 'id' });

    await interaction.editReply(buildContainerV2({
        accentColorHex: (ui.colors && ui.colors.primary) || '#00FFFF',
        expression: 'loading',
        title: 'Memanggil Akinator',
        iconURL: AKI_ICON,
        description: 'Naura sedang menggosok lampu ajaibnya... tunggu sebentar yaa~',
        footerText: ui.getFooter('core')
    }));

    try {
        await aki.start();
    } catch (error) {
        logger.warn(`[Minigame] Akinator gagal dimulai: ${error.message}`);
        return interaction.editReply(notice(
            'Akinator sedang tidur',
            'Servernya belum mau menjawab panggilan Naura. Coba lagi beberapa saat lagi yaa~'
        ));
    }

    const buildQuestionPayload = () => {
        const answerRow = buttonRow([
            { id: 'aki_0', label: 'Ya', style: 'success' },
            { id: 'aki_1', label: 'Tidak', style: 'danger' },
            { id: 'aki_2', label: 'Tidak Tahu', style: 'secondary' },
            { id: 'aki_3', label: 'Mungkin', style: 'primary' },
            { id: 'aki_4', label: 'Mungkin Tidak', style: 'primary' }
        ]);

        const controlRow = buttonRow([
            { id: 'aki_back', label: 'Kembali', style: 'secondary', disabled: aki.currentStep === 0 },
            { id: 'aki_stop', label: 'Berhenti', style: 'danger' }
        ]);

        return buildContainerV2({
            accentColorHex: (ui.colors && ui.colors.primary) || '#00FFFF',
            expression: 'info',
            title: `Pertanyaan ke-${aki.currentStep + 1}`,
            iconURL: AKI_ICON,
            description: `**${aki.question}**\n\n> Keyakinan Naura: **${Math.round(aki.progress)}%**`,
            buttonsRow: [answerRow, controlRow],
            footerText: ui.getFooter('core')
        });
    };

    await interaction.editReply(buildQuestionPayload());
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({ time: SESSION_TIME });
    let closed = false;

    collector.on('collect', async i => {
        if (i.user.id !== user.id) return ui.sendError(i, 'err_sys_8', true);

        await i.deferUpdate();
        collector.resetTimer();

        try {
            if (i.customId === 'aki_stop') {
                closed = true;
                collector.stop('stopped');
                return i.editReply(notice(
                    'Permainan dihentikan',
                    'Baiklah, kita sudahi dulu yaa. Kalau mau main lagi, panggil Naura kapan saja!',
                    'info',
                    '#f59e0b'
                ));
            }

            if (i.customId === 'aki_back') {
                await aki.back();
            } else {
                await aki.step(parseInt(i.customId.split('_')[1], 10));
            }

            if (aki.progress < WIN_PROGRESS && aki.currentStep < MAX_STEPS) {
                return i.editReply(buildQuestionPayload());
            }

            await aki.win();
            const guess = Array.isArray(aki.answers) ? aki.answers[0] : null;

            closed = true;
            collector.stop('finished');

            if (!guess) {
                return i.editReply(notice(
                    'Naura menyerah',
                    'Karaktermu terlalu sulit ditebak! Naura kalah kali ini, hebat kamu~',
                    'info',
                    '#f59e0b'
                ));
            }

            return i.editReply(buildContainerV2({
                accentColorHex: '#22c55e',
                expression: 'success',
                title: 'Naura berhasil menebak!',
                description: `Pasti yang kamu pikirkan adalah **${guess.name}** kan?\n\n*${guess.description || 'Naura yakin banget sama tebakan ini!'}*`,
                footerText: `Ditebak pada pertanyaan ke-${aki.currentStep}`
            }));
        } catch (error) {
            closed = true;
            collector.stop('error');
            logger.warn(`[Minigame] Akinator terputus: ${error.message}`);

            return i.editReply(notice(
                'Koneksi terputus',
                'Sambungan ke lampu ajaib Naura terputus di tengah jalan. Maaf yaa, coba lagi nanti!'
            ));
        }
    });

    collector.on('end', (collected, reason) => {
        if (closed || reason !== 'time') return;

        interaction.editReply(notice(
            'Waktunya habis~',
            'Naura menunggu cukup lama tapi belum ada jawaban. Permainannya Naura tutup dulu yaa!',
            'cooldown',
            '#f59e0b'
        )).catch(() => { });
    });
}

module.exports = { runAkinator };
