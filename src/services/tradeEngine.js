"use strict";

const redisManager = require("../managers/redisManager");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const COMMODITIES = {
  GOLDEN_WOOD: {
    id: "GOLDEN_WOOD",
    name: "Kayu Jati Emas 🪵",
    basePrice: 120,
    unit: "balok",
  },
  MYTHIC_FISH: {
    id: "MYTHIC_FISH",
    name: "Ikan Mitos Samudera 🐟",
    basePrice: 250,
    unit: "ekor",
  },
  COSMIC_ORE: {
    id: "COSMIC_ORE",
    name: "Bijih Kristal Kosmik 💎",
    basePrice: 380,
    unit: "bongkah",
  },
  ASTRAL_SILK: {
    id: "ASTRAL_SILK",
    name: "Kain Sutra Nebula 👘",
    basePrice: 500,
    unit: "gulung",
  },
};

const TRADE_ROUTES = {
  tokyo: {
    id: "tokyo",
    name: "Rute Badung ➔ Neo Tokyo Orbit 🚀",
    durationMinutes: 30,
    profitMarginPercent: 35,
    riskPercent: 15,
  },
  outpost: {
    id: "outpost",
    name: "Rute Badung ➔ Starlight Outpost 🌌",
    durationMinutes: 60,
    profitMarginPercent: 75,
    riskPercent: 30,
  },
  nexus: {
    id: "nexus",
    name: "Rute Badung ➔ Galactic Core Nexus 🪐",
    durationMinutes: 120,
    profitMarginPercent: 150,
    riskPercent: 45,
  },
};

class TradeEngine {
  /**
   * Ambil fluktuasi harga pasar bursa komoditas
   */
  getMarketPrices() {
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
    const result = {};

    for (const [k, v] of Object.entries(COMMODITIES)) {
      const fluctuation = ((hourSeed * 17 + k.length * 13) % 40) - 20; // -20% s/d +20%
      const currentPrice = Math.round(v.basePrice * (1 + fluctuation / 100));
      result[k] = {
        ...v,
        currentPrice,
        trend: fluctuation >= 0 ? `+${fluctuation}% 📈` : `${fluctuation}% 📉`,
      };
    }
    return result;
  }

  /**
   * Dapatkan rute perdagangan
   */
  getRoutes() {
    return TRADE_ROUTES;
  }

  /**
   * Berangkatkan karavan dagang baru
   */
  async dispatchCaravan(userId, displayName, routeId, commodityKey, amount) {
    const route = TRADE_ROUTES[routeId];
    if (!route) return { success: false, reason: "INVALID_ROUTE" };

    const comm = COMMODITIES[commodityKey];
    if (!comm) return { success: false, reason: "INVALID_COMMODITY" };

    if (!amount || amount < 5)
      return { success: false, reason: "MINIMUM_AMOUNT", min: 5 };

    return cacheManager.withLock(`lock:caravan:${userId}`, 5000, async () => {
      const existing = await this.getActiveCaravan(userId);
      if (existing && existing.status === "EN_ROUTE") {
        return {
          success: false,
          reason: "CARAVAN_ALREADY_ACTIVE",
          caravan: existing,
        };
      }

      const market = this.getMarketPrices();
      const unitPrice = market[commodityKey]?.currentPrice || comm.basePrice;
      const totalCost = unitPrice * amount;

      // Potong koin modal karavan secara atomik
      const debit = await cacheManager.debitUserProfile(
        userId,
        "economy_wallet",
        totalCost,
      );
      if (!debit.ok) {
        return {
          success: false,
          reason: "INSUFFICIENT_FUNDS",
          requiredCost: totalCost,
        };
      }

      const finishTime = Date.now() + route.durationMinutes * 60 * 1000;
      const potentialProfit = Math.round(
        totalCost * (1 + route.profitMarginPercent / 100),
      );

      const caravan = {
        id: `crv_${Date.now()}`,
        userId,
        displayName,
        route,
        commodity: comm,
        amount,
        investedCost: totalCost,
        potentialProfit,
        startTime: new Date().toISOString(),
        finishTime: new Date(finishTime).toISOString(),
        status: "EN_ROUTE",
      };

      const key = `caravan:active:${userId}`;
      if (redisManager.isReady) {
        try {
          await redisManager.set(
            key,
            JSON.stringify(caravan),
            route.durationMinutes * 60 + 3600,
          );
        } catch (_) {}
      }

      logger.info(
        `[TradeEngine] User ${displayName} memberangkatkan karavan ${comm.name} (${amount}x) via ${route.name}`,
      );
      return {
        success: true,
        caravan,
      };
    });
  }

  /**
   * Cek karavan yang sedang aktif
   */
  async getActiveCaravan(userId) {
    const key = `caravan:active:${userId}`;
    if (redisManager.isReady) {
      try {
        const raw = await redisManager.get(key);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
    }
    return null;
  }

  /**
   * Klaim laba hasil karavan yang telah tiba
   */
  async claimCaravanProfits(userId, displayName) {
    const caravan = await this.getActiveCaravan(userId);
    if (!caravan) return { success: false, reason: "NO_ACTIVE_CARAVAN" };

    const now = Date.now();
    const finish = new Date(caravan.finishTime).getTime();

    if (now < finish) {
      const remainingMinutes = Math.ceil((finish - now) / 60000);
      return { success: false, reason: "STILL_TRAVELING", remainingMinutes };
    }

    // Hitung apakah terkena penyergapan bandit berdasarkan risiko rute
    const roll = Math.random() * 100;
    let actualProfit = caravan.potentialProfit;
    let wasAmbushed = false;

    if (roll < caravan.route.riskPercent) {
      wasAmbushed = true;
      actualProfit = Math.round(caravan.potentialProfit * 0.7); // Diselamatkan 70%
    }

    // Tambah keuntungan ke dompet secara atomik
    await cacheManager.incrementUserProfile(
      userId,
      "economy_wallet",
      actualProfit,
    );

    // Hapus karavan aktif
    const key = `caravan:active:${userId}`;
    if (redisManager.isReady) {
      try {
        await redisManager.del(key);
      } catch (_) {}
    }

    logger.info(
      `[TradeEngine] User ${displayName} mengklaim laba karavan: +${actualProfit} koin (Ambushed: ${wasAmbushed})`,
    );
    return {
      success: true,
      profit: actualProfit,
      invested: caravan.investedCost,
      wasAmbushed,
      commodityName: caravan.commodity.name,
      amount: caravan.amount,
    };
  }

  /**
   * Bergabung sebagai pengawal bersenjata (Escort) karavan
   */
  async joinEscort(caravanId, userId, combatPower = 150) {
    try {
      const CaravanEscort = require("../models/CaravanEscort");
      const existing = await CaravanEscort.findOne({
        where: { caravanId, userId },
      });
      if (existing) return { success: false, reason: "ALREADY_ESCORTING" };

      const escort = await CaravanEscort.create({
        caravanId,
        userId,
        combatPower,
        profitSharePercent: 15,
      });

      return { success: true, escort };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Eksekusi serangan penjarahan PvP (Ambush Raid) terhadap karavan di rute berbahaya
   */
  async ambushCaravan(caravanId, raiderUserId, raiderPower = 200) {
    try {
      const TradeCaravan = require("../models/TradeCaravan");
      const CaravanEscort = require("../models/CaravanEscort");

      const caravan = await TradeCaravan.findOne({ where: { caravanId } });
      if (!caravan || caravan.status !== "EN_ROUTE") {
        return { success: false, reason: "CARAVAN_NOT_AVAILABLE" };
      }

      const escorts = await CaravanEscort.findAll({ where: { caravanId } });
      const totalDefensePower = escorts.reduce(
        (sum, e) => sum + (e.combatPower || 100),
        100, // modal dasar penjaga
      );

      const winChance = (raiderPower / (raiderPower + totalDefensePower)) * 100;
      const roll = Math.random() * 100;
      const isSuccessful = roll <= winChance;

      if (isSuccessful) {
        const lootAmount = Math.round(Number(caravan.potentialYield) * 0.4);
        await caravan.update({ status: "AMBUSHED" });
        await cacheManager.incrementUserProfile(
          raiderUserId,
          "economy_wallet",
          lootAmount,
        );

        return {
          success: true,
          raided: true,
          loot: lootAmount,
          winChance: Math.round(winChance),
        };
      } else {
        return {
          success: true,
          raided: false,
          damageTaken: 50,
          winChance: Math.round(winChance),
        };
      }
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }
}

module.exports = new TradeEngine();
