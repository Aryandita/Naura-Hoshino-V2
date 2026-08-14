"use strict";

const { FRAGMENT, COIN } = require("../engines/currency");

// ===== PELEBURAN DI TUNGKU BAGAS (PANDAI BESI DESA) =====
// Bahan mentah masuk, bahan olahan bernilai jauh lebih tinggi keluar.
// Upah tempa dibayar Naura Star Fragment karena tungkunya ada di desa.
const SMELT_RECIPES = [
  {
    id: "charcoal",
    input: [{ id: "wood", amount: 3 }],
    output: { id: "charcoal", amount: 1 },
    fee: 50,
    currency: FRAGMENT,
  },
  {
    id: "copper_ingot",
    input: [
      { id: "copper_ore", amount: 3 },
      { id: "coal", amount: 1 },
    ],
    output: { id: "copper_ingot", amount: 1 },
    fee: 120,
    currency: FRAGMENT,
  },
  {
    id: "iron_ingot",
    input: [
      { id: "iron_ore", amount: 3 },
      { id: "coal", amount: 2 },
    ],
    output: { id: "iron_ingot", amount: 1 },
    fee: 250,
    currency: FRAGMENT,
  },
  {
    id: "steel_ingot",
    input: [
      { id: "iron_ingot", amount: 2 },
      { id: "coal", amount: 3 },
    ],
    output: { id: "steel_ingot", amount: 1 },
    fee: 600,
    currency: FRAGMENT,
  },
  {
    id: "silver_ingot",
    input: [
      { id: "silver_ore", amount: 3 },
      { id: "coal", amount: 2 },
    ],
    output: { id: "silver_ingot", amount: 1 },
    fee: 900,
    currency: FRAGMENT,
  },
  {
    id: "mythril_ingot",
    input: [
      { id: "mythril_ore", amount: 3 },
      { id: "coal", amount: 4 },
    ],
    output: { id: "mythril_ingot", amount: 1 },
    fee: 2500,
    currency: FRAGMENT,
  },
  {
    id: "titanium_ingot",
    input: [
      { id: "iron_ore", amount: 8 },
      { id: "coal", amount: 5 },
    ],
    output: { id: "titanium_ingot", amount: 1 },
    fee: 4000,
    currency: FRAGMENT,
  },
  {
    id: "glass_pane",
    input: [
      { id: "glass_shard", amount: 3 },
      { id: "coal", amount: 1 },
    ],
    output: { id: "glass_pane", amount: 1 },
    fee: 100,
    currency: FRAGMENT,
  },
  {
    id: "tanned_leather",
    input: [
      { id: "leather", amount: 2 },
      { id: "fiber", amount: 2 },
    ],
    output: { id: "tanned_leather", amount: 1 },
    fee: 150,
    currency: FRAGMENT,
  },
  {
    id: "polished_diamond",
    input: [
      { id: "diamond", amount: 1 },
      { id: "whetstone", amount: 2 },
    ],
    output: { id: "polished_diamond", amount: 1 },
    fee: 5000,
    currency: FRAGMENT,
  },
  {
    id: "refined_naura_shard",
    input: [
      { id: "naura_shard", amount: 2 },
      { id: "mana_crystal", amount: 1 },
    ],
    output: { id: "refined_naura_shard", amount: 1 },
    fee: 7500,
    currency: FRAGMENT,
  },
  {
    id: "wood_log",
    input: [
      { id: "wood", amount: 6 },
      { id: "fiber", amount: 2 },
    ],
    output: { id: "wood_log", amount: 1 },
    fee: 200,
    currency: FRAGMENT,
  },
  {
    id: "stone_slab",
    input: [
      { id: "stone", amount: 6 },
      { id: "whetstone", amount: 1 },
    ],
    output: { id: "stone_slab", amount: 1 },
    fee: 350,
    currency: FRAGMENT,
  },
  {
    id: "whetstone",
    input: [{ id: "stone", amount: 3 }],
    output: { id: "whetstone", amount: 1 },
    fee: 80,
    currency: FRAGMENT,
  },
];

// ===== JALUR NAIK LEVEL ALAT =====
// Tiap jenis bahan punya bahan inti sendiri: kayu butuh Gelondong Kayu,
// batu butuh Lempeng Batu, besi butuh Batangan Besi, dan seterusnya.
// Bahan sekunder + mata uang selalu ikut, jadi naik level terasa berjenjang.
const MATERIAL_CORE = {
  kayu: "wood_log",
  batu: "stone_slab",
  tembaga: "copper_ingot",
  besi: "iron_ingot",
  baja: "steel_ingot",
  perak: "silver_ingot",
  mythril: "mythril_ingot",
  titanium: "titanium_ingot",
  diamond: "polished_diamond",
};

const UPGRADE_PATHS = {
  // --- Kapak ---
  wooden_axe: {
    to: "stone_axe",
    material: "kayu",
    coreAmount: 2,
    secondary: [
      { id: "whetstone", amount: 1 },
      { id: "stone", amount: 5 },
    ],
    cost: 1200,
    currency: FRAGMENT,
  },
  stone_axe: {
    to: "iron_axe",
    material: "batu",
    coreAmount: 2,
    secondary: [
      { id: "iron_ingot", amount: 2 },
      { id: "tool_grease", amount: 1 },
    ],
    cost: 3000,
    currency: FRAGMENT,
  },
  iron_axe: {
    to: "silver_axe",
    material: "besi",
    coreAmount: 3,
    secondary: [
      { id: "silver_ingot", amount: 2 },
      { id: "forge_blueprint", amount: 1 },
    ],
    cost: 9000,
    currency: COIN,
  },
  silver_axe: {
    to: "diamond_axe",
    material: "perak",
    coreAmount: 3,
    secondary: [
      { id: "polished_diamond", amount: 1 },
      { id: "mana_crystal", amount: 1 },
    ],
    cost: 30000,
    currency: COIN,
  },

  // --- Beliung ---
  wooden_pickaxe: {
    to: "stone_pickaxe",
    material: "kayu",
    coreAmount: 2,
    secondary: [
      { id: "whetstone", amount: 1 },
      { id: "stone", amount: 5 },
    ],
    cost: 1100,
    currency: FRAGMENT,
  },
  stone_pickaxe: {
    to: "iron_pickaxe",
    material: "batu",
    coreAmount: 2,
    secondary: [
      { id: "iron_ingot", amount: 2 },
      { id: "tool_grease", amount: 1 },
    ],
    cost: 2800,
    currency: FRAGMENT,
  },
  iron_pickaxe: {
    to: "titanium_pickaxe",
    material: "besi",
    coreAmount: 4,
    secondary: [
      { id: "titanium_ingot", amount: 2 },
      { id: "forge_blueprint", amount: 1 },
    ],
    cost: 15000,
    currency: COIN,
  },
  titanium_pickaxe: {
    to: "mythril_pickaxe",
    material: "titanium",
    coreAmount: 3,
    secondary: [
      { id: "mythril_ingot", amount: 2 },
      { id: "mana_crystal", amount: 2 },
    ],
    cost: 35000,
    currency: COIN,
  },

  // --- Pedang & senjata ---
  wooden_sword: {
    to: "stone_sword",
    material: "kayu",
    coreAmount: 2,
    secondary: [{ id: "whetstone", amount: 2 }],
    cost: 1300,
    currency: FRAGMENT,
  },
  stone_sword: {
    to: "iron_sword",
    material: "batu",
    coreAmount: 2,
    secondary: [
      { id: "iron_ingot", amount: 3 },
      { id: "tanned_leather", amount: 1 },
    ],
    cost: 3500,
    currency: FRAGMENT,
  },
  iron_sword: {
    to: "silver_rapier",
    material: "besi",
    coreAmount: 4,
    secondary: [
      { id: "silver_ingot", amount: 3 },
      { id: "forge_blueprint", amount: 1 },
    ],
    cost: 12000,
    currency: COIN,
  },
  silver_rapier: {
    to: "diamond_sword",
    material: "perak",
    coreAmount: 4,
    secondary: [
      { id: "polished_diamond", amount: 2 },
      { id: "mana_crystal", amount: 1 },
    ],
    cost: 32000,
    currency: COIN,
  },
  diamond_sword: {
    to: "flaming_sword",
    material: "diamond",
    coreAmount: 2,
    secondary: [
      { id: "refined_naura_shard", amount: 1 },
      { id: "demon_horn", amount: 2 },
    ],
    cost: 60000,
    currency: COIN,
  },
  hunting_bow: {
    to: "silver_rapier",
    material: "besi",
    coreAmount: 3,
    secondary: [
      { id: "tanned_leather", amount: 2 },
      { id: "fiber", amount: 5 },
    ],
    cost: 10000,
    currency: COIN,
  },
  war_hammer: {
    to: "mystic_sword",
    material: "baja",
    coreAmount: 4,
    secondary: [
      { id: "refined_naura_shard", amount: 1 },
      { id: "mana_crystal", amount: 2 },
    ],
    cost: 70000,
    currency: COIN,
  },
  apprentice_staff: {
    to: "plasma_blade",
    material: "mythril",
    coreAmount: 2,
    secondary: [{ id: "mana_crystal", amount: 3 }],
    cost: 40000,
    currency: COIN,
  },

  // --- Pancing ---
  bamboo_rod: {
    to: "fishing_rod",
    material: "kayu",
    coreAmount: 1,
    secondary: [{ id: "fiber", amount: 4 }],
    cost: 600,
    currency: FRAGMENT,
  },
  fishing_rod: {
    to: "pro_fishing_rod",
    material: "besi",
    coreAmount: 2,
    secondary: [
      { id: "tanned_leather", amount: 2 },
      { id: "tool_grease", amount: 1 },
    ],
    cost: 6000,
    currency: FRAGMENT,
  },
};

/** Resep peleburan berdasarkan id hasil olahannya. */
function getSmeltRecipe(outputId) {
  return SMELT_RECIPES.find((recipe) => recipe.id === outputId) || null;
}

/**
 * Kebutuhan lengkap untuk menaikkan level satu alat. Bahan inti dihitung dari
 * jenis bahan alatnya, jadi pemanggil tidak perlu tahu pemetaannya.
 */
function getUpgradePlan(fromId) {
  const path = UPGRADE_PATHS[fromId];
  if (!path) return null;

  const coreId = MATERIAL_CORE[path.material];
  const materials = [{ id: coreId, amount: path.coreAmount, isCore: true }];
  for (const item of path.secondary || []) {
    materials.push({ id: item.id, amount: item.amount, isCore: false });
  }

  return {
    from: fromId,
    to: path.to,
    material: path.material,
    coreId,
    materials,
    cost: path.cost,
    currency: path.currency,
  };
}

function isUpgradable(itemId) {
  return Boolean(UPGRADE_PATHS[itemId]);
}

module.exports = {
  SMELT_RECIPES,
  UPGRADE_PATHS,
  MATERIAL_CORE,
  getSmeltRecipe,
  getUpgradePlan,
  isUpgradable,
};
