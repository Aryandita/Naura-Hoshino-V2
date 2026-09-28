"use strict";

/**
 * serverChronicleEngine.js - Autonomous Server Chronicle Newspaper Generator
 *
 * Mengagregasikan peristiwa-peristiwa penting server (Pemenang Lotre, Rekor Raid Boss,
 * Perdagangan Komoditas, Pertarungan Klan) menjadi narasi berita mingguan interaktif.
 */

const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");
const { getMarketOverview } = require("../survival/engines/commodityMarketEngine");

/**
 * Rekam aktivitas pesan chat harian ke buffer Redis.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} username
 * @param {string} [content=""]
 */
async function recordMessageActivity(guildId, userId, username, content = "") {
  if (!guildId || !userId) return;
  try {
    if (!redisManager.isReady || !redisManager.client) return;
    const client = redisManager.client;
    const today = new Date().toISOString().slice(0, 10);
    const todayKey = `chronicle:activity:${guildId}:${today}`;
    const userField = `user:${userId}:${username || "user"}`;

    if (typeof client.hIncrBy === "function") {
      await client.hIncrBy(todayKey, userField, 1);
    } else if (typeof client.hincrby === "function") {
      await client.hincrby(todayKey, userField, 1);
    }
    if (typeof client.expire === "function") {
      await client.expire(todayKey, 172800);
    }

    if (
      content &&
      typeof content === "string" &&
      content.length > 10 &&
      content.length < 120 &&
      !content.startsWith("/")
    ) {
      const quotesKey = `chronicle:quotes:${guildId}:${today}`;
      const quotePayload = JSON.stringify({
        username: username || "Warga",
        text: content.trim(),
      });
      if (typeof client.lPush === "function") {
        await client.lPush(quotesKey, quotePayload);
      } else if (typeof client.lpush === "function") {
        await client.lpush(quotesKey, quotePayload);
      }
      if (typeof client.lTrim === "function") {
        await client.lTrim(quotesKey, 0, 20);
      } else if (typeof client.ltrim === "function") {
        await client.ltrim(quotesKey, 0, 20);
      }
      if (typeof client.expire === "function") {
        await client.expire(quotesKey, 172800);
      }
    }
  } catch (e) {
    logger.warn(`[CHRONICLE] Gagal mencatat telemetri: ${e.message}`);
  }
}

/**
 * Agregasi data aktivitas hari ini dan buat ringkasan koran harian.
 * @param {Object} guild
 */
async function generateChronicleData(guild) {
  if (!guild) {
    return {
      date: new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      guildName: "Astral Sanctuary",
      guildIcon: null,
      headline: "KOTA HOSHINO DAMAI & CERAH BERCAHAYA",
      gossip: "Bintang kosmik bersinar terang menaungi hari ini.",
      quoteHighlight: '"Hari yang cerah untuk berpetualang!", Naura',
      totalMessages: 100,
      memberCount: 1,
      topUser: { username: "Warga Teladan", count: 10 },
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayKey = `chronicle:activity:${guild.id}:${todayStr}`;
  const quotesKey = `chronicle:quotes:${guild.id}:${todayStr}`;

  let rawActivity = null;
  let rawQuotes = [];

  try {
    if (redisManager.isReady && redisManager.client) {
      const client = redisManager.client;
      if (typeof client.hGetAll === "function") {
        rawActivity = await client.hGetAll(todayKey);
      } else if (typeof client.hgetall === "function") {
        rawActivity = await client.hgetall(todayKey);
      }

      if (typeof client.lRange === "function") {
        rawQuotes = await client.lRange(quotesKey, 0, 10);
      } else if (typeof client.lrange === "function") {
        rawQuotes = await client.lrange(quotesKey, 0, 10);
      }
    }
  } catch (_) {}

  let topUser = {
    username: "Warga Teladan",
    count: 42,
    userId: guild.ownerId || "0",
  };
  let totalMessages = 0;

  if (rawActivity && Object.keys(rawActivity).length > 0) {
    const userList = Object.entries(rawActivity).map(([key, count]) => {
      const parts = key.split(":");
      const userId = parts[1] || "0";
      const username = parts.slice(2).join(":") || "Warga";
      const num = parseInt(count, 10) || 0;
      totalMessages += num;
      return { userId, username, count: num };
    });

    userList.sort((a, b) => b.count - a.count);
    if (userList.length > 0) {
      topUser = userList[0];
    }
  } else {
    totalMessages = 150;
  }

  const quotes = (rawQuotes || [])
    .map((q) => {
      try {
        return typeof q === "string" ? JSON.parse(q) : q;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let headline = `Sensasi Hari Ini di ${guild.name || "Server"}!`;
  let gossip = `Bintang terik menyinari guild ${guild.name || "komunitas"}. Tetaplah waspada terhadap drop rate gacha dan bahaya monster Rimba!`;
  const quoteHighlight =
    quotes.length > 0
      ? `"${quotes[0].text}", ${quotes[0].username}`
      : '"Hari yang cerah untuk berpetualang!", Naura';

  try {
    const aiManager = require("../managers/aiManager");
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
  } catch {
    // Fallback diam
  }

  return {
    date: new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    guildName: guild.name || "Server",
    guildIcon:
      typeof guild.iconURL === "function"
        ? guild.iconURL({ extension: "png" })
        : null,
    headline,
    gossip,
    quoteHighlight,
    totalMessages,
    memberCount: guild.memberCount || 0,
    topUser,
  };
}

/**
 * Mensintesis data peristiwa mentah menjadi edisi koran terstruktur "Naura Chronicle" (Law 5).
 * @param {Object} data
 * @param {string} [data.guildName="Astral Sanctuary"]
 * @param {Array<Object>} [data.lotteryWinners=[]]
 * @param {Array<Object>} [data.bossKills=[]]
 * @param {Array<Object>} [data.topClans=[]]
 * @param {Array<Object>} [data.marketItems=[]]
 * @returns {{ editionTitle: string, headline: string, leadStory: string, economySection: string, guildSection: string, weatherForecast: string }}
 */
function synthesizeChronicle(data = {}) {
  const guildName = data.guildName || "Astral Sanctuary";
  const lotteryWinners = Array.isArray(data.lotteryWinners) ? data.lotteryWinners : [];
  const bossKills = Array.isArray(data.bossKills) ? data.bossKills : [];
  const topClans = Array.isArray(data.topClans) ? data.topClans : [];
  const marketItems = Array.isArray(data.marketItems) && data.marketItems.length > 0
    ? data.marketItems
    : getMarketOverview();

  // 1. Headline & Lead Story
  let headline = "KOTA HOSHINO DAMAI & CERAH BERCAHAYA";
  let leadStory = "Aktivitas kota berjalan tertib, para petualang giat mengumpulkan Star Fragments di rimba Naura Wilds.";

  if (lotteryWinners.length > 0) {
    const topWin = lotteryWinners[0];
    headline = `PENGUNDIAN LOTRE MEWAH: ${topWin.username || "Seseorang"} MEMBAWA PULANG ${topWin.prize?.toLocaleString("id-ID") || "JUTAAN"} NSF!`;
    leadStory = `Dewi Keberuntungan Hoshino tersenyum lebar pada ${topWin.username || "seorang warga"} yang sukses menyabet jackpot undian lotre utama pekan ini!`;
  } else if (bossKills.length > 0) {
    const topBoss = bossKills[0];
    headline = `ANOMALI ABYSS DITUMPAS: ${topBoss.bossName || "World Boss"} BERHASIL DILUMPUHKAN!`;
    leadStory = `Aliansi pahlawan server berhasil menundukkan ${topBoss.bossName} setelah pertempuran sengit antar fase.`;
  }

  // 2. Kolom Pasar & Komoditas
  const bullish = marketItems.filter((i) => i.trend === "bullish");
  const bearish = marketItems.filter((i) => i.trend === "bearish");

  let economySection = "Pasar komoditas terpantau stabil tanpa gejolak harga ekstrem.";
  if (bullish.length > 0) {
    economySection = `Komoditas yang melonjak tinggi dipimpin oleh **${bullish[0].name}** (+${bullish[0].priceChangePercent}%). Permintaan melonjak drastis!`;
  } else if (bearish.length > 0) {
    economySection = `Pasar mengalami surplus stok pada komoditas **${bearish[0].name}** (${bearish[0].priceChangePercent}%). Waktu tepat bagi pembeli borongan!`;
  }

  // 3. Kolom Klan & Petualang
  let guildSection = "Klan petualang aktif memperkuat benteng dan garnisun di wilayah teritorinya.";
  if (topClans.length > 0) {
    guildSection = `Klan **${topClans[0].name}** memuncaki klasemen prestise pekan ini dengan dominasi wilayah teritorial terluas!`;
  }

  // 4. Ramalan Cuaca Kosmik
  const weatherForecast = "Langit Astral memancarkan starlight hangat, memberikan efisiensi memancing dan bertani +15% di akhir pekan.";

  return {
    editionTitle: `Warta Mingguan ${guildName}`,
    headline,
    leadStory,
    economySection,
    guildSection,
    weatherForecast,
  };
}

module.exports = {
  recordMessageActivity,
  generateChronicleData,
  synthesizeChronicle,
};
