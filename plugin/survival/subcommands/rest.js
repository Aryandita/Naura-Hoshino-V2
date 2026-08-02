// Lokasi: src/commands/survival/subcommands/rest.js
const UserSurvival = require('../../../src/models/UserSurvival');
const ui = require('../../../src/config/ui');
const { advanceTime, getTimeState } = require('../../../plugin/survival/survivalTime');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.inGameHour > 6 && survival.inGameHour < 18) {
            return ui.sendError(interaction, 'err_sys_56', true);
        }

        const rpgState = survival.rpg_state || { house_seized: false };
        if (rpgState.house_seized && survival.propertyId !== 'jalanan') {
            return ui.sendError(interaction, 'err_sys_57', true);
        }

        const prop = survival.propertyId || 'jalanan';
        let regenStamina = 50; // Jalanan
        if (prop === 'gudang') regenStamina = 60;
        if (prop === 'kos') regenStamina = 70;
        if (prop === 'rumah') regenStamina = 90;
        if (prop === 'mansion') regenStamina = 100;

        // Deco buff
        const rpgStateBuff = survival.rpg_state || {};
        const decos = rpgStateBuff.active_decorations || [];
        if (decos.some(d => d.id === 'deco_small_bed')) regenStamina += 10;
        if (decos.some(d => d.id === 'deco_premium_bed')) regenStamina += 20;

        const sleepTime = 8;
        const newStamina = Math.min(100, (survival.stamina || 0) + regenStamina);
        const newHP = Math.min(100 + (survival.survival_level * 2), (survival.hp || 100) + (regenStamina / 2));

        // Tidur menguras sedikit rasa lapar & haus (bangun-bangun lapar)
        const newHunger = Math.max(0, survival.hunger - 20);
        const newThirst = Math.max(0, survival.thirst - 20);

        const timeUpdate = await advanceTime(user.id, sleepTime);
        const timeState = getTimeState(timeUpdate.hour);

        await UserSurvival.update({
            stamina: newStamina,
            hp: newHP,
            hunger: newHunger,
            thirst: newThirst
        }, { where: { userId: user.id } });

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('bed') || '🛏️'} Tidur Lelap`,
            description: `Kamu merebahkan tubuhmu di **${prop.toUpperCase()}** dan tertidur lelap selama ${sleepTime} jam.\n\n**Pemulihan Energi:**\n> Stamina: **+${regenStamina}** (Total: ${newStamina}%)\n> HP: **+${regenStamina / 2}**\n\n**Kondisi Fisik Saat Bangun:**\n> Lapar: -20% | Haus: -20%\n\n**Waktu Saat Ini:**\n> ${timeState.emoji} **Hari ke-${timeUpdate.day}**, jam ${timeUpdate.hour.toString().padStart(2, '0')}:00 (${timeState.label})`,
            footerText: 'Pastikan makan sarapan sebelum memulai hari! • ' + ui.getFooter('survival')
        });

        return interaction.reply(payload);
    }
};
