// Pembuatan kartu tier premium. Sebelumnya blok ini ditulis dua kali dengan
// isi yang identik di subcommand info dan check.
const { AttachmentBuilder } = require('discord.js');
const { CanvasUtils } = require('../../plugin/canvas/Canvas');
const { logger } = require('../../src/managers/logger');

function toBuffer(canvas) {
    if (!canvas) return null;
    if (typeof canvas.encodeSync === 'function') return canvas.encodeSync('png');
    if (typeof canvas.toBuffer === 'function') return canvas.toBuffer('image/png');
    return null;
}

// Mengembalikan AttachmentBuilder, atau null bila kanvas gagal dibuat.
// Kegagalan di sini tidak boleh menjatuhkan command, cukup tanpa gambar.
async function buildTierCard(user, tierData, isPremium, daysLeft, premiumUntil, fileName) {
    try {
        const canvas = await CanvasUtils.generatePremiumTierCard(
            user,
            tierData,
            isPremium,
            daysLeft,
            isPremium ? premiumUntil : null
        );

        const buffer = toBuffer(canvas);
        if (!buffer) return null;

        return new AttachmentBuilder(buffer, { name: fileName });
    } catch (error) {
        logger.warn(`[Premium Card] Gagal membuat kartu tier: ${error.message}`);
        return null;
    }
}

module.exports = { buildTierCard, toBuffer };
