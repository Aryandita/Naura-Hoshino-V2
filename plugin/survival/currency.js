'use strict';

const ui = require('../../src/config/ui');
const cacheManager = require('../../src/managers/cacheManager');

// Tiga mata uang Naura.
// - Naura Star Fragment (NSF) : mata uang desa & seluruh wilayah alam.
// - Naura Coin              : mata uang kota, akademi, dan penjara.
// - Naura Coupon            : mata uang langka, tidak bisa ditukar dari uang biasa.
const FRAGMENT = 'fragment';
const COIN = 'coin';
const COUPON = 'coupon';

// Kurs resmi: 1000 NSF = 1 Naura Coin.
const FRAGMENT_PER_COIN = 1000;

// Emoji resmi dari server. Berkas ini jadi satu-satunya sumber kebenaran untuk
// lambang mata uang, jadi seluruh ekosistem cukup memanggil emojiOf().
// Kalau nanti ID emojinya diubah di ui.js, nilai di sana yang dipakai lebih dulu.
const EMOJI = {
    [FRAGMENT]: { raw: '<:NauraStarFragment:1534169151336222760>', id: '1534169151336222760', name: 'NauraStarFragment', animated: false },
    [COIN]: { raw: '<a:NauraCoin:1534169156520513677>', id: '1534169156520513677', name: 'NauraCoin', animated: true },
    [COUPON]: { raw: '<:NauraCoupon:1534169148807053472>', id: '1534169148807053472', name: 'NauraCoupon', animated: false }
};

const CURRENCIES = {
    [FRAGMENT]: {
        kind: FRAGMENT,
        name: 'Naura Star Fragment',
        short: 'NSF',
        emojiKey: 'nsf',
        emojiFallback: EMOJI[FRAGMENT].raw,
        field: 'starFragments',
        owner: 'survival'
    },
    [COIN]: {
        kind: COIN,
        name: 'Naura Coin',
        short: 'Coin',
        emojiKey: 'coin',
        emojiFallback: EMOJI[COIN].raw,
        field: 'economy_wallet',
        owner: 'profile'
    },
    [COUPON]: {
        kind: COUPON,
        name: 'Naura Coupon',
        short: 'Coupon',
        emojiKey: 'coupon',
        emojiFallback: EMOJI[COUPON].raw,
        // Disimpan di dalam rpg_state supaya tidak perlu migrasi kolom baru.
        field: 'coupons',
        owner: 'survivalState'
    }
};

const LOCATION_CURRENCY = {
    jalanan: FRAGMENT,
    desa: FRAGMENT,
    village: FRAGMENT,
    hutan: FRAGMENT,
    tambang: FRAGMENT,
    laut: FRAGMENT,
    pantai: FRAGMENT,
    sawah: FRAGMENT,
    gunung: FRAGMENT,
    kota: COIN,
    city: COIN,
    academy: COIN,
    prison: COIN
};

function currencyKindFor(location) {
    return LOCATION_CURRENCY[String(location || 'jalanan').toLowerCase()] || FRAGMENT;
}

function byKind(kind) {
    return CURRENCIES[kind] || CURRENCIES[FRAGMENT];
}

function currencyFor(location) {
    return byKind(currencyKindFor(location));
}

function resolve(currency) {
    return typeof currency === 'string' ? byKind(currency) : (currency || CURRENCIES[FRAGMENT]);
}

function emojiOf(currency) {
    const c = resolve(currency);
    return ui.getEmoji(c.emojiKey) || c.emojiFallback;
}

// Menu pilihan Discord menolak emoji berbentuk teks, jadi komponen select harus
// memakai bentuk objek ini.
function emojiObjectOf(currency) {
    const c = resolve(currency);
    const entry = EMOJI[c.kind];
    if (!entry) return undefined;
    return { id: entry.id, name: entry.name, animated: entry.animated };
}

function format(currency, amount) {
    const c = resolve(currency);
    const value = Number(amount) || 0;
    return `${emojiOf(c)} **${value.toLocaleString('id-ID')} ${c.name}**`;
}

function stateOf(survival) {
    return (survival && survival.rpg_state) || {};
}

function balanceOf(currency, holders = {}) {
    const c = resolve(currency);
    const { survival, profile } = holders;

    if (c.owner === 'profile') return Number((profile || {})[c.field]) || 0;
    if (c.owner === 'survivalState') return Number(stateOf(survival)[c.field]) || 0;
    return Number((survival || {})[c.field]) || 0;
}

function userIdOf(holders = {}) {
    const { survival, profile } = holders;
    return (survival && survival.userId) || (profile && profile.userId) || null;
}

/**
 * Menyelaraskan objek di memori dengan nilai yang baru ditulis ke database.
 *
 * Pemanggil sering menampilkan saldo dari objek yang sama sesaat setelah
 * transaksi, jadi objeknya perlu ikut maju. Fungsi ini sengaja TIDAK menulis ke
 * database supaya tidak terjadi penulisan ganda.
 */
function syncLocal(currency, holders, nextValue) {
    const c = resolve(currency);
    const { survival, profile } = holders || {};

    if (c.owner === 'profile') {
        if (profile) profile[c.field] = nextValue;
        return;
    }
    if (!survival) return;

    if (c.owner === 'survivalState') {
        survival.rpg_state = { ...stateOf(survival), [c.field]: nextValue };
        if (typeof survival.changed === 'function') survival.changed('rpg_state', true);
    } else {
        survival[c.field] = nextValue;
    }
}

/**
 * Menetapkan saldo ke nilai tertentu.
 *
 * Versi sebelumnya memanggil `profile.save()` di balik penjaga
 * `typeof profile.save === 'function'`. Objek profil berasal dari
 * cacheManager.getUserProfile(), yang mengembalikan JSON biasa tanpa .save().
 * Penjaga itu selalu gagal tanpa suara, jadi setiap pembayaran Naura Coin hanya
 * berubah di memori lalu hilang. Sekarang penulisan selalu lewat cacheManager.
 *
 * Untuk pengurangan saldo, pakai charge(). Fungsi ini menimpa nilai apa adanya
 * dan tidak tahan terhadap balapan.
 */
async function setBalance(currency, holders = {}, value) {
    const c = resolve(currency);
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));
    const userId = userIdOf(holders);

    syncLocal(c, holders, safeValue);
    if (!userId) return safeValue;

    if (c.owner === 'profile') {
        await cacheManager.updateUserProfile(userId, { [c.field]: safeValue });
    } else if (c.owner === 'survivalState') {
        await cacheManager.updateUserSurvival(userId, { rpg_state: stateOf(holders.survival) });
    } else {
        await cacheManager.updateUserSurvival(userId, { [c.field]: safeValue });
    }

    return safeValue;
}

function canAfford(currency, holders, amount) {
    return balanceOf(currency, holders) >= (Number(amount) || 0);
}

/**
 * Memotong saldo. Mengembalikan saldo akhir, atau null bila uangnya kurang.
 *
 * Pemeriksaan kecukupan dan pemotongan terjadi dalam satu pernyataan SQL, jadi
 * dua klik yang tiba bersamaan tidak bisa membelanjakan uang yang sama dua kali.
 */
async function charge(currency, holders = {}, amount) {
    const c = resolve(currency);
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    const balance = balanceOf(c, holders);
    if (cost === 0) return balance;

    const userId = userIdOf(holders);
    if (!userId) return null;

    // Naura Coupon tinggal di dalam kolom JSON rpg_state, yang tidak bisa
    // dipotong secara atomik. Kelangkaannya membuat risikonya kecil, tetapi ini
    // tetap satu-satunya jalur yang belum aman terhadap balapan.
    if (c.owner === 'survivalState') {
        if (balance < cost) return null;
        return setBalance(c, holders, balance - cost);
    }

    const result = c.owner === 'profile'
        ? await cacheManager.debitUserProfile(userId, c.field, cost)
        : await cacheManager.debitUserSurvival(userId, c.field, cost);

    if (!result.ok) return null;

    const next = Math.max(0, balance - cost);
    syncLocal(c, holders, next);
    return next;
}

async function reward(currency, holders = {}, amount) {
    const c = resolve(currency);
    const gain = Math.max(0, Math.floor(Number(amount) || 0));
    const balance = balanceOf(c, holders);
    if (gain === 0) return balance;

    const userId = userIdOf(holders);
    if (!userId) return balance;

    if (c.owner === 'survivalState') {
        return setBalance(c, holders, balance + gain);
    }

    if (c.owner === 'profile') {
        await cacheManager.incrementUserProfile(userId, { [c.field]: gain });
    } else {
        await cacheManager.incrementUserSurvival(userId, { [c.field]: gain });
    }

    const next = balance + gain;
    syncLocal(c, holders, next);
    return next;
}

// Konversi nominal antar mata uang biasa. Naura Coupon sengaja tidak bisa
// ditukar supaya kelangkaannya terjaga.
function convert(amount, fromKind, toKind) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (fromKind === toKind) return value;
    if (fromKind === COUPON || toKind === COUPON) return null;
    if (fromKind === FRAGMENT && toKind === COIN) return Math.floor(value / FRAGMENT_PER_COIN);
    if (fromKind === COIN && toKind === FRAGMENT) return value * FRAGMENT_PER_COIN;
    return null;
}

// Tukar uang di penukaran resmi. Sisa NSF yang tidak cukup jadi 1 Coin
// dikembalikan lewat `remainder` supaya tidak hangus.
async function exchange(holders, fromKind, toKind, amount) {
    const from = byKind(fromKind);
    const to = byKind(toKind);
    const value = Math.max(0, Math.floor(Number(amount) || 0));

    if (from.kind === to.kind) return { ok: false, reason: 'same_currency' };
    if (from.kind === COUPON || to.kind === COUPON) return { ok: false, reason: 'coupon_locked' };
    if (value <= 0) return { ok: false, reason: 'invalid_amount' };

    const received = convert(value, from.kind, to.kind);
    if (received === null) return { ok: false, reason: 'unsupported_pair' };
    if (received <= 0) return { ok: false, reason: 'below_minimum', minimum: FRAGMENT_PER_COIN };

    // Hanya nominal yang benar-benar terpakai yang dipotong. Pemotongan selalu
    // lebih dulu; bila gagal, tidak ada uang baru yang terlanjur diterbitkan.
    const spent = to.kind === COIN ? received * FRAGMENT_PER_COIN : value;
    const remaining = await charge(from, holders, spent);
    if (remaining === null) {
        return { ok: false, reason: 'insufficient', balance: balanceOf(from, holders), needed: spent };
    }

    await reward(to, holders, received);
    return {
        ok: true,
        from: from.kind,
        to: to.kind,
        spent,
        received,
        remainder: value - spent,
        balanceFrom: remaining,
        balanceTo: balanceOf(to, holders)
    };
}

module.exports = {
    FRAGMENT,
    COIN,
    COUPON,
    FRAGMENT_PER_COIN,
    EMOJI,
    CURRENCIES,
    LOCATION_CURRENCY,
    currencyKindFor,
    currencyFor,
    byKind,
    emojiOf,
    emojiObjectOf,
    format,
    balanceOf,
    setBalance,
    canAfford,
    charge,
    reward,
    convert,
    exchange
};
