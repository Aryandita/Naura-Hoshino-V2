"use strict";

const express = require("express");
const redisManager = require("../../src/managers/redisManager");
const aiManager = require("../../src/managers/aiManager");

const FEED_CACHE_KEY = "social:feed:posts";

const DEFAULT_POSTS = [
  {
    id: "post_1",
    author: "Naura Hoshino",
    handle: "@naura_hoshino",
    avatar: "/assets/Naura_Expression/Cheers.png",
    content:
      "Pagi semuanya! 🌸 Hari ini cuaca di Frostsnow Kingdom cerah banget. Jangan lupa selesaikan daily quest dan beri makan pet kalian ya!",
    likes: 42,
    timestamp: "10 menit yang lalu",
    tag: "Daily Journal",
  },
  {
    id: "post_2",
    author: "Naura Hoshino",
    handle: "@naura_hoshino",
    avatar: "/assets/Naura_Expression/Thinking.png",
    content:
      "Tadi malam ada yang nekat menantang Abyssal Leviathan sendirian di World Boss Raid... untung diselamatkan pet Bahamut temannya! Hebat banget kerjasamanya ✨",
    likes: 88,
    timestamp: "2 jam yang lalu",
    tag: "Raid Story",
  },
  {
    id: "post_3",
    author: "Naura Hoshino",
    handle: "@naura_hoshino",
    avatar: "/assets/Naura_Expression/Salute.png",
    content:
      "Selamat untuk server pemenang Clan War minggu ini! Nikmati 2x XP Boost & 2x Stamina Regeneration untuk 24 jam ke depan ya! 🏆",
    likes: 125,
    timestamp: "6 jam yang lalu",
    tag: "Clan Announcement",
  },
];

module.exports = (client) => {
  const router = express.Router();

  router.get("/api/feed", async (req, res) => {
    try {
      if (redisManager.isReady) {
        const cached = await redisManager.getCache(FEED_CACHE_KEY);
        if (cached)
          return res.json(
            typeof cached === "string" ? JSON.parse(cached) : cached,
          );
      }

      if (redisManager.isReady) {
        await redisManager.setCache(
          FEED_CACHE_KEY,
          JSON.stringify(DEFAULT_POSTS),
          600,
        );
      }

      res.json(DEFAULT_POSTS);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/feed/:id/like", async (req, res) => {
    try {
      res.json({ success: true, newLikes: 1 });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
