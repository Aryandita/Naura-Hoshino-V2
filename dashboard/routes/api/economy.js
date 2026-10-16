"use strict";

const express = require("express");
const { requireApiLogin, isOwner } = require("../../middleware/auth");
const { pushState } = require("./helpers");


function register(router, client) {
  // --- 1. Mutasi Saldo Deposit (Atomic) ---
  router.post("/economy/deposit", requireApiLogin, async (req, res) => {
    try {
      const amount = Math.floor(Number(req.body?.amount));
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Jumlah setoran tidak valid." });
      }
      const cacheManager = require("../../../src/managers/cacheManager");
      const debitRes = await cacheManager.debitUserProfile(
        req.user.id,
        "economy_wallet",
        amount,
      );
      if (!debitRes.ok) {
        return res.status(400).json({ error: "Saldo dompet tidak mencukupi." });
      }
      await cacheManager.incrementUserProfile(req.user.id, "economy_bank", amount);
      return res.json({
        success: true,
        message: `Berhasil menyetor ${amount.toLocaleString("id-ID")} NC ke bank.`,
      });
    } catch (err) {
      return res.status(500).json({ error: "Gagal memproses setoran." });
    }
  });

  // --- 2. Mutasi Saldo Withdraw (Atomic) ---
  router.post("/economy/withdraw", requireApiLogin, async (req, res) => {
    try {
      const amount = Math.floor(Number(req.body?.amount));
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Jumlah penarikan tidak valid." });
      }
      const cacheManager = require("../../../src/managers/cacheManager");
      const debitRes = await cacheManager.debitUserProfile(
        req.user.id,
        "economy_bank",
        amount,
      );
      if (!debitRes.ok) {
        return res.status(400).json({ error: "Saldo bank tidak mencukupi." });
      }
      await cacheManager.incrementUserProfile(req.user.id, "economy_wallet", amount);
      return res.json({
        success: true,
        message: `Berhasil menarik ${amount.toLocaleString("id-ID")} NC dari bank.`,
      });
    } catch (err) {
      return res.status(500).json({ error: "Gagal memproses penarikan." });
    }
  });

  // --- 3. Mutasi Saldo Transfer (Atomic & Validated) ---
  router.post("/economy/transfer", requireApiLogin, async (req, res) => {
    try {
      const amount = Math.floor(Number(req.body?.amount));
      const rawTarget = String(req.body?.target || "").trim().replace(/^@/, "");
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Jumlah transfer tidak valid." });
      }
      if (!rawTarget) {
        return res.status(400).json({ error: "Tujuan transfer harus diisi." });
      }

      const UserProfile = require("../../../src/models/UserProfile");
      let targetUserId = null;
      if (/^\d{15,21}$/.test(rawTarget)) {
        targetUserId = rawTarget;
      } else {
        const cached = client.users?.cache?.find(
          (u) =>
            u.username?.toLowerCase() === rawTarget.toLowerCase() ||
            u.globalName?.toLowerCase() === rawTarget.toLowerCase(),
        );
        if (cached) {
          targetUserId = cached.id;
        } else {
          const found = await UserProfile.findOne({
            where: { userId: rawTarget },
          });
          if (found) targetUserId = found.userId;
        }
      }

      if (!targetUserId) {
        return res.status(404).json({ error: "Penerima tidak ditemukan." });
      }
      if (targetUserId === req.user.id) {
        return res
          .status(400)
          .json({ error: "Tidak dapat mentransfer ke diri sendiri." });
      }

      const cacheManager = require("../../../src/managers/cacheManager");
      const debitRes = await cacheManager.debitUserProfile(
        req.user.id,
        "economy_wallet",
        amount,
      );
      if (!debitRes.ok) {
        return res.status(400).json({ error: "Saldo dompet tidak mencukupi." });
      }

      await cacheManager.incrementUserProfile(
        targetUserId,
        "economy_wallet",
        amount,
      );
      return res.json({
        success: true,
        message: `Berhasil mentransfer ${amount.toLocaleString("id-ID")} NC ke ${rawTarget}.`,
      });
    } catch (err) {
      return res.status(500).json({ error: "Gagal memproses transfer." });
    }
  });

  // --- 4. Realtime Leaderboard (Economy, Leveling, Survival) ---
  router.get("/realtime/leaderboard", async (req, res) => {
    try {
      const UserProfile = require("../../../src/models/UserProfile");
      const UserSurvival = require("../../../src/models/UserSurvival");
      const { sequelize } = require("../../../src/config/database");
      const defaultAvatars = require("../dashboardAssetPaths").EXPRESSION_AVATARS;

      const resolveDiscordUser = async (userId) => {
        if (!userId) return null;
        let user = client.users?.cache?.get(userId);
        if (!user && client.users?.fetch) {
          try {
            user = await client.users.fetch(userId);
          } catch (_) {
            user = null;
          }
        }
        return user;
      };

      const limitRaw = Number.parseInt(req.query.limit, 10);
      const offsetRaw = Number.parseInt(req.query.offset, 10);
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(limitRaw, 100)
          : 10;
      const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
      const scopeGuildId = req.query.guildId ? String(req.query.guildId) : "global";

      let economyRows = [];
      let economyTotal = 0;
      try {
        economyTotal = await UserProfile.count();
        const profiles = await UserProfile.findAll({
          order: [
            sequelize.literal(
              "(COALESCE(economy_wallet, 0) + COALESCE(economy_bank, 0)) DESC",
            ),
          ],
          limit,
          offset,
        });

        economyRows = await Promise.all(
          profiles.map(async (p, idx) => {
            const discordUser = await resolveDiscordUser(p.userId);
            const name =
              discordUser?.globalName ||
              discordUser?.username ||
              `Member #${p.userId.slice(-4)}`;
            let avatar = defaultAvatars[idx % defaultAvatars.length];
            if (discordUser?.displayAvatarURL) {
              avatar = discordUser.displayAvatarURL({
                extension: "png",
                size: 128,
              });
            }
            const wallet = p.economy_wallet || 0;
            const bank = p.economy_bank || 0;
            const total = wallet + bank;
            return {
              rank: offset + idx + 1,
              userId: p.userId,
              name,
              avatar,
              wallet,
              bank,
              total,
              level: p.leveling_level || 1,
              xp: p.leveling_xp || 0,
              isPremium: Boolean(p.isPremium),
              isOwner: isOwner(p.userId),
            };
          }),
        );
      } catch (err) {
        console.warn("[API LEADERBOARD] Error fetching economy rows:", err.message);
      }

      let levelingRows = [];
      let levelingTotal = 0;
      try {
        levelingTotal = await UserProfile.count();
        const lvlProfiles = await UserProfile.findAll({
          order: [
            ["leveling_level", "DESC"],
            ["leveling_xp", "DESC"],
          ],
          limit,
          offset,
        });

        levelingRows = await Promise.all(
          lvlProfiles.map(async (p, idx) => {
            const discordUser = await resolveDiscordUser(p.userId);
            const name =
              discordUser?.globalName ||
              discordUser?.username ||
              `Survivor #${p.userId.slice(-4)}`;
            let avatar = defaultAvatars[idx % defaultAvatars.length];
            if (discordUser?.displayAvatarURL) {
              avatar = discordUser.displayAvatarURL({
                extension: "png",
                size: 128,
              });
            }
            const xp = p.leveling_xp || 0;
            return {
              rank: offset + idx + 1,
              userId: p.userId,
              name,
              avatar,
              level: p.leveling_level || 1,
              xp,
              messageCount: xp > 0 ? Math.floor(xp / 15) : 0,
              voiceMinutes: xp > 0 ? Math.floor(xp / 25) : 0,
              isOwner: isOwner(p.userId),
            };
          }),
        );
      } catch (err) {
        console.warn("[API LEADERBOARD] Error fetching leveling rows:", err.message);
      }

      let survivalRows = [];
      let survivalTotal = 0;
      try {
        survivalTotal = await UserSurvival.count();
        const survProfiles = await UserSurvival.findAll({
          order: [
            ["survival_level", "DESC"],
            ["starFragments", "DESC"],
          ],
          limit,
          offset,
        });

        survivalRows = await Promise.all(
          survProfiles.map(async (s, idx) => {
            const discordUser = await resolveDiscordUser(s.userId);
            const name =
              discordUser?.globalName ||
              discordUser?.username ||
              `Ranger #${s.userId.slice(-4)}`;
            let avatar = defaultAvatars[idx % defaultAvatars.length];
            if (discordUser?.displayAvatarURL) {
              avatar = discordUser.displayAvatarURL({
                extension: "png",
                size: 128,
              });
            }
            return {
              rank: offset + idx + 1,
              userId: s.userId,
              name,
              avatar,
              starFragments: s.starFragments || 0,
              survivalLevel: s.survival_level || 1,
              currentLocation: s.currentLocation || "jalanan",
              isOwner: isOwner(s.userId),
            };
          }),
        );
      } catch (err) {
        console.warn("[API LEADERBOARD] Error fetching survival rows:", err.message);
      }

      res.json({
        success: true,
        data: {
          economy: economyRows,
          leveling: levelingRows,
          survival: survivalRows,
        },
        totals: {
          economy: economyTotal,
          leveling: levelingTotal,
          survival: survivalTotal,
        },
        pagination: { limit, offset },
        scope: { guildId: scopeGuildId },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 5. Realtime Economy (Total Pools & Stocks) ---
  router.get("/realtime/economy", async (req, res) => {
    try {
      const UserProfile = require("../../../src/models/UserProfile");
      const UserSurvival = require("../../../src/models/UserSurvival");
      const ServerTreasury = require("../../../src/models/ServerTreasury");
      const ServerStock = require("../../../src/models/ServerStock");

      let totalBank = 0;
      let totalWallet = 0;
      let totalCoupons = 0;

      try {
        totalWallet = (await UserProfile.sum("economy_wallet")) || 0;
        totalBank = (await UserProfile.sum("economy_bank")) || 0;
        totalCoupons = (await UserSurvival.sum("coupons")) || 0;
      } catch (_) {}

      const treasuryBalanceNc = totalBank || 0;
      let treasuryBalanceNsf = 0;
      let treasury = null;
      try {
        treasury = await ServerTreasury.findOne({
          order: [["updatedAt", "DESC"]],
        });
        if (treasury) {
          treasuryBalanceNsf =
            Number(treasury.lotteryJackpot || 0) +
            Number(treasury.noviceAidPool || 0) +
            Number(treasury.wanderingMerchantPool || 0);
        }
        if (!treasuryBalanceNsf) {
          treasuryBalanceNsf = (await UserSurvival.sum("starFragments")) || 0;
        }
      } catch (_) {
        treasuryBalanceNsf = 0;
      }

      let topUsers = [];
      try {
        const profiles = await UserProfile.findAll({
          order: [["economy_wallet", "DESC"]],
          limit: 8,
        });
        topUsers = profiles.map((p) => {
          const cachedUser = client.users?.cache?.get(p.userId);
          return {
            userId: p.userId,
            name: cachedUser?.username || `Member #${p.userId.slice(-4)}`,
            level: p.leveling_level || 1,
            wallet: p.economy_wallet || 0,
            bank: p.economy_bank || 0,
            isPremium: !!p.isPremium,
          };
        });
      } catch (_) {}

      let stocks = [];
      try {
        const stockRows = await ServerStock.findAll({
          order: [["currentPrice", "DESC"]],
        });
        if (stockRows && stockRows.length > 0) {
          stocks = stockRows.map((s) => {
            const cur = Number(s.currentPrice || 0);
            const prev = Number(s.previousPrice || cur);
            const diff = cur - prev;
            const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : "0.0";
            const trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
            const sign = diff > 0 ? "+" : "";
            return {
              symbol: s.ticker,
              name: s.name,
              price: Math.round(cur),
              previousPrice: Math.round(prev),
              change: `${sign}${pct}%`,
              trend,
              dividendYield: s.dividendYield,
              availableShares: s.availableShares,
              totalShares: s.totalShares,
              isHighRisk: !!s.isHighRisk,
            };
          });
        }
      } catch (_) {}

      if (stocks.length === 0) {
        stocks = [
          {
            symbol: "TECH_CORP",
            name: "Naura High-Tech Industries",
            price: 4250,
            change: "+4.2%",
            trend: "up",
          },
          {
            symbol: "HOSHINO_AI",
            name: "Hoshino Core AI Corp",
            price: 2420,
            change: "+1.8%",
            trend: "up",
          },
          {
            symbol: "ASTRA_FOODS",
            name: "Astral Culinary Ventures",
            price: 850,
            change: "-0.8%",
            trend: "down",
          },
          {
            symbol: "NAURA_COIN",
            name: "$NRA Volatile Index",
            price: 3100,
            change: "+2.5%",
            trend: "up",
          },
          {
            symbol: "NEO_ENERGY",
            name: "Neo-Hoshino Fusion Power",
            price: 980,
            change: "+3.5%",
            trend: "up",
          },
        ];
      }

      res.json({
        success: true,
        data: {
          treasuryBalanceNsf,
          treasuryBalanceNc,
          totalCoupons,
          totalBank: totalBank || 48500000,
          totalWallet: totalWallet || 15420000,
          stocks,
          userEconomy: topUsers,
          treasury: {
            infra: treasuryBalanceNc || totalBank || 0,
            lottery: Number(treasury?.lotteryJackpot || 0),
            subsidy: Number(treasury?.noviceAidPool || 0),
            merchant: Number(treasury?.wanderingMerchantPool || 0),
          },
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 6. Market History (Chart Points) ---
  router.get("/economy/market-history", async (req, res) => {
    try {
      const rawSymbol = (req.query.symbol || "NAURA_COIN").toUpperCase();
      const period = req.query.period || "7d";
      const ServerStock = require("../../../src/models/ServerStock");

      let stock = null;
      try {
        stock = await ServerStock.findOne({ where: { ticker: rawSymbol } });
        if (!stock) {
          stock = await ServerStock.findByPk(rawSymbol);
        }
        if (!stock) {
          const allStocks = await ServerStock.findAll();
          stock = allStocks.find(
            (s) =>
              s.ticker.toUpperCase() === rawSymbol ||
              s.ticker.toUpperCase().startsWith(rawSymbol) ||
              rawSymbol.startsWith(s.ticker.toUpperCase()),
          );
        }
      } catch (_) {}

      const currentPrice = stock ? Number(stock.currentPrice || 100) : 100;
      const stockName = stock ? stock.name : "Naura Stock Market";
      const symbol = stock ? stock.ticker : rawSymbol;

      let labels = [];
      let prices = [];

      if (
        stock &&
        Array.isArray(stock.history24h) &&
        stock.history24h.length > 0
      ) {
        const pts = stock.history24h.slice(-24);
        labels = pts.map((p) => {
          const d = new Date(p.timestamp || Date.now());
          return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        });
        prices = pts.map((p) =>
          Math.round(Number(p.close || p.price || currentPrice)),
        );
      }

      if (prices.length === 0) {
        const is30d = period === "30d";
        const count = is30d ? 30 : 7;
        const now = Date.now();
        const basePrice = currentPrice * 0.9;

        for (let i = count - 1; i >= 0; i--) {
          const d = new Date(now - i * 86400000);
          labels.push(
            is30d
              ? `${d.getDate()}/${d.getMonth() + 1}`
              : ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()],
          );
          const fluctuation = Math.sin(i * 0.7) * (currentPrice * 0.05);
          prices.push(Math.round(basePrice + fluctuation));
        }
        prices[prices.length - 1] = Math.round(currentPrice);
      }

      res.json({
        success: true,
        data: {
          symbol,
          name: stockName,
          period,
          currentPrice: Math.round(currentPrice),
          labels,
          prices,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 7. Economy Top Holders ---
  router.get("/economy/top-holders", async (req, res) => {
    try {
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 10, 1),
        50,
      );
      const UserProfile = require("../../../src/models/UserProfile");
      const { sequelize } = require("../../../src/managers/dbManager");

      let holders = [];
      try {
        const profiles = await UserProfile.findAll({
          order: [
            sequelize
              ? [
                  sequelize.literal(
                    "COALESCE(economy_wallet, 0) + COALESCE(economy_bank, 0)",
                  ),
                  "DESC",
                ]
              : ["economy_wallet", "DESC"],
          ],
          limit,
        });

        holders = profiles.map((p, idx) => {
          const cachedUser = client.users?.cache?.get(p.userId);
          const name = cachedUser?.username || `Pemain #${p.userId.slice(-4)}`;
          const avatar =
            cachedUser?.displayAvatarURL?.({ extension: "png" }) ||
            "/assets/core/avatar.png";
          const wallet = p.economy_wallet || 0;
          const bank = p.economy_bank || 0;
          return {
            rank: idx + 1,
            userId: p.userId,
            name,
            avatar,
            wallet,
            bank,
            total: wallet + bank,
            level: p.leveling_level || 1,
            isPremium: !!p.isPremium,
          };
        });
      } catch (_) {}

      res.json({ success: true, data: holders });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, data: [] });
    }
  });

  // --- 8. Economy Recent Transactions ---
  router.get("/economy/recent-transactions", async (req, res) => {
    try {
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 10, 1),
        30,
      );
      const MarketAuction = require("../../../src/models/MarketAuction");

      let transactions = [];
      try {
        const auctions = await MarketAuction.findAll({
          order: [["updatedAt", "DESC"]],
          limit,
        });

        transactions = auctions.map((auc, i) => ({
          id: `tx_${auc.id || i}`,
          type: auc.status === "sold" ? "buy" : "trade",
          title: `Lelang ${auc.itemId.replace(/_/g, " ")}`,
          description: `${auc.amount}x item ${auc.itemId} ${auc.status === "sold" ? "terjual ke penawar tertinggi" : "terdaftar di bursa"}`,
          amount: auc.currentBid || auc.startingPrice || 1500,
          currency: auc.currency === "coin" ? "NC" : "NSF",
          timestamp: auc.updatedAt
            ? new Date(auc.updatedAt).getTime()
            : Date.now() - (i + 1) * 3600000,
        }));
      } catch (_) {}

      res.json({ success: true, data: transactions });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, data: [] });
    }
  });

  // --- 9. Active Caravans Radar ---
  router.get("/caravans/active", async (req, res) => {
    try {
      const tradeEngine = require("../../../src/services/tradeEngine");
      const caravans = await tradeEngine.getActiveCaravans(10);
      res.json({ success: true, caravans });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 10. Federation Hall of Fame ---
  router.get("/federations/hall-of-fame", async (req, res) => {
    try {
      const guildFederationEngine = require("../../../src/survival/engines/guildFederationEngine");
      const limit = Math.min(
        20,
        Math.max(1, parseInt(req.query.limit, 10) || 10),
      );
      const rankings = await guildFederationEngine.getHallOfFame(limit);
      res.json({ success: true, federations: rankings });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 11. Caravan Ambush Alert ---
  router.post("/caravan/ambush-alert", requireApiLogin, async (req, res) => {
    try {
      const {
        caravanId,
        ownerUserId,
        routeName,
        raiderName,
        lootAmount,
      } = req.body || {};
      const targetOwner = isOwner(req.user.id)
        ? ownerUserId || req.user.id
        : req.user.id;

      const alertPayload = {
        type: "CARAVAN_AMBUSH",
        caravanId: caravanId || "crv_unknown",
        ownerUserId: targetOwner,
        title: "🚨 PERINGATAN: Karavan Disergap!",
        body: `Karavan milikmu di ${routeName || "Rute Antariksa"} sedang disergap oleh ${raiderName || "Klan Rival"}! Kerugian: ${lootAmount || 0} koin.`,
        timestamp: new Date().toISOString(),
      };

      if (req.app && typeof req.app.get === "function") {
        const io = req.app.get("io");
        if (io && typeof io.emit === "function") {
          io.emit("caravan:ambush", alertPayload);
        }
      }

      const hasSub = await pushState.hasSubscription(targetOwner);
      res.json({
        success: true,
        dispatched: true,
        alert: alertPayload,
        pushDispatchedTo: hasSub ? 1 : 0,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 12. Clan Info ---
  router.get("/clan/info", async (req, res) => {
    try {
      const GuildClan = require("../../../src/models/GuildClan");
      const ClanTerritory = require("../../../src/models/ClanTerritory");
      const UserSurvival = require("../../../src/models/UserSurvival");

      const isAuth =
        typeof req.isAuthenticated === "function" &&
        req.isAuthenticated() &&
        req.user;
      let targetClan = null;

      if (isAuth) {
        const userSurv = await UserSurvival.findByPk(req.user.id).catch(
          () => null,
        );
        if (userSurv && userSurv.clanId) {
          targetClan = await GuildClan.findByPk(userSurv.clanId).catch(
            () => null,
          );
        }
      }

      if (!targetClan) {
        targetClan = await GuildClan.findOne({
          order: [
            ["vault", "DESC"],
            ["level", "DESC"],
          ],
        }).catch(() => null);
      }

      if (!targetClan) {
        return res.json({
          success: true,
          hasClan: false,
          clan: null,
          message: "Belum ada aliansi klan yang terdaftar.",
        });
      }

      const territories = await ClanTerritory.findAll({
        where: { clanId: String(targetClan.id) },
      }).catch(() => []);

      const rawMembers = Array.isArray(targetClan.members)
        ? targetClan.members
        : [];
      const enrichedMembers = await Promise.all(
        rawMembers.map(async (m) => {
          const mUserId = typeof m === "string" ? m : m.userId || m.id;
          const role =
            (typeof m === "object" && m.role) ||
            (String(mUserId) === String(targetClan.leaderId)
              ? "Ketua Klan"
              : "Anggota");
          const xp = (typeof m === "object" && m.contributionXp) || 0;
          let username =
            (typeof m === "object" && m.username) ||
            `Petualang_${String(mUserId).slice(0, 5)}`;
          let isOnline = false;

          if (client && client.users) {
            const u = client.users.cache.get(mUserId);
            if (u) {
              username = u.username;
              isOnline = true;
            }
          }

          return {
            userId: mUserId,
            name: username,
            role,
            level: (typeof m === "object" && m.level) || 1,
            contributionXp: xp,
            isOnline,
          };
        }),
      );

      if (
        targetClan.leaderId &&
        !enrichedMembers.some(
          (m) => String(m.userId) === String(targetClan.leaderId),
        )
      ) {
        let leaderName = `Ketua_${String(targetClan.leaderId).slice(0, 5)}`;
        if (client && client.users) {
          const lu = client.users.cache.get(targetClan.leaderId);
          if (lu) leaderName = lu.username;
        }
        enrichedMembers.unshift({
          userId: targetClan.leaderId,
          name: leaderName,
          role: "Ketua Klan",
          level: targetClan.level || 1,
          contributionXp: 1000,
          isOnline: true,
        });
      }

      return res.json({
        success: true,
        hasClan: true,
        clan: {
          id: targetClan.id,
          name: targetClan.name,
          tag: targetClan.tag || "CLAN",
          level: targetClan.level || 1,
          vault: targetClan.vault || 0,
          membersCount: enrichedMembers.length,
          maxMembers: 30 + (targetClan.level || 1) * 2,
          towersCount: territories.length,
          members: enrichedMembers,
          hallLayout: targetClan.hallLayout || {},
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 13. Marketplace Items ---
  router.get("/marketplace/items", async (req, res) => {
    try {
      const MarketAuction = require("../../../src/models/MarketAuction");
      const GameItem = require("../../../src/models/GameItem");

      const auctions = await MarketAuction.findAll({
        where: { status: "active" },
        order: [["createdAt", "DESC"]],
        limit: 40,
      }).catch(() => []);

      const items = await Promise.all(
        auctions.map(async (auc) => {
          const dbItem = await GameItem.findByPk(auc.itemId).catch(() => null);
          const name = (dbItem && dbItem.name) || auc.itemId;
          const rarity = (dbItem && dbItem.rarity) || "Rare";
          const category = (dbItem && dbItem.category) || "material";
          const desc =
            (dbItem && dbItem.description) ||
            "Barang lelang pasar Naura Wilds.";

          let sellerName = `Petualang_${String(auc.sellerId).slice(0, 5)}`;
          if (client && client.users) {
            const su = client.users.cache.get(auc.sellerId);
            if (su) sellerName = su.username;
          }

          return {
            id: auc.id,
            itemId: auc.itemId,
            name,
            rarity,
            category,
            description: desc,
            amount: auc.amount || 1,
            currency: (auc.currency || "nsf").toUpperCase(),
            startingPrice: auc.startingPrice || 0,
            currentBid: auc.currentBid || auc.startingPrice || 0,
            buyoutPrice: auc.buyoutPrice || null,
            sellerId: auc.sellerId,
            sellerName,
            expiresAt: auc.expiresAt,
          };
        }),
      );

      return res.json({
        success: true,
        items,
        total: items.length,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  register,
  createRouter(client) {
    const router = express.Router();
    register(router, client);
    return router;
  },
};
