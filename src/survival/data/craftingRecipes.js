"use strict";

const { FRAGMENT, COIN } = require("../engines/currency");

// ===== PELEBURAN DI TUNGKU PANDAI BESI DESA =====
// Mengolah bahan mentah menjadi material berkualitas tinggi sesuai 5-tier resmi
const SMELT_RECIPES = [
  {
    id: "copper_ingot",
    input: [
      { id: "copper_ore", amount: 3 },
      { id: "coal_lump", amount: 1 },
    ],
    output: { id: "copper_ingot", amount: 1 },
    fee: 120,
    currency: FRAGMENT,
    reqLevel: 2,
  },
  {
    id: "steel_ingot",
    input: [
      { id: "iron_ore", amount: 3 },
      { id: "coal_lump", amount: 2 },
    ],
    output: { id: "steel_ingot", amount: 1 },
    fee: 350,
    currency: FRAGMENT,
    reqLevel: 5,
  },
  {
    id: "ironwood_plank",
    input: [
      { id: "oak_wood", amount: 4 },
      { id: "pine_timber", amount: 2 },
    ],
    output: { id: "ironwood_plank", amount: 1 },
    fee: 280,
    currency: FRAGMENT,
    reqLevel: 4,
  },
  {
    id: "carbon_fiber_sheet",
    input: [
      { id: "pine_timber", amount: 3 },
      { id: "coal_lump", amount: 2 },
    ],
    output: { id: "carbon_fiber_sheet", amount: 1 },
    fee: 800,
    currency: FRAGMENT,
    reqLevel: 8,
  },
  {
    id: "titanium_alloy",
    input: [
      { id: "steel_ingot", amount: 2 },
      { id: "quartz_crystal", amount: 1 },
    ],
    output: { id: "titanium_alloy", amount: 1 },
    fee: 2500,
    currency: FRAGMENT,
    reqLevel: 12,
  },
  {
    id: "celestial_ingot",
    input: [
      { id: "titanium_alloy", amount: 2 },
      { id: "refined_aetherium", amount: 1 },
    ],
    output: { id: "celestial_ingot", amount: 1 },
    fee: 10000,
    currency: COIN,
    reqLevel: 20,
  },
];

// Bahan inti pemersatu tiap rumpun bahan
const MATERIAL_CORE = {
  kayu: "oak_wood",
  pinus: "pine_timber",
  tembaga: "copper_ingot",
  baja: "steel_ingot",
  titanium: "titanium_alloy",
  celestial: "celestial_ingot",
};

// Jalur peningkatan kualitas peralatan (5 Tier konsisten)
const UPGRADE_PATHS = {
  // --- Kapak ---
  wooden_axe: {
    to: "iron_hatchet",
    material: "kayu",
    coreAmount: 3,
    secondary: [
      { id: "stone_pebble", amount: 5 },
      { id: "copper_ingot", amount: 1 },
    ],
    cost: 800,
    currency: FRAGMENT,
  },
  iron_hatchet: {
    to: "alloy_chainsaw",
    material: "baja",
    coreAmount: 2,
    secondary: [
      { id: "steel_ingot", amount: 2 },
      { id: "ironwood_plank", amount: 2 },
    ],
    cost: 3200,
    currency: FRAGMENT,
  },
  alloy_chainsaw: {
    to: "laser_timber_axe",
    material: "titanium",
    coreAmount: 2,
    secondary: [
      { id: "titanium_alloy", amount: 2 },
      { id: "carbon_fiber_sheet", amount: 2 },
    ],
    cost: 12000,
    currency: COIN,
  },
  laser_timber_axe: {
    to: "antimatter_defoliator",
    material: "celestial",
    coreAmount: 2,
    secondary: [
      { id: "celestial_ingot", amount: 2 },
      { id: "primordial_essence", amount: 1 },
    ],
    cost: 45000,
    currency: COIN,
  },

  // --- Beliung ---
  wooden_pickaxe: {
    to: "iron_pickaxe",
    material: "kayu",
    coreAmount: 3,
    secondary: [
      { id: "stone_pebble", amount: 5 },
      { id: "copper_ingot", amount: 1 },
    ],
    cost: 800,
    currency: FRAGMENT,
  },
  iron_pickaxe: {
    to: "steel_drill_pick",
    material: "baja",
    coreAmount: 2,
    secondary: [
      { id: "steel_ingot", amount: 2 },
      { id: "quartz_crystal", amount: 1 },
    ],
    cost: 3200,
    currency: FRAGMENT,
  },
  steel_drill_pick: {
    to: "plasma_mining_laser",
    material: "titanium",
    coreAmount: 2,
    secondary: [
      { id: "titanium_alloy", amount: 2 },
      { id: "bioluminescent_spore", amount: 2 },
    ],
    cost: 12000,
    currency: COIN,
  },
  plasma_mining_laser: {
    to: "quantum_matter_excavator",
    material: "celestial",
    coreAmount: 2,
    secondary: [
      { id: "celestial_ingot", amount: 2 },
      { id: "void_matter_crystal", amount: 1 },
    ],
    cost: 45000,
    currency: COIN,
  },

  // --- Joran Pancing ---
  bamboo_fishing_rod: {
    to: "fiberglass_rod",
    material: "kayu",
    coreAmount: 2,
    secondary: [
      { id: "pine_timber", amount: 2 },
      { id: "beast_fur", amount: 2 },
    ],
    cost: 750,
    currency: FRAGMENT,
  },
  fiberglass_rod: {
    to: "carbon_reel_rod",
    material: "baja",
    coreAmount: 2,
    secondary: [
      { id: "steel_ingot", amount: 1 },
      { id: "chitin_shell", amount: 2 },
    ],
    cost: 3500,
    currency: FRAGMENT,
  },
  carbon_reel_rod: {
    to: "titanium_deep_rod",
    material: "titanium",
    coreAmount: 2,
    secondary: [
      { id: "titanium_alloy", amount: 2 },
      { id: "carbon_fiber_sheet", amount: 2 },
    ],
    cost: 14000,
    currency: COIN,
  },
  titanium_deep_rod: {
    to: "leviathan_lure_rod",
    material: "celestial",
    coreAmount: 2,
    secondary: [
      { id: "celestial_ingot", amount: 2 },
      { id: "leviathan_heart", amount: 1 },
    ],
    cost: 50000,
    currency: COIN,
  },

  // --- Pedang & Senjata ---
  wooden_sword: {
    to: "iron_broadsword",
    material: "kayu",
    coreAmount: 3,
    secondary: [
      { id: "copper_ingot", amount: 2 },
      { id: "beast_fur", amount: 2 },
    ],
    cost: 950,
    currency: FRAGMENT,
  },
  iron_broadsword: {
    to: "plasma_katana",
    material: "baja",
    coreAmount: 2,
    secondary: [
      { id: "steel_ingot", amount: 2 },
      { id: "bioluminescent_spore", amount: 2 },
    ],
    cost: 4000,
    currency: FRAGMENT,
  },
  plasma_katana: {
    to: "aether_blade",
    material: "titanium",
    coreAmount: 2,
    secondary: [
      { id: "titanium_alloy", amount: 2 },
      { id: "refined_aetherium", amount: 1 },
    ],
    cost: 16000,
    currency: COIN,
  },
  aether_blade: {
    to: "excalibur_prime",
    material: "celestial",
    coreAmount: 2,
    secondary: [
      { id: "celestial_ingot", amount: 2 },
      { id: "phoenix_feather", amount: 1 },
    ],
    cost: 65000,
    currency: COIN,
  },

  // --- Zirah Dada ---
  leather_tunic: {
    to: "iron_chestplate",
    material: "kayu",
    coreAmount: 2,
    secondary: [
      { id: "copper_ingot", amount: 2 },
      { id: "beast_fur", amount: 3 },
    ],
    cost: 900,
    currency: FRAGMENT,
  },
  iron_chestplate: {
    to: "carbon_exosuit",
    material: "baja",
    coreAmount: 2,
    secondary: [
      { id: "steel_ingot", amount: 2 },
      { id: "chitin_shell", amount: 3 },
    ],
    cost: 3800,
    currency: FRAGMENT,
  },
  carbon_exosuit: {
    to: "nano_weave_vest",
    material: "titanium",
    coreAmount: 2,
    secondary: [
      { id: "titanium_alloy", amount: 2 },
      { id: "carbon_fiber_sheet", amount: 3 },
    ],
    cost: 15000,
    currency: COIN,
  },
  nano_weave_vest: {
    to: "aegis_of_immortality",
    material: "celestial",
    coreAmount: 2,
    secondary: [
      { id: "celestial_ingot", amount: 2 },
      { id: "primordial_essence", amount: 1 },
    ],
    cost: 60000,
    currency: COIN,
  },
};

function getSmeltRecipe(outputId) {
  return SMELT_RECIPES.find((recipe) => recipe.id === outputId) || null;
}

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

const WORKBENCH_RECIPES = Object.entries(UPGRADE_PATHS).map(([from, plan]) => ({
  id: `${from}_to_${plan.to}`,
  from,
  to: plan.to,
  cost: plan.cost,
  currency: plan.currency,
  material: plan.material,
}));

module.exports = {
  SMELT_RECIPES,
  UPGRADE_PATHS,
  MATERIAL_CORE,
  WORKBENCH_RECIPES,
  getSmeltRecipe,
  getUpgradePlan,
  isUpgradable,
};
