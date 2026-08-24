"use strict";

/**
 * Rute publik dashboard: statistik bot, statistik ekonomi, daftar item, dan
 * leaderboard. Semuanya read-only sehingga tidak butuh login.
 */

const express = require("express");
const os = require("os");
const { logger } = require("../../src/managers/logger");
const UserProfile = require("../../src/models/UserProfile");
const env = require("../../src/config/env");
const { formatUptime, formatMemory } = require("../utils/format");
const { isOwner } = require("../middleware/auth");

const LEADERBOARD_CACHE_TTL = 60; // detik

function safeRedis() {
  try {
    const redisManager = require("../../src/managers/redisManager");
    if (redisManager.client && redisManager.client.isReady) return redisManager;
  } catch {
    // Redis opsional; abaikan bila tidak tersedia.
  }
  return null;
}

module.exports = (client) => {
  const router = express.Router();

  /** Avatar bot dipakai sebagai gambar cadangan di seluruh dashboard. */
  const botAvatar = () =>
    client.user
      ? client.user.displayAvatarURL({ extension: "png", size: 512 })
      : "/assets/dashboard/naura.png";

  // --- Statistik ringkas untuk kartu di beranda ---
  router.get("/api/stats", async (req, res) => {
    let totalRegisteredUsers = 0;
    try {
      totalRegisteredUsers = await UserProfile.count();
    } catch (e) {
      logger.warn("[API STATS] Gagal menghitung UserProfile:", e.message);
    }

    const memory = formatMemory(os);

    res.json({
      botName: client.user ? client.user.username : "Naura Hoshino",
      avatar: botAvatar(),
      servers: client.guilds.cache.size,
      users:
        totalRegisteredUsers ||
        client.guilds.cache.reduce(
          (acc, guild) => acc + (guild.memberCount || 0),
          0,
        ),
      ping: client.ws.ping,
      uptime: formatUptime(client.uptime),
      ram: `${memory.usedGb}GB / ${memory.totalGb}GB`,
      ramPercent: memory.percent,
      botVersion: env.BOT_VERSION,
      engineVersion: env.ENGINE_VERSION,
      partnership: env.PARTNERSHIP,
    });
  });

  // --- Versi sistem & info konfigurasi env.js ---
  router.get("/api/version", (req, res) => {
    res.json({
      botVersion: env.BOT_VERSION,
      engineVersion: env.ENGINE_VERSION,
      partnership: env.PARTNERSHIP,
      nodeVersion: process.version,
    });
  });

  // --- Peredaran uang global, dicache 5 menit ---
  router.get("/api/economy_stats", async (req, res) => {
    try {
      const redis = safeRedis();
      if (redis) {
        const cached = await redis.getCache("economy_stats_global");
        if (cached) return res.json(cached);
      }

      const UserSurvival = require("../../src/models/UserSurvival");
      const users = await UserSurvival.findAll({
        attributes: ["starFragments", "coupons"],
      });
      let totalStarFragments = 0;
      let totalCoupons = 0;
      users.forEach((u) => {
        totalStarFragments += u.starFragments || 0;
        totalCoupons += u.coupons || 0;
      });

      const stats = {
        total_star_fragments: totalStarFragments,
        total_coupons: totalCoupons,
        total_users: users.length,
      };

      if (redis) await redis.setCache("economy_stats_global", stats, 300);
      return res.json(stats);
    } catch (error) {
      logger.error("[API ECONOMY STATS] Error:", error);
      return res
        .status(500)
        .json({ error: "Naura gagal memuat statistik ekonomi." });
    }
  });

  // --- Katalog item RPG ---
  router.get("/api/rpg/items", (req, res) => {
    try {
      const items = require("../../src/survival/data/items");
      res.json(items);
    } catch (e) {
      logger.error("[API RPG ITEMS] Error:", e);
      res.status(500).json({ error: "Naura gagal memuat daftar item." });
    }
  });

  // --- Analitik Musik Mabar (Realtime dari Database) ---
  router.get("/api/analytics/music-friends", async (req, res) => {
    try {
      const sessionUserId = req.user?.id || req.session?.passport?.user?.id || null;
      if (sessionUserId) {
        const myProfile = await UserProfile.findOne({
          where: { userId: sessionUserId },
          attributes: ["userId", "music_trackingData", "music_tracksListened", "music_totalDurationMs"],
        });
        if (myProfile && myProfile.music_trackingData) {
          let raw = myProfile.music_trackingData;
          if (typeof raw === "string") {
            try {
              raw = JSON.parse(raw);
            } catch (e) {
              raw = null;
            }
          }
          if (raw && raw.friends && Object.keys(raw.friends).length > 0) {
            const list = Object.entries(raw.friends).map(([key, obj]) => ({
              name: typeof obj === "object" && obj && obj.name ? obj.name : key,
              count:
                typeof obj === "object" && obj
                  ? Number(obj.tracks) || Number(obj.count) || 1
                  : 1,
              durationMs:
                typeof obj === "object" && obj
                  ? Number(obj.durationMs) || 0
                  : Number(obj) || 0,
            }));
            return res.json({ source: "user", friends: list });
          }
        }
      }

      // Query agregat dari database UserProfile jika belum ada data mabar personal
      const profiles = await UserProfile.findAll({
        attributes: [
          "userId",
          "music_tracksListened",
          "music_totalDurationMs",
          "music_trackingData",
          "music_topFriend",
        ],
        order: [["music_totalDurationMs", "DESC"]],
        limit: 25,
      });

      const aggregatedFriends = new Map();

      for (const p of profiles) {
        let tracking = p.music_trackingData;
        if (typeof tracking === "string") {
          try {
            tracking = JSON.parse(tracking);
          } catch (e) {
            tracking = null;
          }
        }
        if (tracking && tracking.friends && typeof tracking.friends === "object") {
          for (const [key, obj] of Object.entries(tracking.friends)) {
            const name = typeof obj === "object" && obj && obj.name ? obj.name : key;
            const count =
              typeof obj === "object" && obj
                ? Number(obj.tracks) || Number(obj.count) || 1
                : 1;
            const dur =
              typeof obj === "object" && obj
                ? Number(obj.durationMs) || 0
                : Number(obj) || 0;
            const existing = aggregatedFriends.get(name) || {
              name,
              count: 0,
              durationMs: 0,
            };
            existing.count += count;
            existing.durationMs += dur;
            aggregatedFriends.set(name, existing);
          }
        }
      }

      const list = Array.from(aggregatedFriends.values());

      // Jika belum ada riwayat mabar antar user, ambil dari top pemutar musik di database
      if (list.length === 0 && profiles.length > 0) {
        for (const p of profiles) {
          if (p.music_tracksListened > 0 || p.music_totalDurationMs > 0) {
            let uName = "Member #" + p.userId.slice(-4);
            const cached = client.users?.cache?.get(p.userId);
            if (cached) uName = cached.username;
            list.push({
              name: uName,
              count: p.music_tracksListened || 0,
              durationMs: p.music_totalDurationMs || 0,
            });
          }
        }
      }

      return res.json({ source: "community", friends: list });
    } catch (err) {
      logger.error("[API MUSIC ANALYTICS] Error:", err);
      return res.status(500).json({ error: "Gagal memuat analitik musik." });
    }
  });

  // --- Leaderboard ---
  router.get("/api/leaderboard", async (req, res) => {
    try {
      const type = String(req.query.type || "wealth");
      const limitNum = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 20, 1),
        50,
      );

      const cacheKey = `leaderboard_${type}_${limitNum}`;
      const redis = safeRedis();
      if (redis) {
        const cached = await redis.getCache(cacheKey);
        if (cached) return res.json(cached);
      }

      const UserSurvival = require("../../src/models/UserSurvival");

      const profileAttributes = [
        "userId",
        "economy_wallet",
        "economy_bank",
        "leveling_level",
        "leveling_xp",
        "minigame_triviaScore",
        "music_tracksListened",
        "isPremium",
      ];

      let topProfiles;

      if (type === "rpg_level") {
        // Perbaikan: peringkat RPG kini diurutkan langsung di tabel survival.
        // Versi lama mengambil 20 baris acak (ORDER BY userId) lalu baru
        // menyortirnya, sehingga papan peringkat tidak pernah benar.
        const topSurvival = await UserSurvival.findAll({
          order: [
            ["survival_level", "DESC"],
            ["survival_xp", "DESC"],
          ],
          limit: limitNum,
        });
        const orderedIds = topSurvival.map((s) => s.userId);

        if (orderedIds.length === 0) {
          topProfiles = [];
        } else {
          const found = await UserProfile.findAll({
            attributes: profileAttributes,
            where: { userId: orderedIds },
          });
          const byId = new Map(found.map((p) => [p.userId, p]));
          topProfiles = orderedIds
            .map((id) => byId.get(id) || UserProfile.build({ userId: id }))
            .filter(Boolean);
        }
      } else {
        let orderExpr;
        if (type === "chat_level") {
          orderExpr = [
            ["leveling_level", "DESC"],
            ["leveling_xp", "DESC"],
          ];
        } else if (type === "trivia") {
          orderExpr = [["minigame_triviaScore", "DESC"]];
        } else if (type === "music") {
          orderExpr = [["music_tracksListened", "DESC"]];
        } else if (type === "wealth") {
          const topSurvival = await UserSurvival.findAll({
            order: [["starFragments", "DESC"]],
            limit: limitNum,
          });
          const orderedIds = topSurvival.map((s) => s.userId);

          if (orderedIds.length === 0) {
            topProfiles = [];
          } else {
            const found = await UserProfile.findAll({
              attributes: profileAttributes,
              where: { userId: orderedIds },
            });
            const byId = new Map(found.map((p) => [p.userId, p]));
            topProfiles = orderedIds
              .map((id) => byId.get(id) || UserProfile.build({ userId: id }))
              .filter(Boolean);
          }
        } else {
          // Fallback (seharusnya tidak pernah terpanggil jika type sudah sesuai)
        }

        if (type !== "wealth" && type !== "rpg_level") {
          topProfiles = await UserProfile.findAll({
            attributes: profileAttributes,
            order: orderExpr,
            limit: limitNum,
          });
        }
      }
      
      const userIds = topProfiles.map((p) => p.userId);
      const survivalMap = {};
      if (userIds.length > 0) {
        const survs = await UserSurvival.findAll({
          where: { userId: userIds },
        });
        survs.forEach((s) => {
          survivalMap[s.userId] = s;
        });
      }

      const fallbackAvatar = botAvatar();

      const lbData = await Promise.all(
        topProfiles.map(async (u) => {
          let name = "Pengguna Misterius";
          let avatar = fallbackAvatar;

          // Pakai cache dulu agar tidak memukul REST API Discord 20x per request.
          const cachedUser = client.users.cache.get(u.userId);
          const dUser =
            cachedUser ||
            (await client.users.fetch(u.userId).catch(() => null));
          if (dUser) {
            name = dUser.username;
            avatar = dUser.displayAvatarURL({ extension: "png", size: 128 });
          }

          const surv = survivalMap[u.userId];
          const wallet = u.economy_wallet || 0;
          const bank = u.economy_bank || 0;

          return {
            userId: u.userId,
            name,
            avatar,
            wallet,
            bank,
            netWorth: wallet + bank,
            starFragments: surv?.starFragments || 0,
            chatLevel: u.leveling_level || 1,
            chatXp: u.leveling_xp || 0,
            rpgLevel: surv?.survival_level || 1,
            rpgXp: surv?.survival_xp || 0,
            points: u.minigame_triviaScore || 0,
            tracks: u.music_tracksListened || 0,
            isPremium: !!u.isPremium,
            isOwner: isOwner(u.userId),
          };
        }),
      );

      if (redis) await redis.setCache(cacheKey, lbData, LEADERBOARD_CACHE_TTL);
      return res.json(lbData);
    } catch (error) {
      logger.error("[API LEADERBOARD] Error:", error);
      return res.status(500).json({ error: "Naura gagal memuat leaderboard." });
    }
  });

  return router;
};
