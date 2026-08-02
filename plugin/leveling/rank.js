/**
 * @namespace: src/commands/utility/rank.js
 * @type: Command
 * @copyright © 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.0.1
 * @description Menampilkan kartu profil level lokal (per-server) yang mewah & terstruktur.
 */

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const { Op } = require('sequelize'); // Diperlukan untuk kalkulasi ranking
const { CanvasUtils } = require('../../plugin/canvas/Canvas');
const UserLeveling = require('../../src/models/UserLeveling');
const UserProfile = require('../../src/models/UserProfile');
const UserCosmetic = require('../../src/models/UserCosmetic');
const CanvasAsset = require('../../src/models/CanvasAsset');
const { getNextLevelXp } = require('../../plugin/leveling/leveling');
const ui = require('../../src/config/ui');

module.exports = {
    // 1. DEFINISI COMMAND (SLASH & PREFIX)
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('🌟 Lihat Kartu Profil Eksklusif dinamis kamu di server ini!')
        .addUserOption(option =>
            option.setName('target').setDescription('Lihat profil milik orang lain').setRequired(false)
        ),
    aliases: ['profile', 'level', 'xp'], // n!rank, n!profile

    async execute(interaction) {
        // --- PRE-EXECUTION SETTINGS ---
        const isSlash = typeof interaction.deferReply === 'function';
        if (isSlash) await interaction.deferReply();

        // Menentukan Target Pengguna
        const targetUser = (interaction.options && typeof interaction.options.getUser === 'function')
            ? interaction.options.getUser('target') || interaction.user
            : interaction.user;

        const guildId = interaction.guild.id;
        const cacheManager = require('../../src/managers/cacheManager');
        const redisManager = require('../../src/managers/redisManager');

        // ==========================================
        // 💾 1. LOGIKA DATABASE (PENGAMBILAN DATA VIA CACHE)
        // ==========================================
        let userData;
        let userProfile;
        try {
            userData = await UserLeveling.findOne({
                where: { userId: targetUser.id, guildId: guildId }
            });
            userProfile = await cacheManager.getUserProfile(targetUser.id);
        } catch (error) {
            logger.error('\x1b[31m[RANK ERROR]\x1b[0m Gagal mengakses MySQL:', error);
            return sendErrorReply(interaction, '❌ Gagal menghubungkan ke database MySQL.', isSlash);
        }

        // ==========================================
        // 📊 2. LOGIKA KALKULASI (NULL GUARD & RANK)
        // ==========================================

        // A. Statistik Level & XP (Default jika data kosong)
        const currentLevel = userData ? userData.level : 1;
        const currentXp = userData ? userData.xp : 0;
        const targetXp = getNextLevelXp(currentLevel);

        // B. Kalkulasi Ranking Lokal (Server Rank)
        let localRank = 'N/A';
        if (userData) {
            // Menghitung berapa banyak user yang XP-nya lebih tinggi
            const higherUsers = await UserLeveling.count({
                where: { guildId: guildId, xp: { [Op.gt]: currentXp } }
            });
            localRank = `#${higherUsers + 1}`;
        }

        // C. Kalkulasi Gelar (Badge) berdasarkan Level
        let roleBadge = '✧ Pendatang Baru';
        if (currentLevel >= 100) roleBadge = '✦ Legenda Abadi ✦';
        else if (currentLevel >= 50) roleBadge = '✧ Pahlawan Senior';
        else if (currentLevel >= 25) roleBadge = '✧ Petualang Tangguh';
        else if (currentLevel >= 10) roleBadge = '✧ Pengembara Berbakat';

        // Premium Override
        const isPremium = userProfile ? userProfile.isPremium : false;
        if (isPremium) roleBadge = '👑 V.I.P Premium';

        // D. Cek Kosmetik Aktif (Background & Border)
        let activeBgUrl = null;
        let activeBorderUrl = null;

        try {
            const activeCosmetics = await UserCosmetic.findAll({
                where: { userId: targetUser.id, isActive: true },
                include: [{ model: CanvasAsset, as: 'asset' }]
            });

            for (const cosmetic of activeCosmetics) {
                if (cosmetic.asset) {
                    if (cosmetic.asset.type === 'background') activeBgUrl = cosmetic.asset.url;
                    if (cosmetic.asset.type === 'border') activeBorderUrl = cosmetic.asset.url;
                }
            }
        } catch (err) {
            logger.error('[RANK] Gagal mengambil data kosmetik:', err);
        }

        // ==========================================
        // 🖼️ 3. LOGIKA GRAFIS (GENERATOR CANVAS / CACHE)
        // ==========================================
        let imageBuffer;
        const rankCardCacheKey = `rank:card:${targetUser.id}:${guildId}:${currentXp}`;
        try {
            const cachedBufferBase64 = await redisManager.getCache(rankCardCacheKey);
            if (cachedBufferBase64) {
                imageBuffer = Buffer.from(cachedBufferBase64, 'base64');
            } else {
                // Memanggil fungsi generateRankCard (ANTI TABRAKAN)
                const canvas = await CanvasUtils.generateRankCard(
                    targetUser, currentLevel, currentXp, targetXp, localRank, roleBadge, isPremium, activeBgUrl, activeBorderUrl
                );

                // Konversi Canvas ke Buffer (Mendukung @napi-rs/canvas)
                if (canvas && typeof canvas.encodeSync === 'function') {
                    imageBuffer = canvas.encodeSync('webp');
                } else if (canvas && typeof canvas.toBuffer === 'function') {
                    imageBuffer = canvas.toBuffer('image/png');
                } else {
                    imageBuffer = canvas; // Asumsi sudah berupa buffer
                }

                // Cache rank card buffer selama 5 menit (300 detik)
                if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
                    await redisManager.setCache(rankCardCacheKey, imageBuffer.toString('base64'), 300);
                }
            }

        } catch (error) {
            logger.error('\x1b[31m[RANK CANVAS ERROR]\x1b[0m Gagal merender:', error);
            return sendErrorReply(interaction, '❌ Gagal merender grafis kartu profil.', isSlash);
        }

        const attachment = new AttachmentBuilder(imageBuffer, { name: 'naura-prestige.webp' });

        // ==========================================
        // 🖥️ 4. LOGIKA UI (EMBED ASSEMBLY & SEND)
        // ==========================================
        // ==========================================
        // 🖥️ 4. LOGIKA UI (COMPONENTS V2 ASSEMBLY & SEND)
        // ==========================================
        const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
        const embedColor = isPremium ? '#FFD700' : (currentLevel >= 50 ? '#FFD700' : (ui.getColor ? ui.getColor('primary') : '#00FFFF'));

        const payload = buildContainerV2({
            accentColorHex: embedColor,
            authorName: '✦   𝐏 𝐑 𝐄 𝐒 𝐓 𝐈 𝐆 𝐄   𝐏 𝐑 𝐎 𝐅 𝐈 𝐋 𝐄   ✦',
            title: `🌟 Kartu Rank ${targetUser.username}`,
            iconURL: targetUser.displayAvatarURL(),
            fields: [
                { name: '📜 Sertifikat Registrasi', value: `\`Status Wilayah: Tersinkronisasi dengan ${interaction.guild.name}\`\n🛡️ \`Poin Tata Krama: ${userData ? (userData.mannersPoint !== undefined ? userData.mannersPoint : 100) : 100}/100\`` }
            ],
            bannerAttachmentName: 'naura-prestige.webp',
            footerText: ui.getFooter('core')
        });

        payload.files = [attachment];

        // Pengiriman Akhir
        if (isSlash) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply(payload);
        }
    }
};

// --- FUNGSI UTILITAS LOKAL (HELPER) ---
function sendErrorReply(interaction, message, isSlash) {
    const { buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
    const errPayload = buildErrorContainerV2({ title: 'Gagal', description: message, footerText: ui.getFooter('core') });
    if (isSlash) return interaction.editReply(errPayload).catch(() => { });
    return interaction.reply(errPayload).catch(() => { });
}
