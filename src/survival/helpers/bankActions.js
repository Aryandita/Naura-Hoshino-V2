"use strict";

// Seluruh transaksi Naura Central Bank.
//
// Dua aturan yang dipegang di seluruh berkas ini:
//
// 1. Objek profil berasal dari cacheManager.getUserProfile(), yang mengembalikan
//    JSON biasa. Objek itu TIDAK punya .save() maupun .changed(). Versi
//    sebelumnya memanggil keduanya, sehingga setiap transaksi bank berakhir
//    dengan TypeError. Semua penulisan sekarang lewat cacheManager.
//
// 2. Uang selalu dipotong lebih dulu, baru dikreditkan. Urutan ini membuat klik
//    ganda kehilangan balapan pada langkah pertama, bukan menerbitkan uang baru
//    pada langkah kedua.

const UserSurvival = require("../../models/UserSurvival");
const cacheManager = require("../../managers/cacheManager");
const currencyHelper = require("../engines/currency");
const {
  EMPTY_DEPOSIT,
  MIN_DEPOSIT_COIN,
  MIN_INVEST_COIN,
  termOf,
  assetOf,
} = require("../data/bankConfig");

const COIN = currencyHelper.byKind(currencyHelper.COIN);
const FRAGMENT = currencyHelper.byKind(currencyHelper.FRAGMENT);

async function freshData(userId) {
  const survival = await UserSurvival.findOne({ where: { userId } });
  const profile = await cacheManager.getUserProfile(userId);
  return { survival, profile, holders: { survival, profile } };
}

function parseAmount(input) {
  const value = parseInt(String(input || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(value) ? value : NaN;
}

/** Saldo lengkap untuk ditampilkan di kartu bank. */
function snapshot({ survival, profile, holders }) {
  return {
    fragment: currencyHelper.balanceOf(FRAGMENT, holders),
    coin: currencyHelper.balanceOf(COIN, holders),
    coupon: currencyHelper.balanceOf(currencyHelper.COUPON, holders),
    bank: Number(profile.economy_bank) || 0,
    deposit: profile.economy_deposit || { ...EMPTY_DEPOSIT },
    investments: profile.economy_investments || {},
    day: survival.inGameDay || 1,
  };
}

// ==========================================
// PENUKARAN MATA UANG (1000 NSF = 1 Naura Coin)
// ==========================================
async function exchangeMoney(userId, fromKind, toKind, rawAmount) {
  const amount = parseAmount(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, reason: "invalid_amount" };

  const data = await freshData(userId);
  if (!data.survival || !data.profile)
    return { ok: false, reason: "no_profile" };

  return currencyHelper.exchange(data.holders, fromKind, toKind, amount);
}

// ==========================================
// TABUNGAN: pindah antara dompet Coin dan rekening bank
// ==========================================
async function moveSavings(userId, rawAmount, toBank) {
  const amount = parseAmount(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, reason: "invalid_amount" };

  const { profile, holders } = await freshData(userId);
  if (!profile) return { ok: false, reason: "no_profile" };

  const bank = Number(profile.economy_bank) || 0;
  const wallet = currencyHelper.balanceOf(COIN, holders);

  const source = toBank ? "economy_wallet" : "economy_bank";
  const target = toBank ? "economy_bank" : "economy_wallet";
  const available = toBank ? wallet : bank;

  const debit = await cacheManager.debitUserProfile(userId, source, amount);
  if (!debit.ok)
    return {
      ok: false,
      reason: "insufficient",
      shortage: Math.max(1, amount - available),
    };

  await cacheManager.incrementUserProfile(userId, { [target]: amount });

  const fresh = await cacheManager.getUserProfile(userId);
  return {
    ok: true,
    amount,
    toBank,
    bank: Number((fresh || {}).economy_bank) || 0,
    wallet: Number((fresh || {}).economy_wallet) || 0,
  };
}

// ==========================================
// DEPOSITO BERJANGKA
// ==========================================
async function createDeposit(userId, termKey, rawAmount) {
  const term = termOf(termKey);
  if (!term) return { ok: false, reason: "unknown_term" };

  const amount = parseAmount(rawAmount);
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_COIN) {
    return { ok: false, reason: "below_minimum", minimum: MIN_DEPOSIT_COIN };
  }

  const { survival, profile } = await freshData(userId);
  if (!survival || !profile) return { ok: false, reason: "no_profile" };

  const existing = profile.economy_deposit || {};
  if (Number(existing.amount) > 0)
    return { ok: false, reason: "already_active" };

  const bank = Number(profile.economy_bank) || 0;
  const debit = await cacheManager.debitUserProfile(
    userId,
    "economy_bank",
    amount,
  );
  if (!debit.ok)
    return {
      ok: false,
      reason: "insufficient",
      shortage: Math.max(1, amount - bank),
    };

  const currentDay = survival.inGameDay || 1;
  const written = await cacheManager.mutateUserProfileJson(
    userId,
    "economy_deposit",
    () => ({
      amount,
      unlockDay: currentDay + term.days,
      interestRate: term.rate,
      termName: term.name,
    }),
  );

  // Uang sudah keluar dari rekening; bila pencatatan depositonya gagal, uang itu
  // harus dikembalikan alih-alih menghilang.
  if (!written) {
    await cacheManager.incrementUserProfile(userId, { economy_bank: amount });
    return { ok: false, reason: "write_failed" };
  }

  return { ok: true, amount, term, unlockDay: currentDay + term.days };
}

async function claimDeposit(userId) {
  const { survival, profile } = await freshData(userId);
  if (!survival || !profile) return { ok: false, reason: "no_profile" };

  const dep = profile.economy_deposit || {};
  const amount = Number(dep.amount) || 0;
  if (amount <= 0) return { ok: false, reason: "no_deposit" };

  const currentDay = survival.inGameDay || 1;
  if (currentDay < Number(dep.unlockDay || 0)) {
    return {
      ok: false,
      reason: "locked",
      daysLeft: Number(dep.unlockDay) - currentDay,
    };
  }

  // Depositonya dikosongkan LEBIH DULU. Klik kedua yang datang bersamaan akan
  // membaca deposito kosong dan berhenti di 'no_deposit', bukan mencairkan
  // bunga untuk kedua kalinya.
  const cleared = await cacheManager.mutateUserProfileJson(
    userId,
    "economy_deposit",
    () => ({}),
  );
  if (!cleared) return { ok: false, reason: "write_failed" };

  const interest = Math.floor(amount * (Number(dep.interestRate) || 0));
  const payout = amount + interest;
  await cacheManager.incrementUserProfile(userId, { economy_bank: payout });

  return {
    ok: true,
    amount,
    interest,
    payout,
    termName: dep.termName || "Deposito",
  };
}

// ==========================================
// INVESTASI
// Semua data disimpan di profile.economy_investments dengan bentuk yang sama,
// supaya tidak ada lagi dua tempat penyimpanan yang saling bertabrakan.
// ==========================================
async function buyInvestment(userId, assetKey, rawAmount) {
  const asset = assetOf(assetKey);
  if (!asset) return { ok: false, reason: "unknown_asset" };

  const amount = parseAmount(rawAmount);
  if (!Number.isFinite(amount) || amount < MIN_INVEST_COIN) {
    return { ok: false, reason: "below_minimum", minimum: MIN_INVEST_COIN };
  }

  const { survival, profile } = await freshData(userId);
  if (!survival || !profile) return { ok: false, reason: "no_profile" };

  const investments = { ...(profile.economy_investments || {}) };
  if (investments[assetKey] && Number(investments[assetKey].principal) > 0) {
    return { ok: false, reason: "already_active" };
  }

  const bank = Number(profile.economy_bank) || 0;
  const debit = await cacheManager.debitUserProfile(
    userId,
    "economy_bank",
    amount,
  );
  if (!debit.ok)
    return {
      ok: false,
      reason: "insufficient",
      shortage: Math.max(1, amount - bank),
    };

  const currentDay = survival.inGameDay || 1;
  const written = await cacheManager.mutateUserProfileJson(
    userId,
    "economy_investments",
    (current) => {
      const invs = { ...(current || {}) };
      invs[assetKey] = { principal: amount, buyDay: currentDay };
      return invs;
    },
  );

  if (!written) {
    await cacheManager.incrementUserProfile(userId, { economy_bank: amount });
    return { ok: false, reason: "write_failed" };
  }

  return { ok: true, asset, amount };
}

async function sellInvestment(userId, assetKey) {
  const asset = assetOf(assetKey);
  if (!asset) return { ok: false, reason: "unknown_asset" };

  const { survival, profile } = await freshData(userId);
  if (!survival || !profile) return { ok: false, reason: "no_profile" };

  const investments = { ...(profile.economy_investments || {}) };
  const entry = investments[assetKey];
  const principal = entry ? Number(entry.principal) || 0 : 0;
  if (principal <= 0) return { ok: false, reason: "no_asset" };

  const elapsed = Math.max(
    0,
    (survival.inGameDay || 1) - (Number(entry.buyDay) || 1),
  );
  const value = Math.max(0, asset.calcValue(principal, elapsed));
  const profit = value - principal;

  const cleared = await cacheManager.mutateUserProfileJson(
    userId,
    "economy_investments",
    (current) => {
      const investments = { ...(current || {}) };
      delete investments[assetKey];
      return investments;
    },
  );
  if (!cleared) return { ok: false, reason: "write_failed" };

  await cacheManager.incrementUserProfile(userId, { economy_bank: value });

  return {
    ok: true,
    asset,
    principal,
    elapsed,
    value,
    profit,
    roi: principal > 0 ? (profit / principal) * 100 : 0,
  };
}

/** Nilai portofolio saat ini untuk ditampilkan di papan investasi. */
function valuate(investments, day) {
  const result = {};
  Object.entries(investments || {}).forEach(([key, entry]) => {
    const asset = assetOf(key);
    const principal = entry ? Number(entry.principal) || 0 : 0;
    if (!asset || principal <= 0) return;
    const elapsed = Math.max(0, day - (Number(entry.buyDay) || 1));
    const value = asset.calcValue(principal, elapsed);
    result[key] = {
      principal,
      elapsed,
      value,
      roi: ((value - principal) / principal) * 100,
    };
  });
  return result;
}

module.exports = {
  freshData,
  snapshot,
  parseAmount,
  exchangeMoney,
  moveSavings,
  createDeposit,
  claimDeposit,
  buyInvestment,
  sellInvestment,
  valuate,
};
