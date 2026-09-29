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

  if (finalHp <= 0) {
    survival.hp = 0;
    survival.hunger = finalHunger;
    survival.thirst = finalThirst;
    survival.stamina = finalStamina;
    const rescue = await checkAndRescueDeadEnd(userId, survival);
    return {
      hunger: rescue.survival.hunger,
      thirst: rescue.survival.thirst,
      stamina: rescue.survival.stamina,
      hp: rescue.survival.hp,
      isExhausted: true,
      isCritical: true,
      rescued: true,
      clinic: rescue.clinic,
      penalty: rescue.penalty,
      currencyType: rescue.currencyType,
    };
  }

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

  let maxStamina = 100;
  try {
    const profile = await cacheManager.getUserProfile(userId);
    const { getUserPremiumTier, getMaxEnergy } = require("../../premium/premiumHelper");
    maxStamina = getMaxEnergy(getUserPremiumTier(profile));
  } catch (_) {
    maxStamina = 100;
  }

  const hungerAdd = Math.max(0, Math.min(100 - currentHunger, hunger));
  const thirstAdd = Math.max(0, Math.min(100 - currentThirst, thirst));
  const staminaAdd = Math.max(0, Math.min(maxStamina - currentStamina, stamina));
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

/**
 * Memeriksa apakah pemain mengalami kondisi dead-end (sekarat/mati total dengan HP <= 0
 * atau seluruh status fisik 0) dan melakukan penyelamatan medis darurat (Emergency Rescue).
 *
 * Pemain dibawa ke Rumah Sakit (Kota) atau Klinik (Desa/Wilds), memulihkan sedikit status vital,
 * serta memotong biaya perawatan (50 NC di Kota atau 500 NSF di Desa, tanpa minus).
 *
 * @param {string} userId - ID Discord User
 * @param {object} survival - Objek data survival saat ini
 * @returns {Promise<{ rescued: boolean, survival: object, reason: string|null, clinic?: string, penalty?: number, currencyType?: string }>}
 */
async function checkAndRescueDeadEnd(userId, survival) {
  if (!survival || !userId) return { rescued: false, survival, reason: null };

  const currentHp = Number(survival.hp ?? 100);
  const currentHunger = Number(survival.hunger ?? 100);
  const currentThirst = Number(survival.thirst ?? 100);
  const currentStamina = Number(survival.stamina ?? 100);

  // Kondisi Dead-End: HP <= 0 ATAU (semua 4 status vital <= 0) ATAU (HP <= 5 dan stamina/hunger/thirst habis)
  const isDeadEnd =
    currentHp <= 0 ||
    (currentHp <= 5 &&
      currentHunger <= 0 &&
      currentThirst <= 0 &&
      currentStamina <= 0) ||
    (currentHunger <= 0 &&
      currentThirst <= 0 &&
      currentStamina <= 0 &&
      currentHp <= 10);

  if (!isDeadEnd) {
    return { rescued: false, survival, reason: null };
  }

  const isCity = String(survival.currentLocation || "").toLowerCase() === "kota";
  const clinicType = isCity ? "RS Kota" : "Klinik Desa";
  const targetLocation = isCity ? "kota" : "desa";

  let penalty = 0;
  let currencyType = "NSF";

  if (isCity) {
    currencyType = "NC";
    let walletNc = 0;
    try {
      const profile = await cacheManager.getUserProfile(userId);
      walletNc = Math.max(0, Number(profile?.economy_wallet || 0));
    } catch (_) {
      walletNc = 0;
    }
    penalty = Math.min(50, walletNc);
    if (penalty > 0) {
      await cacheManager.debitUserProfile(userId, "economy_wallet", penalty);
    }
  } else {
    currencyType = "NSF";
    const walletNsf = Math.max(0, Number(survival.starFragments || 0));
    penalty = Math.min(500, walletNsf);
    if (penalty > 0) {
      await cacheManager.debitUserSurvival(userId, "starFragments", penalty);
      survival.starFragments = Math.max(0, walletNsf - penalty);
    }
  }

  // Pulihkan sedikit status vital agar pemain bisa pulih tanpa dead-end
  const maxHp = leveling.calculateMaxHp(survival);
  const safeHp = Math.max(25, Math.round(maxHp * 0.25));
  const safeVitals = {
    hp: safeHp,
    hunger: 30,
    thirst: 30,
    stamina: 30,
    currentLocation: targetLocation,
  };

  await cacheManager.updateUserSurvival(userId, safeVitals);
  Object.assign(survival, safeVitals);

  return {
    rescued: true,
    survival,
    reason: currentHp <= 0 ? "fainted" : "exhaustion",
    clinic: clinicType,
    penalty,
    currencyType,
  };
}

module.exports = {
  drainVitals,
  recoverVitals,
  checkVitalThresholds,
  buildVitalsSummaryLine,
  checkAndRescueDeadEnd,
};
