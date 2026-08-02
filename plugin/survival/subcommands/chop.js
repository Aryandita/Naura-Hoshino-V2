const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const profile = await cacheManager.getUserProfile(user.id);
        const survival = await cacheManager.getUserSurvival(user.id);

        const inventory = safeParseInventory(profile.inventory);
        const hasAxe = inventory.some(i => i && (i.id === 'wooden_axe' || i.id === 'iron_axe' || i.id === 'diamond_axe'));

        if (!hasAxe) return ui.sendError(interaction, 'err_sys_35', true);
        if (survival.stamina < 15) return ui.sendError(interaction, 'err_sys_36', true);

        // Kurangi stamina
        survival.stamina -= 15;
        await survival.save();

        let clicksNeeded = 10;
        const timeLimit = 5000;

        // Cek efisiensi axe
        if (inventory.find(i => i && i.id === 'diamond_axe')) {
            clicksNeeded = 5;
        } else if (inventory.find(i => i && i.id === 'iron_axe')) {
            clicksNeeded = 8;
        }

        const buildChopPayload = (progress) => buildContainerV2({
            accentColorHex: '#22c55e',
            title: '🪓 Menebang Pohon Hutan',
            description: `**CEPAT TEKAN TOMBOL CHOP!**\nKamu harus menebas sebanyak **${clicksNeeded} kali** dalam ${timeLimit / 1000} detik!${progress > 0 ? `\n\nProgres: **${progress} / ${clicksNeeded}** tebasan!` : ''}`,
            footerText: ui.getFooter('survival')
        });

        const chopBtn = new ButtonBuilder()
            .setCustomId('chop_hit')
            .setLabel('CHOP!')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(ui.getEmoji('axe') || '🪓');

        const row = new ActionRowBuilder().addComponents(chopBtn);
        const message = await interaction.reply({ ...buildChopPayload(0), components: [row], fetchReply: true });

        const collector = message.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: timeLimit });

        let clicks = 0;
        collector.on('collect', async i => {
            clicks++;
            if (clicks >= clicksNeeded) {
                collector.stop('success');
                await i.deferUpdate();
            } else {
                await i.update({ ...buildChopPayload(clicks), components: [row] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'success') {
                const rand = Math.random() * 100;
                let rewardAmount = Math.floor(Math.random() * 3) + 1;
                let rewardId = 'wood';
                let rewardName = 'Kayu';
                let rewardEmoji = ui.getEmoji('wood') || '🪵';

                if (rand > 90) {
                    const isFiber = Math.random() > 0.5;
                    if (isFiber) {
                        rewardId = 'fiber'; rewardName = 'Serat Tumbuhan';
                        rewardEmoji = ui.getEmoji('fiber') || '🌿'; rewardAmount = 2;
                    } else { rewardAmount += 3; }
                }

                const exist = profile.inventory.find(item => item && item.id === rewardId);
                if (exist) { exist.amount += rewardAmount; }
                else { profile.inventory.push({ id: rewardId, name: rewardName, amount: rewardAmount, type: 'material' }); }
                await cacheManager.updateUserProfile(user.id, { inventory: profile.inventory });

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: '🌲 Yaaay! Pohonnya Tumbang~! ✨',
                    description: `Hebat banget! Kamu berhasil merobohkan pohon itu dengan cepat~ Naura bangga deh! 💕\n\n**🎁 Hasil Tebanganmu:**\n> ${rewardEmoji} **${rewardAmount}x ${rewardName}**`,
                    footerText: ui.getFooter('survival')
                });
                await interaction.editReply(successPayload);

                const questGen = require('../../questGenerator');
                await questGen.incrementQuestProgress(user.id, 'collect', 1);

                if (rewardId === 'wood') {
                    const finalItem = profile.inventory.find(item => item && item.id === 'wood');
                    if (finalItem && finalItem.amount >= 500) {
                        const achievementHelper = require('../../achievementHelper');
                        await achievementHelper.unlockAchievement(interaction, 'forest_guardian');
                    }
                }
            } else {
                const failPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: '💨 Aww, Waktu Memotong Habis! ⌛',
                    description: `Yahhh... Kamu baru sempat menebas **${clicks}** kali nih. Pohonnya masih kokoh banget, nanti coba tebas lebih cepat lagi yaa! 💕`,
                    footerText: ui.getFooter('survival')
                });
                await interaction.editReply(failPayload);
            }
        });
    }
};
