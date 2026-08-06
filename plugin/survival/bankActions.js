'use strict';

// Seluruh transaksi Naura Central Bank. Semua fungsi selalu membaca data
// terbaru lebih dulu, supaya saldo tidak bisa dipakai dua kali lewat dua
// kolektor yang terbuka bersamaan.

const UserSurvival = require('../../src/models/UserSurvival');
const cacheManager = require('../../src/managers/cacheManager');
const currencyHelper = require('./currency');
const {
    EMPTY_DEPOSIT,
    MIN_DEPOSIT_COIN,
    MIN_INVEST_COIN,
    termOf,
    assetOf
} = require('./bankConfig');

const COIN = currencyHelper.byKind(currencyHelper.COIN);
const FRAGMENT = currencyHelper.byKind(currencyHelper.FRAGMENT);

async function freshData(userId) {
    const survival = await UserSurvival.findOne({ where: { userId } });
    const profile = await cacheManager.getUserProfile(userId);
    return { survival, profile, holders: { survival, profile } };
}

function parseAmount(input) {
    const value = parseInt(String(input || '').replace(/[^0-9]/g, ''), 10);
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
        day: survival.inGameDay || 1
    };
}

// ==========================================
// PENUKARAN MATA UANG (1000 NSF = 1 Naura Coin)
// ==========================================
async function exchangeMoney(userId, fromKind, toKind, rawAmount) {
    const amount = parseAmount(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };

    const data = await freshData(userId);
    if (!data.survival || !data.profile) return { ok: false, reason: 'no_profile' };

    return currencyHelper.exchange(data.holders, fromKind, toKind, amount);
}

// ==========================================
// TABUNGAN: pindah antara dompet Coin dan rekening bank
// ==========================================
async function moveSavings(userId, rawAmount, toBank) {
    const amount = parseAmount(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };

    const { profile, holders } = await freshData(userId);
    if (!profile) return { ok: false, reason: 'no_profile' };

    const bank = Number(profile.economy_bank) || 0;
    const wallet = currencyHelper.balanceOf(COIN, holders);

    if (toBank) {
        if (wallet < amount) return { ok: false, reason: 'insufficient', shortage: amount - wallet };
        await currencyHelper.charge(COIN, holders, amount);
        profile.economy_bank = bank + amount;
    } else {
        if (bank < amount) return { ok: false, reason: 'insufficient', shortage: amount - bank };
        profile.economy_bank = bank - amount;
        await currencyHelper.reward(COIN, holders, amount);
    }

    await profile.save();
    return {
        ok: true,
        amount,
        toBank,
        bank: Number(profile.economy_bank) || 0,
        wallet: currencyHelper.balanceOf(COIN, { profile })
    };
}

// ==========================================
// DEPOSITO BERJANGKA
// ==========================================
async function createDeposit(userId, termKey, rawAmount) {
    const term = termOf(termKey);
    if (!term) return { ok: false, reason: 'unknown_term' };

    const amount = parseAmount(rawAmount);
    if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_COIN) {
        return { ok: false, reason: 'below_minimum', minimum: MIN_DEPOSIT_COIN };
    }

    const { survival, profile } = await freshData(userId);
    if (!survival || !profile) return { ok: false, reason: 'no_profile' };

    const existing = profile.economy_deposit || {};
    if (Number(existing.amount) > 0) return { ok: false, reason: 'already_active' };

    const bank = Number(profile.economy_bank) || 0;
    if (bank < amount) return { ok: false, reason: 'insufficient', shortage: amount - bank };

    const currentDay = survival.inGameDay || 1;
    profile.economy_bank = bank - amount;
    profile.economy_deposit = {
        amount,
        unlockDay: currentDay + term.days,
        interestRate: term.rate,
        termName: term.name
    };
    profile.changed('economy_deposit', true);
    await profile.save();

    return { ok: true, amount, term, unlockDay: currentDay + term.days };
}

async function claimDeposit(userId) {
    const { survival, profile } = await freshData(userId);
    if (!survival || !profile) return { ok: false, reason: 'no_profile' };

    const dep = profile.economy_deposit || {};
    const amount = Number(dep.amount) || 0;
    if (amount <= 0) return { ok: false, reason: 'no_deposit' };

    const currentDay = survival.inGameDay || 1;
    if (currentDay < Number(dep.unlockDay || 0)) {
        return { ok: false, reason: 'locked', daysLeft: Number(dep.unlockDay) - currentDay };
    }

    const interest = Math.floor(amount * (Number(dep.interestRate) || 0));
    const payout = amount + interest;

    profile.economy_bank = (Number(profile.economy_bank) || 0) + payout;
    profile.economy_deposit = { ...EMPTY_DEPOSIT };
    profile.changed('economy_deposit', true);
    await profile.save();

    return { ok: true, amount, interest, payout, termName: dep.termName || 'Deposito' };
}

// ==========================================
// INVESTASI
// Semua data disimpan di profile.economy_investments dengan bentuk yang sama,
// supaya tidak ada lagi dua tempat penyimpanan yang saling bertabrakan.
// ==========================================
async function buyInvestment(userId, assetKey, rawAmount) {
    const asset = assetOf(assetKey);
    if (!asset) return { ok: false, reason: 'unknown_asset' };

    const amount = parseAmount(rawAmount);
    if (!Number.isFinite(amount) || amount < MIN_INVEST_COIN) {
        return { ok: false, reason: 'below_minimum', minimum: MIN_INVEST_COIN };
    }

    const { survival, profile } = await freshData(userId);
    if (!survival || !profile) return { ok: false, reason: 'no_profile' };

    const investments = { ...(profile.economy_investments || {}) };
    if (investments[assetKey] && Number(investments[assetKey].principal) > 0) {
        return { ok: false, reason: 'already_active' };
    }

    const bank = Number(profile.economy_bank) || 0;
    if (bank < amount) return { ok: false, reason: 'insufficient', shortage: amount - bank };

    investments[assetKey] = { principal: amount, buyDay: survival.inGameDay || 1 };
    profile.economy_bank = bank - amount;
    profile.economy_investments = investments;
    profile.changed('economy_investments', true);
    await profile.save();

    return { ok: true, asset, amount };
}

async function sellInvestment(userId, assetKey) {
    const asset = assetOf(assetKey);
    if (!asset) return { ok: false, reason: 'unknown_asset' };

    const { survival, profile } = await freshData(userId);
    if (!survival || !profile) return { ok: false, reason: 'no_profile' };

    const investments = { ...(profile.economy_investments || {}) };
    const entry = investments[assetKey];
    const principal = entry ? Number(entry.principal) || 0 : 0;
    if (principal <= 0) return { ok: false, reason: 'no_asset' };

    const elapsed = Math.max(0, (survival.inGameDay || 1) - (Number(entry.buyDay) || 1));
    const value = Math.max(0, asset.calcValue(principal, elapsed));
    const profit = value - principal;

    delete investments[assetKey];
    profile.economy_bank = (Number(profile.economy_bank) || 0) + value;
    profile.economy_investments = investments;
    profile.changed('economy_investments', true);
    await profile.save();

    return {
        ok: true,
        asset,
        principal,
        elapsed,
        value,
        profit,
        roi: principal > 0 ? (profit / principal) * 100 : 0
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
            roi: ((value - principal) / principal) * 100
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
    valuate
};
