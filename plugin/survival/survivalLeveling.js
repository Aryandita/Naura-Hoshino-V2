// Lokasi: src/utils/survivalLeveling.js
const UserSurvival = require('../../src/models/UserSurvival');

// Gunakan fungsi murni agar tidak terkena error "this" context
function getExpRequirement(level) {
    // Memastikan input adalah angka (Integer)
    const lvl = parseInt(level) || 1;
    return lvl * lvl * 100;
}

function getMaxStatCap(level) {
    const lvl = parseInt(level) || 1;
    return lvl * 5;
}

async function addPlayerXP(userId, xpAmount) {
    const cacheManager = require('../../src/managers/cacheManager');
    const survival = await cacheManager.getUserSurvival(userId);

    const diffHelper = require('./difficultyHelper');
    const diffConfig = diffHelper.getDifficultyConfig(survival?.rpg_state?.difficulty || 'Normal');

    // ✨ FIX: Mengunci tipe data menjadi Integer agar tidak tergabung sebagai Teks
    let currentLevel = parseInt(survival?.survival_level) || 1;
    let currentXP = parseInt(survival?.survival_xp) || 0;

    let totalXpAdded = parseInt(xpAmount);
    if (xpAmount > 0) totalXpAdded = Math.floor(totalXpAdded * diffConfig.expMultiplier);

    currentXP += totalXpAdded;

    let reqXP = getExpRequirement(currentLevel);
    let hasLeveledUp = false;

    // ✨ FIX: Potong XP yang berlebih secara berulang sampai sesuai dengan batas level
    while (currentXP >= reqXP) {
        currentXP -= reqXP; // Sisa XP akan dibawa ke level berikutnya
        currentLevel++;
        hasLeveledUp = true;
        reqXP = getExpRequirement(currentLevel);
    }

    await cacheManager.updateUserSurvival(userId, {
        survival_xp: currentXP,
        survival_level: currentLevel
    });

    return {
        currentLevel,
        currentXP,
        reqXP,
        hasLeveledUp,
        maxStatCap: getMaxStatCap(currentLevel)
    };
}

module.exports = {
    getExpRequirement,
    getMaxStatCap,
    addPlayerXP
};
