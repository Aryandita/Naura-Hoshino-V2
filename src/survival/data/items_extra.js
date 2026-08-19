"use strict";

// Katalog tambahan supaya barang di Shop/Market tidak itu-itu saja.
// Sengaja dipisah dari items_static.js agar berkasnya tetap kecil dan mudah
// dirawat. Semua entri memakai bentuk datar yang sama seperti hasil pemetaan
// GameItem, jadi bisa langsung dipakai subcommand tanpa penyesuaian.
//
// Rentang harga dijaga agar berjenjang dengan alat yang sudah ada:
// kayu (700-900) -> batu/tembaga (1.400-2.600) -> besi (3.000-5.000)
// -> perak/baja (8.000-15.000) -> titanium/diamond (25.000+)

module.exports = [
  // ===== ITEM EVENT MUSIMAN (SEASONAL) =====
  // ===== ITEM KOSMETIK (BANNER GACHA) =====
  {
    id: "banner_sakura",
    name: "Sakura Blossom Banner",
    description: "Banner kosmetik dengan nuansa bunga sakura yang gugur.",
    price: 0,
    sellPrice: 100,
    category: "cosmetic",
    rarity: "Langka",
  },
  {
    id: "banner_ocean",
    name: "Deep Ocean Banner",
    description: "Banner kosmetik dengan pemandangan bawah laut yang tenang.",
    price: 0,
    sellPrice: 100,
    category: "cosmetic",
    rarity: "Langka",
  },
  {
    id: "banner_cyber",
    name: "Cyberpunk City Banner",
    description: "Banner kosmetik dengan nuansa neon kota futuristik.",
    price: 0,
    sellPrice: 250,
    category: "cosmetic",
    rarity: "Epik",
  },
  {
    id: "banner_galaxy",
    name: "Galaxy Space Banner",
    description: "Banner kosmetik yang menampilkan keindahan luar angkasa.",
    price: 0,
    sellPrice: 500,
    category: "cosmetic",
    rarity: "Legendaris",
  },
  {
    id: "banner_naura_vip",
    name: "Naura VIP Gold Banner",
    description: "Banner kosmetik emas yang sangat langka dan mewah.",
    price: 0,
    sellPrice: 1500,
    category: "cosmetic",
    rarity: "Mythic",
  },
  {
    id: "bendera_merah_putih",
    name: "Bendera Merah Putih",
    description: "Kain dua warna yang berkibar gagah. Bisa ditukarkan ke NPC Spesial Kemerdekaan!",
    price: 0,
    sellPrice: 50,
    category: "materials",
    rarity: "Event",
  },
  {
    id: "ketupat",
    name: "Ketupat Lebaran",
    description: "Beras yang dibungkus anyaman daun kelapa. Kumpulkan untuk ditukar saat Lebaran tiba!",
    price: 0,
    sellPrice: 10,
    category: "consumable",
    rarity: "Event",
  },
  {
    id: "opor_ayam",
    name: "Opor Ayam Spesial",
    description: "Makanan khas Idul Fitri yang sangat lezat. Memulihkan energi secara penuh!",
    price: 0,
    sellPrice: 500,
    category: "consumable",
    effects: { hunger: 100, stamina: 100 },
    rarity: "Event",
  },
  {
    id: "birthday_cake",
    name: "Kue Ulang Tahun",
    description: "Kue manis dengan lilin. Hadiah khusus di hari ulang tahun Naura!",
    price: 0,
    sellPrice: 200,
    category: "consumable",
    effects: { hunger: 50, stamina: 50 },
    rarity: "Event",
  },
  {
    id: "firework",
    name: "Kembang Api",
    description: "Benda yang akan meledak indah di langit malam Tahun Baru.",
    price: 0,
    sellPrice: 100,
    category: "materials",
    rarity: "Event",
  },

  // ===== ALAT MENEBANG =====
  {
    id: "stone_axe",
    name: "Kapak Batu (Lv. 2)",
    description:
      "Lebih berat dari kapak kayu, tapi jauh lebih awet. Hati-hati pegangnya yaa!",
    price: 1600,
    sellPrice: 640,
    category: "tools",
    upgrade_level: 2,
    base_efficiency: 16,
    rarity: "Biasa",
  },
  {
    id: "silver_axe",
    name: "Kapak Perak (Lv. 4)",
    description:
      "Mata kapaknya berkilau. Kayu keras pun rasanya seperti mentega.",
    price: 12000,
    sellPrice: 4800,
    category: "tools",
    upgrade_level: 4,
    base_efficiency: 48,
    rarity: "Langka",
  },

  // ===== ALAT MENAMBANG =====
  {
    id: "stone_pickaxe",
    name: "Beliung Batu (Lv. 2)",
    description:
      "Naik kelas dari kayu. Sudah sanggup memecah bijih besi tipis.",
    price: 1400,
    sellPrice: 560,
    category: "tools",
    upgrade_level: 2,
    base_efficiency: 15,
    rarity: "Biasa",
  },
  {
    id: "iron_pickaxe",
    name: "Beliung Besi (Lv. 3)",
    description: "Beliung andalan penambang desa. Kuat, murah, nggak rewel.",
    price: 4500,
    sellPrice: 1800,
    category: "tools",
    upgrade_level: 3,
    base_efficiency: 30,
    rarity: "Langka",
  },
  {
    id: "mythril_pickaxe",
    name: "Beliung Mythril (Lv. 5)",
    description:
      "Ringan seperti kapas tapi menembus batu apa saja. Naura sampai kagum.",
    price: 40000,
    sellPrice: 16000,
    category: "tools",
    upgrade_level: 5,
    base_efficiency: 85,
    rarity: "Epic",
  },

  // ===== SENJATA =====
  {
    id: "stone_sword",
    name: "Pedang Batu (Lv. 2)",
    description: "Tumpul tapi menyakitkan. Cukup buat slime dan goblin kecil.",
    price: 1800,
    sellPrice: 720,
    category: "tools",
    upgrade_level: 2,
    base_damage: 16,
    rarity: "Biasa",
  },
  {
    id: "silver_rapier",
    name: "Rapier Perak (Lv. 4)",
    description: "Tipis, cepat, dan sangat efektif melawan makhluk kutukan.",
    price: 22000,
    sellPrice: 8800,
    category: "tools",
    upgrade_level: 4,
    base_damage: 45,
    rarity: "Langka",
  },
  {
    id: "war_hammer",
    name: "Godam Perang",
    description:
      "Berat sekali! Tapi kalau kena, musuhnya langsung terpelanting.",
    price: 30000,
    sellPrice: 12000,
    category: "tools",
    upgrade_level: 4,
    base_damage: 55,
    rarity: "Langka",
  },
  {
    id: "hunting_bow",
    name: "Busur Pemburu",
    description:
      "Senjata pilihan para Ranger. Menyerang dari jauh itu lebih aman, kan?",
    price: 9000,
    sellPrice: 3600,
    category: "tools",
    upgrade_level: 3,
    base_damage: 28,
    rarity: "Langka",
  },
  {
    id: "apprentice_staff",
    name: "Tongkat Murid Sihir",
    description:
      "Tongkat pertama para Mage. Ujungnya kadang berpercik sendiri, hehe.",
    price: 8500,
    sellPrice: 3400,
    category: "tools",
    upgrade_level: 3,
    base_damage: 26,
    rarity: "Langka",
  },

  // ===== ALAT PENDUKUNG =====
  {
    id: "bamboo_rod",
    name: "Pancing Bambu",
    description:
      "Pancing sederhana buatan sendiri. Sabar sedikit, pasti dapat ikan.",
    price: 600,
    sellPrice: 240,
    category: "tools",
    upgrade_level: 1,
    base_efficiency: 6,
    rarity: "Biasa",
  },
  {
    id: "pro_fishing_rod",
    name: "Pancing Profesional (Lv. 3)",
    description:
      "Katrolnya halus banget. Ikan besar jadi lebih sering nyangkut.",
    price: 15000,
    sellPrice: 6000,
    category: "tools",
    upgrade_level: 3,
    base_efficiency: 40,
    rarity: "Langka",
  },
  {
    id: "watering_can",
    name: "Gembor Air",
    description: "Menyiram tanaman jadi lebih cepat. Ladangmu pasti senang.",
    price: 1200,
    sellPrice: 480,
    category: "tools",
    base_efficiency: 12,
    rarity: "Biasa",
  },
  {
    id: "sickle",
    name: "Arit Panen",
    description:
      "Memanen gandum tanpa pegal tangan. Naura sudah coba, enak dipakai!",
    price: 2200,
    sellPrice: 880,
    category: "tools",
    base_efficiency: 18,
    rarity: "Biasa",
  },

  // ===== BOOSTER =====
  {
    id: "sturdy_backpack",
    name: "Tas Gunung Kokoh",
    description:
      "Muat lebih banyak barang hasil jelajah. Talinya nyaman di pundak.",
    price: 6500,
    sellPrice: 2600,
    category: "booster",
    multiplier: 1.3,
    rarity: "Langka",
  },
  {
    id: "miners_lamp",
    name: "Lampu Karbit Penambang",
    description: "Gua gelap jadi terang. Naura nggak suka gelap-gelapan, sih.",
    price: 3500,
    sellPrice: 1400,
    category: "booster",
    multiplier: 1.25,
    rarity: "Langka",
  },
  {
    id: "leather_gloves",
    name: "Sarung Tangan Kulit",
    description:
      "Melindungi tangan dari lecet, sekalian bikin pegangan lebih kuat.",
    price: 2600,
    sellPrice: 1040,
    category: "booster",
    multiplier: 1.2,
    rarity: "Biasa",
  },
  {
    id: "rain_coat",
    name: "Mantel Hujan",
    description:
      "Biar tetap bisa kerja walau hujan deras. Jangan sampai masuk angin yaa!",
    price: 4200,
    sellPrice: 1680,
    category: "booster",
    multiplier: 1.15,
    rarity: "Biasa",
  },
  {
    id: "four_leaf_clover",
    name: "Klover Empat Daun",
    description:
      "Naura temukan ini di belakang rumah. Katanya bikin hoki, lho!",
    price: 18000,
    sellPrice: 7200,
    category: "booster",
    multiplier: 1.6,
    rarity: "Epic",
  },

  // ===== KONSUMSI =====
  {
    id: "coconut_water",
    name: "Air Kelapa Muda",
    description: "Segar banget diminum siang-siang. Dahaga langsung hilang.",
    price: 250,
    sellPrice: 100,
    category: "consumable",
    effects: { thirst: 40, stamina: 10 },
    rarity: "Biasa",
  },
  {
    id: "nasi_bungkus",
    name: "Nasi Bungkus Warung",
    description: "Porsinya banyak dan murah. Menu wajib petualang hemat.",
    price: 500,
    sellPrice: 200,
    category: "consumable",
    effects: { hunger: 45, stamina: 15 },
    rarity: "Biasa",
  },
  {
    id: "grilled_corn",
    name: "Jagung Bakar",
    description:
      "Manis dan sedikit gurih. Naura bakarkan khusus buat kamu, hehe.",
    price: 400,
    sellPrice: 160,
    category: "consumable",
    effects: { hunger: 30, stamina: 12 },
    rarity: "Biasa",
  },
  {
    id: "ginger_milk",
    name: "Susu Jahe Hangat",
    description:
      "Menghangatkan badan dan memulihkan tenaga. Minum pelan-pelan yaa.",
    price: 900,
    sellPrice: 360,
    category: "consumable",
    effects: { hunger: 15, thirst: 20, stamina: 30 },
    rarity: "Biasa",
  },
  {
    id: "stamina_tonic",
    name: "Tonik Stamina",
    description: "Rasanya agak aneh, tapi tenaganya balik penuh dalam sekejap.",
    price: 3000,
    sellPrice: 1200,
    category: "consumable",
    effects: { stamina: 70 },
    rarity: "Langka",
  },

  // ===== MATERIAL =====
  {
    id: "copper_ore",
    name: "Bijih Tembaga",
    description:
      "Bahan dasar peralatan tingkat awal. Sering ditemukan dekat permukaan.",
    price: 220,
    sellPrice: 110,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "coal",
    name: "Bongkahan Batu Bara",
    description:
      "Bahan bakar tungku pandai besi. Tangannya jadi hitam, tapi berguna!",
    price: 180,
    sellPrice: 90,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "leather",
    name: "Lembar Kulit",
    description: "Hasil olahan kulit binatang buruan. Lentur dan tahan lama.",
    price: 350,
    sellPrice: 175,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "glass_shard",
    name: "Pecahan Kaca Pantai",
    description:
      "Halus di ujungnya. Bisa dilebur jadi barang kerajinan cantik.",
    price: 300,
    sellPrice: 150,
    category: "material",
    rarity: "Biasa",
  },

  // ===== DEKORASI =====
  {
    id: "deco_potted_plant",
    name: "Tanaman Hias Pot",
    description: "Bikin rumah terasa lebih hidup. Jangan lupa disiram yaa!",
    price: 3000,
    sellPrice: 1200,
    category: "decoration",
    rarity: "Biasa",
  },
  {
    id: "deco_warm_lamp",
    name: "Lampu Tidur Hangat",
    description: "Cahayanya redup dan menenangkan. Tidurmu pasti lebih nyaman.",
    price: 7500,
    sellPrice: 3000,
    category: "decoration",
    rarity: "Langka",
  },
  {
    id: "deco_bath_tub",
    name: "Bak Mandi Berendam",
    description: "Berendam setelah menambang seharian itu nikmat banget, lho.",
    price: 26000,
    sellPrice: 10400,
    category: "decoration",
    rarity: "Langka",
  },
];
