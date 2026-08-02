// plugin/survival/inventoryHelper.js
// Helper terpusat untuk normalisasi dan manipulasi inventory user.
// Memastikan tidak ada crash 'xxx.some is not a function' karena data JSON tersimpan sebagai string.

/**
 * Normalisasi nilai inventory dari database menjadi array yang aman.
 * Menangani kasus: null, undefined, string JSON, atau array biasa.
 * @param {any} rawValue - Nilai mentah dari profile.inventory atau kolom JSON lainnya
 * @returns {Array} Array yang sudah bersih (minimal [])
 */
function safeParseInventory(rawValue) {
    if (Array.isArray(rawValue)) return rawValue;
    if (!rawValue) return [];
    if (typeof rawValue === 'string') {
        try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

/**
 * Ambil item dari inventory berdasarkan ID.
 * @param {Array} inv - Inventory yang sudah di-parse dengan safeParseInventory()
 * @param {string} itemId - ID item yang dicari
 * @returns {Object|undefined}
 */
function findItem(inv, itemId) {
    return inv.find(item => item && item.id === itemId);
}

/**
 * Cek apakah user memiliki item tertentu.
 * @param {Array} inv - Inventory yang sudah di-parse
 * @param {string} itemId - ID item
 * @returns {boolean}
 */
function hasItem(inv, itemId) {
    return inv.some(item => item && item.id === itemId);
}

/**
 * Hapus item dari inventory (sekali pakai / konsumsi).
 * @param {Array} inv - Inventory yang sudah di-parse
 * @param {string} itemId - ID item yang dihapus
 * @param {number} [amount=1] - Jumlah yang dihapus
 * @returns {Array} Inventory baru setelah penghapusan
 */
function removeItem(inv, itemId, amount = 1) {
    let removed = 0;
    return inv.filter(item => {
        if (item && item.id === itemId && removed < amount) {
            removed++;
            return false;
        }
        return true;
    });
}

/**
 * Tambah atau update jumlah item di inventory.
 * Jika item sudah ada, increment amount-nya.
 * @param {Array} inv - Inventory yang sudah di-parse
 * @param {Object} newItem - Item baru { id, name, amount, type, ... }
 * @returns {Array} Inventory baru
 */
function addOrStackItem(inv, newItem) {
    const existing = inv.find(item => item && item.id === newItem.id);
    if (existing) {
        existing.amount = (existing.amount || 1) + (newItem.amount || 1);
        return [...inv];
    }
    return [...inv, newItem];
}

module.exports = { safeParseInventory, findItem, hasItem, removeItem, addOrStackItem };
