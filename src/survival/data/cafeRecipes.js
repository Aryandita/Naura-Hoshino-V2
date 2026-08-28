"use strict";

const CAFE_RECIPES = [
  {
    id: "sakura_latte",
    name: "Sakura Blossom Latte",
    emoji: "🌸",
    category: "DRINK",
    price: 250,
    requiredLevel: 1,
    description:
      "Kopi susu lembut dengan aroma kelopak sakura segar dari hutan Neo-Hoshino.",
    ingredients: [
      { id: "herb", name: "Tanaman Herbal", amount: 2 },
      { id: "water", name: "Air Bersih", amount: 1 },
    ],
    buff: {
      type: "DUNGEON_PASS_DROP",
      value: 10,
      durationHours: 2,
      description: "+10% Drop Rate Tiket Dungeon",
    },
  },
  {
    id: "cyber_ramen",
    name: "Cyber Neon Ramen",
    emoji: "🍜",
    category: "FOOD",
    price: 450,
    requiredLevel: 1,
    description:
      "Ramen kuah kaldu kental gurih dengan irisan ikan segar dan telur setengah matang.",
    ingredients: [
      { id: "wheat", name: "Gandum", amount: 3 },
      { id: "fish", name: "Ikan Segar", amount: 2 },
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
    description:
      "Boba kenyal berkilau neon dengan sirup blueberry dingin penyegar dahaga.",
    ingredients: [
      { id: "berry", name: "Buah Berry", amount: 2 },
      { id: "sugar", name: "Gula Alami", amount: 1 },
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
    description:
      "Kotak bekal porsi besar berenergi tinggi untuk petarung garis depan.",
    ingredients: [
      { id: "wheat", name: "Gandum", amount: 2 },
      { id: "meat", name: "Daging Olahan", amount: 2 },
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
    description:
      "Es krim manis berlapis jeli bintang yang sangat digemari pet dan maskot.",
    ingredients: [
      { id: "berry", name: "Buah Berry", amount: 2 },
      { id: "sugar", name: "Gula Alami", amount: 2 },
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
    description:
      "Espresso pekat super kental yang memulihkan stamina secara instan.",
    ingredients: [
      { id: "herb", name: "Tanaman Herbal", amount: 3 },
      { id: "dark_crystal", name: "Kristal Gelap", amount: 1 },
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
