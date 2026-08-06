'use strict';

// Aturan biaya, hadiah, dan jeda untuk sesi jalan-jalan.
// Dipisah dari npcEncounter.js supaya lapisan "siapa yang kamu temui" tetap
// murni data, sementara berkas ini mengurus dampaknya ke pemain.

const cacheManager = require('../../src/managers/cacheManager');
const { safeParseInventory } = require('./inventoryHelper');
const { addItem, nameOf } = require('./craftHelpers');
const encounter = require('./npcEncounter');

// Berkeliling di dalam pemukiman tidak melelahkan. Yang menguras tenaga adalah
// menyusuri hutan, tambang, pesisir, dan jalanan terbuka.
const SAFE_ZONES = new Set(['desa', 'kota', 'academy']);
const STAMINA_COST = 5;

// Jeda menyapa disamakan dengan papan NPC supaya dua jalur tidak saling menyalip.
const GREET_COOLDOWN_MS = 30 * 60 * 1000;

const GIFT_CHANCE = 0.35;
const HINT_CHANCE = 0.15;

// Oleh-oleh memakai id yang benar-benar ada di katalog. Barangnya kecil saja,
// supaya jalan-jalan terasa menyenangkan tanpa merusak keseimbangan ekonomi.
const GIFTS = {
    desa: [
        { id: 'apple', amount: 1 },
        { id: 'mineral_water', amount: 1 },
        { id: 'seed_wheat', amount: 1 },
        { id: 'fiber', amount: 2 }
    ],
    kota: [
        { id: 'mineral_water', amount: 2 },
        { id: 'apple', amount: 1 }
    ],
    academy: [
        { id: 'mineral_water', amount: 1 },
        { id: 'fiber', amount: 1 }
    ],
    hutan: [
        { id: 'wood', amount: 2 },
        { id: 'fiber', amount: 2 }
    ],
    tambang: [
        { id: 'stone', amount: 2 },
        { id: 'iron_ore', amount: 1 }
    ],
    laut: [
        { id: 'worm_bait', amount: 2 }
    ],
    pantai: [
        { id: 'worm_bait', amount: 1 },
        { id: 'fiber', amount: 1 }
    ],
    sawah: [
        { id: 'seed_wheat', amount: 1 },
        { id: 'seed_potato', amount: 1 }
    ],
    jalanan: [
        { id: 'mineral_water', amount: 1 }
    ]
};

// Kalimat pengantar saat NPC menitipkan sesuatu.
const GIFT_LINES = [
    '"Ini buat kamu, bawa saja. Aku masih punya banyak, kok."',
    '"Kebetulan lebih. Daripada mubazir, kamu saja yang pakai."',
    '"Ambil ini, hitung-hitung terima kasih sudah mau menyapa."',
    '"Sebentar... nah, ini. Jangan ditolak, ya."'
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function isSafeZone(location) {
    return SAFE_ZONES.has(encounter.normalizeLocation(location));
}

/** Biaya stamina per langkah. Nol di dalam pemukiman. */
function staminaCostFor(location) {
    return isSafeZone(location) ? 0 : STAMINA_COST;
}

/**
 * Potong stamina untuk satu langkah jalan-jalan.
 * @returns {Promise<{ ok: boolean, cost: number, stamina: number, reason?: string }>}
 */
async function spendStamina(userId, location) {
    const cost = staminaCostFor(location);
    const survival = await cacheManager.getUserSurvival(userId);
    const current = Number(survival && survival.stamina) || 0;

    if (cost === 0) return { ok: true, cost: 0, stamina: current };
    if (current < cost) return { ok: false, cost, stamina: current, reason: 'lelah' };

    const left = current - cost;
    await cacheManager.updateUserSurvival(userId, { stamina: left });
    return { ok: true, cost, stamina: left };
}

/** Sisa jeda menyapa dalam milidetik. Nol berarti sudah boleh menyapa lagi. */
function cooldownLeft(lastInteraction) {
    if (!lastInteraction) return 0;
    const last = new Date(lastInteraction).getTime();
    if (!Number.isFinite(last)) return 0;
    return Math.max(0, GREET_COOLDOWN_MS - (Date.now() - last));
}

function formatCooldown(ms) {
    const totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes} menit`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
}

/**
 * Undi oleh-oleh dari NPC yang baru saja kamu sapa.
 * @returns {{ kind: 'item'|'hint'|'none', id?: string, amount?: number }}
 */
function rollGift(location) {
    const roll = Math.random();
    if (roll < HINT_CHANCE) return { kind: 'hint' };
    if (roll >= HINT_CHANCE + GIFT_CHANCE) return { kind: 'none' };

    const pool = GIFTS[encounter.normalizeLocation(location)];
    if (!pool || pool.length === 0) return { kind: 'none' };

    const chosen = pick(pool);
    return { kind: 'item', id: chosen.id, amount: chosen.amount };
}

/**
 * Masukkan oleh-oleh ke tas pemain.
 * @returns {Promise<string|null>} kalimat siap tampil, atau null bila gagal
 */
async function grantGift(userId, gift) {
    if (!gift || gift.kind !== 'item') return null;

    const profile = await cacheManager.getUserProfile(userId);
    if (!profile) return null;

    const inventory = safeParseInventory(profile.inventory);
    addItem(inventory, gift.id, gift.amount);
    await cacheManager.updateUserProfile(userId, { inventory });

    return `${pick(GIFT_LINES)} Kamu menerima **${nameOf(gift.id)} x${gift.amount}**.`;
}

module.exports = {
    SAFE_ZONES,
    STAMINA_COST,
    GREET_COOLDOWN_MS,
    GIFT_CHANCE,
    HINT_CHANCE,
    GIFTS,
    isSafeZone,
    staminaCostFor,
    spendStamina,
    cooldownLeft,
    formatCooldown,
    rollGift,
    grantGift
};
