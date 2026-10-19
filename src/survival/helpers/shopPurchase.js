"use strict";

// Logika pembelian toko, dipisah dari antarmuka supaya subcommand shop tetap
// ringan. Modul ini menangani tiga mata uang sekaligus: Naura Star Fragment di
// desa, Naura Coin di kota, dan Naura Coupon di kios Gaston.

const cacheManager = require("../../managers/cacheManager");
const currencyHelper = require("../engines/currency");
const stock = require("../data/shopStock");
const coupons = require("./shopCoupon");
const { addItemsAtomic } = require("../engines/inventoryHelper");
const { applyItemEffect } = require("./specialEffects");
const { executeAtomicPayment } = require("../../utils/transactionHelper");

const COUPON_PREFIX = "kupon:";
const PROPERTY_MAP = {
  prop_kos: "kos",
  prop_rumah: "rumah",
  prop_mansion: "mansion",
};

/** Apakah nilai select menu menunjuk ke etalase kupon Gaston? */
function isCouponCategory(value) {
  return String(value || "").startsWith(COUPON_PREFIX);
}

function couponCategoryOf(value) {
  return String(value || "").slice(COUPON_PREFIX.length);
}

/** Bungkus id, harga, dan penanda kupon menjadi satu nilai select menu. */
function encodeChoice(itemId, price, isCoupon) {
  return `${itemId}|${price}|${isCoupon ? "c" : "n"}`;
}

// Pemisah pipa dipakai karena banyak id memuat garis bawah, sehingga
// split('_') akan memotong id jadi salah.
function decodeChoice(value) {
  const [itemId, priceStr, flag] = String(value || "").split("|");
  return { itemId, price: parseInt(priceStr, 10), isCoupon: flag === "c" };
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
  if (!itemId || !Number.isFinite(price))
    return { ok: false, reason: "invalid" };

  const profile = await cacheManager.getUserProfile(userId);
  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival || !profile) return { ok: false, reason: "no_profile" };

  const c = currencyHelper.resolve(currency);
  const holders = { survival, profile };
  const balance = currencyHelper.balanceOf(c, holders);
  if (balance < price) {
    return { ok: false, reason: "broke", shortage: price - balance };
  }

  const itemName = catalogNameOf(itemId, isCoupon);
  let effectNote = "";

  const payment = await executeAtomicPayment({
    userId,
    amount: price,
    currency: c.field,
    reason: `shop_buy_${itemId}`,
    action: async () => {
      if (itemId.startsWith("prop_")) {
        await cacheManager.updateUserSurvival(userId, {
          propertyId: PROPERTY_MAP[itemId] || survival.propertyId,
        });
      } else if (itemId.startsWith("veh_")) {
        await cacheManager.updateUserSurvival(userId, {
          vehicle: itemId === "veh_motor" ? "motorcycle" : "bicycle",
        });
      } else {
        const couponItem = isCoupon ? coupons.getCouponItem(itemId) : null;
        if (couponItem && couponItem.effect) {
          const applied = await applyItemEffect(couponItem.effect, {
            survival,
            userId,
          });
          if (applied && applied.ok) {
            effectNote = applied.message || "Khasiatnya langsung terpasang!";
          } else {
            effectNote =
              "Khasiatnya belum bisa dipasang sekarang, jadi barangnya Naura simpan di tas dulu.";
            await storeItem(userId, profile, itemId, itemName);
          }
        } else {
          await storeItem(userId, profile, itemId, itemName);
        }
      }
    },
  });

  if (!payment.ok) {
    return { ok: false, reason: "broke", shortage: price - balance };
  }

  return { ok: true, itemId, itemName, price, isCoupon, effectNote };
}

// Barang masuk tas lewat transaksi berkunci, bukan tulis-ulang seluruh array.
// Dua pembelian yang tiba bersamaan dulu bisa membuat salah satu barang hilang.
async function storeItem(userId, profile, itemId, itemName) {
  const stored = await addItemsAtomic(userId, {
    id: itemId,
    name: itemName,
    amount: 1,
  });

  // Objek profile yang dipegang pemanggil ikut disegarkan supaya tampilan tas
  // sesudah pembelian tidak memperlihatkan isi tas yang lama.
  if (profile && stored.ok && stored.inventory)
    profile.inventory = stored.inventory;
  return stored;
}

module.exports = {
  COUPON_PREFIX,
  isCouponCategory,
  couponCategoryOf,
  encodeChoice,
  decodeChoice,
  catalogNameOf,
  buy,
};
