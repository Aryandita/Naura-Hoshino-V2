const { AttachmentBuilder } = require('discord.js');
const UserAchievement = require('../../src/models/UserAchievement');
const achievementsPool = require('./achievementsData');
const { generateAchievementImage } = require('../canvas/achievementCanvas');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

/**
 * Membuka achievement untuk user dan mengirim notifikasi canvas.
 * @param {Object} interaction - Discord Interaction object
 * @param {String} achievementId - ID achievement dari pool
 */
async function unlockAchievement(interaction, achievementId) {
    try {
        const achievement = achievementsPool.find(a => a.id === achievementId);
        if (!achievement) return;

        const [userAch] = await UserAchievement.findOrCreate({ where: { userId: interaction.user.id } });

        let unlocked = userAch.unlockedAchievements || [];
        if (unlocked.includes(achievementId)) {
            // Sudah terbuka, abaikan
            return;
        }

        unlocked.push(achievementId);
        userAch.unlockedAchievements = unlocked;
        userAch.changed('unlockedAchievements', true);
        await userAch.save();

        // Render notifikasi canvas achievement
        const canvasBuffer = await generateAchievementImage(interaction.user, achievement.title, achievement.description, achievement.color);
        const attachment = new AttachmentBuilder(canvasBuffer, { name: 'achievement.png' });

        const payload = buildContainerV2({
            accentColorHex: achievement.color || ui.getColor('primary') || '#FFD700',
            title: '🏆 Achievement Unlocked!',
            description: `Selamat <@${interaction.user.id}>! Kamu berhasil membuka pencapaian baru:\n**${achievement.title}**`,
            bannerAttachmentName: 'achievement.png',
            footerText: ui.getFooter('survival')
        });

        // Kirim notifikasi sebagai followUp ephemeral
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ ...payload, files: [attachment], ephemeral: true }).catch(() => { });
        } else {
            await interaction.reply({ ...payload, files: [attachment], ephemeral: true }).catch(() => { });
        }
    } catch (e) {
        logger.error('[AchievementHelper] Gagal memproses unlockAchievement:', e);
    }
}

module.exports = { unlockAchievement };
