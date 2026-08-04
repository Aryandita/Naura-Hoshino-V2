'use strict';

const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const SWITCH_FEE = 10000;

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

// Kunci bonus memakai nama kolom UserSurvival apa adanya supaya penerapannya
// bisa dilakukan lewat satu loop, tanpa percabangan per kelas.
const CLASSES = {
    warrior: {
        emoji: 'class_warrior',
        emojiFallback: '\uD83D\uDEE1\uFE0F',
        label: 'Warrior (Fighter)',
        color: '#FF4D4D',
        tagline: 'Petarung tangguh dengan HP besar dan tebasan pedang yang mematikan.',
        bonus: { hp: 50, strength: 5 },
        skill: '**Iron Slash** (15 stamina) \u2014 tebasan pedang murni, daya rusak **1.8x damage**.'
    },
    mage: {
        emoji: 'class_mage',
        emojiFallback: '\uD83D\uDD2E',
        label: 'Mage (Penyihir)',
        color: '#C084FC',
        tagline: 'Penyihir agung yang menguasai sihir elemen dengan kecerdasan luar biasa.',
        bonus: { agility: 3, intelligence: 8 },
        skill: '**Fireball** (25 stamina) \u2014 sihir api membara, daya rusak **2.2x damage** berbasis kecerdasan.'
    },
    assassin: {
        emoji: 'class_assassin',
        emojiFallback: '\uD83D\uDDE1\uFE0F',
        label: 'Assassin (Pembunuh Bayangan)',
        color: '#93C5FD',
        tagline: 'Eksekutor bayangan yang gerakannya cepat sekali dan sadis kalau kena kritikal.',
        bonus: { agility: 8, luck: 5 },
        skill: '**Shadow Strike** (20 stamina) \u2014 tebasan kritikal **2.5x damage**, tapi bisa meleset.'
    },
    ranger: {
        emoji: 'class_ranger',
        emojiFallback: '\uD83C\uDFF9',
        label: 'Ranger (Pemanah)',
        color: '#4ADE80',
        tagline: 'Penjelajah alam liar yang jago memanah dan paling cepat mengumpulkan sumber daya.',
        bonus: { luck: 8, agility: 5 },
        skill: '**Piercing Arrow** (15 stamina) \u2014 panah penembus pertahanan, **1.5x damage** dengan akurasi tinggi.'
    }
};

const STAT_LABELS = {
    hp: 'Max HP',
    strength: 'STR',
    agility: 'AGI',
    intelligence: 'INT',
    luck: 'LUCK'
};

function describeBonus(bonus) {
    return Object.entries(bonus)
        .map(([stat, value]) => `${STAT_LABELS[stat] || stat} **+${value}**`)
        .join(' \u2022 ');
}

/**
 * Terapkan bonus ke kolom stat. Dipakai dua arah: sign 1 untuk memberi bonus
 * kelas baru, sign -1 untuk mencabut bonus kelas lama. Tanpa pencabutan ini,
 * pemain bisa menumpuk bonus setiap kali berpindah kelas.
 */
function applyBonus(survival, bonus, sign) {
    if (!bonus) return;
    for (const [stat, value] of Object.entries(bonus)) {
        const current = Number(survival[stat]) || 0;
        survival[stat] = Math.max(1, current + (value * sign));
    }
}

/**
 * Bonus kelas lama diambil dari catatan di rpg_state. Pemain lama yang sudah
 * punya kelas sebelum fitur ini ada belum punya catatan itu, jadi nilainya
 * ditebak dari tabel kelas.
 */
function previousBonusOf(rpgState, currentClass) {
    if (rpgState.class_bonus) return rpgState.class_bonus;
    if (currentClass && CLASSES[currentClass]) return CLASSES[currentClass].bonus;
    return null;
}

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

        applyBonus(survival, previousBonusOf(rpgState, currentClass), -1);
        applyBonus(survival, chosen.bonus, 1);

        rpgState.class = requested;
        rpgState.class_bonus = { ...chosen.bonus };

        survival.rpg_state = rpgState;
        survival.changed('rpg_state', true);
        await survival.save();

        const biaya = isSwitching
            ? `*Biaya administrasi ganti kelas ${coinEmoji} **${SWITCH_FEE.toLocaleString('id-ID')} Coin** sudah Naura potong, dan bonus kelas lamamu Naura cabut biar adil.*`
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
                `> Bonus stat: ${describeBonus(chosen.bonus)}`,
                `> Skill tempur: ${chosen.skill}`,
                '',
                `Stat-mu sekarang: HP **${survival.hp}** \u2022 STR **${survival.strength}** \u2022 AGI **${survival.agility}** \u2022 INT **${survival.intelligence}** \u2022 LUCK **${survival.luck}**`,
                '',
                biaya
            ].join('\n'),
            footerText: `Coba kelas barumu di Infinite Dungeon \u2022 ${ui.getFooter('survival')}`
        });

        return interaction.reply(payload);
    }
};
