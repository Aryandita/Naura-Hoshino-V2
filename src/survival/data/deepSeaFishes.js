"use strict";

const DEEP_SEA_FISHES = [
  // 1. CORAL REEF (0 - 200m)
  {
    id: "neon_guppy",
    name: "Neon Plasma Guppy",
    zone: "CORAL_REEF",
    rarity: "COMMON",
    emoji: "🐟",
    price: 40,
    ticketYield: 5,
  },
  {
    id: "prism_clownfish",
    name: "Prism Clownfish",
    zone: "CORAL_REEF",
    rarity: "COMMON",
    emoji: "🐠",
    price: 60,
    ticketYield: 8,
  },
  {
    id: "lumina_squid",
    name: "Lumina Coral Squid",
    zone: "CORAL_REEF",
    rarity: "RARE",
    emoji: "🦑",
    price: 120,
    ticketYield: 15,
  },
  {
    id: "crystal_seahorse",
    name: "Crystal Seahorse",
    zone: "CORAL_REEF",
    rarity: "EPIC",
    emoji: "🪸",
    price: 250,
    ticketYield: 30,
  },

  // 2. MIDNIGHT TRENCH (200 - 1000m)
  {
    id: "shadow_barracuda",
    name: "Shadow Barracuda",
    zone: "MIDNIGHT_TRENCH",
    rarity: "COMMON",
    emoji: "🐟",
    price: 150,
    ticketYield: 20,
  },
  {
    id: "cyber_anglerfish",
    name: "Cyberpunk Anglerfish",
    zone: "MIDNIGHT_TRENCH",
    rarity: "RARE",
    emoji: "🐡",
    price: 300,
    ticketYield: 40,
  },
  {
    id: "phantom_eel",
    name: "Electric Phantom Eel",
    zone: "MIDNIGHT_TRENCH",
    rarity: "EPIC",
    emoji: "⚡",
    price: 550,
    ticketYield: 75,
  },
  {
    id: "void_manta",
    name: "Void Stalker Manta",
    zone: "MIDNIGHT_TRENCH",
    rarity: "MYTHIC",
    emoji: "🛸",
    price: 1200,
    ticketYield: 150,
  },

  // 3. ABYSSAL CORE (1000m+)
  {
    id: "obsidian_shark",
    name: "Obsidian Core Shark",
    zone: "ABYSSAL_CORE",
    rarity: "RARE",
    emoji: "🦈",
    price: 600,
    ticketYield: 80,
  },
  {
    id: "astral_jellyfish",
    name: "Astral Nebula Jellyfish",
    zone: "ABYSSAL_CORE",
    rarity: "EPIC",
    emoji: "🪼",
    price: 950,
    ticketYield: 120,
  },
  {
    id: "glitch_kraken",
    name: "Glitch Sovereign Kraken",
    zone: "ABYSSAL_CORE",
    rarity: "MYTHIC",
    emoji: "🐙",
    price: 2500,
    ticketYield: 300,
  },
  {
    id: "cosmic_leviathan",
    name: "Primordial Cyber Leviathan",
    zone: "ABYSSAL_CORE",
    rarity: "MYTHIC",
    emoji: "🐉",
    price: 5000,
    ticketYield: 600,
  },
];

function getFishesByZone(zone) {
  return DEEP_SEA_FISHES.filter((f) => f.zone === zone);
}

function getFishById(id) {
  return DEEP_SEA_FISHES.find((f) => f.id === id) || null;
}

module.exports = {
  DEEP_SEA_FISHES,
  getFishesByZone,
  getFishById,
};
