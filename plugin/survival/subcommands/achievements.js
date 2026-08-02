const { ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const UserAchievement = require('../../../src/models/UserAchievement');
const achievementsPool = require('../achievementsData');
const { generateAchievementImage } = require('../../canvas/achievementCanvas');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [achievementData] = await UserAchievement.findOrCreate({ where: { userId: user.id } });

        const unlockedIds = achievementData.unlockedAchievements || [];
        const unlockedAchievements = achievementsPool.filter(a => unlockedIds.includes(a.id));

        if (unlockedAchievements.length === 0) {
            return ui.sendError(interaction, 'err_sys_33', true);
        }

        const activeTitle = achievementData.activeTitle
            ? achievementsPool.find(a => a.id === achievementData.activeTitle)
            : null;

        const achievementList = unlockedAchievements
            .map(a => `> ${a.emoji} **${a.title}**\n> *${a.description}*`)
            .join('\n\n');

        const payload = buildContainerV2({
            accentColorHex: '#ffd700',
            title: `🏆 Koleksi Pencapaian: ${user.username}`,
            description: 'Berikut adalah daftar gelar yang berhasil kamu raih:\n\n' + achievementList,
            footerText: activeTitle
                ? `Gelar Aktif: ${activeTitle.emoji} ${activeTitle.title}`
                : ui.getFooter('survival')
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('set_active_title')
            .setPlaceholder('Pilih Gelar Aktif untuk profilmu!')
            .addOptions(unlockedAchievements.map(a => ({
                label: a.title,
                description: a.description.substring(0, 100),
                value: a.id,
                emoji: a.emoji
            })));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const message = await interaction.reply({ ...payload, components: [row], fetchReply: true });

        const collector = message.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'set_active_title') {
                await i.deferUpdate();
                const selectedId = i.values[0];
                const selectedAch = achievementsPool.find(a => a.id === selectedId);

                achievementData.activeTitle = selectedId;
                await achievementData.save();

                // Render Canvas untuk merayakan penggantian gelar
                const canvasBuffer = await generateAchievementImage(user, selectedAch.title, selectedAch.description, selectedAch.color);
                const attachment = new AttachmentBuilder(canvasBuffer, { name: 'achievement.png' });

                const updatePayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: '🎉 Gelar Aktif Berhasil Diperbarui~! 💕',
                    description: `Yaaay! Kamu sekarang resmi menyandang gelar **${selectedAch.title}**! Keren banget~! ✨`,
                    bannerAttachmentName: 'achievement.png',
                    footerText: ui.getFooter('survival')
                });

                await i.editReply({ ...updatePayload, files: [attachment] });
                collector.stop();
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutPayload = buildErrorContainerV2({
                    title: 'Waktu Memilih Habis! ⌛',
                    description: 'Aww... Waktu memilih gelar sudah habis. Nanti bisa dicoba lagi kapan saja yaa! 💕',
                    footerText: ui.getFooter('survival')
                });
                await interaction.editReply(timeoutPayload).catch(() => { });
            }
        });
    }
};
