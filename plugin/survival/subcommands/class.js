const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const className = interaction.options.getString('nama'); // warrior, mage, assassin, ranger

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);

        const rpgState = survival.rpg_state || {};
        const currentClass = rpgState.class;

        if (currentClass === className) {
            return ui.sendError(interaction, `Kamu sudah memilih kelas **${className.toUpperCase()}**!`, true);
        }

        // Biaya ganti kelas jika sudah punya kelas sebelumnya
        const fee = 10000; // 10.000 Coin
        if (currentClass) {
            if (profile.economy_wallet < fee) {
                return ui.sendError(interaction, `Kamu butuh ${ui.getEmoji('coin') || '🪙'} **${fee.toLocaleString()} Naura Coin** untuk berpindah kelas dari **${currentClass.toUpperCase()}** ke **${className.toUpperCase()}**.`, true);
            }
            await profile.decrement('economy_wallet', { by: fee });
        }

        rpgState.class = className;
        await UserSurvival.update({ rpg_state: rpgState }, { where: { userId: user.id } });

        let classTitle = '';
        let classDesc = '';
        let classColor = '#ffffff';

        if (className === 'warrior') {
            classTitle = `${ui.getEmoji('class_warrior') || '🛡️'} Warrior (Fighter)`;
            classDesc = 'Petarung tangguh dengan HP besar dan tebasan pedang yang mematikan.\n\n**Bonus Stats:**\n> Max HP: **+50** | STR: **+5**\n\n**Skill Tempur:**\n> **Iron Slash** (15 Stamina): Tebasan pedang murni dengan daya rusak **1.8x damage**.';
            classColor = '#ff4d4d';
        } else if (className === 'mage') {
            classTitle = `${ui.getEmoji('class_mage') || '🔮'} Mage (Penyihir)`;
            classDesc = 'Penyihir agung yang menguasai sihir elemen dengan tingkat inteligensi luar biasa.\n\n**Bonus Stats:**\n> AGI: **+3** | INT: **+8**\n\n**Skill Tempur:**\n> **Fireball** (25 Stamina): Serangan sihir api membara dengan daya rusak **2.2x damage** berbasis kecerdasan.';
            classColor = '#c084fc';
        } else if (className === 'assassin') {
            classTitle = `${ui.getEmoji('class_assassin') || '🗡️'} Assassin (Pembunuh Bayangan)`;
            classDesc = 'Eksekutor bayangan dengan kelincahan super cepat dan serangan kritikal mematikan.\n\n**Bonus Stats:**\n> AGI: **+8** | LUCK: **+5**\n\n**Skill Tempur:**\n> **Shadow Strike** (20 Stamina): Tebasan kritikal mematikan sebesar **2.5x damage** namun memiliki peluang meleset.';
            classColor = '#93c5fd';
        } else if (className === 'ranger') {
            classTitle = `${ui.getEmoji('class_ranger') || '🏹'} Ranger (Pemanah)`;
            classDesc = 'Penjelajah alam liar yang ahli menggunakan panah. Sangat efisien dalam mengumpulkan sumber daya.\n\n**Bonus Stats:**\n> LUCK: **+8** | AGI: **+5**\n\n**Skill Tempur:**\n> **Piercing Arrow** (15 Stamina): Tembakan panah menembus pertahanan dengan daya rusak **1.5x damage** dan akurasi tinggi.';
            classColor = '#4ade80';
        }

        const payload = buildContainerV2({
            accentColorHex: classColor,
            title: '✨ Inisiasi Kelas Baru',
            iconURL: user.displayAvatarURL({ dynamic: true }),
            description: `Selamat, **${user.username}**! Jiwamu telah terikat dengan kekuatan legendaris:\n\n**${classTitle}**\n${classDesc}\n\n${currentClass ? `*Kamu dikenakan biaya administrasi ganti kelas sebesar ${ui.getEmoji('coin') || '🪙'} **${fee.toLocaleString()} Coin**.*` : '*Inisiasi kelas pertama ini Gratis!*'}`,
            footerText: 'Gunakan kelas barumu ini di Infinite Dungeon (/survival dungeon)!'
        });

        return interaction.reply(payload);
    }
};
