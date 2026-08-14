"use strict";

// Cetak biru rakitan dasar. Semua bahannya sengaja dipilih dari barang yang
// benar-benar ada di katalog, karena versi lama meminta `slime_gel` dan
// `mystic_herb` yang tidak pernah ada sehingga beberapa resep mustahil dirakit.
//
// Barang tingkat lanjut TIDAK dirakit dari nol: alurnya lewat Tungku Bagas
// (peleburan) lalu jalur naik level alat di craftingRecipes.js.

const BLUEPRINTS = {
  wooden_axe: {
    id: "wooden_axe",
    name: "Kapak Kayu",
    desc: "Alat pertama buat menebang pohon. Sederhana, tapi Naura bangga kamu bikin sendiri!",
    req: [
      { id: "wood", amount: 3 },
      { id: "fiber", amount: 1 },
    ],
    emojiKey: "axe",
    emojiFallback: "\ud83e\ude93",
  },
  wooden_pickaxe: {
    id: "wooden_pickaxe",
    name: "Beliung Kayu",
    desc: "Buat mengetuk-ngetuk dinding tambang. Hati-hati tangannya, ya.",
    req: [
      { id: "wood", amount: 3 },
      { id: "stone", amount: 2 },
    ],
    emojiKey: "pickaxe",
    emojiFallback: "\u26cf\ufe0f",
  },
  wooden_sword: {
    id: "wooden_sword",
    name: "Pedang Kayu",
    desc: "Belum seram, tapi cukup buat menghalau monster kecil. Naura doakan selamat!",
    req: [
      { id: "wood", amount: 2 },
      { id: "fiber", amount: 2 },
    ],
    emojiKey: "sword",
    emojiFallback: "\ud83d\udde1\ufe0f",
  },
  bamboo_rod: {
    id: "bamboo_rod",
    name: "Pancing Bambu",
    desc: "Pancing rakitan sendiri. Sabar sedikit, nanti dapat ikan besar.",
    req: [
      { id: "wood", amount: 2 },
      { id: "fiber", amount: 3 },
    ],
    emojiKey: "fishing_rod",
    emojiFallback: "\ud83c\udfa3",
  },
  worm_bait: {
    id: "worm_bait",
    name: "Umpan Cacing",
    desc: "Naura ikut menggali, lho. Umpan segar bikin ikan cepat menyambar.",
    req: [
      { id: "fiber", amount: 2 },
      { id: "trash", amount: 1 },
    ],
    amount: 3,
    emojiKey: "worm",
    emojiFallback: "\ud83e\udab1",
  },
  heist_mask: {
    id: "heist_mask",
    name: "Topeng Perampok",
    desc: "Naura pura-pura tidak lihat kamu bikin ini. Jangan nakal-nakal, ya?",
    req: [
      { id: "trash", amount: 5 },
      { id: "fiber", amount: 2 },
    ],
    emojiKey: "mask",
    emojiFallback: "\ud83c\udfad",
  },
  c4_bomb: {
    id: "c4_bomb",
    name: "Bom Rakitan (C4)",
    desc: "Peledak untuk membobol brankas. Naura ngeri, tapi tetap bantu siapkan.",
    req: [
      { id: "iron_ingot", amount: 2 },
      { id: "charcoal", amount: 3 },
      { id: "fiber", amount: 2 },
    ],
    emojiKey: "bomb",
    emojiFallback: "\ud83d\udca3",
  },
};

// Resep yang bisa dipakai siapa pun sejak awal permainan.
const DEFAULT_UNLOCKED = [
  "wooden_axe",
  "wooden_pickaxe",
  "wooden_sword",
  "bamboo_rod",
  "worm_bait",
  "heist_mask",
];

// Resep di luar daftar bawaan hanya muncul kalau ID-nya tercatat pada
// `rpg_state.unlocked_recipes`, misalnya hadiah misi atau pemberian NPC.
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
