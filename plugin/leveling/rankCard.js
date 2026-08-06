// Perakitan kartu rank: kosmetik aktif, kunci cache, dan penyangga gambar.

const { logger } = require('../../src/managers/logger');
const redisManager = require('../../src/managers/redisManager');
const UserCosmetic = require('../../src/models/UserCosmetic');
const CanvasAsset = require('../../src/models/CanvasAsset');

const CARD_TTL = 300;
const BAR_STEPS = 20; // Petak lima persen

// Mengambil latar dan bingkai yang sedang dipakai. Kegagalan di sini tidak
// boleh menggagalkan kartu, cukup kembali ke tampilan bawaan.
async function activeCosmetics(userId) {
    const result = { bg: null, border: null };

    try {
        const rows = await UserCosmetic.findAll({
            where: { userId, isActive: true },
            include: [{ model: CanvasAsset, as: 'asset' }]
        });

        for (const row of rows) {
            if (!row.asset) continue;
            if (row.asset.type === 'background') result.bg = row.asset.url;
            if (row.asset.type === 'border') result.border = row.asset.url;
        }
    } catch (err) {
        logger.error('[Rank] Gagal mengambil kosmetik:', err.message);
    }

    return result;
}

// Kunci cache sengaja tidak memuat XP mentah. Bar yang terlihat sama boleh
// memakai kartu yang sama, dan pergantian kosmetik wajib menembus cache.
function cacheKey(userId, guildId, level, xp, targetXp, cosmetics) {
    const step = targetXp > 0 ? Math.floor((xp / targetXp) * BAR_STEPS) : 0;
    const skin = [cosmetics.bg || 'default', cosmetics.border || 'default'].join('|');
    let fingerprint = 0;

    for (let i = 0; i < skin.length; i += 1) {
        fingerprint = (fingerprint * 31 + skin.charCodeAt(i)) % 1000000007;
    }

    return `rank:card:${userId}:${guildId}:${level}:${step}:${fingerprint}`;
}

function toBuffer(canvas) {
    if (canvas && typeof canvas.encodeSync === 'function') return canvas.encodeSync('webp');
    if (canvas && typeof canvas.toBuffer === 'function') return canvas.toBuffer('image/png');
    return canvas;
}

async function readCache(key) {
    try {
        const cached = await redisManager.getCache(key);
        return cached ? Buffer.from(cached, 'base64') : null;
    } catch (e) {
        return null;
    }
}

async function writeCache(key, buffer) {
    if (!buffer || !Buffer.isBuffer(buffer)) return;
    try {
        await redisManager.setCache(key, buffer.toString('base64'), CARD_TTL);
    } catch (e) {
        // Cache gagal ditulis bukan alasan menggagalkan kartu.
    }
}

/**
 * Menghasilkan penyangga gambar kartu rank, memakai cache bila tersedia.
 * @param {object} args - render adalah fungsi yang menerima kosmetik.
 */
async function buildCard(args) {
    const { userId, guildId, level, xp, targetXp, render } = args;

    const cosmetics = await activeCosmetics(userId);
    const key = cacheKey(userId, guildId, level, xp, targetXp, cosmetics);

    const cached = await readCache(key);
    if (cached) return { buffer: cached, cosmetics, cached: true };

    const buffer = toBuffer(await render(cosmetics));
    await writeCache(key, buffer);

    return { buffer, cosmetics, cached: false };
}

module.exports = { activeCosmetics, cacheKey, toBuffer, buildCard, CARD_TTL, BAR_STEPS };
