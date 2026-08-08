'use strict';

// Logika pembelian toko, dipisah dari antarmuka supaya subcommand shop tetap
// ringan. Modul ini menangani tiga mata uang sekaligus: Naura Star Fragment di
// desa, Naura Coin di kota, dan Naura Coupon di kios Gaston.

const UserSurvival = require('../../src/models/UserSurvival');
const cacheManager = require('../../src/managers/cacheManager');
const currencyHelper = require('./currency');
const stock = require('./shopStock');
const coupons = require('./shopCoupon');
const { safeParseInventory, addOrStackItem } = require('./inventoryHelper');
const { applyItemEffect } = require('./specialEffects');

const COUPON_PREFIX = 'kupon:';
const PROPERTY_MAP = { prop_kos: 'kos', prop_rumah: 'rumah', prop_mansion: 'mansion' };

/** Apakah nilai select menu menunjuk ke etalase kupon Gaston? */
function isCouponCategory(value) {
    return String(value || '').startsWith(COUPON_PREFIX);
}

function couponCategoryOf(value) {
    return String(value || '').slice(COUPON_PREFIX.length);
}

/** Bungkus id, harga, dan penanda kupon menjadi satu nilai select menu. */
function encodeChoice(itemId, price, isCoupon) {
    return `${itemId}|${price}|${isCoupon ? 'c' : 'n'}`;
}

// Pemisah pipa dipakai karena banyak id memuat garis bawah, sehingga
// split('_') akan memotong id jadi salah.
function decodeChoice(value) {
    const [itemId, priceStr, flag] = String(value || '').split('|');
    return { itemId, price: parseInt(priceStr, 10), isCoupon: flag === 'c' };
}

function catalogNameOf(itemId, isCoupon) {
    const entry = isCoupon
        ? coupons.getCouponItem(itemId)
        : stock.findItem(itemId) || stock.propertyById(itemId);
    return entry ? entry.name : itemId;
}

/**
 * Jalankan satu transaksi pembelian.
 * Selalu membaca ulang data terbaru supaya saldo tidak bisa dipakai dua kali
 * lewat dua kolektor yang terbuka bersamaan.
 */
async function buy({ userId, value, currency }) {
    const { itemId, price, isCoupon } = decodeChoice(value);
    if (!itemId || !Number.isFinite(price)) return { ok: false, reason: 'invalid' };

    const profile = await cacheManager.getUserProfile(userId);
    const survival = await UserSurvival.findOne({ where: { userId } });
    if (!survival || !profile) return { ok: false, reason: 'no_profile' };

    const holders = { survival, profile };
    const balance = currencyHelper.balanceOf(currency, holders);
    if (balance < price) {
        return { ok: false, reason: 'broke', shortage: price - balance };
    }

    const charged = await currencyHelper.charge(currency, holders, price);
    if (charged === null) return { ok: false, reason: 'broke', shortage: price - balance };

    const itemName = catalogNameOf(itemId, isCoupon);
    let effectNote = '';

    // Penyimpanan dibatasi ke kolom yang memang berubah. Uangnya sudah dipotong
    // secara atomik di database, jadi menyimpan seluruh objek hanya akan menulis
    // ulang saldo dari memori dan membuka kembali peluang balapan.
    if (itemId.startsWith('prop_')) {
        survival.propertyId = PROPERTY_MAP[itemId] || survival.propertyId;
        await survival.save({ fields: ['propertyId'] });
    } else if (itemId.startsWith('veh_')) {
        survival.vehicle = itemId === 'veh_motor' ? 'motorcycle' : 'bicycle';
        await survival.save({ fields: ['vehicle'] });
    } else {
        const couponItem = isCoupon ? coupons.getCouponItem(itemId) : null;

        // Barang kupon berkhasiat permanen langsung dipasang, karena efeknya
        // memang bukan sesuatu yang perlu disimpan dulu di dalam tas.
        if (couponItem && couponItem.effect) {
            const applied = await applyItemEffect(couponItem.effect, { survival, userId });
            if (applied && applied.ok) {
                effectNote = applied.message || 'Khasiatnya langsung terpasang!';
            } else {
                effectNote = 'Khasiatnya belum bisa dipasang sekarang, jadi barangnya Naura simpan di tas dulu.';
                await storeItem(userId, profile, itemId, itemName);
            }
        } else {
            await storeItem(userId, profile, itemId, itemName);
        }
    }

    return { ok: true, itemId, itemName, price, isCoupon, effectNote };
}

async function storeItem(userId, profile, itemId, itemName) {
    const inv = addOrStackItem(safeParseInventory(profile.inventory), {
        id: itemId,
        name: itemName,
        amount: 1
    });
    await cacheManager.updateUserProfile(userId, { inventory: inv });
}

module.exports = {
    COUPON_PREFIX,
    isCouponCategory,
    couponCategoryOf,
    encodeChoice,
    decodeChoice,
    catalogNameOf,
    buy
};
