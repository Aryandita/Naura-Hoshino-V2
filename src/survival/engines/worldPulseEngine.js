"use strict";

const worldWeatherEngine = require("./worldWeatherEngine");

/**
 * Mengambil denyut dunia (World Pulse) yang memadukan status cuaca,
 * narasi kontekstual, dan efek lingkungan untuk sub-brand Naura Wilds.
 *
 * @param {object} [options]
 * @param {string} [options.regionId="desa_sukamaju"]
 * @param {string} [options.action="default"]
 * @param {number} [options.timestamp=Date.now()]
 * @returns {object} Status denyut dunia
 */
function getWorldPulse({ regionId = "desa_sukamaju", action = "default", timestamp = Date.now() } = {}) {
  const weather = worldWeatherEngine.getCurrentWeather(regionId, timestamp);
  const flavorText = worldWeatherEngine.getWeatherFlavorText(weather.id, action);

  const regionName =
    regionId === "desa_khulkhas" || regionId === "khulkhas"
      ? "Gurun Khul'Khas"
      : regionId === "hutan_lebat"
        ? "Hutan Belantara"
        : regionId === "laut_dalam"
          ? "Pesisir Samudra"
          : "Wilayah Lembah Sukamaju";

  const pulseHeader = `${weather.icon} **${weather.name}** (${weather.timeRemainingFormatted} tersisa) \u2022 📍 ${regionName}`;

  return {
    regionId,
    regionName,
    weather,
    flavorText,
    pulseHeader,
    staminaMultiplier: weather.staminaMultiplier || 1.0,
    durabilityWearMultiplier: weather.durabilityWearMultiplier || 1.0,
    rareDropMultiplier: weather.rareDropMultiplier || 1.0,
    harvestBonus: weather.harvestBonus || 0,
  };
}

module.exports = {
  getWorldPulse,
};
