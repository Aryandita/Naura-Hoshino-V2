'use strict';

// Perhitungan data profil survival. Dipisah dari subcommand info supaya
// tampilannya mudah disunting tanpa menyentuh rumus level, stat, dan saldo.

const ui = require('../../src/config/ui');
const leveling = require('./survivalLeveling');
const currencyHelper = require('./currency');
const { getTimeState } = require('./survivalTime');
const { safeParseInventory } = require('./inventoryHelper');
const { perksOf } = require('./specialEffects');

const LOCATION_NAMES = {
    desa: 'Desa Pemula',
    village: 'Desa Pemula',
    jalanan: 'Pinggir Jalan',
    kota: 'Kota Naura',
    city: 'Kota Naura',
    hutan: 'Hutan Pinus',
    laut: 'Pantai Selatan',
    pantai: 'Pantai Selatan',
    sawah: 'Sawah Desa',
    tambang: 'Tambang Kuno',
    academy: 'Naura Academy',
    park: 'Amusement Park',
    prison: 'Penjara Kota'
};

const PROPERTY_NAMES = {
    jalanan: 'Pinggir Jalan',
    gudang: 'Gudang Tua',
    kos: 'Kos-kosan',
    rumah: 'Rumah Nyaman',
    mansion: 'Mansion Mewah'
};

const DIFF_BADGE = {
    Mudah: 'diff_easy',
    Normal: 'diff_normal',
    Sulit: 'diff_hard',
    Ekstrim: 'diff_extreme'
};

const PET_BONUS = {
    wolf: { strength: 2, note: '+2 Strength' },
    cat: { luck: 2, note: '+2 Luck' },
    dragon: { strength: 3, luck: 1, note: '+3 Strength, +1 Luck' }
};

function e(name, fallback) {
    return ui.getEmoji(name) || fallback || '';
}

/** Level dan XP, sekaligus memperbaiki XP yang menumpuk karena bug lama. */
async function resolveLeveling(userId, survival) {
    let level = parseInt(survival.survival_level, 10) || 1;
    let xp = parseInt(survival.survival_xp, 10) || 0;
    let reqXP = leveling.getExpRequirement(level);

    if (xp >= reqXP) {
        const fixed = await leveling.addPlayerXP(userId, 0);
        level = fixed.currentLevel;
        xp = fixed.currentXP;
        reqXP = fixed.reqXP;
        survival.survival_level = level;
        survival.survival_xp = xp;
    }

    return { level, xp, reqXP, maxStat: leveling.getMaxStatCap(level) };
}

function resolvePet(activePets) {
    if (!Array.isArray(activePets) || activePets.length === 0) {
        return { bonusStrength: 0, bonusLuck: 0, display: 'Belum ada teman setia', name: null };
    }

    const pet = activePets[0];
    const name = pet.petName || pet.petType;
    const bonus = PET_BONUS[pet.petType] || null;

    let display = `${e('pet')} **${name}**`;
    if (bonus) display += `\n> *Efek: ${bonus.note}*`;

    return {
        bonusStrength: bonus?.strength || 0,
        bonusLuck: bonus?.luck || 0,
        display,
        name
    };
}

/** Alat, senjata, dan zirah yang sedang dipegang pemain. */
function resolveGear(inventory) {
    const has = (fn) => inventory.some((it) => it && typeof it.id === 'string' && fn(it.id));
    const armorPieces = inventory.filter((it) => it && typeof it.id === 'string' && /helmet|chestplate|boots/.test(it.id));

    return {
        axe: has((id) => id.includes('axe')),
        pickaxe: has((id) => id.includes('pick')),
        rod: has((id) => id.includes('fishing') || id.includes('rod')),
        sword: has((id) => id.includes('sword') || id.includes('blade')),
        bow: has((id) => id.includes('bow')),
        armorCount: armorPieces.length,
        armorNames: armorPieces.map((it) => it.name || it.id)
    };
}

function resolveWeather(rpgState) {
    const name = rpgState.weather || 'cerah';
    let emoji = e('clear_sky');
    if (name === 'hujan') emoji = e('rain');
    if (name === 'badai') emoji = e('badai');
    return { name, emoji };
}

/** Saldo tiga mata uang sekaligus, lengkap dengan emoji resminya. */
function resolveBalances(survival, profile) {
    const holders = { survival, profile };
    return [currencyHelper.FRAGMENT, currencyHelper.COIN, currencyHelper.COUPON].map((kind) => {
        const currency = currencyHelper.byKind(kind);
        return {
            kind,
            name: currency.name,
            emoji: currencyHelper.emojiOf(currency),
            amount: currencyHelper.balanceOf(currency, holders)
        };
    });
}

async function buildStats({ userId, profile, survival, activePets }) {
    const rpgState = survival.rpg_state || {};
    const inventory = safeParseInventory(profile.inventory);

    const lvl = await resolveLeveling(userId, survival);
    const pet = resolvePet(activePets);
    const gear = resolveGear(inventory);

    const activeStrength = Math.min(survival.strength || 1, lvl.maxStat);
    const maxHp = 100 + Math.floor(lvl.level / 5) * 10 + activeStrength * 10;
    const hp = survival.hp !== undefined && survival.hp !== null ? survival.hp : maxHp;

    const locationKey = survival.currentLocation || 'desa';
    const difficulty = rpgState.difficulty || 'Normal';

    return {
        level: lvl.level,
        xp: lvl.xp,
        reqXP: lvl.reqXP,
        maxStat: lvl.maxStat,
        xpBar: ui.createProgressBar(lvl.xp, lvl.reqXP, 8),
        hp,
        maxHp,
        hpBar: ui.createProgressBar(hp, maxHp, 8),
        hungerBar: ui.createProgressBar(survival.hunger || 0, 100, 8),
        thirstBar: ui.createProgressBar(survival.thirst || 0, 100, 8),
        staminaBar: ui.createProgressBar(survival.stamina || 0, 100, 8),
        pet,
        gear,
        balances: resolveBalances(survival, profile),
        perks: perksOf(survival),
        rpgState,
        difficulty,
        difficultyEmoji: e(DIFF_BADGE[difficulty] || 'diff_normal'),
        rebirthCount: rpgState.rebirth_count || 0,
        locationName: LOCATION_NAMES[locationKey] || String(locationKey).toUpperCase(),
        propertyName: PROPERTY_NAMES[survival.propertyId] || 'Pinggir Jalan',
        timeState: getTimeState(survival.inGameHour || 6),
        weather: resolveWeather(rpgState),
        isSick: Boolean(rpgState.sick),
        isRegistered: inventory.some((it) => it && it.id === 'survival_started')
    };
}

module.exports = { buildStats, LOCATION_NAMES, PROPERTY_NAMES, PET_BONUS };
