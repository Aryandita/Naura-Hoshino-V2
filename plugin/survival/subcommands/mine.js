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
        const hasPickaxe = inventory.some(i => i && i.id === 'steel_pickaxe');

        if (!hasPickaxe) return ui.sendError(interaction, 'err_sys_53', true);
        if (survival.stamina < 20) return ui.sendError(interaction, 'err_sys_54', true);

        survival.stamina -= 20;
        await survival.save();

        const colors = [
            { id: 'red', emoji: '🔴', label: 'Batu Merah' },
            { id: 'blue', emoji: '🔵', label: 'Batu Biru' },
            { id: 'green', emoji: '🟢', label: 'Batu Hijau' }
        ];

        const correctColor = colors[Math.floor(Math.random() * colors.length)];

        const minePayload = buildContainerV2({
            accentColorHex: '#f59e0b',
            title: '⛏️ Menambang di Gua Kuno',
            description: `Kamu melihat kilauan aneh dari bebatuan di depanmu.\nCepat pukul **${correctColor.label}** sebelum cahayanya menghilang!`,
            footerText: ui.getFooter('survival')
        });

        const row = new ActionRowBuilder();
        colors.forEach(c => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`mine_${c.id}`)
                    .setEmoji(c.emoji)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        const message = await interaction.reply({ ...minePayload, components: [row], fetchReply: true });

        // Waktu reaksi 3.5 detik
        const collector = message.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 3500 });

        let answered = false;
        collector.on('collect', async i => {
            answered = true;
            collector.stop();
            await i.deferUpdate();

            const chosen = i.customId.replace('mine_', '');

            if (chosen === correctColor.id) {
                const rand = Math.random() * 100;
                let rewardId = 'stone', rewardName = 'Batu', rewardEmoji = ui.getEmoji('stone') || '🪨', rewardAmount = Math.floor(Math.random() * 2) + 2;

                if (rand > 95) { rewardId = 'mythril_ore'; rewardName = 'Bijih Mythril'; rewardEmoji = ui.getEmoji('sparkle') || '✨'; rewardAmount = 1; }
                else if (rand > 80) { rewardId = 'silver_ore'; rewardName = 'Bijih Perak'; rewardEmoji = ui.getEmoji('coin') || '🪙'; rewardAmount = 1; }
                else if (rand > 50) { rewardId = 'iron_ore'; rewardName = 'Bijih Besi'; rewardEmoji = ui.getEmoji('iron') || '⛓️'; rewardAmount = 1; }

                const exist = profile.inventory.find(item => item && item.id === rewardId);
                if (exist) { exist.amount += rewardAmount; }
                else { profile.inventory.push({ id: rewardId, name: rewardName, amount: rewardAmount, type: 'material' }); }
                await cacheManager.updateUserProfile(user.id, { inventory: profile.inventory });

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: '💎 Yaaay! Hasil Tambang Berharga~! ✨',
                    description: `Hebat! Insting menambangmu tajam banget~ Kamu memukul batu yang menyimpan harta karun! 💎✨\n\n**🎁 Hasil Tambanganmu:**\n> ${rewardEmoji} **${rewardAmount}x ${rewardName}**`,
                    footerText: ui.getFooter('survival')
                });
                await interaction.editReply(successPayload);

                const questGen = require('../../questGenerator');
                await questGen.incrementQuestProgress(user.id, 'collect', 1);

                if (rewardId === 'diamond') {
                    const finalItem = profile.inventory.find(item => item && item.id === 'diamond');
                    if (finalItem && finalItem.amount >= 100) {
                        const achievementHelper = require('../../achievementHelper');
                        await achievementHelper.unlockAchievement(interaction, 'miner_dwarf');
                    }
                }
            } else {
                const failPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: '💥 Aww, Salah Pukul Batu! ⛏️',
                    description: 'Aww... Batu yang itu ternyata kosong! Beliungmu memantul keras, tapi jangan menyerah yaa! Coba lagi! 💕',
                    footerText: ui.getFooter('survival')
                });
                await interaction.editReply(failPayload);
            }
        });

        collector.on('end', async () => {
            if (!answered) {
                const timeoutPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: '💨 Waktu Menambang Habis! ⌛',
                    description: 'Aww... Cahaya batu mulianya memudar sebelum kamu sempat memukulnya. Lain kali pukul lebih cepat yaa! 💕',
                    footerText: ui.getFooter('survival')
                });
                await interaction.editReply(timeoutPayload);
            }
        });
    }
};
