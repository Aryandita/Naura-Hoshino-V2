'use strict';

/**
 * Server webhook Naura (port terpisah dari dashboard).
 *
 * Tiga penyedia (vote, Saweria, Trakteer) dulunya punya blok kode yang nyaris
 * identik sepanjang ratusan baris. Semuanya kini memakai satu helper
 * `grantPremium()` sehingga perubahan aturan premium cukup dilakukan sekali.
 */

const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { logger } = require('../../managers/logger');
const UserProfile = require('../../models/UserProfile');
const ui = require('../../config/ui');

// Tangga donasi: nominal minimal -> lama premium.
const DONATION_TIERS = [
    { min: 75000, days: 365, name: 'Naura Bestie (1 Tahun)' },
    { min: 50000, days: 180, name: 'Naura Friends (6 Bulan)' },
    { min: 35000, days: 30, name: 'Naura Supporter (1 Bulan)' }
];

function resolveTier(amount) {
    return DONATION_TIERS.find((tier) => amount >= tier.min) || null;
}

function extractDiscordId(text) {
    const match = String(text || '').match(/\b\d{17,19}\b/);
    return match ? match[0] : null;
}

/**
 * Perpanjang premium seorang pengguna secara aman di dalam transaksi.
 * Bila premium masih aktif, durasi ditambahkan; bila tidak, dihitung dari sekarang.
 */
async function grantPremium(userId, durationMs) {
    const { sequelize } = require('../../managers/dbManager');
    let newExpiry = new Date();

    await sequelize.transaction(async (t) => {
        const [profile] = await UserProfile.findOrCreate({
            where: { userId },
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        const stillActive = profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date();
        const base = stillActive ? profile.premiumUntil.getTime() : Date.now();
        newExpiry = new Date(base + durationMs);

        profile.isPremium = true;
        profile.premiumUntil = newExpiry;
        await profile.save({ transaction: t });
    });

    return newExpiry;
}

/** Kirim DM ucapan terima kasih. Gagal DM tidak boleh menggagalkan webhook. */
async function notifyUser(client, userId, embed, tag) {
    try {
        const userObj = await client.users.fetch(userId);
        await userObj.send({ embeds: [embed] });
    } catch {
        logger.info(`[WEBHOOK ${tag}] Naura tidak bisa mengirim DM ke ${userId}: DM tertutup.`);
    }
}

function checkToken(req, envKey, headerNames) {
    const expected = process.env[envKey];
    if (!expected) return true;
    const received = headerNames.map((h) => req.headers[h]).find(Boolean);
    return received === expected;
}

module.exports = (client) => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // --- Vote di server list: hadiah trial premium 12 jam ---
    app.post('/api/webhook/vote', async (req, res) => {
        if (!checkToken(req, 'WEBHOOK_AUTH_VOTE', ['authorization'])) {
            return res.status(401).send('Unauthorized');
        }

        const userId = req.body?.user;
        if (!userId) return res.status(400).send('Missing user ID');

        try {
            const expiry = await grantPremium(userId, 12 * 60 * 60 * 1000);
            const userObj = await client.users.fetch(userId).catch(() => null);
            const embed = new EmbedBuilder()
                .setColor(ui.getColor('economy') || '#FFD700')
                .setTitle(`${ui.getEmoji('naura_cheers') || '🎉'} Makasih banyak sudah memilih Naura!`)
                .setDescription(
                    `Hai ${userObj?.username || 'kamu'}! Naura senang banget kamu menyempatkan vote hari ini.\n\n` +
                    'Sebagai tanda terima kasih, Naura kasih **Trial V.I.P Premium selama 12 jam** ya!\n\n' +
                    `⏳ **Aktif sampai:** <t:${Math.floor(expiry.getTime() / 1000)}:R>`
                )
                .setFooter({ text: 'Naura Hoshino Auto-Vote System' });

            if (userObj) await notifyUser(client, userId, embed, 'VOTE');
            return res.status(200).send('Vote recorded successfully');
        } catch (error) {
            logger.error('[WEBHOOK ERROR] Vote:', error);
            return res.status(500).send('Internal Server Error');
        }
    });

    /** Pabrik handler donasi agar Saweria & Trakteer memakai alur yang sama. */
    function donationHandler({ tag, envKey, headerNames, readAmount, readMessage, readName, label }) {
        return async (req, res) => {
            if (!checkToken(req, envKey, headerNames)) {
                return res.status(401).send('Unauthorized');
            }

            const amount = Number(readAmount(req.body || {})) || 0;
            const message = readMessage(req.body || {}) || '';
            const donatorName = readName(req.body || {}) || 'Seseorang';

            if (!amount || !message) return res.status(400).send('Bad Request: Missing Amount or Message');

            const userId = extractDiscordId(message);
            if (!userId) return res.status(200).send('OK: No Discord ID found in message');

            const tier = resolveTier(amount);
            if (!tier) return res.status(200).send('OK: Amount below premium tier');

            try {
                const expiry = await grantPremium(userId, tier.days * 24 * 60 * 60 * 1000);
                const embed = new EmbedBuilder()
                    .setColor(ui.getColor('economy') || '#FFD700')
                    .setTitle(`${ui.getEmoji('naura_impressed') || '💖'} Dukungan ${label} kamu sudah Naura terima!`)
                    .setDescription(
                        `Terima kasih banyak **${donatorName}** atas dukungannya (Rp ${amount.toLocaleString('id-ID')})!\n\n` +
                        'Status **Premium Naura** kamu langsung Naura aktifkan.\n\n' +
                        `📦 **Paket aktif:** ${tier.name}\n` +
                        `⏳ **Berlaku sampai:** <t:${Math.floor(expiry.getTime() / 1000)}:F>`
                    )
                    .setFooter({ text: `Naura Hoshino ${label} System` });

                await notifyUser(client, userId, embed, tag);
                return res.status(200).send('Donation Processed Successfully');
            } catch (error) {
                logger.error(`[WEBHOOK ERROR] ${tag}:`, error);
                return res.status(500).send('Internal Server Error');
            }
        };
    }

    app.post(
        '/api/webhook/saweria',
        donationHandler({
            tag: 'SAWERIA',
            envKey: 'WEBHOOK_AUTH_SAWERIA',
            headerNames: ['saweria-token', 'authorization'],
            readAmount: (b) => b.amount || b.total_amount,
            readMessage: (b) => b.message,
            readName: (b) => b.donator_name || b.donator,
            label: 'Saweria'
        })
    );

    app.post(
        '/api/webhook/trakteer',
        donationHandler({
            tag: 'TRAKTEER',
            envKey: 'WEBHOOK_AUTH_TRAKTEER',
            headerNames: ['x-trakteer-token', 'authorization'],
            readAmount: (b) => b.amount,
            readMessage: (b) => b.supporter_message,
            readName: (b) => b.supporter_name,
            label: 'Trakteer'
        })
    );

    const port = process.env.WEBHOOK_PORT || 3071;
    app.listen(port, () => {
        logger.info(`[WEBHOOK] Server webhook berjalan di port ${port}`);
    });

    return app;
};

module.exports.DONATION_TIERS = DONATION_TIERS;
module.exports.resolveTier = resolveTier;
module.exports.extractDiscordId = extractDiscordId;
