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

const ENERGY_RESET_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 Jam

/**
 * Format selisih waktu milidetik ke teks bahasa Indonesia yang ringkas.
 *
 * @param {number} ms - Sisa waktu dalam milidetik
 * @returns {string} Contoh: "4 jam 15 menit", "35 menit", atau "Siap!"
 */
function formatResetCountdown(ms) {
  if (!ms || ms <= 0) return "Siap!";
  const totalMinutes = Math.ceil(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
  }
  return `${minutes} menit`;
}

/**
 * Memeriksa apakah siklus reset energi 5 jam pemain sudah tiba.
 * Jika sudah >= 5 jam sejak reset terakhir, stamina dipulihkan penuh (100 atau cap premium).
 *
 * @param {string} userId - ID Discord User
 * @param {object} [existingSurvival] - Objek survival jika sudah di-fetch sebelumnya
 * @returns {Promise<{ reset: boolean, stamina: number, nextResetInMs: number, formattedCountdown: string }>}
 */
async function checkAndApplyEnergyReset(userId, existingSurvival = null) {
  if (!userId) {
    return {
      reset: false,
      stamina: 0,
      nextResetInMs: ENERGY_RESET_INTERVAL_MS,
      formattedCountdown: formatResetCountdown(ENERGY_RESET_INTERVAL_MS),
    };
  }

  const survival =
    existingSurvival || (await cacheManager.getUserSurvival(userId));
  if (!survival) {
    return {
      reset: false,
      stamina: 0,
      nextResetInMs: ENERGY_RESET_INTERVAL_MS,
      formattedCountdown: formatResetCountdown(ENERGY_RESET_INTERVAL_MS),
    };
  }

  const rpgState =
    survival.rpg_state && typeof survival.rpg_state === "object"
      ? { ...survival.rpg_state }
      : {};

  const now = Date.now();
  const lastReset = rpgState.last_energy_reset
    ? new Date(rpgState.last_energy_reset).getTime()
    : 0;

  const elapsed = now - lastReset;

  let maxStamina = 100;
  try {
    const profile = await cacheManager.getUserProfile(userId);
    const {
      getUserPremiumTier,
      getMaxEnergy,
    } = require("../../premium/premiumHelper");
    maxStamina = getMaxEnergy(getUserPremiumTier(profile));
  } catch (_) {
    maxStamina = 100;
  }

  if (lastReset === 0 || elapsed >= ENERGY_RESET_INTERVAL_MS) {
    const patch = {
      stamina: maxStamina,
    };
    rpgState.last_energy_reset = new Date(now).toISOString();
    patch.rpg_state = rpgState;

    await cacheManager.updateUserSurvival(userId, patch);
    survival.stamina = maxStamina;
    survival.rpg_state = rpgState;

    return {
      reset: true,
      stamina: maxStamina,
      nextResetInMs: ENERGY_RESET_INTERVAL_MS,
      formattedCountdown: formatResetCountdown(ENERGY_RESET_INTERVAL_MS),
    };
  }

  const nextResetInMs = Math.max(0, ENERGY_RESET_INTERVAL_MS - elapsed);
  return {
    reset: false,
    stamina: Number(survival.stamina ?? maxStamina),
    nextResetInMs,
    formattedCountdown: formatResetCountdown(nextResetInMs),
  };
}

/**
 * Menghitung energi tambahan dari makanan dan minuman berdasarkan tier (maksimal +25).
 * Tier 1: +5 | Tier 2: +10 | Tier 3: +15 | Tier 4: +20 | Tier 5: +25
 *
 * @param {object} item - Objek konfigurasi item
 * @returns {number} Bonus energi (0 sampai 25)
 */
function calculateFoodEnergyBonus(item) {
  if (!item) return 0;
  const isFoodOrDrink =
    item.iconType === "food" ||
    item.iconType === "drink" ||
    item.category === "consumable" ||
    Number(item.hunger || item.effects?.hunger || 0) > 0 ||
    Number(item.thirst || item.effects?.thirst || 0) > 0;

  if (!isFoodOrDrink) return 0;
  const tier = Math.min(5, Math.max(1, Number(item.tier || 1)));
  return Math.min(25, tier * 5);
}

/**
 * Memotong stamina untuk aksi survival. Jika stamina habis atau kurang,
 * sisa biaya ditanggung oleh Lapar (hunger) dan Haus (thirst) dengan penalti 1.5x.
 *
 * @param {string} userId - ID Discord User
 * @param {number} staminaCost - Biaya stamina yang dibutuhkan
 * @returns {Promise<{
 *   ok: boolean,
 *   usedVitalsFallback: boolean,
 *   staminaSpent: number,
 *   hungerSpent: number,
 *   thirstSpent: number,
 *   finalStamina: number,
 *   finalHunger: number,
 *   finalThirst: number,
 *   warning?: string,
 *   reason?: string,
 *   message?: string
 * }>}
 */
async function consumeEnergyOrVitals(userId, staminaCost) {
  const cost = Math.max(0, Math.floor(Number(staminaCost) || 0));
  if (cost === 0) {
    return {
      ok: true,
      usedVitalsFallback: false,
      staminaSpent: 0,
      hungerSpent: 0,
      thirstSpent: 0,
    };
  }

  await checkAndApplyEnergyReset(userId);

  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival) {
    return {
      ok: false,
      reason: "not_found",
      message: "Data survival tidak ditemukan.",
    };
  }

  const currentStamina = Math.max(0, Number(survival.stamina ?? 0));
  const currentHunger = Math.max(0, Number(survival.hunger ?? 0));
  const currentThirst = Math.max(0, Number(survival.thirst ?? 0));

  if (currentStamina >= cost) {
    const debit = await cacheManager.debitUserSurvival(userId, "stamina", cost);
    if (debit.ok) {
      return {
        ok: true,
        usedVitalsFallback: false,
        staminaSpent: cost,
        hungerSpent: 0,
        thirstSpent: 0,
        finalStamina: currentStamina - cost,
        finalHunger: currentHunger,
        finalThirst: currentThirst,
      };
    }
  }

  const staminaSpent = currentStamina;
  const deficit = cost - staminaSpent;
  const vitalsPenaltyCost = Math.ceil(deficit * 1.5);

  if (currentHunger <= 0 && currentThirst <= 0) {
    return {
      ok: false,
      reason: "completely_exhausted",
      message:
        "Energi, Lapar, dan Hausmu sudah habis! Tubuhmu ambruk karena kelelahan ekstrim. Pulihkan kondisi fisikmu dulu sebelum bekerja lagi!",
    };
  }

  const hungerDrain = Math.min(currentHunger, vitalsPenaltyCost);
  const thirstDrain = Math.min(currentThirst, vitalsPenaltyCost);

  const finalStamina = 0;
  const finalHunger = Math.max(0, currentHunger - hungerDrain);
  const finalThirst = Math.max(0, currentThirst - thirstDrain);

  const patch = {
    stamina: finalStamina,
    hunger: finalHunger,
    thirst: finalThirst,
  };

  await cacheManager.updateUserSurvival(userId, patch);

  survival.stamina = finalStamina;
  survival.hunger = finalHunger;
  survival.thirst = finalThirst;

  if (
    Number(survival.hp ?? 100) <= 0 ||
    (finalHunger <= 0 &&
      finalThirst <= 0 &&
      Number(survival.hp ?? 100) <= 10)
  ) {
    await checkAndRescueDeadEnd(userId, survival);
  }

  const warningNote =
    staminaSpent > 0
      ? `⚠️ **Energi Habis di Tengah Aksi!** Sisa ${deficit} tenaga dialihkan menguras **${hungerDrain}% Lapar** dan **${thirstDrain}% Haus** (penalti 1.5x). Rehat atau makan dulu!`
      : `⚠️ **Energi Habis!** Tenaga darurat menguras **${hungerDrain}% Lapar** dan **${thirstDrain}% Haus** (penalti 1.5x pengganti stamina). Rehat atau makan dulu!`;

  return {
    ok: true,
    usedVitalsFallback: true,
    staminaSpent,
    hungerSpent: hungerDrain,
    thirstSpent: thirstDrain,
    finalStamina,
    finalHunger,
    finalThirst,
    warning: warningNote,
  };
}

module.exports = {
  ENERGY_RESET_INTERVAL_MS,
  formatResetCountdown,
  checkAndApplyEnergyReset,
  calculateFoodEnergyBonus,
  consumeEnergyOrVitals,
  drainVitals,
  recoverVitals,
  checkVitalThresholds,
  buildVitalsSummaryLine,
  checkAndRescueDeadEnd,
};
