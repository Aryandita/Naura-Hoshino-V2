"use strict";

const itemsHelper = require("./items");

const BANNERS = {
  standard: {
    id: "standard",
    name: "Silver Supply Drop",
    description: "Peti perbekalan standar. Memerlukan Naura Coin.",
    currency: "coin",
    cost: 3000,
    pityMax: 50, // Pity di 50 roll = Guarantee Legendary
    rates: [
      { rarity: "Biasa", chance: 60 },
      { rarity: "Langka", chance: 30 },
      { rarity: "Epic", chance: 9.5 },
      { rarity: "Legendary", chance: 0.5 },
    ],
  },
  gold: {
    id: "gold",
    name: "Gold Mystic Crate",
    description:
      "Peti perlengkapan berkelas. Memerlukan Naura Star Fragments (NFS).",
    currency: "starFragments",
    cost: 150,
    pityMax: 40, // Pity di 40 roll = Guarantee Legendary (Higher Rate)
    rates: [
      { rarity: "Biasa", chance: 20 },
      { rarity: "Langka", chance: 45 },
      { rarity: "Epic", chance: 30 },
      { rarity: "Legendary", chance: 5 },
    ],
  },
  premium: {
    id: "premium",
    name: "Diamond Mythic Crate",
    description: "Peti harta magis misterius. Memerlukan Naura Coupon.",
    currency: "coupon",
    cost: 5,
    pityMax: 30, // Pity di 30 roll = Guarantee Mythic
    rates: [
      { rarity: "Epic", chance: 60 },
      { rarity: "Legendary", chance: 35 },
      { rarity: "Mythic", chance: 5 },
    ],
  },
};

// Ambil item pool berdasarkan banner dan kelangkaan
async function getBannerPool(bannerId) {
  const allItems = itemsHelper; // it's an array directly
  const banner = BANNERS[bannerId];
  if (!banner) return null;

  const pool = {};
  for (const rate of banner.rates) {
    pool[rate.rarity] = allItems.filter((item) => item.rarity === rate.rarity);
  }
  return { banner, pool };
}

module.exports = {
  BANNERS,
  getBannerPool,
};
