'use strict';

/**
 * Server webhook Naura (port terpisah dari dashboard).
 *
 * Vote top.gg, Saweria, dan Trakteer memakai helper bersama supaya aturan
 * premium hanya ditulis sekali.
 */

const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { logger } = require('../../managers/logger');
const UserProfile = require('../../models/UserProfile');
const ui = require('../../config/ui');
const { grantVoteRewards, extendPremium } = require('../utils/voteRewards');

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

/** Kirim DM. Gagal DM tidak boleh menggagalkan webhook. */
async function notifyUser(client, userId, embed, tag) {
    try {
        const userObj = await client.users.fetch(userId);
        await userObj.send({ embeds: [embed] });
        return true;
    } catch {
        logger.info(`[WEBHOOK ${tag}] DM ke ${userId} gagal: DM-nya tertutup.`);
        return false;
    }
}

function checkToken(req, envKey, headerNames) {
    const expected = process.env[envKey];
    if (!expected) return null; // null = belum dikonfigurasi
    const received = headerNames.map((h) => req.headers[h]).find(Boolean);
    return received === expected;
}

module.exports = (client) => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ================= VOTE TOP.GG =================
    // top.gg mengirim { bot, user, type: 'upvote'|'test', isWeekend, query }
    // dengan header Authorization berisi secret yang kamu pasang di top.gg.
    app.post('/api/webhook/vote', async (req, res) => {
        const tokenState = checkToken(req, 'WEBHOOK_AUTH_VOTE', ['authorization']);

        // Tanpa secret, siapa pun bisa mengklaim hadiah vote. Endpoint ditutup.
        if (tokenState === null) {
            logger.warn('[WEBHOOK VOTE] WEBHOOK_AUTH_VOTE belum diisi, permintaan vote ditolak.');
            return res.status(503).send('Vote webhook is not configured');
        }
        if (tokenState === false) {
            logger.warn('[WEBHOOK VOTE] Token vote tidak cocok, permintaan ditolak.');
            return res.status(401).send('Unauthorized');
        }

        const body = req.body || {};
        const userId = body.user;
        if (!userId) return res.status(400).send('Missing user ID');

        // Tombol "Send Test" di dasbor top.gg tidak boleh memberi hadiah nyata.
        if (body.type === 'test') {
            logger.info(`[WEBHOOK VOTE] Uji coba top.gg diterima untuk ${userId}.`);
            return res.status(200).send('Test webhook received');
        }

        try {
            const isWeekend = body.isWeekend === true || body.isWeekend === 'true';
            const result = await grantVoteRewards(userId, { isWeekend });

            if (!result.ok) {
                logger.info(`[WEBHOOK VOTE] Vote ${userId} dilewati (${result.reason}).`);
                return res.status(200).send(`OK: skipped (${result.reason})`);
            }

            const userObj = await client.users.fetch(userId).catch(() => null);
            const couponEmoji = ui.getEmoji('coupon') || '\uD83C\uDF9F\uFE0F';

            const embed = new EmbedBuilder()
                .setColor(ui.getColor('economy') || '#FFD700')
                .setTitle(`${ui.getEmoji('naura_cheers') || '\uD83C\uDF89'} Makasih banyak sudah vote Naura!`)
                .setDescription(
                    `Hai ${userObj?.username || 'kamu'}! Naura seneng banget kamu masih menyempatkan waktu buat vote hari ini.\n\n` +
                    `Ini hadiah dari Naura ya:\n` +
                    `\u2728 **Trial V.I.P Premium 12 jam**\n` +
                    `${couponEmoji} **${result.coupons} Naura Coupon**${isWeekend ? ' (bonus akhir pekan, dobel!)' : ''}\n\n` +
                    `Total kuponmu sekarang **${result.totalCoupons}**. Kupon ini bisa kamu tukar dengan barang langka seperti peralatan Obsidian, lho!\n\n` +
                    `\u23F3 **Premium aktif sampai:** <t:${Math.floor(result.expiry.getTime() / 1000)}:R>\n` +
                    `\uD83D\uDCC5 **Vote ke-${result.streak}.** Jangan lupa balik lagi 12 jam lagi ya!`
                )
                .setFooter({ text: 'Naura Hoshino Auto-Vote System' });

            await notifyUser(client, userId, embed, 'VOTE');
            return res.status(200).send('Vote recorded successfully');
        } catch (error) {
            logger.error('[WEBHOOK ERROR] Vote:', error);
            return res.status(500).send('Internal Server Error');
        }
    });

    // ================= DONASI =================
    /** Pabrik handler donasi agar Saweria & Trakteer memakai alur yang sama. */
    function donationHandler({ tag, envKey, headerNames, readAmount, readMessage, readName, label }) {
        return async (req, res) => {
            if (checkToken(req, envKey, headerNames) === false) {
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
                const expiry = await extendPremium(userId, tier.days * 24 * 60 * 60 * 1000);
                const embed = new EmbedBuilder()
                    .setColor(ui.getColor('economy') || '#FFD700')
                    .setTitle(`${ui.getEmoji('naura_impressed') || '\uD83D\uDC96'} Dukungan ${label} kamu sudah Naura terima!`)
                    .setDescription(
                        `Terima kasih banyak **${donatorName}** atas dukungannya (Rp ${amount.toLocaleString('id-ID')})!\n\n` +
                        'Status **Premium Naura** kamu langsung Naura aktifkan.\n\n' +
                        `\uD83D\uDCE6 **Paket aktif:** ${tier.name}\n` +
                        `\u23F3 **Berlaku sampai:** <t:${Math.floor(expiry.getTime() / 1000)}:F>`
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

    // Penanda sehat untuk memastikan port webhook benar-benar terbuka.
    app.get('/api/webhook/health', (req, res) => res.status(200).json({ ok: true }));

    const port = process.env.WEBHOOK_PORT || 3071;
    app.listen(port, () => {
        logger.info(`[WEBHOOK] Server webhook berjalan di port ${port}`);
    });

    return app;
};

module.exports.DONATION_TIERS = DONATION_TIERS;
module.exports.resolveTier = resolveTier;
module.exports.extractDiscordId = extractDiscordId;

// UserProfile tetap diekspor untuk pengujian manual di REPL.
module.exports.UserProfile = UserProfile;
