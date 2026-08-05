'use strict';

// Urusan tiket masuk, hadiah kemenangan, dan akibat kekalahan di Infinite
// Dungeon. Dipisahkan dari subcommand supaya alur tombolnya tetap ringkas.

const UserQuest = require('../../src/models/UserQuest');
const cacheManager = require('../../src/managers/cacheManager');
const { safeParseInventory } = require('./inventoryHelper');
const helpers = require('./craftHelpers');
const currency = require('./currency');
const { rollCouponDrop, dropLine } = require('./couponRewards');
const leveling = require('./survivalLeveling');
const { advanceTime } = require('./survivalTime');
const combat = require('./dungeonCombat');
const { DUNGEON_PASS_ID, DUNGEON_SPECIAL_PASS_ID, SPECIAL_MULTIPLIER } = require('./items_dungeon');

const KO_HOURS = 4;
const CLEAR_HOURS = 1;

function availablePasses(inventory) {
    return {
        normal: helpers.countItem(inventory, DUNGEON_PASS_ID),
        special: helpers.countItem(inventory, DUNGEON_SPECIAL_PASS_ID)
    };
}

function multiplierOf(passId) {
    return passId === DUNGEON_SPECIAL_PASS_ID ? SPECIAL_MULTIPLIER : 1;
}

// Tiket dipotong tepat sebelum pertempuran dimulai. Dulu tiket hanya diperiksa
// dan tidak pernah berkurang, jadi satu tiket bisa dipakai selamanya.
async function consumePass(userId, passId) {
    const profile = await cacheManager.getUserProfile(userId);
    const inventory = safeParseInventory(profile.inventory);

    if (!helpers.takeItem(inventory, passId, 1)) return { ok: false, reason: 'no_pass' };

    await cacheManager.updateUserProfile(userId, { inventory });
    return { ok: true, passId, multiplier: multiplierOf(passId) };
}

async function bumpDungeonQuest(userId) {
    try {
        const { incrementQuestProgress } = require('./questGenerator');
        await incrementQuestProgress(userId, 'dungeon');

        const today = new Date().toISOString().split('T')[0];
        const [quest] = await UserQuest.findOrCreate({ where: { userId }, defaults: { lastReset: today } });
        if (quest.lastReset !== today) {
            quest.workCount = 0;
            quest.dungeonKills = 0;
            quest.collectCount = 0;
            quest.isClaimed = false;
            quest.lastReset = today;
        }
        quest.dungeonKills = (quest.dungeonKills || 0) + 1;
        await quest.save();
    } catch (err) {
        // Misi harian hanya pelengkap; kegagalannya tidak boleh membatalkan hadiah.
    }
}

// Menang: jarahan masuk tas, lantai naik, upah dibayar dalam Naura Star Fragment
// karena guanya berada di wilayah desa, lalu peluang Naura Coupon dilempar.
async function grantVictory({ userId, survival, floor, diffConfig, stats, multiplier, playerHp }) {
    await bumpDungeonQuest(userId);

    const isBoss = floor % combat.BOSS_EVERY === 0;
    const reward = combat.rewardsFor(floor, diffConfig, multiplier);
    const loot = combat.rollLoot(floor, stats.luck, multiplier);

    const profile = await cacheManager.getUserProfile(userId);
    const inventory = safeParseInventory(profile.inventory);
    for (const item of loot) helpers.addItem(inventory, item.id, item.amount);

    await cacheManager.updateUserProfile(userId, {
        inventory,
        dungeon_floor: floor + 1
    });

    const hpLeft = Math.max(1, playerHp);
    await cacheManager.updateUserSurvival(userId, { hp: hpLeft });
    survival.hp = hpLeft;

    const balance = await currency.reward(currency.FRAGMENT, { survival, profile }, reward.money);
    await advanceTime(userId, CLEAR_HOURS);
    await leveling.addPlayerXP(userId, reward.xp);

    const coupon = await rollCouponDrop(isBoss ? 'dungeon_boss' : 'dungeon_clear', { survival });

    const lootText = loot.length > 0
        ? loot.map(item => '- **' + item.name + '** x' + item.amount).join('\n')
        : '*Kali ini tidak ada yang tertinggal. Naura sudah periksa setiap sudut, kok!*';

    return {
        reward,
        loot,
        lootText,
        balance,
        couponText: dropLine(coupon),
        nextFloor: floor + 1,
        isBoss
    };
}

// Kalah: pemain diseret keluar gua, pulang ke desa dengan HP sisa satu.
async function applyDefeat(userId) {
    await cacheManager.updateUserSurvival(userId, { hp: 1, currentLocation: 'desa' });
    await advanceTime(userId, KO_HOURS);
}

async function applyFleePenalty(userId, playerHp, floor) {
    const penalty = Math.floor(10 + floor * 2);
    const hpLeft = Math.max(1, playerHp - penalty);
    await cacheManager.updateUserSurvival(userId, { hp: hpLeft });
    return { penalty, hpLeft };
}

module.exports = {
    KO_HOURS,
    CLEAR_HOURS,
    availablePasses,
    multiplierOf,
    consumePass,
    grantVictory,
    applyDefeat,
    applyFleePenalty
};
