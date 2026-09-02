"use strict";

const CROP_SEEDS = [
  {
    id: "astral_strawberry",
    name: "Astral Strawberry",
    emoji: "🍓",
    seedPrice: 50,
    growTimeMinutes: 60, // 1 jam
    harvestYield: {
      itemId: "berry",
      itemName: "Astral Strawberry",
      amountMin: 2,
      amountMax: 5,
      xp: 25,
      cafeYieldBonus: 10,
    },
    description: "Stroberi bercahaya kosmik dengan rasa manis menyegarkan.",
  },
  {
    id: "cyber_mint",
    name: "Cyber Mint",
    emoji: "🌿",
    seedPrice: 80,
    growTimeMinutes: 120, // 2 jam
    harvestYield: {
      itemId: "herb",
      itemName: "Cyber Mint Leaf",
      amountMin: 3,
      amountMax: 6,
      xp: 45,
      cafeYieldBonus: 15,
    },
    description: "Daun mint elektrik beraroma sejuk untuk bahan baku kafe.",
  },
  {
    id: "void_coffee",
    name: "Void Coffee Bean",
    emoji: "☕",
    seedPrice: 150,
    growTimeMinutes: 240, // 4 jam
    harvestYield: {
      itemId: "void_coffee_bean",
      itemName: "Void Coffee Bean",
      amountMin: 2,
      amountMax: 4,
      xp: 80,
      cafeYieldBonus: 30,
    },
    description: "Biji kopi langka dari dimensi void penghasil energi tinggi.",
  },
  {
    id: "neon_melon",
    name: "Neon Melon",
    emoji: "🍈",
    seedPrice: 220,
    growTimeMinutes: 360, // 6 jam
    harvestYield: {
      itemId: "neon_melon_slice",
      itemName: "Neon Melon Slice",
      amountMin: 3,
      amountMax: 7,
      xp: 120,
      cafeYieldBonus: 45,
    },
    description: "Melon bertekstur kristal manis dengan kadar air elektrolit.",
  },
  {
    id: "sakura_grain",
    name: "Sakura Grain",
    emoji: "🌾",
    seedPrice: 350,
    growTimeMinutes: 720, // 12 jam
    harvestYield: {
      itemId: "wheat",
      itemName: "Sakura Golden Grain",
      amountMin: 5,
      amountMax: 10,
      xp: 250,
      cafeYieldBonus: 80,
    },
    description: "Bulir gandum sakura legendaris dengan nilai nutrisi maksimal.",
  },
];

module.exports = {
  CROP_SEEDS,
  getSeedById: (id) => CROP_SEEDS.find((s) => s.id === id),
};
