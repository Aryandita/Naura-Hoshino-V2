'use strict';

// Semua urusan tampilan pertempuran dungeon: kanvas, kartu Components V2, dan
// deretan tombol aksi. Dipisahkan supaya subcommand tinggal mengurus alur.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { drawBattle } = require('../canvas/battleCanvas');
const ui = require('../../src/config/ui');
const helpers = require('./craftHelpers');
const currency = require('./currency');

const IMAGE_NAME = 'battle.png';
const e = helpers.e;

function actionRow({ stats, stamina, canFlee = true }) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dungeon_attack')
            .setLabel('Serang')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(e('dagger', '\ud83d\udde1\ufe0f'))
    );

    if (stats.skill) {
        const skillButton = new ButtonBuilder()
            .setCustomId('dungeon_skill')
            .setLabel(stats.skill.name + ' (' + stats.skill.cost + ' SP)')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(e('sparkle', '\u2728'));
        if ((stamina || 0) < stats.skill.cost) skillButton.setDisabled(true);
        row.addComponents(skillButton);
    }

    if (canFlee) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('dungeon_flee')
                .setLabel('Kabur')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(e('run', '\ud83c\udfc3'))
        );
    }

    return row;
}

// Muncul hanya kalau pemain memegang kedua jenis tiket, supaya tiket spesial
// yang mahal tidak terpakai tanpa disengaja.
function buildPassChoiceView(passes) {
    const payload = buildContainerV2({
        accentColorHex: ui.getColor('info'),
        authorName: 'Naura Dungeon Guide',
        expression: 'thinking',
        title: e('lokasi', '\ud83d\udccd') + ' Pintu Batu Infinite Dungeon',
        description: [
            'Kamu memegang dua jenis tiket, jadi Naura tanya dulu, ya!',
            '',
            currency.emojiOf(currency.FRAGMENT) + ' **Dungeon Pass** (' + passes.normal + ' tersisa) \u2014 penjelajahan biasa, aman untuk mengumpulkan bahan.',
            currency.emojiOf(currency.COIN) + ' **Dungeon Special Pass** (' + passes.special + ' tersisa) \u2014 musuhnya dua kali lebih tangguh, tapi jarahan dan hadiahnya juga dua kali lipat.',
            '',
            '*Tiket yang kamu pilih langsung terpakai, jadi pikirkan matang-matang.*'
        ].join('\n'),
        footerText: ui.getFooter('survival')
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dungeon_use_normal').setLabel('Pakai Tiket Biasa').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('dungeon_use_special').setLabel('Pakai Tiket Spesial').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('dungeon_cancel').setLabel('Nanti Saja').setStyle(ButtonStyle.Secondary)
    );

    return { ...payload, components: [...payload.components, row] };
}

async function buildBattleView({ user, stats, survival, enemy, enemyHp, playerHp, floor, logText }) {
    const playerInfo = {
        username: user.username,
        avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
        hp: Math.max(0, playerHp),
        maxHp: stats.playerMaxHp,
        stamina: survival.stamina,
        class: stats.userClass || 'Belum Berkelas'
    };

    const enemyInfo = {
        name: enemy.isBoss ? 'Boss: ' + enemy.type.toUpperCase() : enemy.type.toUpperCase(),
        type: enemy.type,
        hp: Math.max(0, enemyHp),
        maxHp: enemy.maxHp
    };

    const buffer = await drawBattle(playerInfo, enemyInfo, logText);
    const attachment = new AttachmentBuilder(buffer, { name: IMAGE_NAME });

    let footer = ui.getFooter('survival');
    if (!stats.userClass) {
        footer += ' \u2022 Naura sarankan pilih kelas lewat /survival class biar skill tempurmu terbuka!';
    }

    const title = e('battle', '\u2694\ufe0f') + ' Infinite Dungeon - Lantai ' + floor
        + (enemy.special ? ' (Segel Spesial)' : '');

    const payload = buildContainerV2({
        accentColorHex: enemy.isBoss || enemy.special ? ui.getColor('error') : ui.getColor('warning'),
        authorName: 'Naura Battle Log',
        expression: enemy.isBoss || enemy.special ? 'shocked' : 'thinking',
        title,
        description: logText,
        bannerAttachmentName: IMAGE_NAME,
        footerText: footer
    });

    const row = actionRow({ stats, stamina: survival.stamina });

    return {
        ...payload,
        files: [attachment],
        components: [...payload.components, row]
    };
}

// Kartu penutup (menang, kalah, kabur). Pesan Components V2 tidak boleh diedit
// menjadi tanpa komponen, jadi kartunya dikirim utuh tanpa deretan tombol.
function buildClosingView({ expression, colorKey, title, description }) {
    const payload = buildContainerV2({
        accentColorHex: ui.getColor(colorKey),
        authorName: 'Naura Battle Log',
        expression,
        title,
        description,
        footerText: ui.getFooter('survival')
    });
    return { ...payload, files: [] };
}

module.exports = {
    IMAGE_NAME,
    actionRow,
    buildPassChoiceView,
    buildBattleView,
    buildClosingView
};
