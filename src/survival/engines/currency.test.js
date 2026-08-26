'use strict';

// Test untuk currency.js: menjaga kontrak tiga mata uang Naura (NSF, Coin,
// Coupon) tanpa menyentuh database. Fungsi yang diuji murni logika konversi,
// pembacaan saldo, dan jalur gagal penukaran sebelum penulisan apa pun.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    FRAGMENT,
    COIN,
    COUPON,
    FRAGMENT_PER_COIN,
    CURRENCIES,
    byKind,
    currencyKindFor,
    balanceOf,
    canAfford,
    convert,
    exchange,
} = require('./currency');

test('tiga mata uang utama terdaftar dengan kolom yang benar', () => {
    assert.equal(CURRENCIES[FRAGMENT].field, 'starFragments');
    assert.equal(CURRENCIES[FRAGMENT].owner, 'survival');
    assert.equal(CURRENCIES[COIN].field, 'economy_wallet');
    assert.equal(CURRENCIES[COIN].owner, 'profile');
    assert.equal(CURRENCIES[COUPON].field, 'coupons');
    assert.equal(CURRENCIES[COUPON].owner, 'survival');
});

test('kurs resmi 1000 NSF per 1 Coin', () => {
    assert.equal(FRAGMENT_PER_COIN, 1000);
});

test('currencyKindFor memetakan lokasi ke mata uang wilayah', () => {
    // Wilayah alam membayar NSF
    assert.equal(currencyKindFor('desa'), FRAGMENT);
    assert.equal(currencyKindFor('hutan'), FRAGMENT);
    assert.equal(currencyKindFor('tambang'), FRAGMENT);
    // Kota membayar Coin
    assert.equal(currencyKindFor('kota'), COIN);
    assert.equal(currencyKindFor('city'), COIN);
    assert.equal(currencyKindFor('academy'), COIN);
    // Lokasi tak dikenal jatuh ke NSF sebagai default alam liar
    assert.equal(currencyKindFor('tempat_aneh'), FRAGMENT);
    assert.equal(currencyKindFor(undefined), FRAGMENT);
});

test('convert menghitung konversi dua arah dengan lantai', () => {
    assert.equal(convert(1000, FRAGMENT, COIN), 1);
    assert.equal(convert(1500, FRAGMENT, COIN), 1); // sisa 500 tidak hangus di exchange
    assert.equal(convert(999, FRAGMENT, COIN), 0);
    assert.equal(convert(2, COIN, FRAGMENT), 2000);
    assert.equal(convert(5, FRAGMENT, FRAGMENT), 5);
});

test('convert menolak pasangan yang melibatkan Coupon', () => {
    assert.equal(convert(10, COUPON, COIN), null);
    assert.equal(convert(10, COIN, COUPON), null);
    assert.equal(convert(10, COUPON, FRAGMENT), null);
});

test('balanceOf membaca kolom sesuai pemilik mata uang', () => {
    const holders = {
        survival: { starFragments: 250, coupons: 3 },
        profile: { economy_wallet: 900 },
    };
    assert.equal(balanceOf(FRAGMENT, holders), 250);
    assert.equal(balanceOf(COIN, holders), 900);
    assert.equal(balanceOf(COUPON, holders), 3);
    // Holder kosong aman
    assert.equal(balanceOf(FRAGMENT, {}), 0);
    assert.equal(balanceOf(COIN, { profile: null }), 0);
});

test('couponBalanceOf membaca legacy rpg_state saat kolom belum ada', () => {
    const holders = {
        survival: { rpg_state: { coupons: 7 } },
    };
    assert.equal(balanceOf(COUPON, holders), 7);
});

test('canAfford membandingkan saldo dengan biaya', () => {
    const holders = { survival: { starFragments: 200 } };
    assert.ok(canAfford(FRAGMENT, holders, 200));
    assert.ok(canAfford(FRAGMENT, holders, 199));
    assert.equal(canAfford(FRAGMENT, holders, 201), false);
});

test('byKind jatuh ke NSF untuk kind tak dikenal', () => {
    assert.equal(byKind('tidak_ada').kind, FRAGMENT);
    assert.equal(byKind(undefined).kind, FRAGMENT);
});

test('exchange menolak jalur tidak valid sebelum menyentuh database', async () => {
    const holders = { survival: { starFragments: 5000 }, profile: {} };

    await assert.deepEqual(await exchange(holders, FRAGMENT, FRAGMENT, 100), {
        ok: false,
        reason: 'same_currency',
    });
    await assert.deepEqual(await exchange(holders, COUPON, COIN, 1), {
        ok: false,
        reason: 'coupon_locked',
    });
    await assert.deepEqual(await exchange(holders, COIN, COUPON, 1), {
        ok: false,
        reason: 'coupon_locked',
    });
    await assert.deepEqual(await exchange(holders, FRAGMENT, COIN, 0), {
        ok: false,
        reason: 'invalid_amount',
    });
    await assert.deepEqual(await exchange(holders, FRAGMENT, COIN, 999), {
        ok: false,
        reason: 'below_minimum',
        minimum: FRAGMENT_PER_COIN,
    });
});