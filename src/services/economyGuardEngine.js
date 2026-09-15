"use strict";

/**
 * Lokasi: src/services/economyGuardEngine.js
 *
 * Algorithmic Anti-Inflation Circuit Breaker & Economic Security Guard.
 * Bertanggung jawab untuk:
 *   1. Memantau kecepatan sirkulasi mata uang (Velocity of Money) per pengguna.
 *   2. Menghitung tarif pajak pasar dinamis (Dynamic Market Tax: 3% - 12%)
 *      berdasarkan total suplai uang aktif di server untuk mencegah hiperinflasi.
 *   3. Mendeteksi anomali transfer saldo dan potensi eksploitasi multi-akun (alt abuse).
 *   4. Mengaktifkan Circuit Breaker otomatis untuk mengunci transaksi mencurigakan.
 *   5. Mencatat audit trail terstruktur ke MongoDB jika tersedia.
 */

const { logger } = require("../managers/logger");
const mongoManager = require("../managers/mongoManager");

// Konfigurasi Batas Keamanan Ekonomi
const DEFAULT_CONFIG = {
  windowMs: 300_000, // 5 menit jendela geser (rolling window)
  maxTransfersPerWindow: 8, // Maksimal 8 transfer per 5 menit
  maxVolumePerWindow: 250_000, // Maksimal 250.000 koin per 5 menit
  cooldownMs: 600_000, // 10 menit cooldown saat circuit breaker aktif
  baseTaxRate: 0.05, // 5% pajak dasar
  minTaxRate: 0.03, // 3% batas minimal
  maxTaxRate: 0.12, // 12% batas maksimal
  inflationThresholdTier1: 5_000_000, // > 5jt koin suplai -> tax naik
  inflationThresholdTier2: 20_000_000, // > 20jt koin suplai -> tax max
};

class EconomyGuardEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Map<userId, Array<{ timestamp: number, amount: number, receiverId: string, type: string }>>
    this.userTransfers = new Map();
    // Map<userId, { blockedUntil: number, reason: string }>
    this.blockedUsers = new Map();
  }

  /**
   * Bersihkan riwayat transaksi yang sudah di luar jendela geser (window).
   * @param {string} userId
   */
  _pruneOldTransfers(userId) {
    const list = this.userTransfers.get(userId);
    if (!list || list.length === 0) return;
    const cutoff = Date.now() - this.config.windowMs;
    const fresh = list.filter((t) => t.timestamp >= cutoff);
    if (fresh.length === 0) {
      this.userTransfers.delete(userId);
    } else {
      this.userTransfers.set(userId, fresh);
    }
  }

  /**
   * Hitung tarif pajak dinamis pasar/lelang berdasarkan total suplai koin.
   * @param {number} totalMoneySupply - Total koin beredar di server/ekosistem.
   * @returns {number} Tarif pajak dalam desimal (misal 0.05 = 5%).
   */
  calculateDynamicTax(totalMoneySupply = 0, premiumTier = "none") {
    const supply = Math.max(0, Number(totalMoneySupply) || 0);
    const {
      minTaxRate,
      maxTaxRate,
      baseTaxRate,
      inflationThresholdTier1,
      inflationThresholdTier2,
    } = this.config;

    let calculatedRate = baseTaxRate;
    if (supply <= 0) {
      calculatedRate = baseTaxRate;
    } else if (supply < inflationThresholdTier1) {
      // Suplai rendah: beri insentif transaksi (3% - 5%)
      const ratio = supply / inflationThresholdTier1;
      calculatedRate = Number(
        (minTaxRate + (baseTaxRate - minTaxRate) * ratio).toFixed(4),
      );
    } else if (supply >= inflationThresholdTier2) {
      calculatedRate = maxTaxRate;
    } else {
      // Di antara Tier 1 dan Tier 2: interpolasi naik menuju maxTaxRate
      const ratio =
        (supply - inflationThresholdTier1) /
        (inflationThresholdTier2 - inflationThresholdTier1);
      calculatedRate = Number((baseTaxRate + (maxTaxRate - baseTaxRate) * ratio).toFixed(4));
    }

    // Terapkan Diskon Tax Haven untuk Anggota V.I.P
    if (premiumTier && premiumTier !== "none") {
      const { getMarketTaxDiscount } = require("../premium/premiumHelper");
      const discount = getMarketTaxDiscount(premiumTier);
      if (discount > 0) {
        calculatedRate = Number((calculatedRate * (1 - discount)).toFixed(4));
      }
    }

    return calculatedRate;
  }

  /**
   * Periksa apakah Circuit Breaker aktif untuk pengguna tertentu.
   * @param {string} userId
   * @returns {{ isBlocked: boolean, remainingMs: number, reason: string }}
   */
  checkCircuitBreaker(userId) {
    if (!userId) return { isBlocked: false, remainingMs: 0, reason: "" };
    const blockInfo = this.blockedUsers.get(userId);
    if (!blockInfo) return { isBlocked: false, remainingMs: 0, reason: "" };

    const remainingMs = blockInfo.blockedUntil - Date.now();
    if (remainingMs <= 0) {
      this.blockedUsers.delete(userId);
      return { isBlocked: false, remainingMs: 0, reason: "" };
    }

    return {
      isBlocked: true,
      remainingMs,
      reason: blockInfo.reason,
    };
  }

  /**
   * Evaluasi transaksi dan catat riwayat. Jika mencurigakan, aktifkan Circuit Breaker.
   * @param {string} senderId - ID pengguna pengirim.
   * @param {string} receiverId - ID pengguna penerima.
   * @param {number} amount - Jumlah koin yang ditransfer.
   * @param {string} [type='transfer'] - Tipe transaksi ('pay', 'market', 'auction', dll).
   * @returns {{ allowed: boolean, reason?: string, warning?: boolean }}
   */
  evaluateTransaction(senderId, receiverId, amount, type = "transfer") {
    if (!senderId || !receiverId)
      return { allowed: false, reason: "ID pengguna tidak valid." };
    if (senderId === receiverId)
      return {
        allowed: false,
        reason: "Pengirim dan penerima tidak boleh sama.",
      };

    const transferAmount = Number(amount) || 0;
    if (transferAmount <= 0)
      return { allowed: false, reason: "Jumlah transfer harus lebih dari 0." };

    // 1. Cek status Circuit Breaker
    const status = this.checkCircuitBreaker(senderId);
    if (status.isBlocked) {
      const minutesLeft = Math.ceil(status.remainingMs / 60000);
      return {
        allowed: false,
        reason: `Circuit Breaker aktif! Transaksi ditolak sementara selama ${minutesLeft} menit lagi karena aktivitas anomali (${status.reason}).`,
      };
    }

    // 2. Bersihkan catatan lama
    this._pruneOldTransfers(senderId);
    const history = this.userTransfers.get(senderId) || [];

    // 3. Hitung metrik kecepatan transaksi (Velocity)
    const currentCount = history.length + 1;
    const currentVolume =
      history.reduce((sum, t) => sum + t.amount, 0) + transferAmount;

    // 4. Deteksi anomali frekuensi transaksi (Rapid Burst)
    if (currentCount > this.config.maxTransfersPerWindow) {
      this._tripCircuitBreaker(
        senderId,
        "Frekuensi transfer terlalu tinggi dalam waktu singkat (Spam Transfer).",
      );
      this._logSuspiciousEvent(
        senderId,
        receiverId,
        transferAmount,
        "EXCESSIVE_TRANSFER_FREQUENCY",
      );
      return {
        allowed: false,
        reason:
          "Terdeteksi lonjakan frekuensi transfer berlebihan. Akun diblokir sementara dari transaksi selama 10 menit.",
      };
    }

    // 5. Deteksi anomali volume transaksi (Drain Attack)
    if (currentVolume > this.config.maxVolumePerWindow) {
      this._tripCircuitBreaker(
        senderId,
        "Volume akumulasi transfer melampaui batas keamanan jendela waktu.",
      );
      this._logSuspiciousEvent(
        senderId,
        receiverId,
        transferAmount,
        "EXCESSIVE_TRANSFER_VOLUME",
      );
      return {
        allowed: false,
        reason:
          "Total volume transfer Anda melampaui batas keamanan. Silakan coba lagi setelah 10 menit.",
      };
    }

    // 6. Catat transaksi valid ke memori
    history.push({
      timestamp: Date.now(),
      amount: transferAmount,
      receiverId,
      type,
    });
    this.userTransfers.set(senderId, history);

    return { allowed: true };
  }

  /**
   * Aktifkan Circuit Breaker secara internal untuk pengguna.
   * @param {string} userId
   * @param {string} reason
   */
  _tripCircuitBreaker(userId, reason) {
    const blockedUntil = Date.now() + this.config.cooldownMs;
    this.blockedUsers.set(userId, { blockedUntil, reason });
    logger.warn(
      `[EconomyGuard] Circuit Breaker diaktifkan untuk user ${userId}: ${reason}`,
    );
  }

  /**
   * Catat log audit anomali ke MongoDB dan logger.
   * @param {string} senderId
   * @param {string} receiverId
   * @param {number} amount
   * @param {string} alertType
   */
  async _logSuspiciousEvent(senderId, receiverId, amount, alertType) {
    const payload = {
      senderId,
      receiverId,
      amount,
      alertType,
      timestamp: new Date(),
    };

    logger.warn(
      `[EconomyGuard Audit] ${alertType} - Sender: ${senderId} -> Receiver: ${receiverId}, Amount: ${amount}`,
    );

    try {
      if (mongoManager && mongoManager.isConnected()) {
        const db = mongoManager.getDb();
        if (db) {
          await db
            .collection("economy_security_alerts")
            .insertOne(payload)
            .catch(() => {});
        }
      }
    } catch (_e) {
      // Abaikan kegagalan log jika Mongo tidak aktif
    }
  }

  /**
   * Buka kunci Circuit Breaker secara manual (untuk administrator).
   * @param {string} userId
   * @returns {boolean}
   */
  resetCircuitBreaker(userId) {
    if (!this.blockedUsers.has(userId)) return false;
    this.blockedUsers.delete(userId);
    this.userTransfers.delete(userId);
    return true;
  }
}

// Ekspor instance singleton
const economyGuard = new EconomyGuardEngine();
economyGuard.EconomyGuardEngine = EconomyGuardEngine;

module.exports = economyGuard;
