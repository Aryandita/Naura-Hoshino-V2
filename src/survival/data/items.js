"use strict";

const GameItem = require("../../models/GameItem");
const staticItems = require("./items_static");
const woodenTools = require("./items_wooden");
const extraItems = require("./items_extra");
const refinedItems = require("./items_refined");
const { COUPON_ITEMS } = require("./items_coupon");
const { DUNGEON_ITEMS } = require("./items_dungeon");
const {
  BALANCED_ITEMS_CATALOG,
  CATALOG_BY_ID,
} = require("./items_catalog");

// Item warisan dan khusus yang harus tetap dapat dicari di inventaris pemain lama.
const LEGACY_ITEMS = [
  ...woodenTools,
  ...extraItems,
  ...refinedItems,
  ...COUPON_ITEMS,
  ...DUNGEON_ITEMS,
  ...staticItems,
];

function flatten(row) {
  const data = row.toJSON();
  const catalogItem = CATALOG_BY_ID.get(data.id);
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    price: data.price,
    sellPrice: data.sellPrice,
    category: data.category,
    rarity: data.rarity,
    tier:
      (data.attributes && data.attributes.tier) ||
      (catalogItem ? catalogItem.tier : 1),
    tierColor:
      (data.attributes && data.attributes.tierColor) ||
      (catalogItem ? catalogItem.tierColor : "#9CA3AF"),
    image:
      (data.attributes && data.attributes.image) ||
      (catalogItem ? catalogItem.image : `/items/${data.id}.svg`),
    emoji:
      (data.attributes && data.attributes.emoji) ||
      (catalogItem ? catalogItem.emoji : "📦"),
    ...data.attributes,
  };
}

async function fetchFromDatabase() {
  try {
    const rows = await GameItem.findAll();
    if (rows && rows.length > 0) return rows.map(flatten);
  } catch (err) {
    // Biarkan kosong, pemanggil akan memakai katalog standar.
  }
  return null;
}

// Data database selalu menang kalau ID-nya sama, lalu lengkapi dengan item katalog dan warisan.
function withRequiredItems(list) {
  const merged = [...list];
  const seenIds = new Set(merged.map((item) => item && item.id));

  // 1. Pastikan seluruh 150 item resmi ada
  for (const item of BALANCED_ITEMS_CATALOG) {
    if (!seenIds.has(item.id)) {
      merged.push(item);
      seenIds.add(item.id);
    }
  }

  // 2. Pastikan item warisan/kupon/dungeon tetap aman bagi pemain lama
  for (const item of LEGACY_ITEMS) {
    if (item && !seenIds.has(item.id)) {
      const enrichedItem = {
        ...item,
        tier: item.tier || 1,
        tierColor: item.tierColor || "#9CA3AF",
        image: item.image || `/items/${item.id}.svg`,
        emoji: item.emoji || "📦",
      };
      merged.push(enrichedItem);
      seenIds.add(item.id);
    }
  }

  return merged;
}

// Array ini diekspor apa adanya dengan 150 item seimbang sebagai fondasi utama.
const itemsArray = withRequiredItems(BALANCED_ITEMS_CATALOG);

fetchFromDatabase().then((dbItems) => {
  if (!dbItems) return;
  const next = withRequiredItems(dbItems);
  itemsArray.length = 0;
  itemsArray.push(...next);
});

module.exports = itemsArray;
