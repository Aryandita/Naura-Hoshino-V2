"use strict";

/**
 * craftBlueprints.js - Cetak Biru Perakitan Awal Naura Wilds
 *
 * Seluruh bahan dan hasil perakitan diselaraskan 100% dengan ID katalog 5-tier resmi.
 * Bebas dari em-dash dan mematuhi aturan antislop.
 */

const BLUEPRINTS = {
  wooden_axe: {
    id: "wooden_axe",
    name: "Kapak Penebang Kayu",
    desc: "Perkakas dasar untuk menebang pohon hutan. Dirakit dari kayu ek dan ikatan bulu binatang liar.",
    req: [
      { id: "oak_wood", amount: 3 },
      { id: "beast_fur", amount: 1 },
    ],
    emojiKey: "axe",
    emojiFallback: "🪓",
  },
  wooden_pickaxe: {
    id: "wooden_pickaxe",
    name: "Beliung Kayu Sederhana",
    desc: "Alat gali untuk memecah bongkahan batu dan mencari bijih tembaga pertama di lereng gua.",
    req: [
      { id: "oak_wood", amount: 3 },
      { id: "stone_pebble", amount: 2 },
    ],
    emojiKey: "pickaxe",
    emojiFallback: "⛏️",
  },
  wooden_sword: {
    id: "wooden_sword",
    name: "Pedang Kayu Latih",
    desc: "Pedang latihan dari kayu ek padat untuk memukul mundur hama kebun dan monster liar.",
    req: [
      { id: "oak_wood", amount: 2 },
      { id: "beast_fur", amount: 2 },
    ],
    emojiKey: "sword",
    emojiFallback: "🗡️",
  },
  bamboo_fishing_rod: {
    id: "bamboo_fishing_rod",
    name: "Pancing Bambu Pinggiran",
    desc: "Joran pancing rakitan dari batang bambu lentur untuk menangkap ikan air tawar di sungai desa.",
    req: [
      { id: "oak_wood", amount: 2 },
      { id: "beast_fur", amount: 2 },
    ],
    emojiKey: "fishing_rod",
    emojiFallback: "🎣",
  },
  roasted_meat: {
    id: "roasted_meat",
    name: "Daging Panggang Asap",
    desc: "Daging binatang liar yang dibakar di atas perapian kayu untuk bekal mengganjal perut lapar.",
    req: [
      { id: "beast_fur", amount: 1 },
      { id: "oak_wood", amount: 1 },
    ],
    amount: 1,
    emojiKey: "food",
    emojiFallback: "🥩",
  },
  herbal_salve: {
    id: "herbal_salve",
    name: "Salep Herbal Daun Sirih",
    desc: "Pasta obat oles dari daun herbal hutan untuk membalut luka dan memulihkan stamina.",
    req: [
      { id: "wild_herbs", amount: 3 },
      { id: "purified_water", amount: 1 },
    ],
    amount: 1,
    emojiKey: "potion",
    emojiFallback: "🌿",
  },
};

// Resep yang dapat diakses pemain sejak awal petualangan
const DEFAULT_UNLOCKED = [
  "wooden_axe",
  "wooden_pickaxe",
  "wooden_sword",
  "bamboo_fishing_rod",
  "roasted_meat",
  "herbal_salve",
];

function listAvailable(unlocked = []) {
  return Object.values(BLUEPRINTS).filter(
    (bp) => DEFAULT_UNLOCKED.includes(bp.id) || unlocked.includes(bp.id),
  );
}

function getBlueprint(id) {
  return BLUEPRINTS[id] || null;
}

module.exports = {
  BLUEPRINTS,
  DEFAULT_UNLOCKED,
  listAvailable,
  getBlueprint,
};
