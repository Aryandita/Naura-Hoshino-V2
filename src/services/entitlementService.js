'use strict';

const { getUserProfile } = require('../managers/cacheManager');
const env = require('../config/env');

/**
 * Entitlement Service
 * 
 * Abstraksi agnostik-sumber untuk mengecek hak akses premium/VIP pengguna.
 * Ke depannya, jika Discord Entitlements native diaktifkan, kita hanya perlu 
 * menambahkan adapternya ke sini tanpa menyentuh command yang membutuhkan VIP.
 */
class EntitlementService {
    /**
     * Memeriksa apakah seorang pengguna memiliki akses premium.
     * @param {string} userId - ID Pengguna Discord
     * @returns {Promise<boolean>}
     */
    static async isUserPremium(userId) {
        if (!userId) return false;

        // 1. Cek apakah user adalah owner bot (Owner selalu memiliki akses VIP)
        if (env.OWNER_IDS && env.OWNER_IDS.includes(userId)) {
            return true;
        }

        // 2. Cek status premium dari database (via Saweria/Trakteer)
        try {
            const profile = await getUserProfile(userId);
            if (profile && profile.isPremium) {
                // Opsional: Jika kita menerapkan expiredDate ke depannya, 
                // cek apakah tanggal saat ini <= expiredDate
                if (profile.premiumUntil) {
                    return new Date() <= new Date(profile.premiumUntil);
                }
                return true;
            }
        } catch (e) {
            // Abaikan error cache, anggap tidak premium
        }

        // 3. Tambahkan adapter lain di sini nanti (misal: cek role khusus di server dukungan)

        return false;
    }

    /**
     * Memeriksa apakah sebuah guild memiliki akses premium.
     * @param {string} guildId - ID Guild
     * @returns {Promise<boolean>}
     */
    static async isGuildPremium(guildId) {
        if (!guildId) return false;
        
        // TODO: Menerapkan langganan level server (Server Boosts)
        return false;
    }
}

module.exports = EntitlementService;
