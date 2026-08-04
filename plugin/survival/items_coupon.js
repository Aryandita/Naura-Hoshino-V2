'use strict';

// Barang eksklusif Naura Coupon.
// Semua barang di sini memakai `price: 0` supaya tidak pernah bocor ke toko
// biasa (filter toko mensyaratkan harga > 0), dan dijual hanya lewat etalase
// kupon dengan `couponPrice`.
const COUPON_ITEMS = [
    // ===== BAHAN =====
    {
        id: 'obsidian_shard',
        name: 'Serpih Obsidian',
        description: 'Pecahan kaca vulkanik hitam yang tajamnya tidak pernah tumpul. Bahan dasar seluruh peralatan obsidian.',
        price: 0,
        couponPrice: 2,
        sellPrice: 4000,
        category: 'material',
        rarity: 'Legendary',
        currency: 'coupon'
    },

    // ===== PERALATAN OBSIDIAN =====
    {
        id: 'obsidian_pickaxe',
        name: 'Beliung Obsidian',
        description: 'Menembus lapisan batu terdalam seperti menyibak air. Hasil tambang meningkat drastis dan hampir tidak pernah gagal.',
        price: 0,
        couponPrice: 15,
        sellPrice: 60000,
        category: 'tools',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { base_efficiency: 60, durability: 500 }
    },
    {
        id: 'obsidian_axe',
        name: 'Kapak Obsidian',
        description: 'Satu tebasan cukup untuk menumbangkan pohon tertua di hutan. Gagangnya tetap dingin walau dipakai berjam-jam.',
        price: 0,
        couponPrice: 15,
        sellPrice: 60000,
        category: 'tools',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { base_efficiency: 60, durability: 500 }
    },
    {
        id: 'obsidian_sword',
        name: 'Pedang Obsidian',
        description: 'Bilah hitam yang menyerap cahaya. Monster tingkat dungeon pun mundur begitu melihat kilaunya.',
        price: 0,
        couponPrice: 20,
        sellPrice: 80000,
        category: 'tools',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { base_damage: 120, durability: 500 }
    },
    {
        id: 'obsidian_bow',
        name: 'Busur Obsidian',
        description: 'Anak panahnya berdesing tanpa suara dan tidak pernah melenceng. Favorit para Ranger sejati.',
        price: 0,
        couponPrice: 18,
        sellPrice: 72000,
        category: 'tools',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { base_damage: 95, durability: 450 }
    },
    {
        id: 'obsidian_rod',
        name: 'Pancing Obsidian',
        description: 'Kailnya menarik ikan legendaris dari dasar laut terdalam. Sabar sedikit, hasilnya luar biasa.',
        price: 0,
        couponPrice: 14,
        sellPrice: 56000,
        category: 'tools',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { base_efficiency: 55, durability: 400 }
    },

    // ===== ARMOR OBSIDIAN =====
    {
        id: 'obsidian_helmet',
        name: 'Helm Obsidian',
        description: 'Melindungi kepala dari pukulan paling brutal. Bagian dari set armor obsidian.',
        price: 0,
        couponPrice: 12,
        sellPrice: 48000,
        category: 'armor',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { defense: 40, set: 'obsidian' }
    },
    {
        id: 'obsidian_chestplate',
        name: 'Zirah Obsidian',
        description: 'Ringan di badan, namun serangan naga pun hanya menggores permukaannya.',
        price: 0,
        couponPrice: 20,
        sellPrice: 80000,
        category: 'armor',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { defense: 80, set: 'obsidian' }
    },
    {
        id: 'obsidian_boots',
        name: 'Sepatu Obsidian',
        description: 'Membuat langkahmu tidak bersuara dan tidak pernah lelah menempuh perjalanan jauh.',
        price: 0,
        couponPrice: 10,
        sellPrice: 40000,
        category: 'armor',
        rarity: 'Mythic',
        currency: 'coupon',
        attributes: { defense: 30, agility: 5, set: 'obsidian' }
    },

    // ===== BARANG BERKHASIAT KHUSUS =====
    {
        id: 'diamond_ring',
        name: 'Cincin Berlian',
        description: 'Cincin yang berkilau menyilaukan. Begitu dipakaikan, hati kekasihmu langsung terbuka sepenuhnya dan kalian bisa menikah saat itu juga.',
        price: 0,
        couponPrice: 25,
        sellPrice: 100000,
        category: 'special',
        rarity: 'Mythic',
        currency: 'coupon',
        effect: 'max_romance'
    },
    {
        id: 'luck_crown',
        name: 'Mahkota Keberuntungan',
        description: 'Mahkota yang dirajut dari bintang jatuh. Menaikkan LUCK sebesar 80% secara permanen, sekali pakai selamanya.',
        price: 0,
        couponPrice: 30,
        sellPrice: 120000,
        category: 'special',
        rarity: 'Mythic',
        currency: 'coupon',
        effect: 'luck_crown'
    },
    {
        id: 'midas_gloves',
        name: 'Sarung Tangan Midas',
        description: 'Segala yang kamu jual terasa lebih bernilai. Harga jual seluruh barangmu naik 50% secara permanen.',
        price: 0,
        couponPrice: 22,
        sellPrice: 88000,
        category: 'booster',
        rarity: 'Mythic',
        currency: 'coupon',
        effect: 'midas_gloves'
    },
    {
        id: 'void_backpack',
        name: 'Tas Ruang Hampa',
        description: 'Isinya seakan tanpa dasar. Kapasitas tas bertambah jauh dan barangmu tidak pernah tertinggal lagi.',
        price: 0,
        couponPrice: 14,
        sellPrice: 56000,
        category: 'booster',
        rarity: 'Legendary',
        currency: 'coupon',
        effect: 'void_backpack'
    },
    {
        id: 'star_compass',
        name: 'Kompas Bintang',
        description: 'Menunjuk jalan tersingkat ke mana pun. Perjalanan antarwilayah jadi gratis dan tidak menguras stamina.',
        price: 0,
        couponPrice: 12,
        sellPrice: 48000,
        category: 'booster',
        rarity: 'Legendary',
        currency: 'coupon',
        effect: 'star_compass'
    },
    {
        id: 'memory_album',
        name: 'Album Kenangan Naura',
        description: 'Album bersampul kain lembut untuk menyimpan foto kebersamaanmu dengan para NPC. Foto yang tersimpan bisa dilihat kapan pun kamu mau.',
        price: 0,
        couponPrice: 8,
        sellPrice: 32000,
        category: 'special',
        rarity: 'Legendary',
        currency: 'coupon',
        effect: 'memory_album'
    },
    {
        id: 'phoenix_charm',
        name: 'Azimat Phoenix',
        description: 'Bila kamu tumbang, azimat ini membangkitkanmu satu kali dengan HP penuh. Sekali terpakai, ia berubah jadi abu.',
        price: 0,
        couponPrice: 6,
        sellPrice: 24000,
        category: 'consumable',
        rarity: 'Legendary',
        currency: 'coupon',
        effect: 'phoenix_charm'
    },
    {
        id: 'eternal_pet_egg',
        name: 'Telur Abadi',
        description: 'Telur berkilau yang menetaskan hewan peliharaan tingkat legenda. Kesetiaannya tidak pernah berkurang.',
        price: 0,
        couponPrice: 18,
        sellPrice: 72000,
        category: 'pet_food',
        rarity: 'Mythic',
        currency: 'coupon',
        effect: 'eternal_pet_egg'
    }
];

const COUPON_ITEM_IDS = COUPON_ITEMS.map(it => it.id);

function getCouponItem(id) {
    return COUPON_ITEMS.find(it => it.id === id) || null;
}

function isCouponItem(id) {
    return COUPON_ITEM_IDS.includes(id);
}

module.exports = { COUPON_ITEMS, COUPON_ITEM_IDS, getCouponItem, isCouponItem };
