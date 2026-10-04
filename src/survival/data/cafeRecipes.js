"use strict";

/**
 * cafeRecipes.js - Resep Masakan & Minuman Kafe Naura
 *
 * Bahan-bahan resep diselaraskan 100% dengan item katalog 5-tier resmi.
 * Bebas dari em-dash dan mematuhi aturan antislop.
 */

const CAFE_RECIPES = [
  {
    id: "sakura_latte",
    name: "Sakura Blossom Latte",
    emoji: "🌸",
    category: "DRINK",
    price: 250,
    requiredLevel: 1,
    description: "Kopi susu lembut dengan aroma kelopak sakura segar dari hutan rimba Naura.",
    ingredients: [
      { id: "wild_herbs", name: "Rerumputan Herbal Hijau", amount: 2 },
      { id: "purified_water", name: "Air Bersih Pegunungan", amount: 1 },
    ],
    buff: {
      type: "DUNGEON_PASS_DROP",
      value: 10,
      durationHours: 2,
      description: "+10% Drop Rate Kunci Dungeon",
    },
  },
  {
    id: "cyber_ramen",
    name: "Cyber Neon Ramen",
    emoji: "🍜",
    category: "FOOD",
    price: 450,
    requiredLevel: 1,
    description: "Ramen kuah kaldu kental gurih dengan irisan ikan segar dan telur setengah matang.",
    ingredients: [
      { id: "wild_herbs", name: "Rerumputan Herbal Hijau", amount: 2 },
      { id: "freshwater_carp", name: "Ikan Mas Sungai", amount: 1 },
      { id: "purified_water", name: "Air Bersih Pegunungan", amount: 1 },
    ],
    buff: {
      type: "PROFESSION_XP",
      value: 15,
      durationHours: 3,
      description: "+15% Bonus XP Berkebun, Menambang & Memancing",
    },
  },
  {
    id: "neon_boba",
    name: "Electric Blue Boba",
    emoji: "🧋",
    category: "DRINK",
    price: 300,
    requiredLevel: 2,
    description: "Boba kenyal berkilau neon dengan sirup buah beri dingin penyegar dahaga.",
    ingredients: [
      { id: "wild_berry", name: "Beri Liar Manis", amount: 2 },
      { id: "honeycomb_snack", name: "Camilan Sarang Lebah Madu", amount: 1 },
    ],
    buff: {
      type: "FRAGMENT_YIELD",
      value: 10,
      durationHours: 2,
      description: "+10% Bonus Perolehan Star Fragments",
    },
  },
  {
    id: "glitch_bento",
    name: "Glitch Samurai Bento",
    emoji: "🍱",
    category: "FOOD",
    price: 550,
    requiredLevel: 3,
    description: "Kotak bekal porsi besar berenergi tinggi untuk petarung garis depan.",
    ingredients: [
      { id: "roasted_meat", name: "Daging Panggang Asap", amount: 2 },
      { id: "smoked_fish", name: "Ikan Asap Danau", amount: 1 },
    ],
    buff: {
      type: "RAID_DAMAGE",
      value: 25,
      durationHours: 4,
      description: "+25 Serangan Fisik di Pertarungan World Boss",
    },
  },
  {
    id: "star_parfait",
    name: "Astral Star Parfait",
    emoji: "🍨",
    category: "DESSERT",
    price: 400,
    requiredLevel: 4,
    description: "Es krim manis berlapis jeli bintang yang sangat digemari maskot.",
    ingredients: [
      { id: "wild_berry", name: "Beri Liar Manis", amount: 3 },
      { id: "honeycomb_snack", name: "Camilan Sarang Lebah Madu", amount: 2 },
    ],
    buff: {
      type: "PET_EXP",
      value: 20,
      durationHours: 2,
      description: "+20% Pertumbuhan XP Pet saat Ekspedisi",
    },
  },
  {
    id: "void_espresso",
    name: "Void Core Espresso",
    emoji: "☕",
    category: "DRINK",
    price: 600,
    requiredLevel: 5,
    description: "Espresso pekat super kental bertenaga kristal hampa yang memulihkan stamina secara instan.",
    ingredients: [
      { id: "wild_herbs", name: "Rerumputan Herbal Hijau", amount: 3 },
      { id: "quartz_crystal", name: "Batu Kristal Kuarsa", amount: 1 },
    ],
    buff: {
      type: "ENERGY_RESTORE",
      value: 50,
      durationHours: 1,
      description: "Pemulihan Stamina Instan +50 Poin",
    },
  },
];

module.exports = {
  CAFE_RECIPES,
  getRecipeById: (id) => CAFE_RECIPES.find((r) => r.id === id),
};
