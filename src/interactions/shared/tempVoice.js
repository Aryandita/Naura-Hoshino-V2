'use strict';

/**
 * Konteks bersama untuk panel Temp Voice.
 *
 * Pemeriksaan kepemilikan sebelumnya tersalin di beberapa tempat. Sekarang hanya
 * ada satu.
 */

const { PermissionFlagsBits } = require('discord.js');
const UserProfile = require('../../models/UserProfile');
const tempVoiceRegistry = require('../../managers/tempVoiceRegistry');
const { logger } = require('../../managers/logger');
const env = require('../../config/env');

/**
 * Pemeriksaan kepemilikan berbasis nama channel.
 *
 * Ini cara lama dan cara ini salah. Dibiarkan hidup hanya sebagai jembatan
 * transisi: ruangan yang sudah aktif saat versi ini di-deploy belum punya entri
 * di registry, dan pemiliknya tidak boleh mendadak terkunci dari panelnya
 * sendiri di tengah sesi.
 *
 * Hapus fungsi ini setelah beberapa hari berjalan, saat sudah tidak ada lagi
 * ruangan warisan yang hidup.
 */
function isRoomOwnerByName(channel, user) {
    return channel.name.includes(user.username);
}

/**
 * Versi sinkron, hanya membaca memori.
 *
 * Dipertahankan karena tanda tangannya sudah dipakai di tempat lain. Mengubah
 * fungsi sinkron menjadi async itu berbahaya di sini: pemanggil yang lupa
 * `await` akan menerima Promise, dan Promise selalu truthy. Artinya setiap
 * pemeriksaan izin yang terlewat akan otomatis lolos, bukan gagal.
 */
function isRoomOwner(channel, user) {
    const known = tempVoiceRegistry.isOwnerSync(channel.id, user.id);
    if (known !== null) return known;
    return isRoomOwnerByName(channel, user);
}

/**
 * Versi asli yang juga memeriksa Redis.
 *
 * Ini jalur yang benar setelah bot restart, karena entri registry sudah tidak
 * ada di memori tapi masih tersimpan di Redis.
 */
async function resolveRoomOwner(channel, user) {
    const known = await tempVoiceRegistry.isOwner(channel.id, user.id);
    if (known !== null) return known;

    const legacy = isRoomOwnerByName(channel, user);
    if (legacy) {
        logger.warn(
            `[TempVoice] Ruangan ${channel.id} tidak ada di registry, jatuh ke pencocokan nama untuk ${user.id}. Ruangan warisan sebelum registry aktif.`
        );
    }
    return legacy;
}

/**
 * Kumpulkan seluruh informasi yang dibutuhkan panel Temp Voice.
 *
 * @returns {Promise<{channel, isAdmin, isBotOwner, isPremium, isOwner, isPrivileged}|null>}
 *          null bila pengguna tidak sedang berada di voice channel.
 */
async function resolveVoiceContext(interaction) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) return null;

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
    const isBotOwner = Boolean(env.OWNER_IDS?.includes(interaction.user.id));

    let isPremium = false;
    try {
        const profile = await UserProfile.findOne({ where: { userId: interaction.user.id } });
        isPremium = Boolean(profile?.isPremium);
    } catch (error) {
        // Kegagalan membaca profil tidak boleh mematikan panel. Pengguna hanya
        // kehilangan akses ke fitur premium untuk sesaat.
        isPremium = false;
    }

    return {
        channel,
        isAdmin,
        isBotOwner,
        isPremium,
        isOwner: await resolveRoomOwner(channel, interaction.user),
        // Boleh memakai fitur premium panel.
        isPrivileged: isPremium || isBotOwner || isAdmin
    };
}

const PREMIUM_ONLY = (feature) =>
    `\ud83d\udc51 **Fitur Eksklusif!** ${feature} hanya untuk pengguna Premium.`;

module.exports = { resolveVoiceContext, isRoomOwner, resolveRoomOwner, PREMIUM_ONLY };
