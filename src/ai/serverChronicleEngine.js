"use strict";

const { AttachmentBuilder } = require("discord.js");
const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");
const aiManager = require("../managers/aiManager");
const GuildSettings = require("../models/GuildSettings");
const { drawChronicleNewspaper } = require("../canvas/chronicleCanvas");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");

class ServerChronicleEngine {
  /**
   * Rekam aktivitas pesan chat harian ke buffer Redis.
   */
  static async recordMessageActivity(guildId, userId, username, content = "") {
    if (!guildId || !userId || !redisManager.isReady) return;
    try {
      const todayKey = `chronicle:activity:${guildId}:${new Date().toISOString().slice(0, 10)}`;
      await redisManager.client.hIncrBy(todayKey, `user:${userId}:${username}`, 1);
      await redisManager.client.expire(todayKey, 172800); // 48 jam

      if (content && content.length > 10 && content.length < 120 && !content.startsWith("/")) {
        const quotesKey = `chronicle:quotes:${guildId}:${new Date().toISOString().slice(0, 10)}`;
        await redisManager.client.lPush(quotesKey, JSON.stringify({ username, text: content }));
        await redisManager.client.lTrim(quotesKey, 0, 20);
        await redisManager.client.expire(quotesKey, 172800);
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

    let rawActivity = null;
    let rawQuotes = null;

    if (redisManager.isReady) {
      try {
        rawActivity = await redisManager.client.hGetAll(todayKey);
        rawQuotes = await redisManager.client.lRange(quotesKey, 0, 10);
      } catch (err) {
        logger.warn(`[CHRONICLE] Gagal membaca cache Redis: ${err.message}`);
      }
    }

    let topUser = { username: "Warga Teladan", count: 42, userId: guild.ownerId };
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

    const quotes = (rawQuotes || []).map((q) => {
      try { return JSON.parse(q); } catch (e) { return null; }
    }).filter(Boolean);

    // AI Headline & Horoscope Generation
    let headline = `Sensasi Hari Ini di ${guild.name}!`;
    let gossip = `Bintang terik menyinari guild ${guild.name}. Tetaplah waspada terhadap drop rate gacha dan bahaya monster Tower of Babel!`;
    const quoteHighlight = quotes.length > 0 ? `"${quotes[0].text}", ${quotes[0].username}` : `"Hari yang cerah untuk berpetualang!", Naura`;

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
      date: new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
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

  /**
   * Publikasikan koran pagi otomatis ke seluruh guild yang mengaktifkannya
   */
  static async publishMorningChronicle(client) {
    logger.info("[CHRONICLE] Memulai publikasi koran pagi harian 'The Hoshino Times'...");

    for (const guild of client.guilds.cache.values()) {
      try {
        const settingsRecord = await GuildSettings.findOne({ where: { guildId: guild.id } });
        if (!settingsRecord) continue;

        let settings = {};
        try {
          settings = typeof settingsRecord.settings === "string" ? JSON.parse(settingsRecord.settings) : (settingsRecord.settings || {});
        } catch (err) {
          settings = {};
        }

        const channelId = settings.chronicleChannelId;
        if (!channelId) continue;

        const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
        if (!channel || !channel.isTextBased()) continue;

        const chronicleData = await this.generateChronicleData(guild);
        const imgBuffer = await drawChronicleNewspaper(chronicleData);
        const attachment = new AttachmentBuilder(imgBuffer, { name: "hoshino-times.png" });

        const payload = buildContainerV2({
          accentColorHex: "#FFB6C1",
          authorName: "📰 The Hoshino Times - Edisi Pagi",
          title: `🌅 Edisi Harian Resmi: ${chronicleData.date}`,
          description: [
            `Selamat pagi warga **${guild.name}**! Berikut adalah rangkuman berita dan tren harian server:`,
            ``,
            `👑 **Member of the Day:** **${chronicleData.topUser.username}** (\`${chronicleData.topUser.count} pesan\`)`,
            `⚡ **Headline:** *${chronicleData.headline}*`,
            `🔮 **Ramalan & Gosip:** *${chronicleData.gossip}*`,
            ``,
            `-# 💡 *Koran terbit otomatis setiap pukul 08:00 WIB. Baca kapan saja dengan \`/chronicle\`!*`,
          ].join("\n"),
          footerText: ui.getFooter("utility"),
          media: attachment,
        });

        await channel.send({ ...payload, files: [attachment] });
        logger.info(`[CHRONICLE] Koran pagi berhasil diterbitkan ke channel ${channel.id} di guild ${guild.name}`);
      } catch (err) {
        logger.warn(`[CHRONICLE] Gagal menerbitkan koran pagi di guild ${guild.id}:`, err.message);
      }
    }
  }
}

module.exports = ServerChronicleEngine;
