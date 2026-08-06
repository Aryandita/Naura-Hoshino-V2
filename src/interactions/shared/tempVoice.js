'use strict';

/**
 * Konteks bersama untuk panel Temp Voice.
 *
 * Pemeriksaan kepemilikan sebelumnya tersalin di beberapa tempat. Sekarang hanya
 * ada satu.
 */

const { PermissionFlagsBits } = require('discord.js');
const UserProfile = require('../../models/UserProfile');
const env = require('../../config/env');

/**
 * MASALAH YANG BELUM DISELESAIKAN (lihat issue #22).
 *
 * Kepemilikan ruangan ditentukan dari nama channel yang mengandung username
 * pembuatnya. Ini rapuh dan bisa dieksploitasi:
 *
 *   - Pengguna bernama "a" cocok dengan hampir semua nama ruangan.
 *   - Mengganti nama ruangan lewat tombol Rename bisa membuat pemilik aslinya
 *     kehilangan akses ke panelnya sendiri.
 *   - Siapa pun yang mengganti nama tampilannya agar mengandung nama pemilik
 *     bisa mengambil alih panel.
 *
 * Perbaikan sebenarnya adalah peta `channelId -> ownerId` yang ditulis oleh
 * voiceStateUpdate saat ruangan dibuat. Itu menyentuh berkas lain dan sengaja
 * tidak dicampur ke dalam refactor ini. Dengan dipusatkan di sini, perbaikannya
 * nanti cukup mengganti isi satu fungsi.
 */
function isRoomOwner(channel, user) {
    return channel.name.includes(user.username);
}

/**
 * Kumpulkan seluruh informasi yang dibutuhkan panel Temp Voice.
 *
 * @returns {Promise<{channel, isAdmin, isBotOwner, isPremium, isPrivileged}|null>}
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
        isOwner: isRoomOwner(channel, interaction.user),
        // Boleh memakai fitur premium panel.
        isPrivileged: isPremium || isBotOwner || isAdmin
    };
}

const PREMIUM_ONLY = (feature) =>
    `\ud83d\udc51 **Fitur Eksklusif!** ${feature} hanya untuk pengguna Premium.`;

module.exports = { resolveVoiceContext, isRoomOwner, PREMIUM_ONLY };
