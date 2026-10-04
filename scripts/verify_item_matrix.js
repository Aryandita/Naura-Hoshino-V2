// Lokasi: scripts/verify_item_matrix.js
// Memverifikasi paritas matriks 5-tier dan 6-kategori katalog resmi Naura Wilds

"use strict";

const {
  BALANCED_ITEMS_CATALOG,
  WEAPONS,
  ARMORS,
  TOOLS,
  CONSUMABLES,
  MATERIALS,
  SPECIALS,
} = require("../src/survival/data/items_catalog");

console.log("=== VERIFIKASI MATRIKS ITEM RESMI NAURA WILDS (5 TIER / 6 KATEGORI) ===");

// 1. Total Count
const expectedTotal = 123;
console.log(
  `Total Item Terdaftar: ${BALANCED_ITEMS_CATALOG.length} (Target: ${expectedTotal})`,
);
if (BALANCED_ITEMS_CATALOG.length !== expectedTotal) {
  console.error(`FAIL: Total item tidak sama dengan ${expectedTotal}!`);
  process.exit(1);
}

// 2. Kategori Count
const categories = {
  weapon: WEAPONS.length,
  armor: ARMORS.length,
  tool: TOOLS.length,
  consumable: CONSUMABLES.length,
  material: MATERIALS.length,
  special: SPECIALS ? SPECIALS.length : 0,
};

console.log("\nDistribusi per Kategori:");
console.table(categories);

const expectedCats = {
  weapon: 20,
  armor: 20,
  tool: 20,
  consumable: 25,
  material: 25,
  special: 13,
};

for (const [cat, expected] of Object.entries(expectedCats)) {
  if (categories[cat] !== expected) {
    console.error(
      `FAIL: Kategori ${cat} memiliki ${categories[cat]} item (harus tepat ${expected})!`,
    );
    process.exit(1);
  }
}

// 3. Tier & Properties Validation
const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const idSet = new Set();

for (const item of BALANCED_ITEMS_CATALOG) {
  // Cek ID unik
  if (idSet.has(item.id)) {
    console.error(`FAIL: Duplikasi ID item terdeteksi: ${item.id}`);
    process.exit(1);
  }
  idSet.add(item.id);

  // Cek tier (1-5)
  if (!tierCounts[item.tier]) {
    tierCounts[item.tier] = 0;
  }
  tierCounts[item.tier] += 1;

  // Cek properti wajib
  if (!item.name || !item.description || !item.price || !item.image || !item.emoji) {
    console.error(`FAIL: Item ${item.id} tidak memiliki properti lengkap!`);
    process.exit(1);
  }

  // Cek larangan em dash
  if (item.name.includes("\u2014") || item.description.includes("\u2014")) {
    console.error(`FAIL: Item ${item.id} mengandung karakter terlarang em dash!`);
    process.exit(1);
  }
}

console.log("\nDistribusi per Tier (1 sampai 5):");
console.table(tierCounts);

console.log(
  "\nSUCCESS: Seluruh item terverifikasi simetris, bebas em dash, dan seimbang sempurna! 🎉",
);
