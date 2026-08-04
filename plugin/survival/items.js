'use strict';

const GameItem = require('../../src/models/GameItem');
const staticItems = require('./items_static.js');
const woodenTools = require('./items_wooden.js');

// Fallback minimum kalau pengambilan dari database gagal total.
const staticFallback = [
    { id: 'apple', name: 'Apel Segar', description: 'Buah manis dari hutan. Mengisi +15 Lapar.', price: 150, category: 'consumable', effects: { hunger: 15, stamina: 5 }, rarity: 'Biasa' },
    { id: 'fishing_rod', name: 'Alat Pancing (Lv. 1)', description: 'Dibutuhkan untuk memancing ikan di laut.', price: 1500, category: 'tools', upgrade_level: 1, base_efficiency: 10, rarity: 'Biasa' },
    { id: 'wooden_axe', name: 'Kapak Kayu (Lv. 1)', description: 'Dibutuhkan untuk mendapatkan kayu di hutan.', price: 800, category: 'tools', upgrade_level: 1, base_efficiency: 10, rarity: 'Biasa' }
];

function flatten(row) {
    const data = row.toJSON();
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        price: data.price,
        sellPrice: data.sellPrice,
        category: data.category,
        rarity: data.rarity,
        ...data.attributes
    };
}

async function fetchFromDatabase() {
    try {
        const rows = await GameItem.findAll();
        if (rows && rows.length > 0) return rows.map(flatten);
    } catch (err) {
        // Biarkan kosong, pemanggil akan memakai data statis.
    }
    return null;
}

// Item kode-saja yang harus selalu ada, bahkan kalau katalog database belum
// pernah di-seed. Tanpa ini, starter kit bisa menunjuk item yang tidak dikenal.
function withRequiredItems(list) {
    const merged = [...list];
    for (const tool of woodenTools) {
        if (!merged.some(item => item && item.id === tool.id)) merged.push(tool);
    }
    return merged;
}

// Array ini diekspor apa adanya supaya pemanggil lama tetap bisa menulis
// `const items = require('./items'); items.find(...)`. Isinya ditukar di tempat
// begitu data database selesai dimuat.
const itemsArray = withRequiredItems(staticItems.length > 0 ? staticItems : staticFallback);

fetchFromDatabase().then(dbItems => {
    if (!dbItems) return;
    const next = withRequiredItems(dbItems);
    itemsArray.length = 0;
    itemsArray.push(...next);
});

module.exports = itemsArray;
