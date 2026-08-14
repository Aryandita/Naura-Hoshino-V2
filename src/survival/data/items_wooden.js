"use strict";

// Alat kayu tingkat pemula.
// Dipisah dari items_static.js supaya daftar starter kit gampang disesuaikan
// tanpa harus menyentuh katalog utama yang besar.
//
// Ketiga alat kayu (wooden_axe ada di items_static.js) sengaja dibuat paling
// lemah dan paling murah, jadi pemain tetap punya alasan untuk naik ke besi.
const woodenTools = [
  {
    id: "wooden_pickaxe",
    name: "Beliung Kayu (Lv. 1)",
    description:
      "Beliung kayu sederhana. Cukup buat menambang batu di gua dangkal.",
    price: 700,
    sellPrice: 150,
    category: "tools",
    upgrade_level: 1,
    base_efficiency: 8,
    rarity: "Biasa",
  },
  {
    id: "wooden_sword",
    name: "Pedang Kayu (Lv. 1)",
    description:
      "Pedang latihan dari kayu keras. Ringan, tapi lumayan buat melawan Slime.",
    price: 900,
    sellPrice: 200,
    category: "tools",
    upgrade_level: 1,
    base_damage: 8,
    rarity: "Biasa",
  },
];

module.exports = woodenTools;
