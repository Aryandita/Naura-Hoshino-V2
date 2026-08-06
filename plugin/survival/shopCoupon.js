'use strict';

// Etalase Naura Coupon milik Gaston, pedagang keliling yang hanya muncul
// sesekali. Dipisah dari shopkeepers.js supaya menambah dagangan kupon tidak
// perlu mengirim ulang seluruh daftar toko desa dan kota.
//
// Gaston sengaja tidak selalu ada. Setiap hari dalam game dia berpindah ke satu
// lokasi acak dan hanya membuka kios pada rentang jam tertentu. Jadwalnya
// dihitung dari nomor hari, bukan Math.random(), supaya semua pemain di server
// yang sama melihat lokasi yang sama dan kiosnya tidak berpindah setiap kali
// perintah dijalankan.

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

// Lokasi persembunyian Gaston beserta nama tempat yang enak dibaca pemain.
const SPAWN_SPOTS = [
    { key: 'desa', label: 'Desa', spot: 'balik gudang padi' },
    { key: 'kota', label: 'Kota', spot: 'gang sempit belakang butik' },
    { key: 'hutan', label: 'Hutan', spot: 'bawah pohon beringin tua' },
    { key: 'tambang', label: 'Tambang', spot: 'mulut lorong yang sudah ditinggalkan' },
    { key: 'pantai', label: 'Pantai', spot: 'dekat perahu yang terbalik' },
    { key: 'laut', label: 'Laut', spot: 'atas rakit kayu berlampu badai' },
    { key: 'sawah', label: 'Sawah', spot: 'gubuk pengairan di pematang' },
    { key: 'jalanan', label: 'Jalanan', spot: 'trotoar di bawah jembatan' }
];

// Jendela buka. Gaston tidak pernah berjualan sepanjang hari.
const SPAWN_WINDOWS = [
    { startHour: 5, endHour: 9, label: 'pagi buta' },
    { startHour: 9, endHour: 13, label: 'menjelang siang' },
    { startHour: 13, endHour: 17, label: 'sore hari' },
    { startHour: 17, endHour: 21, label: 'senja' },
    { startHour: 21, endHour: 24, label: 'larut malam' }
];

// Lokasi yang secara efektif dianggap sama dengan lokasi utama, mengikuti alias
// yang dipakai shopkeepers.js dan currency.js.
const LOCATION_ALIAS = {
    village: 'desa',
    city: 'kota',
    academy: 'kota',
    gunung: 'hutan'
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

/** Pengacak sederhana yang hasilnya tetap untuk nomor hari yang sama. */
function hashDay(day, salt) {
    let value = (Number(day) || 1) * 2654435761 + salt * 40503;
    value ^= value >>> 13;
    value = (value * 1274126177) >>> 0;
    return value;
}

/** Samakan penamaan lokasi supaya alias tidak dianggap tempat berbeda. */
function normalizeLocation(location) {
    const key = String(location || '').toLowerCase();
    return LOCATION_ALIAS[key] || key;
}

/**
 * Jadwal Gaston pada hari tertentu: di mana dia berdiri dan jam berapa kiosnya
 * buka. Selalu memulangkan objek, jadi pemanggil tidak perlu memeriksa null.
 */
function spawnOf(day) {
    const spot = SPAWN_SPOTS[hashDay(day, 7) % SPAWN_SPOTS.length];
    const window = SPAWN_WINDOWS[hashDay(day, 19) % SPAWN_WINDOWS.length];
    return {
        location: spot.key,
        locationLabel: spot.label,
        spot: spot.spot,
        startHour: window.startHour,
        endHour: window.endHour,
        windowLabel: window.label
    };
}

/** Apakah kios Gaston benar-benar bisa dibuka di sini dan sekarang. */
function isOpen(location, day, hour) {
    const schedule = spawnOf(day);
    const now = Number(hour) || 0;
    return normalizeLocation(location) === schedule.location
        && now >= schedule.startHour
        && now < schedule.endHour;
}

/** Kalimat petunjuk untuk pemain yang belum menemukan Gaston hari ini. */
function rumor(day) {
    const schedule = spawnOf(day);
    return `Kata orang, Gaston si pedagang kupon sedang menggelar tikar di **${schedule.locationLabel}**, ${schedule.spot}, dari jam **${schedule.startHour}.00 sampai ${schedule.endHour}.00** \u2014 pas ${schedule.windowLabel}.`;
}

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
    SPAWN_SPOTS,
    SPAWN_WINDOWS,
    normalizeLocation,
    spawnOf,
    isOpen,
    rumor,
    availableCategories,
    stockByCategory,
    couponPriceOf,
    getCouponItem,
    say
};
