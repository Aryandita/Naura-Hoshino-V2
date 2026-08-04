'use strict';

const UserNPC = require('../../src/models/UserNPC');
const npcs = require('./npcs');

// Khasiat permanen barang Naura Coupon. Semua jejaknya disimpan di
// `rpg_state.perks` supaya tidak perlu kolom database baru dan tidak bisa
// ditumpuk dua kali.
const LUCK_CROWN_BONUS = 0.8; // +80% permanen
const MAX_AFFECTION = 1000;
const MARRIED_LEVEL = 4;

const PERMANENT_PERKS = {
    luck_crown: 'Mahkota Keberuntungan',
    midas_gloves: 'Sarung Tangan Midas',
    void_backpack: 'Tas Ruang Hampa',
    star_compass: 'Kompas Bintang',
    memory_album: 'Album Kenangan Naura',
    phoenix_charm: 'Azimat Phoenix'
};

function stateOf(survival) {
    return (survival && survival.rpg_state) || {};
}

function perksOf(survival) {
    return stateOf(survival).perks || {};
}

function hasPerk(survival, key) {
    return Boolean(perksOf(survival)[key]);
}

async function writeState(survival, patch, perkPatch) {
    const state = { ...stateOf(survival), ...patch };
    if (perkPatch) state.perks = { ...perksOf(survival), ...perkPatch };
    survival.rpg_state = state;
    if (typeof survival.changed === 'function') survival.changed('rpg_state', true);
    if (typeof survival.save === 'function') await survival.save();
    return state;
}

function npcNameOf(npcId) {
    const npc = npcs[npcId];
    return npc ? npc.name : npcId;
}

// Cincin Berlian: melejitkan hubungan dengan kekasih terdekat sampai batas
// maksimal, lalu langsung menikahkan keduanya.
async function applyMaxRomance(userId, survival) {
    const bonds = await UserNPC.findAll({ where: { userId } });
    if (!bonds || bonds.length === 0) {
        return { ok: false, reason: 'no_bond' };
    }

    const married = bonds.find(b => b.relationshipLevel >= MARRIED_LEVEL);
    if (married) {
        return { ok: false, reason: 'already_married', npcName: npcNameOf(married.npcId) };
    }

    // Pasangan dipilih dari ikatan dengan afeksi tertinggi.
    const target = bonds.slice().sort((a, b) => (b.affection || 0) - (a.affection || 0))[0];

    target.affection = MAX_AFFECTION;
    target.relationshipLevel = MARRIED_LEVEL;
    target.lastInteraction = new Date();
    await target.save();

    const unlocked = stateOf(survival).unlocked_cutscenes || [];
    await writeState(survival, {
        married_to: target.npcId,
        unlocked_cutscenes: unlocked.includes('wedding') ? unlocked : [...unlocked, 'wedding']
    });

    return { ok: true, npcId: target.npcId, npcName: npcNameOf(target.npcId) };
}

// Mahkota Keberuntungan: LUCK naik 80% permanen, hanya sekali seumur hidup.
async function applyLuckCrown(survival) {
    if (hasPerk(survival, 'luck_crown')) {
        return { ok: false, reason: 'already_owned' };
    }

    const before = Number(survival.luck) || 1;
    // Minimal naik 1 supaya pemain berstat rendah tetap merasakan efeknya.
    const gained = Math.max(1, Math.floor(before * LUCK_CROWN_BONUS));
    survival.luck = before + gained;
    if (typeof survival.save === 'function') await survival.save();

    await writeState(survival, {}, { luck_crown: { gained, at: new Date().toISOString() } });
    return { ok: true, before, after: survival.luck, gained };
}

async function applySimplePerk(survival, key, value) {
    if (hasPerk(survival, key)) return { ok: false, reason: 'already_owned' };
    await writeState(survival, {}, { [key]: value });
    return { ok: true, perk: key, label: PERMANENT_PERKS[key] || key };
}

// Pintu masuk tunggal yang dipakai `consume.js` maupun etalase kupon.
async function applyItemEffect(effect, { survival, userId }) {
    switch (effect) {
        case 'max_romance':
            return applyMaxRomance(userId, survival);
        case 'luck_crown':
            return applyLuckCrown(survival);
        case 'midas_gloves':
            return applySimplePerk(survival, 'midas_gloves', { sellBonus: 0.5 });
        case 'void_backpack':
            return applySimplePerk(survival, 'void_backpack', { slotBonus: 50 });
        case 'star_compass':
            return applySimplePerk(survival, 'star_compass', { freeTravel: true });
        case 'memory_album':
            return applySimplePerk(survival, 'memory_album', { unlocked: true });
        case 'phoenix_charm':
            return applySimplePerk(survival, 'phoenix_charm', { charges: 1 });
        case 'eternal_pet_egg':
            // Ditetaskan lewat `/survival pet`, jadi cukup ditandai di sini.
            return applySimplePerk(survival, 'eternal_pet_egg', { pending: true });
        default:
            return { ok: false, reason: 'unknown_effect' };
    }
}

// Pengali harga jual dari Sarung Tangan Midas, dipakai market.js nanti.
function sellMultiplier(survival) {
    const perk = perksOf(survival).midas_gloves;
    return perk && perk.sellBonus ? 1 + perk.sellBonus : 1;
}

function hasMemoryAlbum(survival) {
    return hasPerk(survival, 'memory_album');
}

module.exports = {
    LUCK_CROWN_BONUS,
    PERMANENT_PERKS,
    perksOf,
    hasPerk,
    applyItemEffect,
    applyMaxRomance,
    applyLuckCrown,
    sellMultiplier,
    hasMemoryAlbum
};
