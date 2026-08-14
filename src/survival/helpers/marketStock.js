"use strict";

// Dagangan dan transaksi Pasar Tradisional Desa.
// Versi lama subcommand market memotong barang dari tas tetapi lupa menambah
// Naura Star Fragment ke dompet, jadi pemain menjual barangnya secara gratis.
// Seluruh transaksi sekarang lewat modul ini supaya kejadian itu tidak terulang.

const cacheManager = require("../../managers/cacheManager");
const UserSurvival = require("../../models/UserSurvival");
const items = require("../data/items");
const currencyHelper = require("../engines/currency");
const { sellMultiplier } = require("./specialEffects");
const { safeParseInventory, addOrStackItem } = require("../engines/inventoryHelper");

const FRAGMENT = currencyHelper.byKind(currencyHelper.FRAGMENT);

// Pasar desa hanya melayani kebutuhan sederhana. Barang mewah tetap milik kota.
const CATEGORIES = {
  consumable: { label: "Bahan Pangan & Obat", emojiKey: "apple" },
  material: { label: "Bahan Mentah & Umpan", emojiKey: "wood" },
  seed: { label: "Benih Pertanian", emojiKey: "farm_seed" },
  tools: { label: "Alat Kerja & Kendaraan", emojiKey: "tools" },
  special: { label: "Properti Sederhana", emojiKey: "property" },
};

const ALLOWED_IDS = [
  "apple",
  "mineral_water",
  "potato",
  "instant_noodles",
  "village_coffee",
  "bandaid",
  "herb_tea",
  "wood",
  "stone",
  "fiber",
  "worm_bait",
  "seed_wheat",
  "seed_potato",
  "seed_apple",
  "wooden_axe",
  "wooden_pickaxe",
  "fishing_rod",
];

const EXTRA_STOCK = {
  tools: [
    {
      id: "veh_bicycle",
      name: "Sepeda Kayuh (Kendaraan)",
      price: 15000,
      description: "Bebas ongkos jalan antarwilayah.",
    },
  ],
  special: [
    {
      id: "prop_gudang",
      name: "Gudang Tua (Properti)",
      price: 10000,
      description: "Tempat berteduh sederhana, tapi cukup untuk tidur.",
    },
  ],
};

function findItem(id) {
  return items.find((it) => it && it.id === id) || null;
}

/** Harga dasar penjualan sebuah barang, sebelum berkah apa pun. */
function baseSellPrice(item) {
  if (!item) return 0;
  if (Number(item.sellPrice) > 0) return Number(item.sellPrice);
  if (Number(item.price) > 0) return Math.floor(Number(item.price) * 0.5);
  return 0;
}

/** Dagangan yang dijual pasar untuk satu kategori. */
function poolFor(category, diffConfig = {}) {
  const base = items.filter(
    (it) =>
      it &&
      it.category === category &&
      ALLOWED_IDS.includes(it.id) &&
      Number(it.price) > 0,
  );
  const pool = base.concat(EXTRA_STOCK[category] || []);

  return pool.map((it) => {
    let price = Number(it.price) || 0;
    if (diffConfig.extreme) price = Math.floor(price * 1.5);
    return { ...it, finalPrice: price };
  });
}

/**
 * Barang di tas yang bisa dijual, sudah digabung per id dan sudah menghitung
 * berkah Sarung Tangan Midas.
 */
function sellableFrom(inventory, survival) {
  const multiplier = sellMultiplier(survival);
  const grouped = {};

  safeParseInventory(inventory).forEach((entry) => {
    if (!entry || !entry.id) return;
    grouped[entry.id] = (grouped[entry.id] || 0) + (Number(entry.amount) || 1);
  });

  return Object.entries(grouped)
    .map(([id, amount]) => {
      const item = findItem(id);
      const unitPrice = Math.floor(baseSellPrice(item) * multiplier);
      if (!item || unitPrice <= 0) return null;
      return { id, name: item.name, amount, unitPrice, multiplier };
    })
    .filter(Boolean);
}

function encode(itemId, value, amount) {
  return `${itemId}|${value}|${amount || 0}`;
}

function decode(value) {
  const [itemId, valueStr, amountStr] = String(value || "").split("|");
  return {
    itemId,
    value: parseInt(valueStr, 10),
    amount: parseInt(amountStr, 10) || 0,
  };
}

/** Jual barang dari tas. Uangnya benar-benar masuk ke dompet kali ini. */
async function sell(userId, itemId, sellAll) {
  const profile = await cacheManager.getUserProfile(userId);
  const survival = await UserSurvival.findOne({ where: { userId } });
  if (!profile || !survival) return { ok: false, reason: "no_profile" };

  const item = findItem(itemId);
  if (!item) return { ok: false, reason: "unknown_item" };

  const inventory = safeParseInventory(profile.inventory);
  const kept = [];
  let owned = 0;

  inventory.forEach((entry) => {
    if (entry && entry.id === itemId) owned += Number(entry.amount) || 1;
    else kept.push(entry);
  });

  if (owned <= 0) return { ok: false, reason: "not_owned" };

  const multiplier = sellMultiplier(survival);
  const unitPrice = Math.floor(baseSellPrice(item) * multiplier);
  if (unitPrice <= 0) return { ok: false, reason: "worthless" };

  const qty = sellAll ? owned : 1;
  const earned = unitPrice * qty;
  const left = owned - qty;

  const nextInv =
    left > 0
      ? addOrStackItem(kept, { id: itemId, name: item.name, amount: left })
      : kept;

  await cacheManager.updateUserProfile(userId, { inventory: nextInv });
  const balance = await currencyHelper.reward(
    FRAGMENT,
    { survival, profile },
    earned,
  );

  return {
    ok: true,
    itemName: item.name,
    qty,
    unitPrice,
    earned,
    left,
    balance,
    multiplier,
  };
}

/** Beli barang dari pasar, termasuk gudang tua dan sepeda. */
async function buy(userId, itemId, price) {
  const profile = await cacheManager.getUserProfile(userId);
  const survival = await UserSurvival.findOne({ where: { userId } });
  if (!profile || !survival) return { ok: false, reason: "no_profile" };

  const holders = { survival, profile };
  const balanceBefore = currencyHelper.balanceOf(FRAGMENT, holders);
  if (balanceBefore < price) {
    return {
      ok: false,
      reason: "insufficient",
      shortage: price - balanceBefore,
    };
  }

  const balance = await currencyHelper.charge(FRAGMENT, holders, price);
  if (balance === null)
    return {
      ok: false,
      reason: "insufficient",
      shortage: price - balanceBefore,
    };

  if (itemId === "prop_gudang") {
    survival.propertyId = "gudang";
    await survival.save();
    return { ok: true, itemName: "Gudang Tua", price, balance };
  }

  if (itemId === "veh_bicycle") {
    survival.vehicle = "bicycle";
    await survival.save();
    return { ok: true, itemName: "Sepeda Kayuh", price, balance };
  }

  const item = findItem(itemId);
  const itemName = item ? item.name : itemId;
  const nextInv = addOrStackItem(safeParseInventory(profile.inventory), {
    id: itemId,
    name: itemName,
    amount: 1,
  });
  await cacheManager.updateUserProfile(userId, { inventory: nextInv });

  return { ok: true, itemName, price, balance };
}

module.exports = {
  CATEGORIES,
  ALLOWED_IDS,
  EXTRA_STOCK,
  findItem,
  baseSellPrice,
  poolFor,
  sellableFrom,
  encode,
  decode,
  sell,
  buy,
};
