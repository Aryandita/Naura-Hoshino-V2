"use strict";

// Lokasi: plugin/survival/survivalTime.js
// ==========================================
// PERPINDAHAN WAKTU DALAM GAME
// ==========================================
// Tiga bug lama yang ditutup di sini:
// 1. Seluruh perubahan rpg_state (cuaca, sakit, tunggakan pajak) dihitung tapi
//    tidak pernah ikut disimpan, karena UserSurvival.update() tidak menyertakan
//    kolom rpg_state. Jadi pemain tidak pernah benar-benar sakit dan pajak
//    tidak pernah menumpuk.
// 2. Saat pingsan tepat melewati tengah malam, hari bertambah dua kali.
// 3. Pemain dipulangkan ke 'village', padahal seluruh ekosistem NPC, toko, dan
//    perjalanan memakai 'desa'. Akibatnya lokasi pulang jadi wilayah hantu.

const UserSurvival = require("../../models/UserSurvival");
const cacheManager = require("../../managers/cacheManager");
const { safeParseInventory } = require("../engines/inventoryHelper");
const weatherModule = require("./survivalWeather");

const HOME_LOCATION = "desa";
const TAX_RATES = { gudang: 100, kos: 250, rumah: 500 };
const TAX_PENALTY_RATE = 1.2;
const SEIZE_AFTER_DAYS = 3;
const SICK_CHANCE = 0.3;
const WAKE_UP_HOUR = 10;

const defaultRpgState = () => ({
  sick: false,
  tax_due: 0,
  house_seized: false,
  weather: "cerah",
  weather_hour: 0,
  unlocked_recipes: [],
  failed_exams: 0,
  test_cd: 0,
});

/** Cuaca berganti setiap blok tiga jam, bukan setiap pemanggilan. */
function rollWeather(rpgState, previousHour, nextHour) {
  if (Math.floor(nextHour / 3) === Math.floor(previousHour / 3)) return;

  const seed = Math.random() * 100;
  // Setelah hujan, peluang hujan lagi menurun supaya cuaca terasa bergerak.
  const chanceHujan = rpgState.weather === "hujan" ? 10 : 30;

  if (seed < chanceHujan) rpgState.weather = "hujan";
  else if (seed < chanceHujan + 5) rpgState.weather = "badai";
  else rpgState.weather = "cerah";
}

/** Tanpa jas hujan, cuaca buruk berpeluang membuat pemain sakit. */
async function rollSickness(userId, rpgState) {
  if (rpgState.sick) return;
  if (rpgState.weather !== "hujan" && rpgState.weather !== "badai") return;

  const profile = await cacheManager.getUserProfile(userId);
  const inventory = safeParseInventory(profile?.inventory);
  const hasRaincoat = inventory.some(
    (item) => item && (item.id === "raincoat" || item.id === "rain_coat"),
  );

  if (!hasRaincoat && Math.random() < SICK_CHANCE) rpgState.sick = true;
}

/**
 * Tagih pajak properti untuk sejumlah hari, potong dari bank bila cukup.
 * @returns {Promise<void>}
 */
async function chargeTax(userId, propertyId, rpgState, days) {
  if (!propertyId || propertyId === "jalanan" || days <= 0) return;

  const dailyTax = TAX_RATES[propertyId] || 0;
  if (dailyTax <= 0) return;

  const totalDue = dailyTax * days;
  rpgState.tax_due = (rpgState.tax_due || 0) + totalDue;

  const bill = Math.floor(totalDue * TAX_PENALTY_RATE);
  const debitRes = await cacheManager.debitUserProfile(
    userId,
    "economy_bank",
    bill,
  );

  if (debitRes && debitRes.ok) {
    rpgState.tax_due = Math.max(0, (rpgState.tax_due || 0) - totalDue);
  } else if (rpgState.tax_due > dailyTax * SEIZE_AFTER_DAYS) {
    rpgState.house_seized = true;
  }
}

/**
 * Majukan waktu dalam game.
 * @param {string} userId
 * @param {number} hoursAdded
 * @returns {Promise<{hour: number, day: number, passedOut: boolean, penalty: number, clinic?: string}>}
 */
async function advanceTime(userId, hoursAdded) {
  const [survival] = await UserSurvival.findOrCreate({ where: { userId } });

  const previousHour = survival.inGameHour || 6;
  let newHour = previousHour + hoursAdded;
  let newDay = survival.inGameDay || 1;

  const rpgState = survival.rpg_state || defaultRpgState();

  rollWeather(rpgState, previousHour, newHour);
  await rollSickness(userId, rpgState);

  const exhausted = survival.stamina <= 0 || survival.hunger <= 0;
  const passedOut = newHour >= 24 || exhausted;

  // Hitung berapa hari yang benar-benar terlewat, satu kali saja.
  let advancedDays = 0;
  while (newHour >= 24) {
    newHour -= 24;
    newDay += 1;
    advancedDays += 1;
  }

  if (passedOut) {
    const clinicType =
      survival.currentLocation === "kota" ? "RS Kota" : "Klinik Desa";

    // Pingsan karena kelelahan sebelum tengah malam tetap menghabiskan sisa
    // hari itu. Kalau tengah malam sudah terlewat, hari tidak ditambah lagi.
    if (advancedDays === 0) {
      newDay += 1;
      advancedDays = 1;
    }
    newHour = WAKE_UP_HOUR;

    await chargeTax(userId, survival.propertyId, rpgState, advancedDays);

    let penaltyAmt = clinicType === "RS Kota" ? 500 : 150;
    const wallet = survival.starFragments || 0;
    if (wallet < penaltyAmt) penaltyAmt = wallet;

    if (penaltyAmt > 0) {
      await cacheManager.debitUserSurvival(userId, "starFragments", penaltyAmt);
    }

    await cacheManager.mutateUserSurvivalJson(
      userId,
      "rpg_state",
      () => rpgState,
    );

    await cacheManager.incrementUserSurvival(userId, {
      inGameHour: newHour - (survival.inGameHour || 0),
      inGameDay: newDay - (survival.inGameDay || 1),
    });

    await cacheManager.updateUserSurvival(userId, {
      hunger: 30,
      thirst: 30,
      stamina: 30,
      currentLocation: HOME_LOCATION,
    });

    return {
      hour: newHour,
      day: newDay,
      passedOut: true,
      penalty: penaltyAmt,
      clinic: clinicType,
    };
  }

  await chargeTax(userId, survival.propertyId, rpgState, advancedDays);

  // Menjalani waktu di penjara pada akhirnya membebaskan pemain.
  const finalLocation =
    survival.currentLocation === "prison" && advancedDays > 0
      ? HOME_LOCATION
      : survival.currentLocation;

  await cacheManager.mutateUserSurvivalJson(
    userId,
    "rpg_state",
    () => rpgState,
  );

  await cacheManager.incrementUserSurvival(userId, {
    inGameHour: newHour - (survival.inGameHour || 0),
    inGameDay: newDay - (survival.inGameDay || 1),
  });

  await cacheManager.updateUserSurvival(userId, {
    currentLocation: finalLocation,
  });

  return { hour: newHour, day: newDay, passedOut: false, penalty: 0 };
}

module.exports = {
  advanceTime,
  HOME_LOCATION,
  // Diteruskan dari survivalWeather.js agar pemanggil lama tetap berjalan.
  getTimeState: weatherModule.getTimeState,
  getSeason: weatherModule.getSeason,
  getWeather: weatherModule.getWeather,
  getShopMultiplier: weatherModule.getShopMultiplier,
};
