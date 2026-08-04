'use strict';

const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const SWITCH_FEE = 10000;

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

// Data kelas dikumpulkan di satu tabel supaya menambah kelas baru cukup
// menambah satu entri, tanpa menyentuh alur logikanya.
const CLASSES = {
    warrior: {
        emoji: 'class_warrior',
        emojiFallback: '\uD83D\uDEE1\uFE0F',
        label: 'Warrior (Fighter)',
        color: '#FF4D4D',
        tagline: 'Petarung tangguh dengan HP besar dan tebasan pedang yang mematikan.',
        stats: 'Max HP **+50** \u2022 STR **+5**',
        skill: '**Iron Slash** (15 stamina) \u2014 tebasan pedang murni, daya rusak **1.8x damage**.'
    },
    mage: {
        emoji: 'class_mage',
        emojiFallback: '\uD83D\uDD2E',
        label: 'Mage (Penyihir)',
        color: '#C084FC',
        tagline: 'Penyihir agung yang menguasai sihir elemen dengan kecerdasan luar biasa.',
        stats: 'AGI **+3** \u2022 INT **+8**',
        skill: '**Fireball** (25 stamina) \u2014 sihir api membara, daya rusak **2.2x damage** berbasis kecerdasan.'
    },
    assassin: {
        emoji: 'class_assassin',
        emojiFallback: '\uD83D\uDDE1\uFE0F',
        label: 'Assassin (Pembunuh Bayangan)',
        color: '#93C5FD',
        tagline: 'Eksekutor bayangan yang gerakannya cepat sekali dan sadis kalau kena kritikal.',
        stats: 'AGI **+8** \u2022 LUCK **+5**',
        skill: '**Shadow Strike** (20 stamina) \u2014 tebasan kritikal **2.5x damage**, tapi bisa meleset.'
    },
    ranger: {
        emoji: 'class_ranger',
        emojiFallback: '\uD83C\uDFF9',
        label: 'Ranger (Pemanah)',
        color: '#4ADE80',
        tagline: 'Penjelajah alam liar yang jago memanah dan paling cepat mengumpulkan sumber daya.',
        stats: 'LUCK **+8** \u2022 AGI **+5**',
        skill: '**Piercing Arrow** (15 stamina) \u2014 panah penembus pertahanan, **1.5x damage** dengan akurasi tinggi.'
    }
};

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const requested = (interaction.options.getString('nama') || '').toLowerCase();
        const chosen = CLASSES[requested];

        // Penjaga ini penting: dulu nama kelas asing tetap tersimpan ke database
        // dan kartunya tampil kosong tanpa penjelasan apa pun.
        if (!chosen) {
            const daftar = Object.keys(CLASSES).map(key => `\`${key}\``).join(', ');
            return ui.sendError(
                interaction,
                `Naura belum kenal kelas itu. Kelas yang tersedia: ${daftar}.`,
                true
            );
        }

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);

        const rpgState = survival.rpg_state || {};
        const currentClass = rpgState.class;

        if (currentClass === requested) {
            return ui.sendError(
                interaction,
                `Kamu sudah jadi **${chosen.label}**, kok. Nggak perlu daftar lagi yaa!`,
                true
            );
        }

        const coinEmoji = e('coin', '\uD83E\uDE99');
        const isSwitching = Boolean(currentClass);

        if (isSwitching) {
            if ((profile.economy_wallet || 0) < SWITCH_FEE) {
                const kurang = SWITCH_FEE - (profile.economy_wallet || 0);
                return ui.sendError(
                    interaction,
                    `Pindah kelas butuh ${coinEmoji} **${SWITCH_FEE.toLocaleString('id-ID')} Naura Coin**, sedangkan kamu masih kurang **${kurang.toLocaleString('id-ID')}**. Kumpulkan dulu yaa, Naura dukung dari sini!`,
                    true
                );
            }
            await profile.decrement('economy_wallet', { by: SWITCH_FEE });
        }

        rpgState.class = requested;
        await UserSurvival.update({ rpg_state: rpgState }, { where: { userId: user.id } });

        const biaya = isSwitching
            ? `*Biaya administrasi ganti kelas ${coinEmoji} **${SWITCH_FEE.toLocaleString('id-ID')} Coin** sudah Naura potong dari dompetmu yaa.*`
            : '*Inisiasi kelas pertama ini gratis, hadiah kecil dari Naura!*';

        const payload = buildContainerV2({
            accentColorHex: chosen.color,
            authorName: 'Naura Class Initiation',
            title: `${e('impressed', '\u2728')} Kelas barumu resmi!`,
            iconURL: user.displayAvatarURL(),
            description: [
                `Selamat, **${user.username}**! Naura ikut deg-degan lihat jiwamu terikat kekuatan baru.`,
                '',
                `**${e(chosen.emoji, chosen.emojiFallback)} ${chosen.label}**`,
                chosen.tagline,
                '',
                `> Bonus stat: ${chosen.stats}`,
                `> Skill tempur: ${chosen.skill}`,
                '',
                biaya
            ].join('\n'),
            footerText: `Coba kelas barumu di Infinite Dungeon \u2022 ${ui.getFooter('survival')}`
        });

        return interaction.reply(payload);
    }
};
