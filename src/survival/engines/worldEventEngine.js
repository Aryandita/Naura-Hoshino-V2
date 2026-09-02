"use strict";

/**
 * World Event Engine - Mengelola festival, perayaan nasional, dan event musiman
 * yang memberikan boost drop rate, item eksklusif, dan penyesuaian ekonomi.
 */

const EVENTS = [
  {
    id: "independence_day",
    name: "Pesta Kemerdekaan RI 🇮🇩",
    month: 7, // August (0-indexed)
    startDay: 17,
    endDay: 31,
    dropBoost: 1.5,
    salaryBoost: 1.25,
    exclusiveItem: "bendera_merah_putih",
    exclusiveItemName: "Bendera Merah Putih",
    description: "Semarak kemerdekaan! Hasil panen & tambang naik 50%, gaji kerja naik 25%!",
  },
  {
    id: "naura_birthday",
    name: "Ulang Tahun Naura Hoshino 🎂",
    month: 5, // June (0-indexed)
    startDay: 11,
    endDay: 13,
    dropBoost: 2.0,
    salaryBoost: 1.5,
    exclusiveItem: "birthday_cake",
    exclusiveItemName: "Kue Ulang Tahun Naura",
    description: "Ulang tahun Naura! Semua hadiah & drop berlipat ganda 2x!",
  },
  {
    id: "autumn_harvest",
    name: "Festival Panen Musim Gugur 🌾",
    month: 8, // September (0-indexed)
    startDay: 1,
    endDay: 30,
    dropBoost: 1.3,
    salaryBoost: 1.15,
    exclusiveItem: "golden_grain",
    exclusiveItemName: "Bulir Padi Emas",
    description: "Musim panen melimpah! Hasil pertanian & gathering meningkat 30%!",
  },
  {
    id: "frostsnow_winter",
    name: "Badai Salju Frostsnow ❄️",
    month: 11, // December (0-indexed)
    startDay: 15,
    endDay: 31,
    dropBoost: 1.4,
    salaryBoost: 1.2,
    exclusiveItem: "snow_crystal",
    exclusiveItemName: "Kristal Es Abadi",
    description: "Musim dingin tiba! Kristal es langka mulai muncul di penjuru dunia!",
  },
];

/**
 * Mengambil event yang sedang berlangsung berdasarkan tanggal real-time.
 *
 * @param {Date} [date=new Date()]
 * @returns {object|null}
 */
function getActiveEvent(date = new Date()) {
  const currentMonth = date.getMonth();
  const currentDay = date.getDate();

  for (const ev of EVENTS) {
    if (ev.month === currentMonth && currentDay >= ev.startDay && currentDay <= ev.endDay) {
      return { ...ev, isActive: true };
    }
  }

  return null;
}

/**
 * Terapkan bonus event pada hasil reward dasar.
 *
 * @param {number} baseAmount - Nilai dasar reward
 * @param {object|null} event - Objek event aktif
 * @param {string} [type='drop'] - 'drop' | 'salary'
 * @returns {number} Nilai reward setelah bonus
 */
function applyEventBonuses(baseAmount, event, type = "drop") {
  const base = Math.max(0, Number(baseAmount) || 0);
  if (!event) return base;

  const multiplier = type === "salary" ? (event.salaryBoost || 1.0) : (event.dropBoost || 1.0);
  return Math.max(1, Math.floor(base * multiplier));
}

/**
 * Hitung peluang mendapatkan item eksklusif event.
 *
 * @param {object|null} event - Objek event aktif
 * @param {number} [luck=1] - Stat Luck pemain
 * @returns {{ gotDrop: boolean, item: object|null }}
 */
function getEventExclusiveDrop(event, luck = 1) {
  if (!event || !event.exclusiveItem) {
    return { gotDrop: false, item: null };
  }

  const baseChance = 0.20; // 20% dasar
  const luckBonus = Math.min(0.15, (Number(luck) || 1) * 0.005);
  const roll = Math.random();

  if (roll < baseChance + luckBonus) {
    return {
      gotDrop: true,
      item: {
        id: event.exclusiveItem,
        name: event.exclusiveItemName,
        amount: 1,
        type: "event_exclusive",
      },
    };
  }

  return { gotDrop: false, item: null };
}

/**
 * Menghasilkan satu baris informasi event untuk ditambahkan ke embed/container.
 */
function buildEventBanner(event) {
  if (!event) return "";
  return `🎉 **[EVENT: ${event.name}]** ${event.description}`;
}

module.exports = {
  EVENTS,
  getActiveEvent,
  applyEventBonuses,
  getEventExclusiveDrop,
  buildEventBanner,
};
