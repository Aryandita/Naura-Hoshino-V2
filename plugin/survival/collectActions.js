'use strict';

// Tabel jarahan dan pemrosesan hasil eksplorasi /survival collect.
// Semua id barang di sini sudah dicocokkan dengan katalog items.js, supaya
// pemain tidak pernah lagi menerima barang bernama sama dengan id mentahnya.

const UserSurvival = require('../../src/models/UserSurvival');
const UserQuest = require('../../src/models/UserQuest');
const cacheManager = require('../../src/managers/cacheManager');
const items = require('./items');
const leveling = require('./survivalLeveling');
const { advanceTime, getTimeState } = require('./survivalTime');
const { safeParseInventory, addOrStackItem } = require('./inventoryHelper');

// Sesudah pulang, pemain selalu diantar kembali ke desa.
const HOME_LOCATION = 'desa';

const LOOT = {
    hutan: {
        base: ['wood', 'wood', 'fiber', 'apple', 'stone'],
        cat: ['apple', 'seed_apple'],
        cost: { hunger: 5, thirst: 8, stamina: 10 },
        hours: 1,
        xp: 5
    },
    tambang: {
        base: ['stone', 'stone', 'iron_ore', 'iron_ore', 'silver_ore', 'diamond'],
        cat: ['diamond', 'silver_ore'],
        cost: { hunger: 10, thirst: 15, stamina: 20 },
        hours: 2,
        xp: 10
    },
    laut: {
        base: ['salmon', 'golden_fish', 'trash', 'worm_bait'],
        cat: ['salmon', 'golden_fish'],
        cost: { hunger: 3, thirst: 5, stamina: 5 },
        hours: 1,
        xp: 5
    },
    sampah: {
        base: ['trash', 'fiber', 'mineral_water'],
        cat: ['mineral_water'],
        cost: { hunger: 4, thirst: 6, stamina: 8 },
        hours: 1,
        xp: 4
    }
};

// Mengais tanpa alat: hasilnya sedikit, tenaganya terkuras jauh lebih banyak.
const BARE_HANDS = {
    hutan: {
        loot: ['wood', 'trash'],
        cost: { hunger: 10, thirst: 15, stamina: 25 },
        hours: 1,
        xp: 3,
        story: 'Kamu mengais hutan dengan tangan kosong. Tanganmu perih, tapi tetap dapat sesuatu.'
    },
    tambang: {
        loot: ['stone', 'trash'],
        cost: { hunger: 15, thirst: 20, stamina: 35 },
        hours: 2,
        xp: 4,
        story: 'Kamu mencungkil bebatuan dengan tangan kosong. Jarimu lecet, tapi tidak pulang dengan tangan hampa.'
    }
};

function nameOf(id) {
    const found = items.find(it => it && it.id === id);
    return found ? found.name : id;
}

function lootTable(lokasi) {
    return LOOT[lokasi] || LOOT.hutan;
}

function bareHandsTable(lokasi) {
    return BARE_HANDS[lokasi] || null;
}

/** Alat apa yang wajib dibawa ke lokasi tertentu. */
function gearCheck(lokasi, inventory) {
    const has = (fn) => inventory.some(it => it && typeof it.id === 'string' && fn(it.id));
    const hasRod = has(id => id.includes('fishing') || id.includes('rod'));
    const hasAxe = has(id => id.includes('axe'));
    const hasPickaxe = has(id => id.includes('pick'));

    if (lokasi === 'laut' && !hasRod) return { allowed: false, reason: 'need_rod' };
    if (lokasi === 'hutan' && !hasAxe) return { allowed: true, bareHands: true };
    if (lokasi === 'tambang' && !hasPickaxe) return { allowed: true, bareHands: true };
    return { allowed: true, bareHands: false };
}

/** Peluang QTE per lokasi. Laut selalu QTE karena ikannya harus disentak. */
function shouldQte(lokasi) {
    if (lokasi === 'laut') return true;
    if (lokasi === 'tambang') return Math.random() < 0.4;
    if (lokasi === 'hutan') return Math.random() < 0.3;
    return false;
}

function petBonus(activePets) {
    const types = (activePets || []).map(p => p.petType);
    return { wolf: types.includes('wolf'), cat: types.includes('cat') };
}

/** Antar pemain kembali ke desa tanpa memberi hadiah apa pun. */
async function goHome(userId) {
    await UserSurvival.update({ currentLocation: HOME_LOCATION }, { where: { userId } });
}

/**
 * Bagikan hasil eksplorasi: barang, biaya tenaga, waktu, XP, dan progres quest.
 * Selalu dipanggil sesudah pemain berhasil, jadi tidak ada jalur yang memotong
 * stamina tanpa memberi apa pun.
 */
async function grantLoot({ userId, lokasi, bareHands, activePets }) {
    const profile = await cacheManager.getUserProfile(userId);
    const survival = await UserSurvival.findOne({ where: { userId } });
    if (!profile || !survival) return { ok: false, reason: 'no_profile' };

    const bonus = petBonus(activePets);
    const bare = bareHands ? bareHandsTable(lokasi) : null;
    const table = lootTable(lokasi);

    let inventory = safeParseInventory(profile.inventory);
    const gained = [];

    if (bare) {
        bare.loot.forEach(id => {
            inventory = addOrStackItem(inventory, { id, name: nameOf(id), amount: 1 });
            gained.push({ id, name: nameOf(id), amount: 1 });
        });
    } else {
        const pool = bonus.cat ? table.base.concat(table.cat) : table.base;
        const rolled = pool[Math.floor(Math.random() * pool.length)];
        inventory = addOrStackItem(inventory, { id: rolled, name: nameOf(rolled), amount: 1 });
        gained.push({ id: rolled, name: nameOf(rolled), amount: 1 });
    }

    // Serigala membantu menghemat tenaga saat menambang.
    const cost = { ...(bare ? bare.cost : table.cost) };
    if (!bare && lokasi === 'tambang' && bonus.wolf) {
        cost.hunger = Math.max(0, cost.hunger - 4);
        cost.thirst = Math.max(0, cost.thirst - 5);
        cost.stamina = Math.max(0, cost.stamina - 5);
    }

    const hours = bare ? bare.hours : table.hours;
    const xp = bare ? bare.xp : table.xp;

    await cacheManager.updateUserProfile(userId, { inventory });
    await UserSurvival.update({
        hunger: Math.max(0, (survival.hunger || 0) - cost.hunger),
        thirst: Math.max(0, (survival.thirst || 0) - cost.thirst),
        stamina: Math.max(0, (survival.stamina || 0) - cost.stamina),
        currentLocation: HOME_LOCATION
    }, { where: { userId } });

    const timeUpdate = await advanceTime(userId, hours);
    await leveling.addPlayerXP(userId, xp);

    // Progres quest bersifat pemanis, jadi kegagalannya tidak boleh membatalkan hadiah.
    try {
        const { incrementQuestProgress } = require('./questGenerator');
        await incrementQuestProgress(userId, 'collect');

        const today = new Date().toISOString().split('T')[0];
        const [quest] = await UserQuest.findOrCreate({ where: { userId }, defaults: { lastReset: today } });
        if (quest.lastReset !== today) {
            quest.workCount = 0;
            quest.dungeonKills = 0;
            quest.collectCount = 0;
            quest.isClaimed = false;
            quest.lastReset = today;
        }
        quest.collectCount = (quest.collectCount || 0) + 1;
        await quest.save();
    } catch (e) {
        // Diamkan saja, hadiah utamanya sudah masuk.
    }

    return {
        ok: true,
        gained,
        cost,
        hours,
        xp,
        bareStory: bare ? bare.story : null,
        day: timeUpdate.day,
        hour: timeUpdate.hour,
        timeState: getTimeState(timeUpdate.hour),
        passedOut: Boolean(timeUpdate.passedOut)
    };
}

module.exports = {
    HOME_LOCATION,
    LOOT,
    BARE_HANDS,
    nameOf,
    lootTable,
    bareHandsTable,
    gearCheck,
    shouldQte,
    petBonus,
    goHome,
    grantLoot
};
