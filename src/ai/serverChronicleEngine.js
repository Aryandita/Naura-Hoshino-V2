"use strict";

const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");
const aiManager = require("../managers/aiManager");

class ServerChronicleEngine {
  /**
   * Rekam aktivitas pesan chat harian ke buffer Redis.
   */
  static async recordMessageActivity(guildId, userId, username, content = "") {
    if (!guildId || !userId) return;
    try {
      const todayKey = `chronicle:activity:${guildId}:${new Date().toISOString().slice(0, 10)}`;
      await redisManager.hincrby(todayKey, `user:${userId}:${username}`, 1);
      await redisManager.expire(todayKey, 172800); // 48 jam

      if (
        content &&
        content.length > 10 &&
        content.length < 120 &&
        !content.startsWith("/")
      ) {
        const quotesKey = `chronicle:quotes:${guildId}:${new Date().toISOString().slice(0, 10)}`;
        await redisManager.lpush(
          quotesKey,
          JSON.stringify({ username, text: content }),
        );
        await redisManager.ltrim(quotesKey, 0, 20);
        await redisManager.expire(quotesKey, 172800);
      }
    } catch (e) {
      logger.warn(`[CHRONICLE] Gagal mencatat telemetri: ${e.message}`);
    }
  }

  /**
   * Agregasi data aktivitas hari ini dan buat ringkasan koran harian.
   */
  static async generateChronicleData(guild) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayKey = `chronicle:activity:${guild.id}:${todayStr}`;
    const quotesKey = `chronicle:quotes:${guild.id}:${todayStr}`;

    const rawActivity = await redisManager.hgetall(todayKey);
    const rawQuotes = await redisManager.lrange(quotesKey, 0, 10);

    let topUser = {
      username: "Warga Teladan",
      count: 42,
      userId: guild.ownerId,
    };
    let totalMessages = 0;

    if (rawActivity && Object.keys(rawActivity).length > 0) {
      const userList = Object.entries(rawActivity).map(([key, count]) => {
        const parts = key.split(":");
        const userId = parts[1];
        const username = parts.slice(2).join(":");
        const num = parseInt(count, 10) || 0;
        totalMessages += num;
        return { userId, username, count: num };
      });

      userList.sort((a, b) => b.count - a.count);
      if (userList.length > 0) {
        topUser = userList[0];
      }
    } else {
      totalMessages = Math.floor(Math.random() * 200) + 150;
    }

    const quotes = (rawQuotes || [])
      .map((q) => {
        try {
          return JSON.parse(q);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    // AI Headline & Horoscope Generation
    let headline = `Sensasi Hari Ini di ${guild.name}!`;
    let gossip = `Bintang terik menyinari guild ${guild.name}. Tetaplah waspada terhadap drop rate gacha dan bahaya monster Tower of Babel!`;
    let quoteHighlight =
      quotes.length > 0
        ? `"${quotes[0].text}", ${quotes[0].username}`
        : `"Hari yang cerah untuk berpetualang!", Naura`;

    try {
      if (aiManager && typeof aiManager.ask === "function") {
        const prompt = `Buatkan 1 judul koran anime lucu (maksimal 8 kata) dan 1 horoskop santai (1 kalimat pendek) untuk server Discord '${guild.name}' dengan tema cyber anime kawaii. Format: HEADLINE: [judul] | HOROSCOPE: [kalimat]`;
        const aiRes = await aiManager.ask(prompt, "server_chronicle");
        if (aiRes && aiRes.includes("HEADLINE:")) {
          const parts = aiRes.split("|");
          headline = parts[0].replace("HEADLINE:", "").trim();
          if (parts[1] && parts[1].includes("HOROSCOPE:")) {
            gossip = parts[1].replace("HOROSCOPE:", "").trim();
          }
        }
      }
    } catch (e) {
      // Fallback
    }

    return {
      date: new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      guildName: guild.name,
      guildIcon: guild.iconURL({ extension: "png" }),
      headline,
      gossip,
      quoteHighlight,
      totalMessages,
      memberCount: guild.memberCount,
      topUser,
    };
  }
}

module.exports = ServerChronicleEngine;
