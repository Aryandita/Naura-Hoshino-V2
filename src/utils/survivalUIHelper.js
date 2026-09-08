"use strict";

// 🌿 Naura Wilds - Survival UI Helper
//
// Sumber kebenaran tunggal untuk token warna dan helper antarmuka sub-brand
// Naura Wilds (Hybrid Nature-Tech). Referensi desain lengkap ada di DESIGN.md
// bagian "Survival RPG Design System - Naura Wilds".
//
// Aturan pemakaian (AGENTS.md aturan 1.3 no.20):
// - Dilarang hardcode hex warna survival di plugin atau event handler.
// - Bar vital wajib lewat buildVitalsBar() dengan threshold moss/amber/danger.
// - Footer respons survival wajib getFooter() yang mendelegasikan ke
//   ui.getFooter('survival').

const { colors, footers } = require("../config/ui/palette");
const { buildGoalGradientBar } = require("./uxHelper");

/**
 * Palet earth-tone Naura Wilds.
 * Harus selalu sinkron dengan tabel "Palet Earth-Tone Survival" di DESIGN.md.
 */
const survivalColors = {
  emerald: "#86EFAC", // Aksen utama survival, border panel kaca, glow judul
  moss: "#34D399", // Bar vital sehat (>50%), status panen siap
  amber: "#FBBF24", // Peringatan stamina rendah, energi, reward harian
  bark: "#92400E", // Crafting, kayu/material mentah, workshop
  river: "#7DD3FC", // Fishing, deep sea, vivarium, elemen air
  danger: "#F87171", // Dungeon, world boss, duel, coliseum, HP kritis
};

/**
 * Material glassmorphism bertint hijau untuk panel survival.
 * Menggantikan surface-glass pink global di dalam domain survival saja.
 */
const survivalGlass = {
  surface: "rgba(134, 239, 172, 0.06)",
  hairline: "rgba(134, 239, 172, 0.2)",
};

/**
 * Skala rarity item untuk inventory, gacha, shop, crafting, dan drop dungeon.
 * Harus selalu sinkron dengan tabel "Skala Rarity Item" di DESIGN.md.
 */
const rarityColors = {
  common: "#9CA3AF",
  uncommon: "#86EFAC",
  rare: "#93C5FD",
  epic: "#C084FC",
  legendary: "#FFD700",
  mythic: "#F9A8D4",
};

/**
 * Mengambil warna survival berdasarkan nama token, dengan fallback aman ke
 * palet global lalu ke emerald sebagai aksen default Naura Wilds.
 * @param {string} name - Nama token (emerald, moss, amber, bark, river, danger)
 * @returns {string} Hex color
 */
function getColor(name) {
  if (name && Object.prototype.hasOwnProperty.call(survivalColors, name)) {
    return survivalColors[name];
  }
  return (name && colors[name]) || survivalColors.emerald;
}

/**
 * Mengambil warna pill badge rarity item secara case-insensitive.
 * Rarity tidak dikenal jatuh ke Common (abu netral) agar tidak pernah crash.
 * @param {string} rarity - common | uncommon | rare | epic | legendary | mythic
 * @returns {string} Hex color
 */
function getRarityColor(rarity) {
  const key = String(rarity || "")
    .trim()
    .toLowerCase();
  return rarityColors[key] || rarityColors.common;
}

/**
 * Threshold vital otomatis sesuai kontrak desain Naura Wilds:
 * - >50%  : moss (sehat)
 * - 20-50%: amber (waspada)
 * - <20%  : danger (kritis)
 * @param {number} percent - Persentase vital (0-100)
 * @returns {string} Hex color
 */
function getVitalColor(percent) {
  const safePercent = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 0;
  if (safePercent <= 20) {
    return survivalColors.danger;
  }
  if (safePercent <= 50) {
    return survivalColors.amber;
  }
  return survivalColors.moss;
}

/**
 * Membangun bar vital bertema Naura Wilds (HP/Stamina/Hunger/XP).
 * Mendelegasikan rendering bar ke uxHelper.buildGoalGradientBar() agar visual
 * progress konsisten dengan sistem UX psikologi bot, lalu menambahkan warna
 * threshold otomatis (moss/amber/danger).
 * @param {object} options
 * @param {number} [options.current=0] - Nilai vital saat ini
 * @param {number} [options.target=100] - Nilai vital maksimum
 * @param {number} [options.length=10] - Panjang bar karakter
 * @param {object|string} [options.user=null] - User/interaction untuk pesan penyemangat personal
 * @param {string} [options.lang='id'] - Bahasa pesan penyemangat
 * @returns {{ bar: string, customBar: string, percent: number, current: number, target: number, remaining: number, cheerMessage: string, color: string }}
 */
function buildVitalsBar({
  current = 0,
  target = 100,
  length = 10,
  user = null,
  lang = "id",
} = {}) {
  const result = buildGoalGradientBar({
    current,
    target,
    length,
    user,
    lang,
  });
  return {
    ...result,
    color: getVitalColor(result.percent),
  };
}

/**
 * Footer terpusat untuk seluruh respons survival.
 * Selalu delegasikan ke footer 'survival' dari palet global agar teks versi
 * tidak pernah ditulis manual di plugin.
 * @returns {string}
 */
function getFooter() {
  return footers.survival || footers.core || "Naura Hoshino";
}

/**
 * Memformat angka stat (HP, damage, saldo fragment) menjadi string lokal id-ID
 * dengan penjagaan terhadap nilai non-numerik.
 * @param {number|string} value
 * @returns {string}
 */
/**
 * Memformat angka stat (HP, damage, saldo fragment) menjadi string lokal id-ID
 * dengan penjagaan terhadap nilai non-numerik.
 * @param {number|string} value
 * @returns {string}
 */
function formatStat(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }
  return num.toLocaleString("id-ID");
}

/**
 * Membangun satu blok HUD mini vital untuk disisipkan di atas deskripsi respons survival.
 * Format: ❤️ HP [▰▰▰▱▱] 80/100 • ⚡ [▰▰▱▱▱] 50/100 • 🍖 [▰▰▰▱▱] 60/100 • 💧 [▰▰▰▰▱] 85/100
 *
 * @param {object} survival - Objek data UserSurvival
 * @param {object} [options]
 * @param {number} [options.customMaxHp] - Batas maksimal HP
 * @param {number} [options.barLength=5] - Panjang bar mini
 * @returns {string} Teks mini HUD
 */
function buildSurvivalHUD(
  survival,
  { customMaxHp = null, barLength = 5 } = {},
) {
  const maxHp = customMaxHp || 100 + Number(survival?.survival_level || 1) * 20;
  const hp = Math.min(maxHp, Number(survival?.hp ?? maxHp));
  const stamina = Number(survival?.stamina ?? 100);
  const hunger = Number(survival?.hunger ?? 100);
  const thirst = Number(survival?.thirst ?? 100);

  const hpBar = buildVitalsBar({
    current: hp,
    target: maxHp,
    length: barLength,
  }).bar;
  const staBar = buildVitalsBar({
    current: stamina,
    target: 100,
    length: barLength,
  }).bar;
  const hunBar = buildVitalsBar({
    current: hunger,
    target: 100,
    length: barLength,
  }).bar;
  const thiBar = buildVitalsBar({
    current: thirst,
    target: 100,
    length: barLength,
  }).bar;

  return `❤️ HP ${hpBar} \`${hp}/${maxHp}\` \u2022 ⚡ ${staBar} \`${stamina}%\` \u2022 🍖 ${hunBar} \`${hunger}%\` \u2022 💧 ${thiBar} \`${thirst}%\``;
}

/**
 * Membangun satu baris indikator waktu, hari, dan lokasi petualang.
 */
function buildTimeLocationLine(survival) {
  const day = survival?.inGameDay || 1;
  const hour = survival?.inGameHour || 6;
  const loc = String(survival?.currentLocation || "desa").toUpperCase();
  const timeEmoji = hour >= 6 && hour < 18 ? "☀️" : "🌙";

  return `${timeEmoji} **Hari ke-${day}**, pukul ${String(hour).padStart(2, "0")}:00 \u2022 📍 **${loc}**`;
}

module.exports = {
  survivalColors,
  survivalGlass,
  rarityColors,
  getColor,
  getRarityColor,
  getVitalColor,
  buildVitalsBar,
  getFooter,
  formatStat,
  buildSurvivalHUD,
  buildTimeLocationLine,
};
