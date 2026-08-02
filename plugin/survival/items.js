const GameItem = require('../../src/models/GameItem');

// We cache items in memory to not break synchronous calls from existing commands
let cachedItems = null;

const staticFallback = [
    // This provides a failsafe if DB fetch fails initially
    { id: 'apple', name: 'Apel Segar', description: 'Buah manis dari hutan. Mengisi +15 Lapar.', price: 150, category: 'consumable', effects: { hunger: 15, stamina: 5 }, rarity: 'Biasa' },
    { id: 'fishing_rod', name: 'Alat Pancing (Lv. 1)', description: 'Dibutuhkan untuk memancing ikan di laut.', price: 1500, category: 'tools', upgrade_level: 1, base_efficiency: 10, rarity: 'Biasa' },
    { id: 'wooden_axe', name: 'Kapak Kayu (Lv. 1)', description: 'Dibutuhkan untuk mendapatkan kayu di hutan.', price: 800, category: 'tools', upgrade_level: 1, base_efficiency: 10, rarity: 'Biasa' }
];

async function syncItems() {
    try {
        const dbItems = await GameItem.findAll();
        if (dbItems && dbItems.length > 0) {
            cachedItems = dbItems.map(item => {
                const data = item.toJSON();
                // Flatten attributes back into the main object for backwards compatibility
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
            });
            return cachedItems;
        }
    } catch (e) {
        // Fallback
    }
    cachedItems = staticFallback;
    return cachedItems;
}

// Ensure items are synced on first require, but we must export an array proxy or similar
// to avoid breaking all `const items = require('./items'); items.find()` calls.
// Since modules are evaluated synchronously, and DB sync is async, the best approach for
// backward compatibility without rewriting 20+ subcommands is to export the static array,
// BUT override it once the DB loads, OR just read from DB periodically.
// Actually, since Javascript objects are passed by reference, we can export a standard array
// and empty/push to it during sync.

const itemsArray = [];

// Initialize with static data
const originalItems = require('./items_static.js'); // We'll move the old file here
itemsArray.push(...originalItems);

// Background sync
syncItems().then(items => {
    if (items && items.length > 0 && items !== staticFallback) {
        itemsArray.length = 0; // clear array
        itemsArray.push(...items);
    }
});

module.exports = itemsArray;
