'use strict';

const { AttachmentBuilder, MessageFlags } = require('discord.js');
const UserAchievement = require('../../src/models/UserAchievement');
const UserSurvival = require('../../src/models/UserSurvival');
const achievementsPool = require('./achievementsData');
const { generateAchievementImage } = require('../canvas/achievementCanvas');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { rollCouponDrop, dropLine } = require('./couponRewards');

const IMAGE_NAME = 'achievement.png';

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

// Tingkat kelangkaan pencapaian. Ditaruh di sini, bukan di achievementsData,
// supaya data pencapaian tetap utuh dan penyetelan hadiah cukup diubah di satu
// tempat saja.
const MYTHIC_IDS = new Set([
    'god_slayer',
    'elf_evolution',
    'magic_creator',
    'billionaire'
]);

const RARE_IDS = new Set([
    'high_mage',
    'weapon_manifest',
    'blacksmith_master',
    'demon_contract',
    'yinyang_light',
    'cat_beast_friend',
    'gambler'
]);

function couponSourceFor(achievementId) {
    if (MYTHIC_IDS.has(achievementId)) return 'achievement_mythic';
    if (RARE_IDS.has(achievementId)) return 'achievement_rare';
    return null;
}

/**
 * Membuka achievement untuk user, mengirim notifikasi canvas, dan menjatuhkan
 * Naura Coupon bila pencapaiannya tergolong langka atau mitos.
 *
 * @param {Object} interaction - Discord Interaction object
 * @param {String} achievementId - ID achievement dari pool
 */
async function unlockAchievement(interaction, achievementId) {
    try {
        const achievement = achievementsPool.find(a => a.id === achievementId);
        if (!achievement) return;

        const [userAch] = await UserAchievement.findOrCreate({ where: { userId: interaction.user.id } });

        const unlocked = userAch.unlockedAchievements || [];
        if (unlocked.includes(achievementId)) {
            // Sudah terbuka, abaikan supaya hadiahnya tidak bisa dipanen ulang.
            return;
        }

        unlocked.push(achievementId);
        userAch.unlockedAchievements = unlocked;
        userAch.changed('unlockedAchievements', true);
        await userAch.save();

        // Hadiah kupon hanya untuk pencapaian berat. Bila datanya belum ada,
        // pencapaian tetap terbuka tanpa kupon.
        let couponText = '';
        const source = couponSourceFor(achievementId);

        if (source) {
            try {
                const survival = await UserSurvival.findOne({ where: { userId: interaction.user.id } });
                if (survival) {
                    const drop = await rollCouponDrop(source, { survival });
                    couponText = dropLine(drop);
                }
            } catch (err) {
                logger.error('[AchievementHelper] Gagal menjatuhkan Naura Coupon:', err);
            }
        }

        const files = [];
        let bannerName;

        try {
            const buffer = await generateAchievementImage(
                interaction.user,
                achievement.title,
                achievement.description,
                achievement.color
            );
            files.push(new AttachmentBuilder(buffer, { name: IMAGE_NAME }));
            bannerName = IMAGE_NAME;
        } catch (err) {
            // Pencapaiannya tetap tersimpan walaupun kartu gambarnya gagal dirender.
            logger.error('[AchievementHelper] Gagal merender kartu pencapaian:', err);
        }

        const lines = [
            `Yaay, selamat <@${interaction.user.id}>! Naura ikut bangga banget lihat kamu berhasil membuka pencapaian baru.`,
            '',
            `${achievement.emoji || e('impressed', '\uD83C\uDFC6')} **${achievement.title}**`,
            `*${achievement.description}*`
        ];

        if (source === 'achievement_mythic') {
            lines.push('', `${e('shocked', '\uD83D\uDE32')} Ini pencapaian tingkat **Mitos**, lho! Jarang ada yang sampai sini.`);
        } else if (source === 'achievement_rare') {
            lines.push('', `${e('impressed', '\u2728')} Pencapaian **Langka** \u2014 Naura simpan baik-baik di lemari piala kamu.`);
        }

        if (couponText) {
            lines.push('', couponText);
        }

        const payload = buildContainerV2({
            accentColorHex: achievement.color || ui.getColor('primary') || '#FFD700',
            authorName: 'Naura Hall of Fame',
            title: `${e('cheers', '\uD83C\uDFC6')} Pencapaian terbuka!`,
            iconURL: interaction.user.displayAvatarURL(),
            expression: 'achievement',
            description: lines.join('\n'),
            bannerAttachmentName: bannerName,
            files,
            footerText: ui.getFooter('survival')
        });

        // Pesan Components V2 tidak boleh kehilangan flag builder-nya, jadi flag
        // ephemeral digabung, bukan ditumpuk lewat opsi `ephemeral` lama.
        const notice = { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(notice).catch(() => {});
        } else {
            await interaction.reply(notice).catch(() => {});
        }
    } catch (err) {
        logger.error('[AchievementHelper] Gagal memproses unlockAchievement:', err);
    }
}

module.exports = { unlockAchievement, couponSourceFor, MYTHIC_IDS, RARE_IDS };
