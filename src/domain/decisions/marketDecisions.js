// Lokasi: src/domain/decisions/marketDecisions.js
// Implementasi Law 5: Separate decisions from actions & Law 2: Name things by meaning
// Mesin kalkulasi murni (pure function) untuk transaksi pasar desa dan evaluasi harga tanpa I/O.

"use strict";

const VALID_VILLAGE_LOCATIONS = Object.freeze(["desa", "village"]);

/**
 * Mengevaluasi izin akses ke pasar desa
 *
 * @param {Object} params
 * @param {string} params.currentLocation - Lokasi pemain saat ini
 * @returns {Readonly<{
 *   isAllowed: boolean,
 *   reasonCode: string|null,
 *   errorCode: string|null
 * }>}
 */
function evaluateMarketAccess({ currentLocation }) {
  const loc = String(currentLocation || "").toLowerCase();

  // Guard 1: Pemain sedang dipenjara
  if (loc === "prison") {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "IN_PRISON",
      errorCode: "err_sys_51",
    });
  }

  // Guard 2: Pemain harus berada di wilayah desa
  if (!VALID_VILLAGE_LOCATIONS.includes(loc)) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "NOT_IN_VILLAGE",
      errorCode: "err_sys_52",
    });
  }

  return Object.freeze({
    isAllowed: true,
    reasonCode: null,
    errorCode: null,
  });
}

/**
 * Menghitung harga jual dinamis item di pasar desa
 *
 * @param {Object} params
 * @param {number} params.basePrice - Harga dasar item
 * @param {number} [params.weatherMultiplier=1] - Pengali cuaca
 * @param {number} [params.seasonMultiplier=1] - Pengali musim
 * @param {number} [params.demandCount=0] - Jumlah pembelian sebelumnya
 * @param {boolean} [params.isExtreme=false] - Pengali tingkat kesulitan Extreme (1.5x)
 * @returns {number}
 */
function calculateMarketItemPrice({
  basePrice,
  weatherMultiplier = 1,
  seasonMultiplier = 1,
  demandCount = 0,
  isExtreme = false,
}) {
  const safeBase = Math.max(1, Math.floor(Number(basePrice) || 1));
  const safeWeather = Math.max(0.1, Number(weatherMultiplier) || 1);
  const safeSeason = Math.max(0.1, Number(seasonMultiplier) || 1);
  const safeDemand = Math.max(0, Math.floor(Number(demandCount) || 0));

  const demandFactor = 1 + safeDemand * 0.1;
  let finalPrice = Math.floor(
    safeBase * safeWeather * safeSeason * demandFactor,
  );

  if (isExtreme) {
    finalPrice = Math.floor(finalPrice * 1.5);
  }

  return Math.max(1, finalPrice);
}

/**
 * Mengevaluasi keputusan pembelian barang di pasar desa
 *
 * @param {Object} params
 * @param {number} params.userBalance - Saldo uang/fragmen pemain
 * @param {number} params.itemPrice - Harga satuan barang
 * @param {number} [params.quantity=1] - Jumlah barang yang ingin dibeli
 * @returns {Readonly<{
 *   isAllowed: boolean,
 *   reasonCode: string|null,
 *   totalPrice: number,
 *   shortage: number,
 *   remainingBalance: number
 * }>}
 */
function evaluatePurchaseDecision({ userBalance, itemPrice, quantity = 1 }) {
  const safeBalance = Math.max(0, Math.floor(Number(userBalance) || 0));
  const safePrice = Math.max(0, Math.floor(Number(itemPrice) || 0));
  const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));

  const totalPrice = safePrice * safeQty;

  if (safeBalance < totalPrice) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "INSUFFICIENT_FUNDS",
      totalPrice,
      shortage: totalPrice - safeBalance,
      remainingBalance: safeBalance,
    });
  }

  return Object.freeze({
    isAllowed: true,
    reasonCode: null,
    totalPrice,
    shortage: 0,
    remainingBalance: safeBalance - totalPrice,
  });
}

/**
 * Menghitung perolehan hasil jual barang panen/komoditas
 *
 * @param {Object} params
 * @param {number} params.unitPrice - Harga satuan barang
 * @param {number} [params.quantity=1] - Jumlah yang dijual
 * @param {number} [params.bonusMultiplier=1] - Pengali bonus (misal Sarung Tangan Midas)
 * @returns {Readonly<{
 *   totalGross: number,
 *   bonusEarned: number,
 *   totalEarned: number
 * }>}
 */
function calculateSellYield({ unitPrice, quantity = 1, bonusMultiplier = 1 }) {
  const safePrice = Math.max(0, Math.floor(Number(unitPrice) || 0));
  const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));
  const safeMultiplier = Math.max(1, Number(bonusMultiplier) || 1);

  const totalGross = safePrice * safeQty;
  const totalEarned = Math.floor(totalGross * safeMultiplier);
  const bonusEarned = Math.max(0, totalEarned - totalGross);

  return Object.freeze({
    totalGross,
    bonusEarned,
    totalEarned,
  });
}

module.exports = {
  VALID_VILLAGE_LOCATIONS,
  evaluateMarketAccess,
  calculateMarketItemPrice,
  evaluatePurchaseDecision,
  calculateSellYield,
};
