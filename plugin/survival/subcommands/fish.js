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
        const hasRod = inventory.some(i => i && i.id === 'fishing_rod');
        const baitItem = inventory.find(i => i && i.id === 'worm_bait');

        if (!hasRod) return ui.sendError(interaction, 'err_sys_46', true);
        if (!baitItem || baitItem.amount <= 0) return ui.sendError(interaction, 'err_sys_47', true);
        if (survival.stamina < 10) return ui.sendError(interaction, 'err_sys_48', true);

        // Kurangi stamina & umpan
        survival.stamina -= 10;
        await survival.save();

        baitItem.amount -= 1;
        if (baitItem.amount <= 0) {
            profile.inventory = inventory.filter(i => i.id !== 'worm_bait');
        } else {
            profile.inventory = [...inventory];
        }
        await profile.save();

        const waitingPayload = buildContainerV2({
            accentColorHex: '#3b82f6',
            title: '🎣 Memancing di Pantai Utara',
            description: 'Kamu melempar kail ke laut... Tunggu saat umpan ditarik!\n\n> Sedang menunggu gigitan ikan...',
            footerText: ui.getFooter('survival')
        });

        const message = await interaction.reply({ ...waitingPayload, fetchReply: true });

        // Random wait time (3 to 7 seconds)
        const waitTime = Math.floor(Math.random() * 4000) + 3000;

        setTimeout(async () => {
            const pullBtn = new ButtonBuilder()
                .setCustomId('fish_pull')
                .setLabel('TARIK KAIL!')
                .setStyle(ButtonStyle.Success)
                .setEmoji(ui.getEmoji('fishing_rod') || '🎣');

            const row = new ActionRowBuilder().addComponents(pullBtn);

            const alertPayload = buildContainerV2({
                accentColorHex: '#ef4444',
                title: '‼️ IKAN TERTANGKAP ‼️',
                description: '**CEPAT TEKAN TOMBOL DI BAWAH SEBELUM IKAN LEPAS!**',
                footerText: ui.getFooter('survival')
            });

            await interaction.editReply({ ...alertPayload, components: [row] });

            // Pengecekan kecepatan reaksi (2.5 detik max)
            const collector = message.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 2500 });

            let pulled = false;
            collector.on('collect', async i => {
                pulled = true;
                collector.stop();
                await i.deferUpdate();

                const rand = Math.random() * 100;
                let rewardId, rewardName, rewardEmoji;

                if (rand < 50) {
                    rewardId = 'trash'; rewardName = 'Sampah Plastik'; rewardEmoji = ui.getEmoji('trash') || '🗑️';
                } else if (rand < 90) {
                    rewardId = 'salmon'; rewardName = 'Ikan Salmon'; rewardEmoji = ui.getEmoji('fish') || '🐟';
                } else {
                    rewardId = 'golden_fish'; rewardName = 'Ikan Mas Koki'; rewardEmoji = ui.getEmoji('goldfish') || '🐡';
                }

                const exist = profile.inventory.find(item => item && item.id === rewardId);
                if (exist) { exist.amount += 1; }
                else { profile.inventory.push({ id: rewardId, name: rewardName, amount: 1, type: 'loot' }); }
                await cacheManager.updateUserProfile(user.id, { inventory: profile.inventory });

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: '🎉 Yaaay! Dapat Ikan Segar~! 🐟✨',
                    description: `Waaa! Refleksmu cepat banget! Kamu berhasil menarik kail tepat pada waktunya! 🎣✨\n\n**🎁 Tangkapanmu:**\n> ${rewardEmoji} **1x ${rewardName}**`,
                    footerText: ui.getFooter('survival')
                });
                await interaction.editReply(successPayload);

                const questGen = require('../../questGenerator');
                await questGen.incrementQuestProgress(user.id, 'collect', 1);

                if (rewardId === 'golden_fish') {
                    const achievementHelper = require('../../achievementHelper');
                    await achievementHelper.unlockAchievement(interaction, 'master_angler');
                }
            });

            collector.on('end', async () => {
                if (!pulled) {
                    const failPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFC0CB',
                        title: '💦 Aww... Ikannya Kabur! 🐟',
                        description: 'Aww... Kamu sedikit terlambat menarik kail nih. Umpannya habis dimakan dan ikannya kabur deh. Jangan menyerah, lempar kail lagi yaa! 💕',
                        footerText: ui.getFooter('survival')
                    });
                    await interaction.editReply(failPayload);
                }
            });
        }, waitTime);
    }
};
