'use strict';

const UserSurvival = require('../../../src/models/UserSurvival');
const ui = require('../../../src/config/ui');
const { advanceTime, getTimeState } = require('../survivalTime');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const SLEEP_HOURS = 8;
const MAX_STAT = 100;
const HUNGER_DRAIN = 20;
const THIRST_DRAIN = 20;

// Semakin nyaman tempat tinggalnya, semakin pulas tidurnya.
const REGEN_BY_PROPERTY = {
    jalanan: 50,
    gudang: 60,
    kos: 70,
    rumah: 90,
    mansion: 100
};

const DECO_BONUS = {
    deco_small_bed: 10,
    deco_premium_bed: 20
};

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function bonusFromDecorations(decorations) {
    return decorations.reduce((total, deco) => total + (DECO_BONUS[deco?.id] || 0), 0);
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.inGameHour > 6 && survival.inGameHour < 18) {
            return ui.sendError(interaction, 'err_sys_56', true);
        }

        const rpgState = survival.rpg_state || {};
        const property = survival.propertyId || 'jalanan';

        if (rpgState.house_seized && property !== 'jalanan') {
            return ui.sendError(interaction, 'err_sys_57', true);
        }

        const regenStamina = (REGEN_BY_PROPERTY[property] || REGEN_BY_PROPERTY.jalanan)
            + bonusFromDecorations(rpgState.active_decorations || []);

        const maxHp = MAX_STAT + (survival.survival_level * 2);
        const regenHp = Math.round(regenStamina / 2);

        const newStamina = Math.min(MAX_STAT, (survival.stamina || 0) + regenStamina);
        const newHp = Math.min(maxHp, (survival.hp || MAX_STAT) + regenHp);
        const newHunger = Math.max(0, (survival.hunger || 0) - HUNGER_DRAIN);
        const newThirst = Math.max(0, (survival.thirst || 0) - THIRST_DRAIN);

        const timeUpdate = await advanceTime(user.id, SLEEP_HOURS);
        const timeState = getTimeState(timeUpdate.hour);

        await UserSurvival.update({
            stamina: newStamina,
            hp: newHp,
            hunger: newHunger,
            thirst: newThirst
        }, { where: { userId: user.id } });

        const jam = timeUpdate.hour.toString().padStart(2, '0');

        const description = [
            `Kamu merebahkan badan di **${property.toUpperCase()}** dan tertidur pulas selama ${SLEEP_HOURS} jam. Naura jagain mimpimu, kok.`,
            '',
            '**Yang pulih waktu kamu tidur:**',
            `> Stamina **+${regenStamina}** (sekarang ${newStamina}%)`,
            `> HP **+${regenHp}** (sekarang ${newHp})`,
            '',
            '**Tapi bangun-bangun jadi lapar:**',
            `> Lapar **-${HUNGER_DRAIN}%** (sisa ${newHunger}%)`,
            `> Haus **-${THIRST_DRAIN}%** (sisa ${newThirst}%)`,
            '',
            '**Sekarang sudah:**',
            `> ${timeState.emoji} **Hari ke-${timeUpdate.day}**, jam ${jam}:00 (${timeState.label})`
        ].join('\n');

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            authorName: 'Naura Survival',
            title: `${e('sleepy', '\uD83D\uDECF\uFE0F')} Tidurmu nyenyak sekali`,
            iconURL: interaction.client.user.displayAvatarURL(),
            description,
            footerText: `Jangan lupa sarapan dulu yaa \u2022 ${ui.getFooter('survival')}`
        });

        return interaction.reply(payload);
    }
};
