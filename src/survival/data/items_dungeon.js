"use strict";

// Tiket masuk Infinite Dungeon. Keduanya sekali pakai supaya toko tetap punya
// alasan untuk dikunjungi, dan supaya lubang lama tertutup: dulu satu tiket
// dipegang selamanya karena tidak pernah dipotong saat masuk.
//
// Tiket biasa dijual Pak Damar di desa dengan Naura Star Fragment, sedangkan
// tiket spesial hanya ada di butik Mbak Rini di kota dan wajib dibayar dengan
// Naura Coin. Lihat shopStock.js untuk aturan siapa menjual apa.

const DUNGEON_PASS_ID = "dungeon_pass";
const DUNGEON_SPECIAL_PASS_ID = "dungeon_special_pass";

// Pengali mode spesial: musuh dua kali lebih tebal, jarahan dan hadiahnya juga
// dua kali lipat.
const SPECIAL_MULTIPLIER = 2;

const DUNGEON_ITEMS = [
  {
    id: DUNGEON_PASS_ID,
    name: "Dungeon Pass",
    description:
      "Tiket sekali pakai untuk membuka pintu batu Infinite Dungeon di gua tambang. Naura titip pesan: jangan lupa bawa obat, ya!",
    price: 1500,
    sellPrice: 300,
    category: "pass",
    rarity: "Biasa",
  },
  {
    id: DUNGEON_SPECIAL_PASS_ID,
    name: "Dungeon Special Pass",
    description:
      "Tiket segel merah dari kota. Musuh di dalam jadi dua kali lebih tangguh, tapi jarahan dan hadiahnya juga dua kali lipat. Naura khawatir, tapi percaya kamu kuat!",
    price: 400,
    sellPrice: 0,
    category: "pass",
    rarity: "Langka",
  },
];

function isDungeonPass(id) {
  return id === DUNGEON_PASS_ID || id === DUNGEON_SPECIAL_PASS_ID;
}

module.exports = {
  DUNGEON_PASS_ID,
  DUNGEON_SPECIAL_PASS_ID,
  SPECIAL_MULTIPLIER,
  DUNGEON_ITEMS,
  isDungeonPass,
};
