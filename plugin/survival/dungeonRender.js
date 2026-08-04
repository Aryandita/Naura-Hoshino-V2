'use strict';

// Semua urusan tampilan pertempuran dungeon: kanvas, kartu Components V2, dan
// deretan tombol aksi. Dipisahkan supaya subcommand tinggal mengurus alur.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { drawBattle } = require('../canvas/battleCanvas');
const ui = require('../../src/config/ui');
const helpers = require('./craftHelpers');

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

    const payload = buildContainerV2({
        accentColorHex: enemy.isBoss ? ui.getColor('error') : ui.getColor('warning'),
        authorName: 'Naura Battle Log',
        expression: enemy.isBoss ? 'shocked' : 'thinking',
        title: e('battle', '\u2694\ufe0f') + ' Infinite Dungeon - Lantai ' + floor,
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
    buildBattleView,
    buildClosingView
};
