'use strict';

const { MessageFlags } = require('discord.js');

const GuildClan = require('../../../src/models/GuildClan');
const UserSurvival = require('../../../src/models/UserSurvival');
const ui = require('../../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const STAMINA_COST = 15;
const BOSS_MAX_HP = 1000;
const CRIT_CHANCE = 0.2;
const CRIT_MULTIPLIER = 1.5;

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function findUserClan(clans, userId) {
    return clans.find(clan => {
        const members = Array.isArray(clan.members) ? clan.members : [];
        return clan.leaderId === userId || members.includes(userId);
    });
}

function ephemeralError(interaction, message) {
    return interaction.reply({
        ...buildErrorContainerV2({ errorMessage: message }),
        flags: MessageFlags.Ephemeral
    });
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const guildId = interaction.guildId;

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if ((survival.stamina || 0) < STAMINA_COST) {
            return ephemeralError(
                interaction,
                `Staminamu tinggal ${survival.stamina || 0}, belum cukup buat ikut Boss Raid yaa. Istirahat dulu sebentar, Naura tunggu kok! (butuh ${STAMINA_COST} stamina)`
            );
        }

        const clans = await GuildClan.findAll({ where: { guildId } });
        const userClan = findUserClan(clans, user.id);

        if (!userClan) {
            return ephemeralError(
                interaction,
                'Kamu belum punya klan di server ini. Gabung dulu lewat `/survival clan`, nanti kita raid bareng-bareng!'
            );
        }

        if ((userClan.bossHp || 0) <= 0) {
            return interaction.reply({
                ...buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#00FF00',
                    authorName: 'Naura Guild Boss Raid',
                    title: `${e('cheers', '\uD83D\uDC09')} Bossnya sudah tumbang!`,
                    iconURL: user.displayAvatarURL(),
                    description: `Naga raid klan **${userClan.name}** sudah kalah hari ini. Hebat banget kalian! Bossnya bakal muncul lagi besok, jadi istirahat dulu yaa.`,
                    footerText: ui.getFooter('survival')
                }),
                flags: MessageFlags.Ephemeral
            });
        }

        const strength = survival.strength || 1;
        const agility = survival.agility || 1;
        const baseDamage = Math.floor(Math.random() * 30) + (strength * 5) + (agility * 2);
        const isCritical = Math.random() < CRIT_CHANCE;
        const finalDamage = isCritical ? Math.floor(baseDamage * CRIT_MULTIPLIER) : baseDamage;

        userClan.bossHp = Math.max(0, (userClan.bossHp || BOSS_MAX_HP) - finalDamage);
        userClan.changed('bossHp', true);
        await userClan.save();

        survival.stamina -= STAMINA_COST;
        const rewardNsf = Math.floor(finalDamage / 2) + 20;
        survival.starFragments = (survival.starFragments || 0) + rewardNsf;
        await survival.save();

        const isDefeated = userClan.bossHp <= 0;
        const nsfEmoji = e('nsf', '\uD83E\uDE99');

        const heading = isCritical
            ? `${e('shocked', '\uD83D\uDCA5')} Serangan telak!`
            : `${e('impressed', '\u2694\uFE0F')} Serangan Boss Raid`;

        const penutup = isDefeated
            ? `${e('cheers', '\uD83C\uDF89')} **Luar biasa! Klan ${userClan.name} berhasil menumbangkan bossnya hari ini!** Kas klan ikut bertambah, Naura bangga banget sama kalian.`
            : `${e('happy', '\uD83D\uDCAA')} Ajak anggota klanmu ikut menyerang yaa, sedikit lagi bossnya pasti tumbang!`;

        const payload = buildContainerV2({
            accentColorHex: isDefeated ? '#FFD700' : '#FF4C4C',
            authorName: 'Naura Guild Boss Raid',
            title: heading,
            iconURL: user.displayAvatarURL(),
            description: [
                `<@${user.id}> menyerang boss klan **${userClan.name}** dan memberi **${finalDamage} damage**!`,
                isCritical ? '*Wah, kena titik lemahnya! Naura sampai ikut kaget.*' : '',
                '',
                `> Sisa HP boss: **${userClan.bossHp} / ${BOSS_MAX_HP}**`,
                `> Hadiah serangan: ${nsfEmoji} **+${rewardNsf} NSF**`,
                `> Sisa staminamu: **${survival.stamina} / 100**`,
                '',
                penutup
            ].filter(Boolean).join('\n'),
            footerText: ui.getFooter('survival')
        });

        return interaction.reply(payload);
    }
};
