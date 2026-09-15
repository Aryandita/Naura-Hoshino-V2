"use strict";

/**
 * commodityMarketEngine.js - Automated Dynamic Commodity Market Fluctuations
 *
 * Mengelola dinamika fluktuasi pasar komoditas bebas (Ikan Laut Dalam, Mineral, & Hasil Panen)
 * berbasis elastisitas penawaran-permintaan (*Supply & Demand Elasticity*) dengan batas aman (Law 5).
 */

const COMMODITY_CATALOG = Object.freeze({
  // 1. Ikan Laut Dalam (Deep-Sea Fishes)
  abyssal_angler: { name: "Abyssal Angler", category: "fish", basePrice: 420 },
  luminous_squid: { name: "Luminous Squid", category: "fish", basePrice: 280 },
  neon_tetra: { name: "Neon Tetra", category: "fish", basePrice: 150 },
  celestial_koi: { name: "Celestial Koi", category: "fish", basePrice: 850 },

  // 2. Mineral Tambang (Ores & Gems)
  starlight_ore: { name: "Starlight Ore", category: "mineral", basePrice: 320 },
  cyber_ruby: { name: "Cyber Ruby", category: "mineral", basePrice: 650 },
  mythic_emerald: { name: "Mythic Emerald", category: "mineral", basePrice: 900 },
  void_amethyst: { name: "Void Amethyst", category: "mineral", basePrice: 1200 },

  // 3. Hasil Panen Greenhouse (Crops)
  astral_strawberry: { name: "Astral Strawberry", category: "crop", basePrice: 180 },
  cyber_mint: { name: "Cyber Mint", category: "crop", basePrice: 240 },
  void_coffee: { name: "Void Coffee Bean", category: "crop", basePrice: 380 },
  neon_melon: { name: "Neon Melon", category: "crop", basePrice: 520 },
  sakura_grain: { name: "Sakura Grain", category: "crop", basePrice: 750 },
});

// Batas fluktuasi harga komoditas demi kestabilan ekonomi
const MIN_PRICE_MULTIPLIER = 0.65; // Diskon maksimal -35% saat oversupply
const MAX_PRICE_MULTIPLIER = 1.50; // Inflasi maksimal +50% saat scarcity
const DECAY_RATE_PER_HOUR = 0.08;  // Regresi 8% per jam menuju baseline

/**
 * Menghitung harga aktual komoditas berdasarkan volume perdagangan dan jeda waktu.
 * @param {string} commodityId - ID komoditas (misal: 'celestial_koi')
 * @param {Object} [volume]
 * @param {number} [volume.sold=0] - Jumlah unit yang dijual ke pasar (menambah supply -> harga turun)
 * @param {number} [volume.bought=0] - Jumlah unit yang dibeli dari pasar (menambah demand -> harga naik)
 * @param {number} [timeDecayHours=0] - Jam berlalu sejak siklus perdagangan terakhir
 * @returns {{ id: string, name: string, category: string, basePrice: number, currentPrice: number, multiplier: number, priceChangePercent: number, trend: 'bullish'|'bearish'|'stable' }}
 */
function calculateCommodityPrice(commodityId, volume = { sold: 0, bought: 0 }, timeDecayHours = 0) {
  const item = COMMODITY_CATALOG[commodityId];
  if (!item) {
    throw new Error(`Komoditas tidak dikenal: ${commodityId}`);
  }

  const sold = Math.max(0, Number(volume.sold) || 0);
  const bought = Math.max(0, Number(volume.bought) || 0);
  const hours = Math.max(0, Number(timeDecayHours) || 0);

  // Net pressure: positif = demand tinggi (harga naik), negatif = supply tinggi (harga turun)
  // Tiap 10 unit transaksi memberikan pergeseran 1% harga
  const rawPressure = (bought - sold) * 0.001;

  // Regresi alami eksponensial ke baseline seiring berjalannya waktu
  const decayFactor = Math.exp(-DECAY_RATE_PER_HOUR * hours);
  const effectivePressure = rawPressure * decayFactor;

  // Clamp multiplier ke rentang aman [0.65, 1.50]
  const rawMultiplier = 1.0 + effectivePressure;
  const clampedMultiplier = Math.max(MIN_PRICE_MULTIPLIER, Math.min(MAX_PRICE_MULTIPLIER, rawMultiplier));

  const currentPrice = Math.max(1, Math.round(item.basePrice * clampedMultiplier));
  const priceChangePercent = Math.round((clampedMultiplier - 1.0) * 100);

  let trend = "stable";
  if (priceChangePercent >= 3) {
    trend = "bullish";
  } else if (priceChangePercent <= -3) {
    trend = "bearish";
  }

  return {
    id: commodityId,
    name: item.name,
    category: item.category,
    basePrice: item.basePrice,
    currentPrice,
    multiplier: Number(clampedMultiplier.toFixed(3)),
    priceChangePercent,
    trend,
  };
}

/**
 * Mendapatkan seluruh daftar harga komoditas pasar saat ini.
 * @param {Record<string, { sold: number, bought: number }>} [marketVolumes={}]
 * @param {number} [timeDecayHours=0]
 * @returns {Array<Object>}
 */
function getMarketOverview(marketVolumes = {}, timeDecayHours = 0) {
  return Object.keys(COMMODITY_CATALOG).map((id) => {
    const vol = marketVolumes[id] || { sold: 0, bought: 0 };
    return calculateCommodityPrice(id, vol, timeDecayHours);
  });
}

module.exports = {
  COMMODITY_CATALOG,
  MIN_PRICE_MULTIPLIER,
  MAX_PRICE_MULTIPLIER,
  calculateCommodityPrice,
  getMarketOverview,
};
