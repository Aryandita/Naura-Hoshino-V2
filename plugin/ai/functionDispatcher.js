'use strict';

const cacheManager = require('../../src/managers/cacheManager');
const { logger } = require('../../src/managers/logger');

const tools = [
    {
        name: 'check_balance',
        description: 'Cek saldo koin dan uang (economy_wallet, economy_bank) milik pengguna.',
        parameters: {
            type: 'OBJECT',
            properties: {}
        }
    },
    {
        name: 'get_user_info',
        description: 'Dapatkan informasi profil pengguna (level, xp, role).',
        parameters: {
            type: 'OBJECT',
            properties: {}
        }
    }
];

async function dispatchFunction(name, args, message) {
    const userId = message.author.id;
    try {
        if (name === 'check_balance') {
            const survival = await cacheManager.getUserSurvival(userId);
            return {
                wallet: survival?.economy_wallet || 0,
                bank: survival?.economy_bank || 0,
                coupons: survival?.coupons || 0,
                fragments: survival?.starFragments || 0
            };
        }
        if (name === 'get_user_info') {
            const profile = await cacheManager.getUserProfile(userId);
            return {
                username: message.author.username,
                level: profile?.level || 1,
                xp: profile?.xp || 0,
                language: profile?.language || 'id',
                isPremium: profile?.isPremium || false
            };
        }
    } catch (e) {
        logger.error(`[AI Function] Gagal menjalankan ${name}:`, e.message);
        return { error: 'Terjadi kesalahan sistem saat mengeksekusi fungsi.' };
    }
    return { error: 'Fungsi tidak ditemukan.' };
}

module.exports = {
    tools,
    dispatchFunction
};
