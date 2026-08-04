'use strict';

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require('discord.js');

const UserSurvival = require('../../../src/models/UserSurvival');
const ui = require('../../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const currency = require('../currency');

const COLLECTOR_MS = 120000;
const MIN_AMOUNT = 1;

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function reject(interaction, message) {
    const payload = buildErrorContainerV2({ errorMessage: message });
    return interaction.editReply({ ...payload, embeds: [] });
}

module.exports = {
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('nsf') || 0;
        const sender = interaction.user;

        if (!targetUser) {
            return reject(interaction, 'Naura belum tahu mau kirim ke siapa. Coba tulis begini ya: `/survival trade user:@teman nsf:100`.');
        }

        if (targetUser.bot || targetUser.id === sender.id) {
            return reject(interaction, 'Hehe, kamu nggak bisa bertransaksi sama bot atau sama diri sendiri. Pilih teman yang lain ya!');
        }

        if (amount < MIN_AMOUNT) {
            return reject(interaction, 'Jumlah Star Fragment yang mau dikirim harus lebih dari nol. Naura tunggu angkanya!');
        }

        const [senderSurvival] = await UserSurvival.findOrCreate({ where: { userId: sender.id } });
        const [targetSurvival] = await UserSurvival.findOrCreate({ where: { userId: targetUser.id } });

        const senderBalance = currency.balanceOf(currency.FRAGMENT, { survival: senderSurvival });

        if (senderBalance < amount) {
            return reject(
                interaction,
                `Duh, saldomu belum cukup. Sekarang kamu punya ${currency.format(currency.FRAGMENT, senderBalance)}, sedangkan yang mau dikirim ${amount.toLocaleString('id-ID')}.`
            );
        }

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('trade_accept')
                .setLabel('Terima Transfer')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('trade_reject')
                .setLabel('Tolak')
                .setStyle(ButtonStyle.Danger)
        );

        const tradePayload = buildContainerV2({
            accentColorHex: '#00FFFF',
            authorName: 'Naura Secure Trading',
            title: `${e('happy', '\uD83E\uDD1D')} Ada penawaran transfer!`,
            iconURL: sender.displayAvatarURL(),
            expression: 'info',
            description: [
                `<@${sender.id}> mau mengirim ${currency.format(currency.FRAGMENT, amount)} untuk <@${targetUser.id}>.`,
                '',
                `${e('read', '\uD83D\uDCDD')} <@${targetUser.id}>, tekan **Terima Transfer** kalau kamu setuju ya. Naura yang jaga transaksinya biar aman.`
            ].join('\n'),
            footerText: ui.getFooter('survival')
        });

        // Perintah survival sudah di-defer, jadi wajib editReply dan container
        // builder harus di-spread agar isi kartunya tidak hilang.
        const reply = await interaction.editReply({
            ...tradePayload,
            embeds: [],
            components: [...tradePayload.components, confirmRow]
        });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: COLLECTOR_MS
        });

        // Penjaga agar transfer tidak bisa dieksekusi dua kali. Sebelumnya
        // kolektor tidak pernah dihentikan, jadi tombol Terima bisa ditekan
        // berulang dan saldo pengirim terkuras berkali-kali.
        let settled = false;

        collector.on('collect', async i => {
            if (i.user.id !== targetUser.id) {
                return i.reply({
                    content: `${e('shy', '\uD83D\uDE45')} Penawaran ini bukan untuk kamu, ya. Maaf!`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            if (settled) {
                return i.deferUpdate().catch(() => {});
            }

            settled = true;
            collector.stop('handled');

            if (i.customId === 'trade_reject') {
                const rejectPayload = buildContainerV2({
                    accentColorHex: ui.getColor('error') || '#FF0000',
                    authorName: 'Naura Secure Trading',
                    title: `${e('hmph', '\uD83D\uDE45')} Penawarannya ditolak`,
                    iconURL: targetUser.displayAvatarURL(),
                    expression: 'denied',
                    description: `<@${targetUser.id}> memilih untuk tidak menerima transfer dari <@${sender.id}>. Nggak apa-apa, mungkin lain waktu ya!`,
                    footerText: ui.getFooter('survival')
                });

                return i.update({ ...rejectPayload, embeds: [] }).catch(() => {});
            }

            // Saldo diperiksa ulang tepat sebelum dipindahkan.
            await senderSurvival.reload().catch(() => {});
            await targetSurvival.reload().catch(() => {});

            const remaining = await currency.charge(currency.FRAGMENT, { survival: senderSurvival }, amount);

            if (remaining === null) {
                const failPayload = buildErrorContainerV2({
                    title: `${e('cry', '\u274C')} Transfernya gagal`,
                    description: 'Aduh, saldo pengirim sudah tidak mencukupi saat transaksi diproses. Tidak ada yang berpindah kok, aman.',
                    footerText: ui.getFooter('survival')
                });

                return i.update({ ...failPayload, embeds: [] }).catch(() => {});
            }

            const received = await currency.reward(currency.FRAGMENT, { survival: targetSurvival }, amount);

            const successPayload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#00FF00',
                authorName: 'Naura Secure Trading',
                title: `${e('cheers', '\u2705')} Transfernya berhasil!`,
                iconURL: targetUser.displayAvatarURL(),
                expression: 'success',
                description: [
                    `Selesai! ${currency.format(currency.FRAGMENT, amount)} sudah berpindah dari <@${sender.id}> ke <@${targetUser.id}>.`,
                    '',
                    `> ${e('read', '\uD83D\uDCE4')} Saldo pengirim sekarang: **${remaining.toLocaleString('id-ID')}**`,
                    `> ${e('impressed', '\uD83D\uDCE5')} Saldo penerima sekarang: **${received.toLocaleString('id-ID')}**`,
                    '',
                    'Terima kasih sudah saling berbagi, Naura senang lihat kalian akrab!'
                ].join('\n'),
                footerText: ui.getFooter('survival')
            });

            return i.update({ ...successPayload, embeds: [] }).catch(() => {});
        });

        collector.on('end', async () => {
            if (settled) return;

            const expired = buildErrorContainerV2({
                title: `${e('sleepy', '\u231B')} Penawarannya kedaluwarsa`,
                description: 'Waktunya habis dan belum ada tanggapan, jadi Naura batalkan penawarannya. Saldomu utuh, nggak ada yang berkurang!',
                footerText: ui.getFooter('survival')
            });

            await interaction.editReply({ ...expired, embeds: [] }).catch(() => {});
        });
    }
};
