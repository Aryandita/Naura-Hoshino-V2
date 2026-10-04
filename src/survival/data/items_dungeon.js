"use strict";

/**
 * items_dungeon.js - Akses Kunci & Pass Infinite Dungeon
 *
 * Menyelaraskan ID tiket dungeon dengan ID resmi di items_catalog.js:
 * bronze_dungeon_key (tiket biasa desa) dan golden_dungeon_key (tiket spesial kota).
 */

const { getItemFromCatalog } = require("./items_catalog");

const DUNGEON_PASS_ID = "bronze_dungeon_key";
const DUNGEON_SPECIAL_PASS_ID = "golden_dungeon_key";

const SPECIAL_MULTIPLIER = 2;

const DUNGEON_ITEMS = [
  getItemFromCatalog(DUNGEON_PASS_ID) || {
    id: DUNGEON_PASS_ID,
    name: "Kunci Perunggu Labirin Bawah Tanah",
    description: "Kunci kuno bergigi rumit untuk membuka jeruji gerbang lantai bawah tanah tingkat satu dan dua.",
    price: 2500,
    sellPrice: 1250,
    category: "special",
    rarity: "Uncommon",
  },
  getItemFromCatalog(DUNGEON_SPECIAL_PASS_ID) || {
    id: DUNGEON_SPECIAL_PASS_ID,
    name: "Kunci Emas Gerbang Bos Dungeon",
    description: "Kunci emas padat bertatahkan batu delima merah darah. Membuka gerbang utama sarang bos penunggu dungeon laut dalam.",
    price: 32000,
    sellPrice: 16000,
    category: "special",
    rarity: "Epic",
  },
];

function isDungeonPass(id) {
  return (
    id === DUNGEON_PASS_ID ||
    id === DUNGEON_SPECIAL_PASS_ID ||
    id === "dungeon_pass" ||
    id === "dungeon_special_pass"
  );
}

module.exports = {
  DUNGEON_PASS_ID,
  DUNGEON_SPECIAL_PASS_ID,
  SPECIAL_MULTIPLIER,
  DUNGEON_ITEMS,
  isDungeonPass,
};
