'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const economyGuard = require('./economyGuardEngine');
const { EconomyGuardEngine } = economyGuard;

describe('EconomyGuardEngine - Anti-Inflation & Circuit Breaker', () => {
    let engine;

    beforeEach(() => {
        engine = new EconomyGuardEngine({
            windowMs: 5000,
            maxTransfersPerWindow: 3,
            maxVolumePerWindow: 10000,
            cooldownMs: 60000,
            baseTaxRate: 0.05,
            minTaxRate: 0.03,
            maxTaxRate: 0.12,
            inflationThresholdTier1: 100000,
            inflationThresholdTier2: 500000,
        });
    });

    it('menghitung pajak dinamis pasar dengan benar berdasarkan suplai koin', () => {
        // Suplai 0 -> base tax
        assert.equal(engine.calculateDynamicTax(0), 0.05);

        // Suplai 50.000 (di bawah Tier 1) -> 0.03 + (0.05 - 0.03) * 0.5 = 0.04
        assert.equal(engine.calculateDynamicTax(50000), 0.04);

        // Suplai 100.000 (tepat Tier 1) -> 0.05
        assert.equal(engine.calculateDynamicTax(100000), 0.05);

        // Suplai 300.000 (setengah jalan ke Tier 2) -> 0.05 + (0.12 - 0.05) * 0.5 = 0.085
        assert.equal(engine.calculateDynamicTax(300000), 0.085);

        // Suplai 500.000+ (Tier 2 maksimum) -> 0.12
        assert.equal(engine.calculateDynamicTax(600000), 0.12);
    });

    it('mengizinkan transaksi normal dalam batas keamanan', () => {
        const res1 = engine.evaluateTransaction('userA', 'userB', 1000, 'pay');
        assert.equal(res1.allowed, true);

        const res2 = engine.evaluateTransaction('userA', 'userC', 2000, 'pay');
        assert.equal(res2.allowed, true);
    });

    it('menolak transaksi dengan pengirim dan penerima yang sama', () => {
        const res = engine.evaluateTransaction('userA', 'userA', 1000, 'pay');
        assert.equal(res.allowed, false);
        assert.match(res.reason, /tidak boleh sama/);
    });

    it('mengaktifkan Circuit Breaker saat melebihi frekuensi transfer maksimal (Burst Spam)', () => {
        engine.evaluateTransaction('userA', 'userB', 500);
        engine.evaluateTransaction('userA', 'userC', 500);
        engine.evaluateTransaction('userA', 'userD', 500);

        // Transaksi ke-4 melebihi batas 3 transfer per window
        const res = engine.evaluateTransaction('userA', 'userE', 500);
        assert.equal(res.allowed, false);
        assert.match(res.reason, /frekuensi transfer/);

        // Cek status Circuit Breaker
        const block = engine.checkCircuitBreaker('userA');
        assert.equal(block.isBlocked, true);
    });

    it('mengaktifkan Circuit Breaker saat melebihi volume transfer maksimal (Drain Attack)', () => {
        const res1 = engine.evaluateTransaction('userX', 'userY', 6000);
        assert.equal(res1.allowed, true);

        // Transaksi ke-2 membawa akumulasi volume menjadi 12.000 (batas 10.000)
        const res2 = engine.evaluateTransaction('userX', 'userZ', 6000);
        assert.equal(res2.allowed, false);
        assert.match(res2.reason, /volume/);
    });

    it('dapat me-reset Circuit Breaker secara manual oleh admin', () => {
        engine.evaluateTransaction('userA', 'userB', 500);
        engine.evaluateTransaction('userA', 'userC', 500);
        engine.evaluateTransaction('userA', 'userD', 500);
        engine.evaluateTransaction('userA', 'userE', 500); // Trigger circuit breaker

        assert.equal(engine.checkCircuitBreaker('userA').isBlocked, true);

        const resetSuccess = engine.resetCircuitBreaker('userA');
        assert.equal(resetSuccess, true);
        assert.equal(engine.checkCircuitBreaker('userA').isBlocked, false);

        // Sekarang bisa transaksi lagi
        const resNew = engine.evaluateTransaction('userA', 'userB', 100);
        assert.equal(resNew.allowed, true);
    });
});
