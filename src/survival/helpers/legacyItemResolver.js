"use strict";

/**
 * legacyItemResolver.js - Smart Remap & Migrasi Inventaris Lama Naura Wilds
 *
 * Memetakan ID item lama (dari katalog lawas atau warisan) ke ID baru katalog 5-tier.
 * Item usang yang pensiun dikonversi menjadi kompensasi koin Naura Star Fragments (NSF).
 */

const { CATALOG_BY_ID } = require("../data/items_catalog");

// Peta penerjemahan ID lama ke ID baru resmi
const LEGACY_ID_MAP = Object.freeze({
  // Senjata
  wood_sword: "wooden_sword",
  starter_sword: "wooden_sword",
  iron_sword: "iron_broadsword",
  bronze_sword: "iron_broadsword",
  steel_sword: "plasma_katana",
  diamond_sword: "aether_blade",
  mythic_sword: "excalibur_prime",
  slingshot_basic: "slingshot",
  dagger: "scrap_dagger",
  bow_wood: "hunting_bow",
  bow_steel: "composite_recurve",
  spear_basic: "bronze_spear",
  club_wood: "reinforced_club",

  // Armor & Pelindung
  leather_armor: "leather_tunic",
  leather_vest: "leather_tunic",
  iron_armor: "iron_chestplate",
  steel_armor: "carbon_exosuit",
  diamond_armor: "nano_weave_vest",
  mythic_armor: "aegis_of_immortality",
  helmet_leather: "cloth_hood",
  helmet_iron: "steel_helmet",
  shield_wood: "wooden_buckler",
  shield_iron: "reinforced_shield",
  boots_cloth: "fiber_boots",
  boots_iron: "scout_treads",

  // Peralatan (Tools)
  wood_pickaxe: "wooden_pickaxe",
  pickaxe_wood: "wooden_pickaxe",
  pickaxe_iron: "iron_pickaxe",
  pickaxe_steel: "steel_drill_pick",
  steel_pickaxe: "steel_drill_pick",
  wood_axe: "wooden_axe",
  axe_wood: "wooden_axe",
  axe_iron: "iron_hatchet",
  axe_steel: "alloy_chainsaw",
  basic_shovel: "stone_hoe",
  hoe_wood: "stone_hoe",
  fishing_rod: "bamboo_fishing_rod",
  basic_rod: "bamboo_fishing_rod",
  watering_can: "iron_watering_can",

  // Bahan Baku (Materials)
  wood: "oak_wood",
  raw_wood: "oak_wood",
  pine_wood: "pine_timber",
  coal: "coal_lump",
  stone: "stone_pebble",
  rocks: "stone_pebble",
  copper: "copper_ore",
  iron: "iron_ore",
  gold_ore: "celestial_ingot",
  gold_ingot: "celestial_ingot",
  diamond: "quartz_crystal",
  crystal: "quartz_crystal",
  herb: "wild_herbs",
  herbs: "wild_herbs",
  wild_herb: "wild_herbs",
  leather: "beast_fur",
  fur: "beast_fur",
  chitin: "chitin_shell",
  charcoal: "coal_lump",
  iron_ingot: "steel_ingot",
  refined_iron: "steel_ingot",
  refined_copper: "copper_ingot",
  titanium: "titanium_alloy",
  fiber: "carbon_fiber_sheet",
  aether_crystal: "refined_aetherium",

  // Makanan & Minuman (Consumables)
  berry: "wild_berry",
  berries: "wild_berry",
  wild_berries: "wild_berry",
  meat: "roasted_meat",
  raw_meat: "roasted_meat",
  cooked_meat: "roasted_meat",
  water: "purified_water",
  water_bottle: "purified_water",
  mineral_water: "purified_water",
  health_potion: "herbal_salve",
  small_potion: "herbal_salve",
  potion: "herbal_salve",
  medium_potion: "nano_healing_stim",
  large_potion: "golden_elixir",
  mushroom: "dried_mushroom",
  mushrooms: "dried_mushroom",
  apple: "wild_berry",
  bread: "hearty_stew",
  stew: "hearty_stew",
  fish_cooked: "smoked_fish",
  honey: "honeycomb_snack",
  energy_drink_basic: "energy_drink",
  ramen: "spicy_ramen_bowl",

  // Khusus & Kupon (Special)
  dungeon_key_1: "bronze_dungeon_key",
  dungeon_key_2: "silver_dungeon_key",
  dungeon_key_3: "golden_dungeon_key",
  bronze_key: "bronze_dungeon_key",
  silver_key: "silver_dungeon_key",
  gold_key: "golden_dungeon_key",
  gacha_ticket: "standard_gacha_coupon",
  gacha_coupon: "standard_gacha_coupon",
  coupon: "standard_gacha_coupon",
  premium_ticket: "premium_gacha_coupon",
  lucky_charm: "lucky_wooden_charm",
});

// Item usang yang sengaja dipensiunkan beserta nilai kompensasi koin NSF
const RETIRED_COMPENSATION = Object.freeze({
  laptop_gaming: { name: "Laptop Gaming Antik", nsf: 15000 },
  vip_card: { name: "Kartu VIP Klub Lama", nsf: 25000 },
  enchanted_gloves: { name: "Sarung Tangan Kuno", nsf: 5000 },
  broken_radio: { name: "Radio Rusak", nsf: 1200 },
  old_battery: { name: "Baterai Bekas", nsf: 800 },
});

/**
 * Menerjemahkan satu ID item.
 * @param {string} id - ID item yang diperiksa
 * @returns {{ id: string|null, isNew: boolean, compensationNsf: number, retiredName?: string }}
 */
function resolveLegacyItemId(id) {
  if (!id || typeof id !== "string") {
    return { id: null, isNew: false, compensationNsf: 0 };
  }

  // 1. Jika ID sudah ada di katalog baru resmi, langsung kembalikan
  if (CATALOG_BY_ID.has(id)) {
    return { id, isNew: false, compensationNsf: 0 };
  }

  // 2. Cek apakah ada di daftar pemetaan legacy
  const remappedId = LEGACY_ID_MAP[id];
  if (remappedId && CATALOG_BY_ID.has(remappedId)) {
    return { id: remappedId, isNew: true, compensationNsf: 0 };
  }

  // 3. Cek apakah item pensiun yang menerima kompensasi koin NSF
  const retired = RETIRED_COMPENSATION[id];
  if (retired) {
    return {
      id: null,
      isNew: false,
      compensationNsf: retired.nsf,
      retiredName: retired.name,
    };
  }

  // 4. Fallback aman untuk ID asing: berikan kompensasi default 100 NSF
  return {
    id: null,
    isNew: false,
    compensationNsf: 100,
    retiredName: id,
  };
}

/**
 * Menata ulang dan memigrasikan seluruh isi inventaris array.
 * @param {Array<Object>} inventory - Array inventaris [{ id, amount, ... }]
 * @returns {{ inventory: Array<Object>, totalCompensationNsf: number, migratedItems: number, retiredCount: number }}
 */
function remapInventory(inventory) {
  if (!Array.isArray(inventory)) {
    return { inventory: [], totalCompensationNsf: 0, migratedItems: 0, retiredCount: 0 };
  }

  const consolidated = new Map();
  let totalCompensationNsf = 0;
  let migratedItems = 0;
  let retiredCount = 0;

  for (const item of inventory) {
    if (!item || !item.id) continue;

    const amount = Math.max(1, Number(item.amount) || 1);
    const resolved = resolveLegacyItemId(item.id);

    if (resolved.id) {
      if (resolved.isNew) {
        migratedItems += amount;
      }
      const existing = consolidated.get(resolved.id);
      if (existing) {
        existing.amount += amount;
      } else {
        const catalogItem = CATALOG_BY_ID.get(resolved.id);
        consolidated.set(resolved.id, {
          id: resolved.id,
          amount,
          name: catalogItem?.name || item.name || resolved.id,
          category: catalogItem?.category || item.category || "material",
          tier: catalogItem?.tier || 1,
        });
      }
    } else if (resolved.compensationNsf > 0) {
      totalCompensationNsf += resolved.compensationNsf * amount;
      retiredCount += amount;
    }
  }

  return {
    inventory: Array.from(consolidated.values()),
    totalCompensationNsf,
    migratedItems,
    retiredCount,
  };
}

module.exports = {
  LEGACY_ID_MAP,
  RETIRED_COMPENSATION,
  resolveLegacyItemId,
  remapInventory,
};
