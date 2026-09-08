"use strict";

const cacheManager = require("../../managers/cacheManager");
const leveling = require("../engines/survivalLeveling");

/**
 * Kurangi nilai vital (hunger, thirst, stamina, hp) pemain secara aman dan terpusat.
 * Mencegah nilai jatuh di bawah 0 dan mengembalikan status kelelahan.
 *
 * @param {string} userId - ID Discord User
 * @param {object} drains - Jumlah penurunan { hunger, thirst, stamina, hp }
 * @returns {Promise<{ hunger: number, thirst: number, stamina: number, hp: number, isExhausted: boolean, isCritical: boolean }>}
 */
async function drainVitals(
  userId,
  { hunger = 0, thirst = 0, stamina = 0, hp = 0 } = {},
) {
  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival) return null;

  const currentHunger = Math.max(0, Number(survival.hunger ?? 100));
  const currentThirst = Math.max(0, Number(survival.thirst ?? 100));
  const currentStamina = Math.max(0, Number(survival.stamina ?? 100));
  const currentHp = Math.max(0, Number(survival.hp ?? 100));

  const hungerDelta = -Math.min(currentHunger, Math.max(0, hunger));
  const thirstDelta = -Math.min(currentThirst, Math.max(0, thirst));
  const staminaDelta = -Math.min(currentStamina, Math.max(0, stamina));
  const hpDelta = -Math.min(currentHp, Math.max(0, hp));

  const deltas = {};
  if (hungerDelta !== 0) deltas.hunger = hungerDelta;
  if (thirstDelta !== 0) deltas.thirst = thirstDelta;
  if (staminaDelta !== 0) deltas.stamina = staminaDelta;
  if (hpDelta !== 0) deltas.hp = hpDelta;

  if (Object.keys(deltas).length > 0) {
    await cacheManager.incrementUserSurvival(userId, deltas);
  }

  const finalHunger = currentHunger + hungerDelta;
  const finalThirst = currentThirst + thirstDelta;
  const finalStamina = currentStamina + staminaDelta;
  const finalHp = currentHp + hpDelta;

  const isExhausted = finalStamina <= 0 || finalHunger <= 0 || finalThirst <= 0;
  const isCritical = finalHp <= 20 || finalStamina <= 10;

  return {
    hunger: finalHunger,
    thirst: finalThirst,
    stamina: finalStamina,
    hp: finalHp,
    isExhausted,
    isCritical,
  };
}

/**
 * Pulihkan nilai vital (hunger, thirst, stamina, hp) pemain hingga batas maksimal.
 *
 * @param {string} userId - ID Discord User
 * @param {object} gains - Jumlah penambahan { hunger, thirst, stamina, hp }
 * @param {number} [customMaxHp] - Batas maksimum HP jika berbeda dari standar
 */
async function recoverVitals(
  userId,
  { hunger = 0, thirst = 0, stamina = 0, hp = 0 } = {},
  customMaxHp = null,
) {
  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival) return null;

  const maxHp = customMaxHp || leveling.calculateMaxHp(survival);
  const currentHunger = Number(survival.hunger ?? 100);
  const currentThirst = Number(survival.thirst ?? 100);
  const currentStamina = Number(survival.stamina ?? 100);
  const currentHp = Number(survival.hp ?? maxHp);

  const hungerAdd = Math.max(0, Math.min(100 - currentHunger, hunger));
  const thirstAdd = Math.max(0, Math.min(100 - currentThirst, thirst));
  const staminaAdd = Math.max(0, Math.min(100 - currentStamina, stamina));
  const hpAdd = Math.max(0, Math.min(maxHp - currentHp, hp));

  const deltas = {};
  if (hungerAdd > 0) deltas.hunger = hungerAdd;
  if (thirstAdd > 0) deltas.thirst = thirstAdd;
  if (staminaAdd > 0) deltas.stamina = staminaAdd;
  if (hpAdd > 0) deltas.hp = hpAdd;

  if (Object.keys(deltas).length > 0) {
    await cacheManager.incrementUserSurvival(userId, deltas);
  }

  return {
    hunger: currentHunger + hungerAdd,
    thirst: currentThirst + thirstAdd,
    stamina: currentStamina + staminaAdd,
    hp: currentHp + hpAdd,
    maxHp,
  };
}

/**
 * Cek status peringatan vital saat ini.
 */
function checkVitalThresholds(survival) {
  const hunger = Number(survival?.hunger ?? 100);
  const thirst = Number(survival?.thirst ?? 100);
  const stamina = Number(survival?.stamina ?? 100);
  const hp = Number(survival?.hp ?? 100);

  const warnings = [];
  if (hp <= 20) warnings.push("Kondisi fisik sekarat!");
  if (stamina <= 15) warnings.push("Stamina hampir habis!");
  if (hunger <= 15) warnings.push("Sangat kelaparan!");
  if (thirst <= 15) warnings.push("Sangat kehausan!");

  const isCritical = hp <= 20 || stamina <= 10;
  const isLow = hp <= 40 || stamina <= 30 || hunger <= 30 || thirst <= 30;

  return {
    isHealthy: !isLow && !isCritical,
    isLow,
    isCritical,
    warnings,
  };
}

/**
 * Membangun satu baris indikator ringkas status vital untuk disisipkan di deskripsi respons.
 */
function buildVitalsSummaryLine(survival, customMaxHp = null) {
  const maxHp = customMaxHp || leveling.calculateMaxHp(survival);
  const hp = Math.min(maxHp, Number(survival?.hp ?? maxHp));
  const stamina = Number(survival?.stamina ?? 100);
  const hunger = Number(survival?.hunger ?? 100);
  const thirst = Number(survival?.thirst ?? 100);

  return `❤️ HP **${hp}/${maxHp}** \u2022 ⚡ Stamina **${stamina}/100** \u2022 🍖 Lapar **${hunger}/100** \u2022 💧 Haus **${thirst}/100**`;
}

module.exports = {
  drainVitals,
  recoverVitals,
  checkVitalThresholds,
  buildVitalsSummaryLine,
};
