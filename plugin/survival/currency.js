'use strict';

const ui = require('../../src/config/ui');

// Tiga mata uang Naura.
// - Naura Star Fragment (NSF) : mata uang desa & seluruh wilayah alam.
// - Naura Coin              : mata uang kota, akademi, dan penjara.
// - Naura Coupon            : mata uang langka, tidak bisa ditukar dari uang biasa.
const FRAGMENT = 'fragment';
const COIN = 'coin';
const COUPON = 'coupon';

// Kurs resmi: 1000 NSF = 1 Naura Coin.
const FRAGMENT_PER_COIN = 1000;

const CURRENCIES = {
    [FRAGMENT]: {
        kind: FRAGMENT,
        name: 'Naura Star Fragment',
        short: 'NSF',
        emojiKey: 'nsf',
        emojiFallback: '\u2728',
        field: 'starFragments',
        owner: 'survival'
    },
    [COIN]: {
        kind: COIN,
        name: 'Naura Coin',
        short: 'Coin',
        emojiKey: 'coin',
        emojiFallback: '\uD83E\uDE99',
        field: 'economy_wallet',
        owner: 'profile'
    },
    [COUPON]: {
        kind: COUPON,
        name: 'Naura Coupon',
        short: 'Coupon',
        emojiKey: 'coupon',
        emojiFallback: '\uD83C\uDF9F\uFE0F',
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

function emojiOf(currency) {
    const c = typeof currency === 'string' ? byKind(currency) : currency;
    return ui.getEmoji(c.emojiKey) || c.emojiFallback;
}

function format(currency, amount) {
    const c = typeof currency === 'string' ? byKind(currency) : currency;
    const value = Number(amount) || 0;
    return `${emojiOf(c)} **${value.toLocaleString('id-ID')} ${c.name}**`;
}

function stateOf(survival) {
    return (survival && survival.rpg_state) || {};
}

function balanceOf(currency, holders = {}) {
    const c = typeof currency === 'string' ? byKind(currency) : currency;
    const { survival, profile } = holders;

    if (c.owner === 'profile') return Number((profile || {})[c.field]) || 0;
    if (c.owner === 'survivalState') return Number(stateOf(survival)[c.field]) || 0;
    return Number((survival || {})[c.field]) || 0;
}

async function setBalance(currency, holders = {}, value) {
    const c = typeof currency === 'string' ? byKind(currency) : currency;
    const { survival, profile } = holders;
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));

    if (c.owner === 'profile') {
        if (!profile) return safeValue;
        profile[c.field] = safeValue;
        if (typeof profile.save === 'function') await profile.save();
        return safeValue;
    }

    if (!survival) return safeValue;

    if (c.owner === 'survivalState') {
        survival.rpg_state = { ...stateOf(survival), [c.field]: safeValue };
        if (typeof survival.changed === 'function') survival.changed('rpg_state', true);
    } else {
        survival[c.field] = safeValue;
    }

    if (typeof survival.save === 'function') await survival.save();
    return safeValue;
}

function canAfford(currency, holders, amount) {
    return balanceOf(currency, holders) >= (Number(amount) || 0);
}

// Memotong saldo. Mengembalikan saldo akhir, atau null bila uangnya kurang.
async function charge(currency, holders, amount) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    const balance = balanceOf(currency, holders);
    if (balance < cost) return null;
    return setBalance(currency, holders, balance - cost);
}

async function reward(currency, holders, amount) {
    const gain = Math.max(0, Math.floor(Number(amount) || 0));
    return setBalance(currency, holders, balanceOf(currency, holders) + gain);
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

    // Hanya nominal yang benar-benar terpakai yang dipotong.
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
    CURRENCIES,
    LOCATION_CURRENCY,
    currencyKindFor,
    currencyFor,
    byKind,
    emojiOf,
    format,
    balanceOf,
    setBalance,
    canAfford,
    charge,
    reward,
    convert,
    exchange
};
