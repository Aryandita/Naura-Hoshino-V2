"use strict";

/**
 * serverChronicleEngine.js - Autonomous Server Chronicle Newspaper Generator
 *
 * Mengagregasikan peristiwa-peristiwa penting server (Pemenang Lotre, Rekor Raid Boss,
 * Perdagangan Komoditas, Pertarungan Klan) menjadi narasi berita mingguan interaktif.
 */

const { getMarketOverview } = require("../survival/engines/commodityMarketEngine");

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
  synthesizeChronicle,
};
