"use strict";

const redisManager = require("../managers/redisManager");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");
const worldEventEngine = require("../survival/engines/worldEventEngine");

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
   * Ambil fluktuasi harga pasar bursa komoditas dengan guncangan makro event
   * @param {Date} [date=new Date()]
   */
  getMarketPrices(date = new Date()) {
    const hourSeed = Math.floor(date.getTime() / (1000 * 60 * 60));
    const macroModifiers = worldEventEngine.getCommodityModifiers(date);
    const result = {};

    for (const [k, v] of Object.entries(COMMODITIES)) {
      const baseFluctuation = ((hourSeed * 17 + k.length * 13) % 40) - 20; // -20% s/d +20%
      const shock = macroModifiers[k];
      const macroMultiplier = shock ? shock.multiplier : 1.0;

      const currentPrice = Math.round(v.basePrice * (1 + baseFluctuation / 100) * macroMultiplier);
      const netPct = Math.round(((currentPrice - v.basePrice) / v.basePrice) * 100);

      result[k] = {
        ...v,
        currentPrice,
        trend: netPct >= 0 ? `+${netPct}% 📈` : `${netPct}% 📉`,
        macroShock: shock ? shock.reason : null,
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
  async dispatchCaravan(
    userId,
    displayName,
    routeId,
    commodityKey,
    amount,
    guildId = "global",
  ) {
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

      // Simpan ke PostgreSQL TradeCaravan
      try {
        const TradeCaravan = require("../models/TradeCaravan");
        await TradeCaravan.create({
          caravanId: caravan.id,
          guildId: guildId || "global",
          creatorUserId: userId,
          routeId: route.id,
          cargo: { commodityKey, amount, commodityName: comm.name },
          status: "EN_ROUTE",
          departureTime: new Date(caravan.startTime),
          estimatedArrival: new Date(finishTime),
          totalInvestment: totalCost,
          potentialYield: potentialProfit,
        });
      } catch (err) {
        logger.warn(
          `[TradeEngine] Gagal menyimpan TradeCaravan ke DB: ${err.message}`,
        );
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
   * Mengambil daftar seluruh karavan yang sedang aktif meluncur (Galactic Caravan Radar)
   * @param {number} [limit=10]
   * @returns {Promise<Array<object>>}
   */
  async getActiveCaravans(limit = 10) {
    try {
      const TradeCaravan = require("../models/TradeCaravan");
      const rows = await TradeCaravan.findAll({
        where: { status: "EN_ROUTE" },
        order: [["departureTime", "DESC"]],
        limit,
      });

      if (rows && rows.length > 0) {
        return rows.map((c) => ({
          id: c.caravanId,
          userId: c.creatorUserId,
          routeId: c.routeId,
          routeName: TRADE_ROUTES[c.routeId]?.name || c.routeId,
          cargo: c.cargo,
          status: c.status,
          departureTime: c.departureTime,
          estimatedArrival: c.estimatedArrival,
          totalInvestment: c.totalInvestment,
          potentialYield: c.potentialYield,
          escortsCount: c.escortsCount || 0,
        }));
      }
    } catch (_) {}

    // Fallback radar simulated data jika belum ada karavan yang meluncur
    return [
      {
        id: "crv_neo_tokyo_01",
        userId: "pilot_starlight",
        routeId: "tokyo",
        routeName: "Rute Badung ➔ Neo Tokyo Orbit 🚀",
        cargo: { commodityName: "Kayu Jati Emas 🪵", amount: 25 },
        status: "EN_ROUTE",
        departureTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        estimatedArrival: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
        totalInvestment: 3000,
        potentialYield: 4050,
        escortsCount: 2,
      },
      {
        id: "crv_nexus_core_02",
        userId: "astral_merchant",
        routeId: "nexus",
        routeName: "Rute Badung ➔ Galactic Core Nexus 🪐",
        cargo: { commodityName: "Bijih Kristal Kosmik 💎", amount: 15 },
        status: "EN_ROUTE",
        departureTime: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        estimatedArrival: new Date(Date.now() + 80 * 60 * 1000).toISOString(),
        totalInvestment: 5700,
        potentialYield: 14250,
        escortsCount: 4,
      },
    ];
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

    // Update TradeCaravan di database bila ada
    try {
      const TradeCaravan = require("../models/TradeCaravan");
      await TradeCaravan.update(
        { status: wasAmbushed ? "AMBUSHED" : "CLAIMED" },
        { where: { caravanId: caravan.id } },
      );
    } catch (_) {}

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
    return cacheManager.withLock(
      `lock:caravan:ambush:${caravanId}`,
      5000,
      async () => {
        try {
          const TradeCaravan = require("../models/TradeCaravan");
          const CaravanEscort = require("../models/CaravanEscort");

          const caravan = await TradeCaravan.findOne({ where: { caravanId } });
          if (!caravan || caravan.status !== "EN_ROUTE") {
            return { success: false, reason: "CARAVAN_NOT_AVAILABLE" };
          }

          if (caravan.creatorUserId === raiderUserId) {
            return { success: false, reason: "CANNOT_AMBUSH_OWN_CARAVAN" };
          }

          const escorts = await CaravanEscort.findAll({ where: { caravanId } });
          const totalDefensePower = escorts.reduce(
            (sum, e) => sum + (e.combatPower || 100),
            100, // modal dasar penjaga
          );

          const winChance =
            (raiderPower / (raiderPower + totalDefensePower)) * 100;
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

            // Update cache aktif jika ada
            const key = `caravan:active:${caravan.creatorUserId}`;
            if (redisManager.isReady) {
              try {
                const raw = await redisManager.get(key);
                if (raw) {
                  const c = JSON.parse(raw);
                  c.status = "AMBUSHED";
                  await redisManager.set(key, JSON.stringify(c), 3600);
                }
              } catch (_) {}
            }

            // Broadcast ambush alert via WebSocket & Web Push
            this.broadcastAmbushAlert({
              caravanId,
              ownerUserId: caravan.creatorUserId,
              routeName: TRADE_ROUTES[caravan.routeId]?.name || caravan.routeId,
              raiderName: `Raider_${raiderUserId}`,
              lootAmount,
            });

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
      },
    );
  }

  /**
   * Mengirimkan notifikasi penyergapan karavan secara real-time ke Web Push & WebSocket
   * @param {object} alertData
   */
  async broadcastAmbushAlert(alertData) {
    try {
      logger.warn(
        `🚨 [TradeEngine Ambush Alert] Karavan ${alertData.caravanId} disergap! Korban: ${alertData.ownerUserId}, Loot: ${alertData.lootAmount}`,
      );
      const axios = require("axios");
      const env = require("../config/env");
      const port = env.DASHBOARD_PORT || 3000;
      await axios
        .post(`http://127.0.0.1:${port}/api/caravan/ambush-alert`, alertData, {
          timeout: 1500,
        })
        .catch(() => {});
    } catch (_) {}
  }
}

module.exports = new TradeEngine();

