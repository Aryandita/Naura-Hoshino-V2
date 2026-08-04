'use strict';

// Etalase Naura Coupon milik Gaston, pedagang keliling yang hanya muncul
// sesekali. Dipisah dari shopkeepers.js supaya menambah dagangan kupon tidak
// perlu mengirim ulang seluruh daftar toko desa dan kota.

const { COUPON } = require('./currency');
const { COUPON_ITEMS, getCouponItem } = require('./items_coupon');
const { pickLine, fill } = require('./shopkeepers');

const CATEGORIES = {
    tools: 'Peralatan Obsidian',
    armor: 'Zirah Obsidian',
    special: 'Barang Berkhasiat Khusus',
    booster: 'Penguat Permanen',
    consumable: 'Azimat Sekali Pakai',
    pet_food: 'Telur Legendaris',
    material: 'Bahan Langka'
};

const COUPON_SHOP = {
    key: 'kupon',
    npcId: 'gaston',
    shopName: 'Kios Kupon Keliling Gaston',
    currency: COUPON,
    accentColorHex: '#FBBF24',
    categories: CATEGORIES,
    dialog: {
        greet: [
            'Pssst, {nama}! Ke sini sebentar. Gaston cuma buka kios kalau ada yang bawa kupon asli.',
            'Hoo, {nama} bawa Naura Coupon! Gaston sudah lama menunggu pelanggan yang serius.',
            'Selamat datang di kios rahasia Gaston, {nama}. Barang di sini tidak dijual dengan uang biasa.'
        ],
        browse: [
            'Lihat baik-baik. Semua ini Gaston kumpulkan dari dungeon terdalam, bukan barang pasar.',
            'Kalau kamu ragu, ambil yang murah dulu. Kupon susah dicari, jangan sampai menyesal.',
            'Barang obsidian ini tidak bisa ditempa siapa pun di desa. Cuma Gaston yang punya.'
        ],
        bought: [
            'Hehe, pilihan berani! **{barang}** sekarang milikmu, {nama}. Pakai dengan bijak.',
            'Gaston bungkus rapat-rapat. **{barang}** ini akan mengubah cara kamu bertarung.',
            'Transaksi kupon selesai. Simpan **{barang}** baik-baik, tidak ada gantinya kalau hilang.'
        ],
        broke: [
            'Aduh, {nama}. Kuponmu kurang **{kurang}**. Coba tuntaskan dungeon atau bantu clan dulu.',
            'Kurang **{kurang}** kupon lagi. Gaston tidak menerima Coin untuk barang ini, maaf ya.',
            'Sabar. Kumpulkan **{kurang}** kupon lagi, Gaston simpankan barangnya untukmu.'
        ],
        farewell: [
            'Gaston harus pindah kota lagi. Cari Gaston kalau kuponmu sudah menumpuk, {nama}!',
            'Kios ditutup dulu. Jangan bocorkan lokasi Gaston ke sembarang orang, ya~'
        ]
    }
};

/** Kategori yang benar-benar punya barang, supaya menu tidak pernah kosong. */
function availableCategories() {
    const result = {};
    Object.keys(CATEGORIES).forEach((key) => {
        if (COUPON_ITEMS.some((it) => it.category === key)) result[key] = CATEGORIES[key];
    });
    return result;
}

/** Dagangan kupon per kategori, diurutkan dari yang termurah. */
function stockByCategory(category) {
    return COUPON_ITEMS
        .filter((it) => it.category === category && Number(it.couponPrice) > 0)
        .sort((a, b) => a.couponPrice - b.couponPrice);
}

/** Harga kupon sebuah barang, atau null bila barangnya bukan barang kupon. */
function couponPriceOf(id) {
    const item = getCouponItem(id);
    return item && Number(item.couponPrice) > 0 ? Number(item.couponPrice) : null;
}

function say(kind, vars) {
    return fill(pickLine(COUPON_SHOP.dialog[kind] || []), vars || {});
}

module.exports = {
    COUPON_SHOP,
    CATEGORIES,
    availableCategories,
    stockByCategory,
    couponPriceOf,
    getCouponItem,
    say
};
