"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  WEATHER_TYPES,
  WEATHER_CYCLE,
  getCurrentWeather,
  getTimeUntilNextWeather,
  applyWeatherHarvestBonus,
  applyWeatherDurabilityWear,
} = require("./worldWeatherEngine");

test("worldWeatherEngine - daftar cuaca lengkap 5 tipe", () => {
  assert.equal(WEATHER_CYCLE.length, 5);
  assert.ok(WEATHER_TYPES.CLEAR_SKY);
  assert.ok(WEATHER_TYPES.HEAVY_RAIN);
  assert.ok(WEATHER_TYPES.THUNDERSTORM);
  assert.ok(WEATHER_TYPES.SANDSTORM);
  assert.ok(WEATHER_TYPES.SCORCHING_SUN);
});

test("worldWeatherEngine - siklus cuaca berganti setiap 6 jam secara deterministik", () => {
  const t0 = 1700000000000;
  const t6h = t0 + 6 * 60 * 60 * 1000;
  const weather0 = getCurrentWeather("desa_sukamaju", t0);
  const weather6h = getCurrentWeather("desa_sukamaju", t6h);

  assert.notEqual(weather0.id, weather6h.id);
  assert.ok(weather0.timeRemainingFormatted.length > 0);
  assert.ok(getTimeUntilNextWeather(t0) <= 6 * 60 * 60 * 1000);
});

test("worldWeatherEngine - applyWeatherHarvestBonus menghitung bonus panen", () => {
  // Heavy rain: +30%
  const rainBonus = applyWeatherHarvestBonus(10, "HEAVY_RAIN");
  assert.equal(rainBonus, 13);

  // Clear sky: no bonus
  const clearBonus = applyWeatherHarvestBonus(10, "CLEAR_SKY");
  assert.equal(clearBonus, 10);
});

test("worldWeatherEngine - applyWeatherDurabilityWear menghitung pengikisan alat", () => {
  // Thunderstorm: +25% wear
  const thunderWear = applyWeatherDurabilityWear(10, "THUNDERSTORM");
  assert.equal(thunderWear, 13);

  // Clear sky: normal wear
  const clearWear = applyWeatherDurabilityWear(10, "CLEAR_SKY");
  assert.equal(clearWear, 10);
});
