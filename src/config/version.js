"use strict";

/**
 * @file: src/config/version.js
 * @description: Single Source of Truth (SSOT) untuk versi ekosistem, codename, dan footer resmi Naura Hoshino.
 * @copyright (c) 2026 Aryandita Praftian
 */

const BOT_VERSION = "2.3.0";
const ENGINE_VERSION = "2.3.0";
const CODENAME = "Celestial Bloom";
const AUTHOR = "Aryandita";

/**
 * Daftar template footer resmi Naura Hoshino V2 per kategori.
 * Didesain bersih, informatif, dan terhindar dari pola teks AI generik (anti-slop).
 */
const FOOTERS = {
  core: `Naura Hoshino Core v${BOT_VERSION} • Dibuat oleh ${AUTHOR} ✨`,
  naura: `Naura Hoshino Companion 🌸 • v${BOT_VERSION}`,
  utility: `Naura Utility Suite v${BOT_VERSION} • Dibuat oleh ${AUTHOR} ✨`,
  survival: `Naura RPG Survival Edition v${BOT_VERSION} • Dibuat oleh ${AUTHOR} ✨`,
  music: `Naura High-Fidelity Audio System v${BOT_VERSION} • Dibuat oleh ${AUTHOR} ✨`,
  ai: `Naura Living AI Intelligence 🌸 • v${BOT_VERSION}`,
  partner: `Naura Community Partnership Program v${BOT_VERSION} • Bertumbuh Bersama Komunitas 🤝`,
  admin: `Naura Administration & Moderation v${BOT_VERSION} • Keamanan Server Terjaga 🛡️`,

  // --- Tingkatan Premium / V.I.P ---
  premium: `Naura V.I.P Project v${BOT_VERSION} • Terima kasih telah mendukung Naura! 💎`,
  premium_supporter: `Naura Supporter Tier v${BOT_VERSION} • Bersama kita bertumbuh ✨`,
  premium_friends: `Naura Friends Tier v${BOT_VERSION} • Terima kasih sahabat setia 💫`,
  premium_vip: `Naura V.I.P Tier v${BOT_VERSION} • Kamu adalah pendukung terpilih 👑`,
};

/**
 * Mengambil nomor versi bot saat ini.
 * @returns {string}
 */
function getAppVersion() {
  return BOT_VERSION;
}

/**
 * Mengambil nomor versi engine saat ini.
 * @returns {string}
 */
function getEngineVersion() {
  return ENGINE_VERSION;
}

/**
 * Mengambil nama sandi (codename) rilis saat ini.
 * @returns {string}
 */
function getCodename() {
  return CODENAME;
}

/**
 * Mengambil string footer resmi berdasarkan kategori.
 * @param {string} [category="core"] - Kategori modul (core, survival, music, ai, dsb.)
 * @returns {string}
 */
function getFormattedFooter(category = "core") {
  return FOOTERS[category] || FOOTERS.core;
}

module.exports = {
  BOT_VERSION,
  ENGINE_VERSION,
  CODENAME,
  AUTHOR,
  FOOTERS,
  getAppVersion,
  getEngineVersion,
  getCodename,
  getFormattedFooter,
};
