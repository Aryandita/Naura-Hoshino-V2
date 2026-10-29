// Lokasi: scripts/emojis/svgGenerator.js
// Generator Terpadu 90 Custom Emoji SVG Naura Hoshino V2
"use strict";

const { STATUS_GENERATORS } = require("./generators/status");
const { ACTION_GENERATORS } = require("./generators/action");
const { RPG_GENERATORS } = require("./generators/rpg");
const { SYSTEM_GENERATORS } = require("./generators/system");
const { SOCIAL_GENERATORS } = require("./generators/social");
const { SPECIAL_GENERATORS } = require("./generators/special");

const ALL_GENERATORS = {
  ...STATUS_GENERATORS,
  ...ACTION_GENERATORS,
  ...RPG_GENERATORS,
  ...SYSTEM_GENERATORS,
  ...SOCIAL_GENERATORS,
  ...SPECIAL_GENERATORS,
};

/**
 * Menghasilkan string XML SVG lengkap untuk emoji tertentu pada frame tertentu
 * @param {string} name - Nama emoji (misal "naura_happy", "naura_sword")
 * @param {object} options
 * @param {number} [options.frame=0] - Indeks frame (0..totalFrames-1)
 * @param {number} [options.totalFrames=12] - Total frame dalam siklus loop
 * @returns {string} String SVG yang valid
 */
function getEmojiSvg(name, { frame = 0, totalFrames = 12 } = {}) {
  const generator = ALL_GENERATORS[name];
  if (!generator) {
    throw new Error(`Generator tidak ditemukan untuk emoji: ${name}`);
  }

  const t = totalFrames > 0 ? (frame % totalFrames) / totalFrames : 0;
  return generator(t);
}

/**
 * Mengembalikan daftar seluruh nama emoji yang didukung (harus 90)
 */
function getAllGeneratorNames() {
  return Object.keys(ALL_GENERATORS);
}

module.exports = {
  getEmojiSvg,
  getAllGeneratorNames,
  ALL_GENERATORS,
};
