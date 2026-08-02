const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const StoryProgress = require('../../../src/models/StoryProgress');
const storyData = require('../storyData');
const ui = require('../../../src/config/ui');
const fs = require('fs');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const { safeParseInventory } = require('../inventoryHelper');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);
        const [storyProgress] = await StoryProgress.findOrCreate({ where: { userId: user.id } });

        const currentArcId = storyProgress.currentArc;
        if (currentArcId === -1) return ui.sendError(interaction, 'err_sys_60', true);

        const arc = storyData.find(a => a.arc === currentArcId);
        if (!arc) return ui.sendError(interaction, 'err_sys_61', true);

        if (survival.survival_level < arc.reqLevel) {
            return ui.sendError(interaction, `Kamu harus mencapai **Level ${arc.reqLevel}** untuk memulai arc cerita **${arc.arcName}** (Levelmu saat ini: ${survival.survival_level || 1}).`, true);
        }

        const currentChapterId = storyProgress.currentChapter;
        const chapter = arc.chapters.find(c => c.chapter === currentChapterId);
        if (!chapter) return ui.sendError(interaction, 'err_sys_62', true);

        let dialogueIndex = 0;

        const renderFrame = async (i) => {
            const isLast = dialogueIndex >= chapter.dialogue.length - 1;
            const currentLine = chapter.dialogue[dialogueIndex];

            // Load background image jika ada
            const bgPath = ui.getSurvivalBackground ? ui.getSurvivalBackground(chapter.background, 12) : null;
            let files = [];
            let bannerAttachmentName;
            if (bgPath && fs.existsSync(bgPath)) {
                files.push(new AttachmentBuilder(bgPath, { name: 'bg.jpg' }));
                bannerAttachmentName = 'bg.jpg';
            }

            const storyPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: `📖 Arc ${arc.arc}: ${arc.arcName} - Ch. ${chapter.chapter}`,
                description: `*${chapter.narrative.replace(/{player}/g, user.username)}*\n\n**[${currentLine.speaker.replace(/{player}/g, user.username)}]**\n"${currentLine.text.replace(/{player}/g, user.username)}"`,
                bannerAttachmentName,
                footerText: ui.getFooter('survival')
            });

            const row = new ActionRowBuilder();
            if (!isLast) {
                row.addComponents(
                    new ButtonBuilder().setCustomId('story_next').setLabel('Selanjutnya').setStyle(ButtonStyle.Primary).setEmoji(ui.getEmoji('next') || '▶️')
                );
            } else {
                if (chapter.challenge) {
                    row.addComponents(
                        new ButtonBuilder().setCustomId('story_challenge').setLabel(chapter.challenge.btnLabel).setStyle(ButtonStyle.Danger).setEmoji(chapter.challenge.btnEmoji || ui.getEmoji('warning') || '⚠️')
                    );
                } else {
                    row.addComponents(
                        new ButtonBuilder().setCustomId('story_finish').setLabel('Selesaikan Chapter').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('success') || '✅')
                    );
                }
            }

            if (i.replied || i.deferred) {
                await i.editReply({ ...storyPayload, components: [row], files });
            } else {
                await i.reply({ ...storyPayload, components: [row], files });
            }
        };

        await renderFrame(interaction);

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 180000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            if (i.customId === 'story_next') {
                dialogueIndex++;
                await renderFrame(i);
            } else if (i.customId === 'story_finish' || i.customId === 'story_challenge') {
                if (i.customId === 'story_challenge') {
                    const challenge = chapter.challenge;
                    let passed = false;

                    if (challenge.type === 'item') {
                        // Normalisasi inventory untuk mencegah crash 'xxx.find is not a function'
                        const storyInv = safeParseInventory(profile.inventory);
                        profile.inventory = storyInv;
                        const item = storyInv.find(inv => inv && inv.id === challenge.reqId);
                        if (item && item.amount >= challenge.reqAmount) {
                            passed = true;
                            item.amount -= challenge.reqAmount;
                            await cacheManager.updateUserProfile(user.id, { inventory: profile.inventory });
                        }
                    } else if (challenge.type === 'coin') {
                        if (profile.wallet >= challenge.reqAmount) {
                            passed = true;
                            profile.wallet -= challenge.reqAmount;
                            await cacheManager.updateUserProfile(user.id, { wallet: profile.wallet });
                        }
                    }

                    if (!passed) {
                        const failPayload = buildContainerV2({
                            accentColorHex: ui.getColor('error') || '#ef4444',
                            title: '❌ Persyaratan Belum Terpenuhi',
                            description: challenge.failMsg.replace(/{player}/g, user.username),
                            footerText: ui.getFooter('survival')
                        });
                        return await i.followUp({ ...failPayload, ephemeral: true });
                    }
                }

                collector.stop('finished');

                let rewardText = '';
                if (chapter.reward.exp) {
                    const leveling = require('../survivalLeveling');
                    await leveling.addPlayerXP(user.id, chapter.reward.exp);
                    rewardText += `🌟 **+${chapter.reward.exp} XP**\n`;
                }
                if (chapter.reward.item) {
                    const itemName = chapter.reward.item;
                    const exist = profile.inventory.find(inv => inv && inv.id === itemName);
                    if (exist) { exist.amount += chapter.reward.amount; }
                    else { profile.inventory.push({ id: itemName, name: itemName, amount: chapter.reward.amount, type: 'loot' }); }
                    await cacheManager.updateUserProfile(user.id, { inventory: profile.inventory });
                    rewardText += `📦 **${chapter.reward.amount}x ${itemName}**\n`;
                }

                storyProgress.currentArc = chapter.nextArc;
                storyProgress.currentChapter = chapter.nextChapter;
                await storyProgress.save();

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: '🎉 Chapter Selesai!',
                    description: `Kamu telah menyelesaikan **${chapter.title}**!\n\n**Hadiah:**\n${rewardText}`,
                    footerText: ui.getFooter('survival')
                });
                await i.editReply({ ...successPayload, components: [], files: [] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({ components: [] }).catch(() => { });
            }
        });
    }
};
