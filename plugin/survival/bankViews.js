'use strict';

// Tampilan Naura Central Bank. Naura yang menyambut pelanggan di sini, jadi
// kalimatnya dibuat hangat dan tidak terdengar seperti pesan mesin.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const ui = require('../../src/config/ui');
const currencyHelper = require('./currency');
const { DEPOSIT_TERMS, INVEST_ASSETS, MIN_EXCHANGE_NSF, MIN_DEPOSIT_COIN, MIN_INVEST_COIN } = require('./bankConfig');

const BANNER_NAME = 'banner.png';
const FRAGMENT = currencyHelper.byKind(currencyHelper.FRAGMENT);
const COIN = currencyHelper.byKind(currencyHelper.COIN);
const COUPON = currencyHelper.byKind(currencyHelper.COUPON);

function e(name, fallback) {
    return ui.getEmoji(name) || fallback || '';
}

function n(value) {
    return (Number(value) || 0).toLocaleString('id-ID');
}

function backButton(label = 'Kembali') {
    return new ButtonBuilder().setCustomId('bank_back').setLabel(label).setStyle(ButtonStyle.Secondary);
}

/** Ringkasan saldo yang dipakai di hampir semua kartu bank. */
function balanceBlock(snap) {
    return [
        `${currencyHelper.emojiOf(FRAGMENT)} **Dompet desa:** \`${n(snap.fragment)}\` ${FRAGMENT.short}`,
        `${currencyHelper.emojiOf(COIN)} **Dompet kota:** \`${n(snap.coin)}\` ${COIN.short}`,
        `${e('bank')} **Rekening bank:** \`${n(snap.bank)}\` ${COIN.short}`,
        `${currencyHelper.emojiOf(COUPON)} **Kupon:** \`${n(snap.coupon)}\` ${COUPON.short}`
    ].join('\n');
}

function mainView(user, snap) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bank_menu_exchange').setLabel('Tukar Uang').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bank_menu_savings').setLabel('Tabungan').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bank_menu_deposit').setLabel('Deposito').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bank_menu_invest').setLabel('Investasi').setStyle(ButtonStyle.Secondary)
    );

    const banner = ui.getBanner ? ui.getBanner('economy') : null;
    const files = banner ? [new AttachmentBuilder(banner, { name: BANNER_NAME })] : [];

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('economy') || '#FFD700',
        authorName: 'Naura Central Bank',
        title: `${e('bank')} Selamat datang, ${user.displayName || user.username}!`,
        iconURL: user.displayAvatarURL(),
        expression: 'Happy',
        description: [
            'Naura yang jaga loket hari ini, jadi santai saja ya~',
            '',
            `${e('info')} *Kurs resmi: **${n(MIN_EXCHANGE_NSF)} ${FRAGMENT.short} = 1 ${COIN.short}**. Naura Coupon tidak bisa ditukar, itu barang langka!*`,
            '',
            balanceBlock(snap),
            '',
            `${e('clock')} Hari ke-**${snap.day}** di dunia Naura.`
        ].join('\n'),
        buttonsRow: row,
        bannerAttachmentName: banner ? BANNER_NAME : undefined,
        files,
        footerText: ui.getFooter('survival')
    });

    return payload;
}

function exchangeView(snap) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bank_ex_to_coin')
            .setLabel(`${FRAGMENT.short} \u2192 ${COIN.short}`)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('bank_ex_to_nsf')
            .setLabel(`${COIN.short} \u2192 ${FRAGMENT.short}`)
            .setStyle(ButtonStyle.Primary),
        backButton()
    );

    return buildContainerV2({
        accentColorHex: ui.getColor('economy') || '#FFD700',
        authorName: 'Naura Central Bank \u2014 Loket Penukaran',
        title: `${currencyHelper.emojiOf(COIN)} Tukar Mata Uang`,
        expression: 'Cheers',
        description: [
            `Kurs hari ini tetap: **${n(MIN_EXCHANGE_NSF)} ${FRAGMENT.short} = 1 ${COIN.short}**.`,
            `Kalau nominalmu tidak pas, sisanya Naura kembalikan ke dompet, tidak ada yang hangus.`,
            '',
            balanceBlock(snap),
            '',
            `${e('warning')} Naura Coupon tidak dilayani di loket ini ya, kupon hanya bisa didapat dari petualangan.`
        ].join('\n'),
        buttonsRow: row,
        footerText: ui.getFooter('survival')
    });
}

function savingsView(snap) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bank_savings_in').setLabel('Setor ke rekening').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bank_savings_out').setLabel('Tarik ke dompet').setStyle(ButtonStyle.Danger),
        backButton()
    );

    return buildContainerV2({
        accentColorHex: ui.getColor('economy') || '#FFD700',
        authorName: 'Naura Central Bank \u2014 Tabungan',
        title: `${e('bank')} Setor & Tarik ${COIN.short}`,
        expression: 'Read',
        description: [
            'Uang di rekening lebih aman: perampok dan denda tidak bisa menyentuhnya.',
            '',
            balanceBlock(snap)
        ].join('\n'),
        buttonsRow: row,
        footerText: ui.getFooter('survival')
    });
}

function depositView(snap) {
    const dep = snap.deposit || {};
    const active = Number(dep.amount) > 0;
    const ready = active && snap.day >= Number(dep.unlockDay || 0);

    let status = 'Belum ada deposito aktif. Naura bantu buka yang baru, mau?';
    if (active) {
        status = ready
            ? `${e('achievement_unlocked')} **Siap dicairkan!** (jatuh tempo hari ke-${dep.unlockDay})`
            : `${e('achievement_locked')} **Masih terkunci**, sisa **${Number(dep.unlockDay) - snap.day}** hari lagi.`;
    }

    const row = active
        ? new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('bank_dep_claim')
                .setLabel('Cairkan deposito')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!ready),
            backButton()
        )
        : new ActionRowBuilder().addComponents(
            ...Object.values(DEPOSIT_TERMS).map(term =>
                new ButtonBuilder()
                    .setCustomId(`bank_dep_create_${term.key}`)
                    .setLabel(term.label)
                    .setStyle(ButtonStyle.Primary)
            ),
            backButton()
        );

    const termList = Object.values(DEPOSIT_TERMS)
        .map(t => `> **${t.label}** \u2014 ${t.name}, terkunci ${t.days} hari`)
        .join('\n');

    return buildContainerV2({
        accentColorHex: ui.getColor('economy') || '#FFD700',
        authorName: 'Naura Central Bank \u2014 Deposito',
        title: `${e('achievement_locked')} Deposito Berjangka`,
        expression: 'Thinking',
        description: [
            `Titipkan ${COIN.short} sebentar, nanti Naura kembalikan lebih banyak. Minimal **${n(MIN_DEPOSIT_COIN)} ${COIN.short}**.`,
            '',
            termList,
            '',
            `${e('bank')} **Rekening:** \`${n(snap.bank)}\` ${COIN.short}`,
            `**Status:** ${status}`,
            active ? `**Nilai deposito:** \`${n(dep.amount)}\` ${COIN.short} (${dep.termName || 'berjangka'})` : ''
        ].filter(Boolean).join('\n'),
        buttonsRow: row,
        footerText: ui.getFooter('survival')
    });
}

function investView(snap, valuations) {
    const lines = [];
    const rows = [];

    Object.values(INVEST_ASSETS).forEach(asset => {
        const held = valuations[asset.id] || null;
        let block = `${e(asset.riskEmojiKey)} **${asset.name}**\n> Risiko: ${asset.riskLabel}\n> *${asset.desc}*`;

        if (held) {
            const sign = held.roi >= 0 ? '+' : '';
            block += `\n> ${e('stats')} Modal \`${n(held.principal)}\` \u2192 sekarang **\`${n(held.value)}\`** ${COIN.short} (${sign}${held.roi.toFixed(2)}%, ${held.elapsed} hari)`;
        }

        lines.push(block);
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bank_inv_buy_${asset.id}`)
                .setLabel(`Beli ${asset.riskLabel}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(Boolean(held)),
            new ButtonBuilder()
                .setCustomId(`bank_inv_sell_${asset.id}`)
                .setLabel('Jual')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!held)
        ));
    });

    rows.push(new ActionRowBuilder().addComponents(backButton('Kembali ke menu utama')));

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('economy') || '#FFD700',
        authorName: 'Naura Central Bank \u2014 Papan Investasi',
        title: `${e('stats')} Papan Investasi Naura`,
        expression: 'Impressed',
        description: [
            `Modal minimal **${n(MIN_INVEST_COIN)} ${COIN.short}** per portofolio, diambil dari rekening bank.`,
            `${e('warning')} Nilainya naik-turun tiap hari. Naura ingatkan: jangan taruh semua uangmu di satu tempat!`,
            '',
            `${e('bank')} **Rekening:** \`${n(snap.bank)}\` ${COIN.short}`,
            '',
            lines.join('\n\n')
        ].join('\n'),
        footerText: ui.getFooter('survival')
    });

    return { payload, rows };
}

function promptView(title, description) {
    return buildContainerV2({
        accentColorHex: ui.getColor('info') || '#57C7FF',
        authorName: 'Naura Central Bank',
        title: `${e('naura_thinking')} ${title}`,
        expression: 'Thinking',
        description: `${description}\n\n${e('clock')} Naura tunggu jawabanmu di chat selama **30 detik** ya.`,
        footerText: ui.getFooter('survival')
    });
}

function successView(title, description) {
    return buildContainerV2({
        accentColorHex: ui.getColor('success') || '#22c55e',
        authorName: 'Naura Central Bank',
        title: `${e('naura_cheers')} ${title}`,
        expression: 'Cheers',
        description,
        footerText: ui.getFooter('survival')
    });
}

function failView(description) {
    return buildErrorContainerV2({
        title: `${e('naura_akward')} Transaksinya belum bisa lanjut`,
        description,
        footerText: ui.getFooter('survival')
    });
}

module.exports = {
    mainView,
    exchangeView,
    savingsView,
    depositView,
    investView,
    promptView,
    successView,
    failView,
    balanceBlock,
    n
};
