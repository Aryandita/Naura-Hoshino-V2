/**
 * @namespace: plugin/leveling/rank.js
 * @type: Command
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.1.0
 * @description Kartu profil level per server.
 */

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const { Op } = require('sequelize');
const { CanvasUtils } = require('../../plugin/canvas/Canvas');
const UserLeveling = require('../../src/models/UserLeveling');
const cacheManager = require('../../src/managers/cacheManager');
const ui = require('../../src/config/ui');
const { getNextLevelXp, getRoleBadge } = require('./leveling');
const rankCard = require('./rankCard');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

const DEFAULT_MANNERS = 100;

function sendErrorReply(interaction, description, isSlash) {
    const payload = buildErrorContainerV2({
        title: 'Aduh, gagal',
        description,
        footerText: ui.getFooter('core')
    });
    if (isSlash) return interaction.editReply(payload).catch(() => {});
    return interaction.reply(payload).catch(() => {});
}

function isPremiumActive(profile) {
    if (!profile || !profile.isPremium) return false;
    if (!profile.premiumUntil) return Boolean(profile.isPremium);
    return new Date(profile.premiumUntil) > new Date();
}

// Poin tata krama tinggal di profil global. Tabel leveling hanya dipakai
// sebagai cadangan untuk data lama.
function mannersOf(profile, levelRow) {
    if (profile && profile.mannersPoint !== undefined && profile.mannersPoint !== null) {
        return profile.mannersPoint;
    }
    if (levelRow && levelRow.mannersPoint !== undefined && levelRow.mannersPoint !== null) {
        return levelRow.mannersPoint;
    }
    return DEFAULT_MANNERS;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Lihat kartu profil level kamu di server ini')
        .addUserOption(option =>
            option.setName('target').setDescription('Lihat profil milik orang lain').setRequired(false)
        ),
    aliases: ['profile', 'level', 'xp'],

    async execute(interaction) {
        const isSlash = typeof interaction.deferReply === 'function';
        if (isSlash) await interaction.deferReply();

        const targetUser =
            interaction.options && typeof interaction.options.getUser === 'function'
                ? interaction.options.getUser('target') || interaction.user
                : interaction.user;

        const guildId = interaction.guild.id;

        let levelRow;
        let profile;
        try {
            levelRow = await UserLeveling.findOne({ where: { userId: targetUser.id, guildId } });
            profile = await cacheManager.getUserProfile(targetUser.id);
        } catch (error) {
            logger.error('[RANK] Gagal mengakses basis data:', error);
            return sendErrorReply(
                interaction,
                'Naura belum bisa menjangkau basis data. Coba sebentar lagi ya?',
                isSlash
            );
        }

        const level = levelRow ? levelRow.level : 1;
        const xp = levelRow ? levelRow.xp : 0;
        const targetXp = getNextLevelXp(level);

        let localRank = 'N/A';
        if (levelRow) {
            try {
                const higher = await UserLeveling.count({
                    where: { guildId, xp: { [Op.gt]: xp } }
                });
                localRank = `#${higher + 1}`;
            } catch (error) {
                logger.error('[RANK] Gagal menghitung peringkat:', error.message);
            }
        }

        const isPremium = isPremiumActive(profile);
        const roleBadge = getRoleBadge(level, isPremium);

        let card;
        try {
            card = await rankCard.buildCard({
                userId: targetUser.id,
                guildId,
                level,
                xp,
                targetXp,
                render: cosmetics =>
                    CanvasUtils.generateRankCard(
                        targetUser,
                        level,
                        xp,
                        targetXp,
                        localRank,
                        roleBadge,
                        isPremium,
                        cosmetics.bg,
                        cosmetics.border
                    )
            });
        } catch (error) {
            logger.error('[RANK] Gagal merender kartu:', error);
            return sendErrorReply(
                interaction,
                'Naura gagal menggambar kartu kamu. Nanti Naura coba lagi ya!',
                isSlash
            );
        }

        const attachment = new AttachmentBuilder(card.buffer, { name: 'naura-prestige.webp' });
        const accent = isPremium || level >= 50 ? '#FFD700' : ui.getColor('primary');
        const manners = mannersOf(profile, levelRow);

        const payload = buildContainerV2({
            accentColorHex: accent,
            authorName: 'Kartu Prestise',
            title: `Kartu Rank ${targetUser.username}`,
            iconURL: targetUser.displayAvatarURL(),
            expression: 'achievement',
            fields: [
                {
                    name: 'Sertifikat Registrasi',
                    value:
                        `Wilayah tersinkron dengan **${interaction.guild.name}**\n` +
                        `Poin tata krama: **${manners}/${DEFAULT_MANNERS}**\n` +
                        `Peringkat server: **${localRank}** dengan gelar **${roleBadge}**`
                }
            ],
            bannerAttachmentName: 'naura-prestige.webp',
            footerText: ui.getFooter('core')
        });

        payload.files = [attachment];

        if (isSlash) return interaction.editReply(payload);
        return interaction.reply(payload);
    }
};
