'use strict';

const ui = require('../../src/config/ui');

// Aturan ekonomi Naura:
// - Desa dan wilayah alam memakai Naura Star Fragment (kolom UserSurvival.starFragments)
// - Kota dan fasilitas modern memakai Naura Coin (kolom UserProfile.economy_wallet)
// Semua subcommand wajib lewat helper ini supaya tidak ada lagi toko desa yang
// diam-diam memotong Coin, atau sebaliknya.

const FRAGMENT = 'fragment';
const COIN = 'coin';

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
    }
};

// Wilayah yang tidak terdaftar dianggap wilayah alam, jadi tetap memakai NSF.
const LOCATION_CURRENCY = {
    jalanan: FRAGMENT,
    desa: FRAGMENT,
    village: FRAGMENT,
    hutan: FRAGMENT,
    tambang: FRAGMENT,
    laut: FRAGMENT,
    pantai: FRAGMENT,
    sawah: FRAGMENT,
    kota: COIN,
    city: COIN,
    academy: COIN,
    prison: COIN
};

function currencyKindFor(location) {
    return LOCATION_CURRENCY[location] || FRAGMENT;
}

function currencyFor(location) {
    return CURRENCIES[currencyKindFor(location)];
}

function byKind(kind) {
    return CURRENCIES[kind] || CURRENCIES[FRAGMENT];
}

function emojiOf(currency) {
    return ui.getEmoji(currency.emojiKey) || currency.emojiFallback;
}

/** Contoh keluaran: "\u2728 1.500 Naura Star Fragment" */
function format(currency, amount) {
    const value = Number(amount) || 0;
    return `${emojiOf(currency)} **${value.toLocaleString('id-ID')} ${currency.name}**`;
}

function balanceOf(currency, { survival, profile }) {
    const source = currency.owner === 'survival' ? survival : profile;
    if (!source) return 0;
    return Number(source[currency.field]) || 0;
}

function canAfford(currency, holders, amount) {
    return balanceOf(currency, holders) >= (Number(amount) || 0);
}

/**
 * Potong saldo lalu simpan. Mengembalikan saldo akhir, atau null bila saldonya
 * memang tidak cukup sehingga pemanggil bisa menolak transaksi.
 */
async function charge(currency, holders, amount) {
    const cost = Number(amount) || 0;
    const source = currency.owner === 'survival' ? holders.survival : holders.profile;
    if (!source) return null;

    const balance = Number(source[currency.field]) || 0;
    if (balance < cost) return null;

    source[currency.field] = balance - cost;
    await source.save();
    return source[currency.field];
}

/** Tambah saldo, dipakai untuk hasil jual dan hadiah. */
async function reward(currency, holders, amount) {
    const gain = Number(amount) || 0;
    const source = currency.owner === 'survival' ? holders.survival : holders.profile;
    if (!source) return null;

    source[currency.field] = (Number(source[currency.field]) || 0) + gain;
    await source.save();
    return source[currency.field];
}

module.exports = {
    FRAGMENT,
    COIN,
    CURRENCIES,
    LOCATION_CURRENCY,
    currencyKindFor,
    currencyFor,
    byKind,
    emojiOf,
    format,
    balanceOf,
    canAfford,
    charge,
    reward
};
