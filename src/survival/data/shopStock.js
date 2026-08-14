"use strict";

// Aturan siapa menjual apa. Dipisahkan dari subcommand shop supaya menambah
// dagangan baru tidak perlu menyentuh alur antarmuka toko.

const items = require("./items");
const { DUNGEON_PASS_ID, DUNGEON_SPECIAL_PASS_ID } = require("./items_dungeon");

// Barang dasar yang memang seharusnya dicari sendiri di alam, bukan dibeli.
// Tiket dungeon ikut dikecualikan dari daftar umum karena penjualnya dibedakan
// per kota lewat exclusiveStock() di bawah.
const EXCLUDED_IDS = [
  "wood",
  "stone",
  "fiber",
  "worm_bait",
  "trash",
  "survival_started",
  "prop_gudang",
  "veh_bicycle",
  DUNGEON_PASS_ID,
  DUNGEON_SPECIAL_PASS_ID,
];

const PROPERTIES = [
  {
    id: "prop_kos",
    name: "Kamar Kos (Properti)",
    price: 50000,
    category: "special",
  },
  {
    id: "prop_rumah",
    name: "Rumah (Properti)",
    price: 200000,
    category: "special",
  },
  {
    id: "prop_mansion",
    name: "Mansion (Properti)",
    price: 750000,
    category: "special",
  },
  {
    id: "veh_motor",
    name: "Sepeda Motor (Kendaraan)",
    price: 80000,
    category: "special",
  },
];

// Kategori tambahan yang hanya muncul di toko tertentu. Digabung dengan
// shop.categories saat menu kategori dibangun.
const EXTRA_CATEGORIES = {
  desa: { pass: "Tiket Masuk Dungeon" },
  kota: { pass: "Tiket Dungeon Spesial" },
};

function isExcluded(id) {
  return EXCLUDED_IDS.includes(id);
}

function extraCategories(shopKey) {
  return EXTRA_CATEGORIES[shopKey] || {};
}

function findItem(id) {
  return items.find((entry) => entry && entry.id === id) || null;
}

// Dagangan khusus per toko. Pak Damar di desa hanya memegang tiket biasa,
// sedangkan tiket spesial disimpan Mbak Rini di kota dan otomatis dibayar
// dengan Naura Coin karena mata uang butiknya memang Coin.
function exclusiveStock(shopKey, category) {
  if (category === "special" && shopKey === "kota") return [...PROPERTIES];

  if (category === "pass") {
    const item = findItem(
      shopKey === "kota" ? DUNGEON_SPECIAL_PASS_ID : DUNGEON_PASS_ID,
    );
    return item ? [item] : [];
  }

  return [];
}

function propertyById(id) {
  return PROPERTIES.find((entry) => entry.id === id) || null;
}

module.exports = {
  EXCLUDED_IDS,
  PROPERTIES,
  EXTRA_CATEGORIES,
  isExcluded,
  extraCategories,
  exclusiveStock,
  propertyById,
  findItem,
};
