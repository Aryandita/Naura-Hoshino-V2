"use strict";

/**
 * @file worldWeatherEngine.js
 * @description Engine sistem cuaca dunia dinamis yang berotasi setiap 6 jam.
 * Menyediakan efek cuaca, bahaya alam, dan bonus panen/eksplorasi.
 */

const WEATHER_TYPES = {
  CLEAR_SKY: {
    id: "CLEAR_SKY",
    name: "Langit Cerah Berawan",
    icon: "☀️",
    description:
      "Kondisi atmosfer stabil dan nyaman untuk seluruh aktivitas petualangan.",
    harvestBonus: 0,
    staminaMultiplier: 1.0,
    durabilityWearMultiplier: 1.0,
    rareDropMultiplier: 1.0,
    colorHex: "#38BDF8",
  },
  HEAVY_RAIN: {
    id: "HEAVY_RAIN",
    name: "Hujan Lebat Tropis",
    icon: "🌧️",
    description:
      "Hujan deras mengguyur tanah subur. Panen kebun +30%, konsumsi stamina hutan +20%.",
    harvestBonus: 0.3,
    staminaMultiplier: 1.2,
    durabilityWearMultiplier: 1.0,
    rareDropMultiplier: 1.0,
    colorHex: "#3B82F6",
  },
  THUNDERSTORM: {
    id: "THUNDERSTORM",
    name: "Badai Petir Kosmik",
    icon: "⚡",
    description:
      "Kilatan petir menyambar area terbuka. Keausan peralatan kerja meningkat +25%.",
    harvestBonus: 0,
    staminaMultiplier: 1.1,
    durabilityWearMultiplier: 1.25,
    rareDropMultiplier: 1.15,
    colorHex: "#F59E0B",
  },
  SANDSTORM: {
    id: "SANDSTORM",
    name: "Kabut Pasir Gurun Khul'Khas",
    icon: "🌪️",
    description:
      "Angin gurun menyingkap reruntuhan kuno. Peluang menemukan artefak langka x2.",
    harvestBonus: -0.1,
    staminaMultiplier: 1.15,
    durabilityWearMultiplier: 1.1,
    rareDropMultiplier: 2.0,
    colorHex: "#D97706",
  },
  SCORCHING_SUN: {
    id: "SCORCHING_SUN",
    name: "Terik Matahari Ekstrem",
    icon: "🔥",
    description:
      "Suhu udara melonjak panas. Tingkat kehausan berkurang 2x lebih cepat.",
    harvestBonus: 0.1,
    staminaMultiplier: 1.25,
    durabilityWearMultiplier: 1.0,
    rareDropMultiplier: 1.0,
    colorHex: "#EF4444",
  },
};

const WEATHER_CYCLE = [
  "CLEAR_SKY",
  "HEAVY_RAIN",
  "THUNDERSTORM",
  "SANDSTORM",
  "SCORCHING_SUN",
];

const CYCLE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 jam per siklus cuaca

/**
 * Mendapatkan indeks siklus cuaca saat ini berdasarkan timestamp
 * @param {number} [timestamp=Date.now()]
 * @returns {number}
 */
function getCycleIndex(timestamp = Date.now()) {
  const slot = Math.floor(timestamp / CYCLE_DURATION_MS);
  return slot % WEATHER_CYCLE.length;
}

/**
 * Mendapatkan sisa waktu siklus cuaca aktif dalam milidetik
 * @param {number} [timestamp=Date.now()]
 * @returns {number}
 */
function getTimeUntilNextWeather(timestamp = Date.now()) {
  const currentCycleStart =
    Math.floor(timestamp / CYCLE_DURATION_MS) * CYCLE_DURATION_MS;
  const nextCycleStart = currentCycleStart + CYCLE_DURATION_MS;
  return Math.max(0, nextCycleStart - timestamp);
}

/**
 * Mengambil informasi cuaca aktif di dunia Naura Wilds
 * @param {string} [regionId="desa_sukamaju"] - Wilayah target
 * @param {number} [timestamp=Date.now()]
 * @returns {object} Informasi cuaca lengkap
 */
function getCurrentWeather(regionId = "desa_sukamaju", timestamp = Date.now()) {
  let idx = getCycleIndex(timestamp);

  // Variasi cuaca khusus untuk Gurun Khul'Khas
  if (regionId === "desa_khulkhas" || regionId === "khulkhas") {
    idx = (idx + 1) % WEATHER_CYCLE.length;
  }

  const weatherKey = WEATHER_CYCLE[idx];
  const weather = WEATHER_TYPES[weatherKey] || WEATHER_TYPES.CLEAR_SKY;
  const msRemaining = getTimeUntilNextWeather(timestamp);
  const minutesRemaining = Math.floor(msRemaining / (60 * 1000));
  const hoursRemaining = Math.floor(minutesRemaining / 60);

  return {
    ...weather,
    regionId,
    cycleIndex: idx,
    msRemaining,
    timeRemainingFormatted: `${hoursRemaining}j ${minutesRemaining % 60}m`,
  };
}

/**
 * Menghitung hasil panen setelah disesuaikan dengan buff cuaca aktif (Law 5)
 * @param {number} baseAmount
 * @param {string} weatherId
 * @returns {number}
 */
function applyWeatherHarvestBonus(baseAmount, weatherId) {
  if (baseAmount <= 0) return 0;
  const weather = WEATHER_TYPES[weatherId] || WEATHER_TYPES.CLEAR_SKY;
  const multiplier = 1 + (weather.harvestBonus || 0);
  return Math.max(1, Math.round(baseAmount * multiplier));
}

/**
 * Menghitung keausan alat setelah disesuaikan dengan cuaca aktif (Law 5)
 * @param {number} baseWear
 * @param {string} weatherId
 * @returns {number}
 */
function applyWeatherDurabilityWear(baseWear, weatherId) {
  if (baseWear <= 0) return 0;
  const weather = WEATHER_TYPES[weatherId] || WEATHER_TYPES.CLEAR_SKY;
  const multiplier = weather.durabilityWearMultiplier || 1.0;
  return Math.max(1, Math.round(baseWear * multiplier));
}

module.exports = {
  WEATHER_TYPES,
  WEATHER_CYCLE,
  CYCLE_DURATION_MS,
  getCurrentWeather,
  getTimeUntilNextWeather,
  applyWeatherHarvestBonus,
  applyWeatherDurabilityWear,
};
