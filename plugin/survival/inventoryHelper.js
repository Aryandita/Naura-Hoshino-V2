// plugin/survival/inventoryHelper.js
// Helper terpusat untuk normalisasi dan manipulasi inventory user.
// Memastikan tidak ada crash 'xxx.some is not a function' karena data JSON tersimpan sebagai string.
//
// Fungsi murni di bagian atas hanya mengolah array di memori. Untuk penulisan ke
// database, WAJIB memakai addItemsAtomic() atau takeItemsAtomic() di bagian bawah:
// keduanya mengunci baris pemain lebih dulu, sehingga dua klik yang tiba bersamaan
// tidak saling menimpa dan tidak ada barang yang hilang.

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

/**
 * Hitung jumlah sebenarnya sebuah item, termasuk yang tersusun dalam satu tumpukan.
 * removeItem() menghitung per entri, sedangkan addOrStackItem() menumpuk lewat
 * kolom amount, jadi perhitungan yang benar harus menjumlahkan amount.
 * @param {Array} inv
 * @param {string} itemId
 * @returns {number}
 */
function countStack(inv, itemId) {
    return safeParseInventory(inv).reduce(
        (total, item) => (item && item.id === itemId ? total + (Number(item.amount) || 1) : total),
        0
    );
}

/**
 * Ambil sejumlah item dari inventory dengan menghormati tumpukan.
 * @param {Array} inv
 * @param {string} itemId
 * @param {number} [amount=1]
 * @returns {Array|null} Inventory baru, atau null bila jumlahnya tidak cukup.
 */
function takeStack(inv, itemId, amount = 1) {
    const list = safeParseInventory(inv);
    let left = Math.max(1, Math.floor(Number(amount) || 1));
    if (countStack(list, itemId) < left) return null;

    const next = [];
    for (const item of list) {
        if (left > 0 && item && item.id === itemId) {
            const have = Number(item.amount) || 1;
            const used = Math.min(have, left);
            left -= used;
            const rest = have - used;
            if (rest > 0) next.push({ ...item, amount: rest });
            continue;
        }
        next.push(item);
    }
    return next;
}

/** Seragamkan masukan menjadi array permintaan item. */
function toList(input) {
    if (!input) return [];
    return Array.isArray(input) ? input.filter(Boolean) : [input];
}

// Diambil di dalam fungsi, bukan di puncak berkas, supaya berkas ini tetap bisa
// diuji tanpa menyalakan koneksi database.
function manager() {
    return require('../../src/managers/cacheManager');
}

/**
 * Masukkan satu atau beberapa barang ke tas secara atomik.
 *
 * Pola lama membaca inventory dari cache, menambah barang di memori, lalu menulis
 * seluruh array kembali. Dua hadiah yang tiba bersamaan sama-sama menulis array
 * versi lama plus satu barang, jadi salah satu barang hilang tanpa jejak.
 *
 * @param {string} userId
 * @param {Object|Array<Object>} newItems - { id, name, amount }
 * @returns {Promise<{ ok: boolean, inventory?: Array, reason?: string }>}
 */
async function addItemsAtomic(userId, newItems) {
    const list = toList(newItems).filter(item => item && item.id);
    if (list.length === 0) return { ok: true, inventory: null };

    const result = await manager().mutateUserProfileJson(userId, 'inventory', (raw) => {
        let inv = safeParseInventory(raw);
        for (const item of list) {
            inv = addOrStackItem(inv, { ...item, amount: Number(item.amount) || 1 });
        }
        return inv;
    });

    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, inventory: result.value };
}

/**
 * Ambil satu atau beberapa barang dari tas secara atomik.
 *
 * Pemeriksaan jumlah dan pengambilannya terjadi di dalam satu transaksi dengan
 * baris pemain terkunci. Klik kedua menunggu, lalu membaca sisa yang sebenarnya,
 * sehingga satu tiket dungeon tidak bisa dipakai dua kali.
 *
 * @param {string} userId
 * @param {Object|Array<Object>} requests - { id, amount }
 * @returns {Promise<{ ok: boolean, inventory?: Array, reason?: string }>}
 *   reason 'not_enough' berarti barangnya kurang, bukan kegagalan teknis.
 */
async function takeItemsAtomic(userId, requests) {
    const list = toList(requests).filter(item => item && item.id);
    if (list.length === 0) return { ok: true, inventory: null };

    const result = await manager().mutateUserProfileJson(userId, 'inventory', (raw) => {
        let inv = safeParseInventory(raw);
        for (const req of list) {
            const next = takeStack(inv, req.id, req.amount || 1);
            if (next === null) return null; // Batalkan seluruh transaksi.
            inv = next;
        }
        return inv;
    });

    if (result.ok) return { ok: true, inventory: result.value };
    if (result.reason === 'aborted') return { ok: false, reason: 'not_enough' };
    return { ok: false, reason: result.reason };
}

module.exports = {
    safeParseInventory,
    findItem,
    hasItem,
    removeItem,
    addOrStackItem,
    countStack,
    takeStack,
    addItemsAtomic,
    takeItemsAtomic
};
