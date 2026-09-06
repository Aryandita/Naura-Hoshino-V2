// Lokasi: scripts/verify_item_matrix.js
// Memverifikasi paritas matriks 150 item seimbang

"use strict";

const {
  BALANCED_ITEMS_CATALOG,
  WEAPONS,
  ARMORS,
  TOOLS,
  CONSUMABLES,
  MATERIALS,
} = require("../src/survival/data/items_catalog");

console.log("=== VERIFIKASI MATRIKS 150 ITEM RESMI NAURA WILDS ===");

// 1. Total Count
console.log(`Total Item Terdaftar: ${BALANCED_ITEMS_CATALOG.length} (Target: 150)`);
if (BALANCED_ITEMS_CATALOG.length !== 150) {
  console.error("FAIL: Total item tidak sama dengan 150!");
  process.exit(1);
}

// 2. Kategori Count
const categories = {
  weapon: WEAPONS.length,
  armor: ARMORS.length,
  tool: TOOLS.length,
  consumable: CONSUMABLES.length,
  material: MATERIALS.length,
};

console.log("\nDistribusi per Kategori:");
console.table(categories);

for (const [cat, count] of Object.entries(categories)) {
  if (count !== 30) {
    console.error(`FAIL: Kategori ${cat} memiliki ${count} item (harus tepat 30)!`);
    process.exit(1);
  }
}

// 3. Tier Count
const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
const idSet = new Set();

for (const item of BALANCED_ITEMS_CATALOG) {
  // Cek ID unik
  if (idSet.has(item.id)) {
    console.error(`FAIL: Duplikasi ID item terdeteksi: ${item.id}`);
    process.exit(1);
  }
  idSet.add(item.id);

  // Cek tier
  if (!tierCounts[item.tier]) {
    tierCounts[item.tier] = 0;
  }
  tierCounts[item.tier] += 1;

  // Cek properti wajib
  if (!item.name || !item.description || !item.price || !item.image) {
    console.error(`FAIL: Item ${item.id} tidak memiliki properti lengkap!`);
    process.exit(1);
  }
}

console.log("\nDistribusi per Tier (Harus tepat 25 per tier):");
console.table(tierCounts);

for (const [tier, count] of Object.entries(tierCounts)) {
  if (count !== 25) {
    console.error(`FAIL: Tier ${tier} memiliki ${count} item (harus tepat 25)!`);
    process.exit(1);
  }
}

console.log("\nSUCCESS: Seluruh 150 item terverifikasi simetris dan seimbang sempurna! 🎉");
