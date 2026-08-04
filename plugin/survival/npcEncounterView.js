'use strict';

// Tampilan jalan-jalan. Pemain berkeliling di lokasi tempat dia berdiri, lalu
// bertemu penduduk secara acak lengkap dengan potretnya. Disimpan terpisah dari
// travel.js supaya perintah lain (collect, rest, dan sebagainya) bisa memanggil
// pengalaman yang sama tanpa menyalin kode.

const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require('discord.js');

const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const UserNPC = require('../../src/models/UserNPC');
const { findPortrait, refreshRelationship } = require('./npcHelpers');
const encounter = require('./npcEncounter');

const COLLECTOR_MS = 150000;
const MAX_STEPS = 4;

const RELATION_LABELS = ['Kenalan', 'Akrab', 'Sahabat', 'Orang Terkasih', 'Pasangan'];

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

/** Potret NPC sebagai ikon kartu. NPC tanpa gambar tetap bisa disapa. */
function portraitOf(npc) {
    const file = npc ? findPortrait(npc) : null;
    if (!file) return { files: [], iconURL: null };
    const name = `roamer${path.extname(file) || '.png'}`;
    return { files: [new AttachmentBuilder(file, { name })], iconURL: `attachment://${name}` };
}

/** Sapaan dicatat sebagai kenaikan afeksi, sama seperti lewat papan NPC. */
async function greet(userId, npc) {
    const [row] = await UserNPC.findOrCreate({
        where: { userId, npcId: npc.id },
        defaults: { affection: 0, relationshipLevel: 0, dailyGifts: 0 }
    });

    row.affection = (row.affection || 0) + encounter.AFFECTION_GAIN;
    row.lastInteraction = new Date();
    refreshRelationship(row, npc);
    await row.save();

    return {
        affection: row.affection,
        level: row.relationshipLevel || 0,
        label: RELATION_LABELS[row.relationshipLevel || 0] || RELATION_LABELS[0]
    };
}

function rows(found, stepsLeft) {
    const row = new ActionRowBuilder();

    if (found) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('roam_greet')
                .setLabel('Sapa dia')
                .setEmoji(e('npc_talk', '\uD83D\uDCAC'))
                .setStyle(ButtonStyle.Success)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('roam_again')
            .setLabel(stepsLeft > 0 ? `Jalan lagi (${stepsLeft})` : 'Sudah kelelahan')
            .setEmoji(e('run', '\uD83C\uDFC3'))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(stepsLeft <= 0),
        new ButtonBuilder()
            .setCustomId('roam_done')
            .setLabel('Cukup dulu')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
}

function card({ user, result, art, extra }) {
    const found = result.found;
    const title = found
        ? `${e('npc_group', '\uD83D\uDC65')} Kamu bertemu ${result.npc.name}!`
        : `${e('sleepy', '\uD83C\uDF43')} Tidak ada siapa-siapa di sini`;

    const lines = found
        ? [
            `${e('lokasi', '\uD83D\uDCCD')} **${result.locationName}** \u2014 waktu ${result.dayPart}.`,
            '',
            `**${result.npc.name}** \u2014 *${result.npc.title || 'Penduduk'}* ${result.activity}.`,
            '',
            `> *"${result.greeting}"*`
        ]
        : [
            `${e('lokasi', '\uD83D\uDCCD')} **${result.locationName}** \u2014 waktu ${result.dayPart}.`,
            '',
            result.note,
            '',
            'Coba jalan sedikit lagi, atau datang di jam yang berbeda. Penduduk punya kesibukan masing-masing, kok.'
        ];

    if (extra) lines.push('', extra);

    return buildContainerV2({
        accentColorHex: ui.getColor(found ? 'primary' : 'secondary') || '#FFB6C1',
        authorName: 'Naura Jalan-Jalan',
        title,
        iconURL: art.iconURL || user.displayAvatarURL(),
        expression: found ? 'success' : 'info',
        description: lines.filter((line) => line !== undefined).join('\n'),
        files: art.files,
        footerText: ui.getFooter('survival')
    });
}

/**
 * Buka sesi jalan-jalan. Dipanggil sesudah kartu utama sebuah perintah terkirim,
 * jadi hasilnya muncul sebagai pesan lanjutan tanpa menimpa kartu sebelumnya.
 *
 * @param {Object} args
 * @param {import('discord.js').CommandInteraction} args.interaction
 * @param {string} args.location lokasi pemain saat ini
 * @param {number} args.hour jam dalam game
 * @param {number} [args.luck] nilai luck pemain
 */
async function runRoam({ interaction, location, hour, luck }) {
    const user = interaction.user;
    const playerName = user.displayName || user.username;
    const seen = [];
    let stepsLeft = MAX_STEPS;

    const roll = () => {
        const result = encounter.rollEncounter({ location, hour, luck, exclude: seen, playerName });
        if (result.found) seen.push(result.npc.id);
        return result;
    };

    let result = roll();
    let art = portraitOf(result.npc);
    let payload = card({ user, result, art });

    const message = await interaction.followUp({
        ...payload,
        components: [...payload.components, ...rows(result.found, stepsLeft)]
    }).catch(() => null);

    if (!message || typeof message.createMessageComponentCollector !== 'function') return message;

    const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === user.id && i.customId.startsWith('roam_'),
        time: COLLECTOR_MS
    });

    collector.on('collect', async (i) => {
        await i.deferUpdate().catch(() => {});

        if (i.customId === 'roam_done') return collector.stop('done');

        if (i.customId === 'roam_greet' && result.found) {
            let extra;
            try {
                const bond = await greet(user.id, result.npc);
                extra = `${e('sparkle', '\u2728')} Kedekatanmu dengan **${result.npc.name}** naik jadi **${bond.affection}** \u2014 status **${bond.label}**.`;
            } catch (error) {
                extra = `${e('annoy', '\u26A0\uFE0F')} Sapaanmu tersampaikan, tapi catatan kedekatan gagal disimpan. Coba lagi nanti, ya.`;
            }

            payload = card({ user, result, art, extra });
            return i.editReply({
                ...payload,
                components: [...payload.components, ...rows(false, stepsLeft)]
            }).catch(() => {});
        }

        if (i.customId === 'roam_again') {
            stepsLeft = Math.max(0, stepsLeft - 1);
            result = roll();
            art = portraitOf(result.npc);
            payload = card({ user, result, art });
            return i.editReply({
                ...payload,
                components: [...payload.components, ...rows(result.found, stepsLeft)]
            }).catch(() => {});
        }
    });

    collector.on('end', async () => {
        const closing = buildContainerV2({
            accentColorHex: ui.getColor('secondary') || '#C4B5FD',
            authorName: 'Naura Jalan-Jalan',
            title: `${e('happy', '\uD83D\uDC5C')} Jalan-jalanmu selesai`,
            iconURL: user.displayAvatarURL(),
            expression: 'success',
            description: [
                seen.length > 0
                    ? `Hari ini kamu berpapasan dengan **${seen.length} orang** di ${encounter.locationName(location)}.`
                    : `Kali ini tidak ada yang kamu temui di ${encounter.locationName(location)}.`,
                '',
                'Kalau mau ngobrol lebih lama, jalan-jalan lagi kapan pun kamu mau. Naura selalu senang lihat kamu akrab dengan warga.'
            ].join('\n'),
            footerText: ui.getFooter('survival')
        });

        await message.edit(closing).catch(() => {});
    });

    return message;
}

module.exports = {
    COLLECTOR_MS,
    MAX_STEPS,
    RELATION_LABELS,
    portraitOf,
    greet,
    card,
    rows,
    runRoam,
    MessageFlags
};
