"use strict";

// Bahan hasil olahan. Nilainya sengaja jauh di atas bahan mentahnya supaya
// mampir ke tungku Bagas selalu menguntungkan.
//
// Contoh selisih: bijih besi mentah 400 -> Batangan Besi 1.400 (3,5x).
// Resep dan biaya peleburannya diatur di craftingRecipes.js.

module.exports = [
  // ===== BATANGAN LOGAM =====
  {
    id: "copper_ingot",
    name: "Batangan Tembaga",
    description:
      "Tembaga murni hasil leburan. Warnanya kemerahan dan hangat disentuh.",
    price: 700,
    sellPrice: 420,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "iron_ingot",
    name: "Batangan Besi",
    description:
      "Besi murni tanpa kotoran batu. Bahan wajib naik level alat besi.",
    price: 1400,
    sellPrice: 840,
    category: "material",
    rarity: "Langka",
  },
  {
    id: "steel_ingot",
    name: "Batangan Baja",
    description:
      "Besi yang dilebur ulang bersama batu bara. Jauh lebih liat dan tahan.",
    price: 3800,
    sellPrice: 2280,
    category: "material",
    rarity: "Langka",
  },
  {
    id: "silver_ingot",
    name: "Batangan Perak",
    description:
      "Berkilau sampai memantulkan wajah. Ampuh melawan makhluk kutukan.",
    price: 6500,
    sellPrice: 3900,
    category: "material",
    rarity: "Langka",
  },
  {
    id: "mythril_ingot",
    name: "Batangan Mythril",
    description:
      "Ringan, biru pucat, dan berdenyut pelan. Naura merasakan sihirnya.",
    price: 16000,
    sellPrice: 9600,
    category: "material",
    rarity: "Epic",
  },
  {
    id: "titanium_ingot",
    name: "Batangan Titanium",
    description: "Sangat sulit dilebur. Hanya tungku terpanas yang sanggup.",
    price: 24000,
    sellPrice: 14400,
    category: "material",
    rarity: "Epic",
  },

  // ===== OLAHAN NON-LOGAM =====
  {
    id: "charcoal",
    name: "Arang Kayu",
    description:
      "Kayu yang dibakar perlahan. Bahan bakar tungku yang murah meriah.",
    price: 320,
    sellPrice: 192,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "tanned_leather",
    name: "Kulit Tersamak",
    description:
      "Kulit yang sudah diolah dan diminyaki. Lentur, kuat, tidak bau lagi.",
    price: 1100,
    sellPrice: 660,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "glass_pane",
    name: "Lembaran Kaca",
    description:
      "Pecahan kaca pantai yang dilebur jadi lembaran bening. Cantik, lho!",
    price: 950,
    sellPrice: 570,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "polished_diamond",
    name: "Diamond Terasah",
    description:
      "Sudut-sudutnya diasah sempurna sampai memecah cahaya jadi warna.",
    price: 38000,
    sellPrice: 22800,
    category: "material",
    rarity: "Legendary",
  },
  {
    id: "refined_naura_shard",
    name: "Serpih Naura Murni",
    description:
      "Serpih Naura yang disucikan. Menghangatkan tangan yang memegangnya.",
    price: 45000,
    sellPrice: 27000,
    category: "material",
    rarity: "Legendary",
  },

  // ===== BAHAN INTI UNTUK NAIK LEVEL ALAT =====
  // Setiap jenis bahan alat punya bahan intinya sendiri.
  {
    id: "wood_log",
    name: "Gelondong Kayu",
    description:
      "Batang utuh yang belum dibelah. Inti penguat semua alat kayu.",
    price: 900,
    sellPrice: 540,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "stone_slab",
    name: "Lempeng Batu Padat",
    description: "Batu yang dipahat rata. Inti penguat semua alat batu.",
    price: 1500,
    sellPrice: 900,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "whetstone",
    name: "Batu Asah",
    description:
      "Menajamkan mata alat sebelum ditempa ulang. Bahan pendamping wajib.",
    price: 600,
    sellPrice: 360,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "tool_grease",
    name: "Gemuk Pelumas",
    description: "Melumasi sambungan alat biar tidak macet setelah ditempa.",
    price: 800,
    sellPrice: 480,
    category: "material",
    rarity: "Biasa",
  },
  {
    id: "forge_blueprint",
    name: "Cetak Biru Tempa",
    description:
      "Catatan tangan Bagas. Wajib ada untuk menempa alat tingkat tinggi.",
    price: 5000,
    sellPrice: 3000,
    category: "material",
    rarity: "Langka",
  },
  {
    id: "mana_crystal",
    name: "Kristal Mana",
    description:
      "Menyalurkan sihir ke dalam logam. Dipakai alat mythril ke atas.",
    price: 12000,
    sellPrice: 7200,
    category: "material",
    rarity: "Epic",
  },
];
