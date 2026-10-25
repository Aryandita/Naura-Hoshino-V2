"use strict";

/**
 * Data Terpadu Peta Dunia Adisha (Survival World / Naura Wilds)
 *
 * Mengintegrasikan 7 Wilayah Besar (termasuk Kawasan Tambang Raksasa & Kampus Universitas Draken),
 * seluruh Sub-Daerah (Roam Locations / POIs), Showroom Dealer Motor per wilayah dengan efek buff
 * permanen & temporer, serta sistem jual-beli kendaraan (1 kendaraan per user, refund 70%).
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. Katalog Motor & Kendaraan Adisha (Universal Showroom Data)
// ═══════════════════════════════════════════════════════════════════════════
const ADISHA_VEHICLES = {
  motor_bebek_sukamaju: {
    id: "motor_bebek_sukamaju",
    name: "Bebek Trail Sukamaju 125cc",
    vehicleType: "Motor Bebek Petualang",
    locationOrigin: "desa_sukamaju",
    dealerLocationId: "dealer_sukamaju",
    price: 350,
    currency: "SC",
    resalePercent: 70, // Dijual kembali seharga 70% (~245 SC)
    icon: "🛵",
    description: "Motor bebek tangguh serbaguna dengan ban pacul ganda, siap melibas jalanan tanah pedesaan dan tanjakan terjal.",
    permanentBuffs: {
      staminaDiscountPercent: 25,
      strengthBonus: 2,
      description: "Diskon 25% stamina jelajah (Roam), +2 Strength fisik.",
    },
    temporaryBuff: {
      name: "Semangat Panen Raya",
      durationMinutes: 60,
      description: "+15% efisiensi stamina saat menjelajah di siang hari.",
    },
    canAccessColossalMines: true,
  },

  motor_neo_pratama: {
    id: "motor_neo_pratama",
    name: "Neo-Cyber Scrambler 250cc",
    vehicleType: "Cyber Scrambler Futuristik",
    locationOrigin: "kota_pratama",
    dealerLocationId: "dealer_pratama",
    price: 450,
    currency: "PD",
    resalePercent: 70, // Dijual kembali seharga 70% (~315 PD)
    icon: "🏍️",
    description: "Motor sport bertenaga tinggi dengan rangka titanium ringan dan panel speedometer holografis modern.",
    permanentBuffs: {
      staminaDiscountPercent: 40,
      intelligenceBonus: 3,
      charismaBonus: 2,
      description: "Diskon 40% stamina jelajah (Roam), +3 Intelligence, +2 Charisma.",
    },
    temporaryBuff: {
      name: "Turbo Boost Neon",
      durationMinutes: 60,
      description: "Diskon 10% saat berbelanja di toko modern perkotaan.",
    },
    canAccessColossalMines: true,
  },

  motor_gletser_khulkhas: {
    id: "motor_gletser_khulkhas",
    name: "Gletser Snow-Cruiser 300cc",
    vehicleType: "All-Terrain Snow Scrambler",
    locationOrigin: "desa_khulkhas",
    dealerLocationId: "dealer_khulkhas",
    price: 550,
    currency: "SC",
    resalePercent: 70, // Dijual kembali seharga 70% (~385 SC)
    icon: "❄️",
    description: "Motor berselimut penghangat hidrotermal dengan tapak ban bergerigi es untuk menaklukkan puncak gletser beku.",
    permanentBuffs: {
      staminaDiscountPercent: 35,
      strengthBonus: 3,
      agilityBonus: 2,
      description: "Diskon 35% stamina jelajah, kebal cuaca beku, +3 Strength, +2 Agility.",
    },
    temporaryBuff: {
      name: "Resistensi Salju Abadi",
      durationMinutes: 60,
      description: "Stamina tidak terkuras oleh efek dingin ekstrim pegunungan.",
    },
    canAccessColossalMines: true,
  },

  motor_enduro_dhamhai: {
    id: "motor_enduro_dhamhai",
    name: "Dha Mhai Wild Enduro 250cc",
    vehicleType: "Rimba Enduro Beast",
    locationOrigin: "hutan_dha_mhai",
    dealerLocationId: "dealer_dhamhai",
    price: 500,
    currency: "SC",
    resalePercent: 70, // Dijual kembali seharga 70% (~350 SC)
    icon: "🌲",
    description: "Motor trail suspensi tinggi yang lincah menembus lebatnya kanopi akar dan rintangan rawa rimba purba.",
    permanentBuffs: {
      staminaDiscountPercent: 35,
      agilityBonus: 3,
      strengthBonus: 2,
      description: "Diskon 35% stamina jelajah, +3 Agility, +2 Strength.",
    },
    temporaryBuff: {
      name: "Insting Rimba Purba",
      durationMinutes: 60,
      description: "Peluang menemukan bahan herbal atau getah damar saat menjelajah.",
    },
    canAccessColossalMines: true,
  },

  motor_wave_lauhthan: {
    id: "motor_wave_lauhthan",
    name: "Wave Runner Coastal 175cc",
    vehicleType: "Coastal Cruiser Maritim",
    locationOrigin: "desa_lauh_than",
    dealerLocationId: "dealer_lauhthan",
    price: 400,
    currency: "SC",
    resalePercent: 70, // Dijual kembali seharga 70% (~280 SC)
    icon: "🌊",
    description: "Motor bergaya retro pesisir dengan pelapis bodi anti-garam dan bagasi samping jaring nelayan.",
    permanentBuffs: {
      staminaDiscountPercent: 30,
      agilityBonus: 2,
      charismaBonus: 2,
      description: "Diskon 30% stamina jelajah, +2 Agility, +2 Charisma.",
    },
    temporaryBuff: {
      name: "Angin Bahari Segar",
      durationMinutes: 60,
      description: "Tingkat kehausan (Thirst) berkurang 30% lebih lambat.",
    },
    canAccessColossalMines: true,
  },

  motor_astral_draken: {
    id: "motor_astral_draken",
    name: "Astral Scholar E-Bike 400cc",
    vehicleType: "Hyper Electric Vehicle Mahasiswa",
    locationOrigin: "kampus_draken",
    dealerLocationId: "dealer_draken",
    price: 5,
    currency: "VB",
    resalePercent: 70, // Dijual kembali seharga 70% (3.5 -> 4 VB)
    icon: "⚡",
    description: "Motor listrik astral super hening berteknologi rektorat Draken, ditenagai sel surya kristal tanpa emisi.",
    permanentBuffs: {
      staminaDiscountPercent: 50,
      intelligenceBonus: 5,
      charismaBonus: 3,
      description: "Diskon 50% stamina jelajah (Roam), +5 Intelligence, +3 Charisma.",
    },
    temporaryBuff: {
      name: "Aura Beasiswa Berprestasi",
      durationMinutes: 60,
      description: "+25% bonus EXP dari segala pekerjaan dan riset akademik.",
    },
    canAccessColossalMines: true,
  },

  motor_trike_tambang: {
    id: "motor_trike_tambang",
    name: "Colossal Quarry Heavy Trike 500cc",
    vehicleType: "Heavy Duty Three-Wheeler",
    locationOrigin: "tambang_raksasa",
    dealerLocationId: "dealer_tambang",
    price: 800,
    currency: "SC",
    resalePercent: 70, // Dijual kembali seharga 70% (~560 SC)
    icon: "🚜",
    description: "Kendaraan roda tiga raksasa berlapis baja tebal penahan reruntuhan batu, dilengkapi keranjang muatan bijih emas.",
    permanentBuffs: {
      staminaDiscountPercent: 45,
      strengthBonus: 5,
      intelligenceBonus: 3,
      description: "Diskon 45% stamina jelajah, +5 Strength, +3 Intelligence.",
    },
    temporaryBuff: {
      name: "Daya Gempur Mandor Tambang",
      durationMinutes: 60,
      description: "+20% bonus penghasilan dari pekerjaan tambang dan peleburan emas.",
    },
    canAccessColossalMines: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. Data Wilayah Utama Benua Adisha (7 Wilayah Besar)
// ═══════════════════════════════════════════════════════════════════════════
const ADISHA_REGIONS = {
  desa_sukamaju: {
    id: "desa_sukamaju",
    aliases: ["desa", "village", "sukamaju", "desa_pemula"],
    name: "Desa Sukamaju",
    title: "Lembah Permata & Ekosistem Awal Terpadu",
    currency: "SC",
    currencyName: "Sukamaju Koin (SC)",
    currencyCode: "sukamajuCoins",
    themeColor: "#10B981",
    glowColor: "rgba(16, 185, 129, 0.4)",
    bgImage: "/assets/survival/background/desa_siang.jpeg",
    dangerLevel: "Aman (Lv. 1 - 10)",
    description:
      "Desa asri yang menyatukan kawasan pemukiman warga, ladang kebun botani, pesisir nelayan, showroom motor petani, dan warung tradisional.",
    mapCenter: { x: 26, y: 58 },
    locations: {
      warung: {
        id: "warung",
        name: "Warung Bu Yati",
        category: "shop",
        icon: "fa-solid fa-utensils",
        coords: { x: 24, y: 55 },
        roamCost: 5,
        workAvailable: false,
        description: "Aroma nasi goreng rempah dan kopi hangat menyambutmu di warung sederhana yang nyaman.",
        shopItems: [
          { itemId: "nasi_goreng", name: "Nasi Goreng Kampung", price: 15, currency: "SC", restores: { stamina: 20, hunger: 30, thirst: 5 }, icon: "🍛" },
          { itemId: "teh_manis", name: "Teh Manis Hangat", price: 8, currency: "SC", restores: { stamina: 5, hunger: 5, thirst: 25 }, icon: "🍵" },
          { itemId: "kopi_desa", name: "Kopi Tubruk Desa", price: 10, currency: "SC", restores: { stamina: 15, hunger: 5, thirst: 20 }, icon: "☕" },
          { itemId: "soto_ayam", name: "Soto Ayam Sukamaju", price: 20, currency: "SC", restores: { stamina: 25, hunger: 35, thirst: 10 }, icon: "🍲" },
          { itemId: "ticket_picnic", name: "Tiket Piknik Kebun", price: 200, currency: "SC", isTicket: true, ticketFor: "ningsih", icon: "🎟️" },
          { itemId: "ticket_beach", name: "Tiket Pantai Sore", price: 300, currency: "SC", isTicket: true, ticketFor: "tari", icon: "🎫" },
        ],
        residentNpcs: [
          { id: "ningsih", name: "Ningsih", role: "Petani Botani & Masak", avatar: "🌸" },
          { id: "mang_ujang", name: "Mang Ujang", role: "Nelayan Pesisir", avatar: "🎣" },
          { id: "bu_ratna", name: "Bu Ratna", role: "Guru Sekolah", avatar: "👩‍🏫" },
        ],
        facilities: ["santap_kuliner", "tiket_kencan", "obrolan_warung"],
      },
      sekolah: {
        id: "sekolah",
        name: "SD & SMA Cahaya Sukamaju",
        category: "work",
        icon: "fa-solid fa-graduation-cap",
        coords: { x: 28, y: 52 },
        roamCost: 6,
        workAvailable: true,
        jobTitle: "Guru Pengganti & Asisten Pengajar",
        workRequirements: { intelligence: 5 },
        workReward: { currency: "SC", amount: 50, exp: 10 },
        description: "Gedung sekolah asri berlatar bukit hijau dengan suara anak-anak yang tekun belajar.",
        shopItems: [
          { itemId: "buku_catatan", name: "Buku Catatan Seishun", price: 25, currency: "SC", restores: { stamina: 10 }, icon: "📓" },
          { itemId: "susu_kotak", name: "Susu Kotak Cokelat", price: 12, currency: "SC", restores: { stamina: 15, thirst: 20 }, icon: "🧃" },
        ],
        residentNpcs: [
          { id: "bu_ratna", name: "Bu Ratna", role: "Kepala Sekolah & Pengajar", avatar: "👩‍🏫" },
          { id: "budi", name: "Budi", role: "Ketua Kelas", avatar: "👦" },
          { id: "siti", name: "Siti", role: "Siswa Berprestasi", avatar: "👧" },
        ],
        facilities: ["mengajar_kelas", "baca_buku_dasar", "bursa_beasiswa_vb"],
      },
      kebun: {
        id: "kebun",
        name: "Kebun Botani Warga & Rumah Kaca",
        category: "work",
        icon: "fa-solid fa-seedling",
        coords: { x: 32, y: 62 },
        roamCost: 5,
        workAvailable: true,
        jobTitle: "Pekerja Ladang & Panen Botani",
        workRequirements: { strength: 3 },
        workReward: { currency: "SC", amount: 35, exp: 8 },
        description: "Hamparan petak sawah dan rumah kaca bunga yang semerbak di bawah siraman embun pagi.",
        shopItems: [
          { itemId: "pupuk_organik", name: "Pupuk Kompos Organik", price: 18, currency: "SC", restores: {}, icon: "🌾" },
          { itemId: "apel_kebun", name: "Apel Segar Sukamaju", price: 8, currency: "SC", restores: { hunger: 15, stamina: 10 }, icon: "🍎" },
        ],
        residentNpcs: [
          { id: "ningsih", name: "Ningsih", role: "Pengelola Kebun", avatar: "🌸" },
          { id: "ki_prawiro", name: "Ki Prawiro", role: "Pawang Alam", avatar: "👴" },
        ],
        facilities: ["bertani_kebun", "piknik_ningsih", "beli_bibit_tanaman"],
      },
      sungai: {
        id: "sungai",
        name: "Sungai Jernih & Dermaga Nelayan",
        category: "explore",
        icon: "fa-solid fa-water",
        coords: { x: 35, y: 68 },
        roamCost: 7,
        workAvailable: false,
        description: "Air sungai jernih mengalir ke arah pesisir laut selatan, tempat bersandar perahu kayu bercadik.",
        shopItems: [
          { itemId: "umpan_cacing", name: "Umpan Pancing Cacing", price: 5, currency: "SC", restores: {}, icon: "🪱" },
          { itemId: "ikan_bakar", name: "Ikan Mas Bakar Kecap", price: 22, currency: "SC", restores: { hunger: 30, stamina: 15 }, icon: "🐟" },
        ],
        residentNpcs: [
          { id: "mang_ujang", name: "Mang Ujang", role: "Tengkulak Ikan", avatar: "🎣" },
          { id: "tari", name: "Tari", role: "Gadis Pantai", avatar: "🌺" },
        ],
        facilities: ["mancing_santai", "sewa_perahu_cadik", "sunset_tepi_air"],
      },
      balai_desa: {
        id: "balai_desa",
        name: "Balai Desa Sukamaju",
        category: "social",
        icon: "fa-solid fa-landmark",
        coords: { x: 22, y: 50 },
        roamCost: 5,
        workAvailable: false,
        description: "Balai pertemuan bernuansa kayu jati dengan papan pengumuman sayembara dan wejangan Kades.",
        shopItems: [],
        residentNpcs: [
          { id: "kades_tirto", name: "Kades Tirto", role: "Kepala Desa", avatar: "👨‍💼" },
          { id: "bagas", name: "Bagas", role: "Pandai Besi", avatar: "🔨" },
        ],
        facilities: ["papan_sayembara_desa", "registrasi_warga", "wejang_kades"],
      },
      bengkel_bagas: {
        id: "bengkel_bagas",
        name: "Bengkel Tempa Bagas",
        category: "workshop",
        icon: "fa-solid fa-hammer",
        coords: { x: 19, y: 54 },
        roamCost: 6,
        workAvailable: true,
        jobTitle: "Asisten Tempa & Pemecah Logam",
        workRequirements: { strength: 6 },
        workReward: { currency: "SC", amount: 48, exp: 12 },
        description: "Hawa panas berhembus dari tungku perapian berpadu dengan denting logam paron tempa.",
        shopItems: [
          { itemId: "batu_asah", name: "Batu Asah Paron", price: 30, currency: "SC", restores: {}, icon: "🪨" },
          { itemId: "minyak_pelumas", name: "Minyak Pelindung Karat", price: 25, currency: "SC", restores: {}, icon: "🛢️" },
        ],
        residentNpcs: [
          { id: "bagas", name: "Bagas", role: "Master Smith", avatar: "🔨" },
        ],
        facilities: ["reparasi_durability", "forge_senjata", "asah_beliung"],
      },
      klinik_sari: {
        id: "klinik_sari",
        name: "Klinik Sehat Bidan Sari",
        category: "medical",
        icon: "fa-solid fa-heart-pulse",
        coords: { x: 26, y: 62 },
        roamCost: 5,
        workAvailable: false,
        description: "Klinik beraroma minyak kayu putih dan lavender tempat warga memulihkan stamina sehabis bertualang.",
        shopItems: [
          { itemId: "salep_binahong", name: "Salep Binahong Herbal", price: 35, currency: "SC", restores: { hp: 40, stamina: 20 }, icon: "🧴" },
          { itemId: "perban_steril", name: "Perban Medis Steril", price: 15, currency: "SC", restores: { hp: 20 }, icon: "🩹" },
        ],
        residentNpcs: [
          { id: "bidan_sari", name: "Bidan Sari", role: "Tenaga Medis Desa", avatar: "👩‍⚕️" },
        ],
        facilities: ["rawat_darurat", "periksa_kebugaran", "beli_obat_herbal"],
      },
      dealer_sukamaju: {
        id: "dealer_sukamaju",
        name: "Dealer Motor Tani Sukamaju",
        category: "dealer",
        icon: "fa-solid fa-motorcycle",
        coords: { x: 30, y: 48 },
        roamCost: 5,
        workAvailable: false,
        vehicleId: "motor_bebek_sukamaju",
        description: "Showroom motor pedesaan yang menyediakan motor bebek tangguh untuk melintasi jalur tanah dan membuka akses ke Tambang Raksasa.",
        residentNpcs: [
          { id: "bang_jeki", name: "Bang Jeki", role: "Mekanik & Sales Dealer", avatar: "🔧" },
        ],
        facilities: ["beli_motor", "tukar_tambah_motor", "servis_mesin"],
      },
    },
  },

  kota_pratama: {
    id: "kota_pratama",
    aliases: ["kota", "city", "pratama", "naura_city"],
    name: "Kota Pratama",
    title: "Metropolis Modern & Pusat Bisnis Pratama Dollar",
    currency: "PD",
    currencyName: "Pratama Dollar (PD)",
    currencyCode: "pratamaDollars",
    themeColor: "#38BDF8",
    glowColor: "rgba(56, 189, 248, 0.4)",
    bgImage: "/assets/survival/background/kota_siang.jpeg",
    dangerLevel: "Aman Terlindung (Lv. 10 - 25)",
    description:
      "Kota metropolitan modern dengan gedung pencakar langit megah, bursa karir Pratama Dollar (PD), dan showroom kendaraan cyber futuristik.",
    mapCenter: { x: 55, y: 42 },
    locations: {
      cafe: {
        id: "cafe",
        name: "Neo-Cyber Cafe Naura",
        category: "shop",
        icon: "fa-solid fa-mug-hot",
        coords: { x: 50, y: 46 },
        roamCost: 6,
        workAvailable: false,
        description: "Interior lofi futuristik dengan pencahayaan neon temaram dan aroma espresso premium.",
        shopItems: [
          { itemId: "latte", name: "Neon Cyber Latte", price: 25, currency: "PD", restores: { stamina: 25, hunger: 10, thirst: 30 }, icon: "☕" },
          { itemId: "croissant", name: "Butter Croissant", price: 30, currency: "PD", restores: { stamina: 10, hunger: 25, thirst: 5 }, icon: "🥐" },
          { itemId: "cake_slice", name: "Hoshino Strawberry Cake", price: 45, currency: "PD", restores: { stamina: 20, hunger: 30, thirst: 10 }, icon: "🍰" },
          { itemId: "smoothie", name: "Astral Mango Smoothie", price: 35, currency: "PD", restores: { stamina: 30, hunger: 15, thirst: 35 }, icon: "🥤" },
          { itemId: "ticket_cafe", name: "Tiket Cafe Malam", price: 500, currency: "PD", isTicket: true, ticketFor: "bidan_sari", icon: "🎫" },
          { itemId: "ticket_library", name: "Tiket Pustaka Malam", price: 400, currency: "PD", isTicket: true, ticketFor: "bu_ratna", icon: "🎟️" },
        ],
        residentNpcs: [
          { id: "laras", name: "Laras", role: "Barista & Pemilik Kafe", avatar: "☕" },
          { id: "luna_gacha", name: "Luna", role: "Spesialis Fashion", avatar: "✨" },
        ],
        facilities: ["santap_kafe", "wifi_gratis", "kencan_kafe"],
      },
      klinik: {
        id: "klinik",
        name: "Rumah Sakit Sentral Pratama",
        category: "work",
        icon: "fa-solid fa-hospital",
        coords: { x: 62, y: 38 },
        roamCost: 7,
        workAvailable: true,
        jobTitle: "Asisten Dokter & Laboran Medis",
        workRequirements: { intelligence: 15 },
        workReward: { currency: "PD", amount: 80, exp: 20 },
        description: "Peralatan medis mutakhir berteknologi tinggi dengan staf medis berdedikasi tinggi.",
        shopItems: [
          { itemId: "injeksi_vitalitas", name: "Injeksi Vitalitas Nano", price: 75, currency: "PD", restores: { hp: 80, stamina: 50 }, icon: "💉" },
          { itemId: "vitamin_booster", name: "Vitamin Booster Multiguna", price: 40, currency: "PD", restores: { stamina: 35 }, icon: "💊" },
        ],
        residentNpcs: [
          { id: "dokter_wira", name: "Dokter Wira", role: "Kepala RS", avatar: "👨‍⚕️" },
          { id: "suster_maya", name: "Suster Maya", role: "Perawat Senior", avatar: "👩‍⚕️" },
        ],
        facilities: ["rawat_intensif", "detox_racun", "kerja_medis"],
      },
      pasar_kota: {
        id: "pasar_kota",
        name: "Pasar Modern & Balai Lelang Mbak Rini",
        category: "shop",
        icon: "fa-solid fa-store",
        coords: { x: 53, y: 40 },
        roamCost: 5,
        workAvailable: true,
        jobTitle: "Petugas Kasir & Kurasi Lelang",
        workRequirements: { charisma: 8 },
        workReward: { currency: "PD", amount: 60, exp: 15 },
        description: "Pusat perbelanjaan modern dan balai lelang barang antik bergengsi.",
        shopItems: [
          { itemId: "buah_segar", name: "Keranjang Buah Impor", price: 20, currency: "PD", restores: { stamina: 10, hunger: 20, thirst: 15 }, icon: "🍇" },
          { itemId: "roti_premium", name: "Roti Brioche Emas", price: 35, currency: "PD", restores: { stamina: 15, hunger: 30, thirst: 5 }, icon: "🍞" },
          { itemId: "jus_alami", name: "Jus Jeruk Peras Dingin", price: 25, currency: "PD", restores: { stamina: 10, hunger: 10, thirst: 30 }, icon: "🧃" },
        ],
        residentNpcs: [
          { id: "mbak_rini", name: "Mbak Rini", role: "Juru Lelang Kota", avatar: "💼" },
          { id: "pak_damar", name: "Pak Damar", role: "Pedagang Grosir", avatar: "👔" },
        ],
        facilities: ["belanja_modern", "lelang_eksklusif", "kerja_kasir"],
      },
      perpustakaan: {
        id: "perpustakaan",
        name: "Perpustakaan & Arsip Pustaka Wulan",
        category: "work",
        icon: "fa-solid fa-book-open",
        coords: { x: 58, y: 34 },
        roamCost: 6,
        workAvailable: true,
        jobTitle: "Peneliti Arsip Kuno & Kurator",
        workRequirements: { intelligence: 10 },
        workReward: { currency: "PD", amount: 55, exp: 18 },
        description: "Rak-rak buku mahoni menjulang tinggi dengan koleksi manuskrip purba dan kubah riset.",
        shopItems: [
          { itemId: "buku_astral", name: "Buku Panduan Astral Teori", price: 60, currency: "PD", restores: {}, icon: "📖" },
        ],
        residentNpcs: [
          { id: "wulan", name: "Wulan", role: "Kepala Arsip Pustaka", avatar: "📚" },
          { id: "prof_habibie", name: "Prof. Habibie", role: "Ilmuwan AI", avatar: "👨‍🔬" },
        ],
        facilities: ["riset_manuskrip", "kencan_wulan", "kerja_pustaka"],
      },
      taman_kota: {
        id: "taman_kota",
        name: "Taman Metropolitan Pratama",
        category: "explore",
        icon: "fa-solid fa-tree-city",
        coords: { x: 48, y: 52 },
        roamCost: 5,
        workAvailable: false,
        description: "Taman kota asri dengan air mancur holografis, pohon sakura rekayasa genetik, dan bangku santai.",
        shopItems: [],
        residentNpcs: [
          { id: "luna_gacha", name: "Luna", role: "Trendsetter", avatar: "✨" },
          { id: "bupati_rahmat", name: "Bupati Rahmat", role: "Pimpinan Wilayah", avatar: "🤵" },
        ],
        facilities: ["santai_sore", "sapa_pejabat_kota", "jogging_segar"],
      },
      bank_sentral: {
        id: "bank_sentral",
        name: "Bank Sentral Pratama & Bursa Valuta",
        category: "finance",
        icon: "fa-solid fa-vault",
        coords: { x: 56, y: 44 },
        roamCost: 5,
        workAvailable: false,
        description: "Pusat perputaran modal perkotaan dan fasilitas penukaran One-Way Bridge dari PD ke SC.",
        shopItems: [],
        residentNpcs: [
          { id: "pak_anif", name: "Pak Anif", role: "Bendahara Sentral", avatar: "🏦" },
        ],
        facilities: ["konversi_one_way", "deposito_investasi", "cek_neraca"],
      },
      dealer_pratama: {
        id: "dealer_pratama",
        name: "Showroom Motor Cyber Pratama",
        category: "dealer",
        icon: "fa-solid fa-motorcycle",
        coords: { x: 60, y: 46 },
        roamCost: 5,
        workAvailable: false,
        vehicleId: "motor_neo_pratama",
        description: "Showroom bergaya neon futuristik yang menjual motor sport Neo-Cyber bertenaga tinggi untuk mobilitas cepat perkotaan dan penjelajahan lintas medan.",
        residentNpcs: [
          { id: "agent_k", name: "Agent K", role: "Sales Executive Cyber", avatar: "🕶️" },
        ],
        facilities: ["beli_motor", "tukar_tambah_motor", "tuning_hologram"],
      },
    },
  },

  desa_khulkhas: {
    id: "desa_khulkhas",
    aliases: ["khulkhas", "salju_khulkhas", "tanah_salju", "salju"],
    name: "Desa Khul'Khas",
    title: "Wilayah Pegunungan Salju Abadi & Altar Kristal Es",
    currency: "SC",
    currencyName: "Sukamaju Koin (SC)",
    currencyCode: "sukamajuCoins",
    themeColor: "#38BDF8",
    glowColor: "rgba(56, 189, 248, 0.4)",
    bgImage: "/assets/survival/background/tambang_siang.jpeg",
    dangerLevel: "Dingin Ekstrem (Lv. 20 - 35)",
    description:
      "Pemukiman tersembunyi di pegunungan salju abadi dan lembah gletser timur laut. Rumah kayu hangat, Altar Kristal Es, dan mata air panas pemulih vitalitas.",
    mapCenter: { x: 78, y: 22 },
    locations: {
      pondok_herbal: {
        id: "pondok_herbal",
        name: "Pondok Herbal Syeikh Malik",
        category: "shop",
        icon: "fa-solid fa-mortar-pestle",
        coords: { x: 75, y: 20 },
        roamCost: 7,
        workAvailable: false,
        description: "Aroma seduhan rempah hangat dan herbal pegunungan salju yang mengembalikan kehangatan tubuh.",
        shopItems: [
          { itemId: "ramuan_stamina", name: "Elixir Stamina Salju", price: 40, currency: "SC", restores: { stamina: 45, hunger: 10, thirst: 10 }, icon: "🧪" },
          { itemId: "jamu_tradisional", name: "Jamu Rempah Jahe Merah", price: 30, currency: "SC", restores: { stamina: 25, hunger: 15, thirst: 20 }, icon: "🍵" },
          { itemId: "teh_herbal", name: "Teh Bunga Edelweiss Salju", price: 20, currency: "SC", restores: { stamina: 20, thirst: 30 }, icon: "🫖" },
        ],
        residentNpcs: [
          { id: "syeikh_malik", name: "Syeikh Malik", role: "Alkimis Salju", avatar: "👳" },
        ],
        facilities: ["racik_ramuan_es", "beli_penghangat", "tanya_ramalan_badai"],
      },
      hutan_belantara: {
        id: "hutan_belantara",
        name: "Hutan Salju & Tebing Gletser",
        category: "work",
        icon: "fa-solid fa-snowflake",
        coords: { x: 82, y: 18 },
        roamCost: 8,
        workAvailable: true,
        jobTitle: "Pencari Jejak & Penebang Kayu Beku",
        workRequirements: { strength: 8, agility: 5 },
        workReward: { currency: "SC", amount: 45, exp: 12 },
        description: "Tebing bersalju lebat dengan jejak binatang kutub dan pohon-pohon pinus es raksasa.",
        shopItems: [
          { itemId: "kayu_beku", name: "Kayu Pinus Gletser", price: 35, currency: "SC", restores: {}, icon: "🪵" },
        ],
        residentNpcs: [
          { id: "gatot", name: "Gatot", role: "Pendekar Penjelajah", avatar: "🛡️" },
        ],
        facilities: ["tebang_kayu_salju", "eksplorasi_gletser", "kerja_pencari_jejak"],
      },
      altar_astral: {
        id: "altar_astral",
        name: "Altar Kristal Es Khul'Khas",
        category: "mystery",
        icon: "fa-solid fa-monument",
        coords: { x: 78, y: 25 },
        roamCost: 8,
        workAvailable: false,
        description: "Monolit kristal es purba bertatahkan aksara berpendar yang berdenyut selaras dengan detak jantung Astral Core.",
        shopItems: [],
        residentNpcs: [
          { id: "lama_norbu", name: "Lama Norbu", role: "Petapa Es", avatar: "🧘" },
        ],
        facilities: ["meditasi_salju", "resonansi_kristal", "buka_segel_es"],
      },
      mata_air_kabut: {
        id: "mata_air_kabut",
        name: "Mata Air Panas Lembah Salju",
        category: "sanctuary",
        icon: "fa-solid fa-hot-tub-person",
        coords: { x: 80, y: 28 },
        roamCost: 6,
        workAvailable: false,
        description: "Pemandian air panas alami yang mengepulkan uap putih suci, menyembuhkan radang beku dan memulihkan stamina penuh.",
        shopItems: [
          { itemId: "air_mineral_hangat", name: "Air Pegunungan Hangat", price: 15, currency: "SC", restores: { thirst: 40, stamina: 20 }, icon: "🍶" },
        ],
        residentNpcs: [
          { id: "fatimah_salju", name: "Fatimah", role: "Penjaga Pemandian", avatar: "🧕" },
        ],
        facilities: ["berendam_air_panas", "pemulihan_vitalitas_penuh", "sembuhkan_status_beku"],
      },
      dealer_khulkhas: {
        id: "dealer_khulkhas",
        name: "Depo Salju All-Terrain Khul'Khas",
        category: "dealer",
        icon: "fa-solid fa-motorcycle",
        coords: { x: 74, y: 15 },
        roamCost: 7,
        workAvailable: false,
        vehicleId: "motor_gletser_khulkhas",
        description: "Depo karavan pegunungan yang menyediakan motor salju All-Terrain dengan penghangat bodi untuk menembus badai gletser.",
        residentNpcs: [
          { id: "paman_yusuf", name: "Paman Yusuf", role: "Montir Salju", avatar: "🧥" },
        ],
        facilities: ["beli_motor", "tukar_tambah_motor", "pasang_rantai_salju"],
      },
    },
  },

  hutan_dha_mhai: {
    id: "hutan_dha_mhai",
    aliases: ["dha_mhai", "rimba_dha_mhai", "hutan_barat"],
    name: "Hutan Dha Mhai",
    title: "Kanopi Purba & Sanctuary Pohon Penjaga Rimba",
    currency: "SC",
    currencyName: "Sukamaju Koin (SC)",
    currencyCode: "sukamajuCoins",
    themeColor: "#8B5CF6",
    glowColor: "rgba(139, 92, 246, 0.4)",
    bgImage: "/assets/survival/background/hutan_siang.jpeg",
    dangerLevel: "Mistik Berbahaya (Lv. 15 - 30)",
    description:
      "Hutan belantara purba di barat laut yang diselimuti kanopi raksasa dan kabut ungu mistik. Flora spora berpendar dan sarang ratu lebah rimba.",
    mapCenter: { x: 20, y: 28 },
    locations: {
      gerbang_akar: {
        id: "gerbang_akar",
        name: "Gerbang Akar Purba Dha Mhai",
        category: "sanctuary",
        icon: "fa-solid fa-tree",
        coords: { x: 22, y: 32 },
        roamCost: 6,
        workAvailable: false,
        description: "Lengkungan akar gantung dari pepohonan raksasa berusia ribuan tahun yang memancarkan aroma damar wangi.",
        shopItems: [],
        residentNpcs: [
          { id: "dara_rimba", name: "Dara Rimba", role: "Penjaga Hutan", avatar: "🧝‍♀️" },
          { id: "raden_bram", name: "Raden Bram", role: "Ksatria Alam", avatar: "🏹" },
        ],
        facilities: ["sapa_penjaga_rimba", "berkah_alam", "daftar_sayembara_hutan"],
      },
      sarang_lebah: {
        id: "sarang_lebah",
        name: "Sarang Ratu Lebah Raksasa",
        category: "work",
        icon: "fa-solid fa-bugs",
        coords: { x: 18, y: 26 },
        roamCost: 8,
        workAvailable: true,
        jobTitle: "Pemanen Madu Liar & Pemburu Hama",
        workRequirements: { strength: 12, agility: 10 },
        workReward: { currency: "SC", amount: 70, exp: 25 },
        description: "Kanopi tinggi tempat lebah rimba membangun sarang madu emas bercahaya yang lezat namun dijaga ketat.",
        shopItems: [
          { itemId: "madu_murni", name: "Madu Emas Ratu Rimba", price: 45, currency: "SC", restores: { stamina: 35, hunger: 20 }, icon: "🍯" },
        ],
        residentNpcs: [
          { id: "pak_wojo", name: "Pak Wojo", role: "Pawang Lebah", avatar: "🐝" },
        ],
        facilities: ["panen_madu_rimba", "buru_ratu_lebah", "beli_madu_murni"],
      },
      pondok_damar: {
        id: "pondok_damar",
        name: "Pondok Damar Kakek Danu",
        category: "gathering",
        icon: "fa-solid fa-campground",
        coords: { x: 25, y: 24 },
        roamCost: 6,
        workAvailable: false,
        description: "Pondok kayu sederhana berselimut lumut tempat pengumpulan getah damar wangi bernilai tinggi.",
        shopItems: [
          { itemId: "resin_damar", name: "Getah Resin Damar Purba", price: 50, currency: "SC", restores: {}, icon: "🧪" },
        ],
        residentNpcs: [
          { id: "kakek_danu", name: "Kakek Danu", role: "Penyadap Getah Damar", avatar: "👴" },
        ],
        facilities: ["tukar_resin_damar", "beli_kayu_akar", "cerita_pohon_purba"],
      },
      lab_alkimis: {
        id: "lab_alkimis",
        name: "Laboratorium Herbal Embun",
        category: "workshop",
        icon: "fa-solid fa-flask",
        coords: { x: 16, y: 30 },
        roamCost: 7,
        workAvailable: false,
        description: "Rumah kaca anyaman bambu dengan toples spora jamur berpendar dan seduhan teh herbal pemulih luka.",
        shopItems: [
          { itemId: "elixir_embun", name: "Elixir Embun Mistik", price: 65, currency: "SC", restores: { hp: 60, stamina: 40 }, icon: "🧪" },
        ],
        residentNpcs: [
          { id: "embun_puri", name: "Embun Puri", role: "Alkimis Herbal", avatar: "👩‍🔬" },
        ],
        facilities: ["racik_elixir_spora", "seduh_teh_rimba", "penawar_racun_akut"],
      },
      dealer_dhamhai: {
        id: "dealer_dhamhai",
        name: "Bengkel Rimba Enduro Dha Mhai",
        category: "dealer",
        icon: "fa-solid fa-motorcycle",
        coords: { x: 28, y: 30 },
        roamCost: 6,
        workAvailable: false,
        vehicleId: "motor_enduro_dhamhai",
        description: "Bengkel tersembunyi di rimbunnya hutan yang merakit motor trail Enduro Beast khusus melibas medan lumpur dan akar purba.",
        residentNpcs: [
          { id: "rimba_sam", name: "Sam Si Rimba", role: "Builder Motor Enduro", avatar: "🏕️" },
        ],
        facilities: ["beli_motor", "tukar_tambah_motor", "upgrade_suspensi"],
      },
    },
  },

  desa_lauh_than: {
    id: "desa_lauh_than",
    aliases: ["lauh_than", "pelabuhan_selatan", "pesisir_selatan"],
    name: "Desa Lauh Than",
    title: "Pesisir Samudra Selatan & Dermaga Bahari",
    currency: "SC",
    currencyName: "Sukamaju Koin (SC)",
    currencyCode: "sukamajuCoins",
    themeColor: "#0EA5E9",
    glowColor: "rgba(14, 165, 233, 0.4)",
    bgImage: "/assets/survival/background/laut_siang.jpeg",
    dangerLevel: "Sedang (Lv. 10 - 20)",
    description:
      "Desa maritim tropis di pesisir selatan benua Adisha dengan jajaran dermaga perahu kayu bercadik, pasar ikan asap, dan showroom motor pesisir.",
    mapCenter: { x: 52, y: 76 },
    locations: {
      dermaga_agung: {
        id: "dermaga_agung",
        name: "Dermaga Agung Lauh Than",
        category: "coastal",
        icon: "fa-solid fa-anchor",
        coords: { x: 50, y: 78 },
        roamCost: 6,
        workAvailable: false,
        description: "Dermaga kayu jati ulin yang menjulang ke perairan biru jernih tempat bersandar kapal layar cadik.",
        shopItems: [
          { itemId: "tiket_perahu_selam", name: "Tiket Sewa Perahu Selam", price: 150, currency: "SC", restores: {}, icon: "🤿" },
        ],
        residentNpcs: [
          { id: "kapten_reza", name: "Kapten Reza", role: "Nahkoda Samudra", avatar: "⚓" },
        ],
        facilities: ["sewa_kapal_ekspedisi", "cek_kondisi_ombak", "jelajah_laut_dalam"],
      },
      pasar_ikan: {
        id: "pasar_ikan",
        name: "Pasar Ikan Asap Mbok Darmi",
        category: "shop",
        icon: "fa-solid fa-fish",
        coords: { x: 55, y: 74 },
        roamCost: 5,
        workAvailable: true,
        jobTitle: "Kuli Bongkar Muat & Pemanggang Ikan",
        workRequirements: { strength: 6 },
        workReward: { currency: "SC", amount: 40, exp: 10 },
        description: "Aroma sedap ikan bakar bumbu rempah kelapa menyeruak di antara keriuhan tawar-menawar hasil laut.",
        shopItems: [
          { itemId: "ikan_bakar_rempah", name: "Ikan Asap Bumbu Rempah", price: 28, currency: "SC", restores: { hunger: 35, stamina: 20 }, icon: "🍲" },
          { itemId: "cumi_panggang", name: "Cumi Panggang Madu", price: 32, currency: "SC", restores: { hunger: 25, stamina: 25 }, icon: "🦑" },
        ],
        residentNpcs: [
          { id: "mbok_darmi", name: "Mbok Darmi", role: "Juru Masak Pesisir", avatar: "👵" },
        ],
        facilities: ["santap_ikan_bakar", "jual_hasil_mancing", "kerja_bongkar_muat"],
      },
      balai_adat: {
        id: "balai_adat",
        name: "Balai Adat Samudra Nyai Bahari",
        category: "sanctuary",
        icon: "fa-solid fa-hands-holding-circle",
        coords: { x: 48, y: 72 },
        roamCost: 6,
        workAvailable: false,
        description: "Pendopo panggung beralas tikar pandan berhias kerang mutiara untuk doa keselamatan laut.",
        shopItems: [
          { itemId: "jimat_ombak", name: "Jimat Kerang Penolak Ombak", price: 80, currency: "SC", restores: {}, icon: "🧿" },
        ],
        residentNpcs: [
          { id: "nyai_bahari", name: "Nyai Bahari", role: "Sesepuh Adat Laut", avatar: "🧕" },
        ],
        facilities: ["doa_keselamatan_laut", "beli_jimat_bahari", "berkah_samudra"],
      },
      dealer_lauhthan: {
        id: "dealer_lauhthan",
        name: "Showroom Maritim Lauh Than",
        category: "dealer",
        icon: "fa-solid fa-motorcycle",
        coords: { x: 58, y: 76 },
        roamCost: 6,
        workAvailable: false,
        vehicleId: "motor_wave_lauhthan",
        description: "Showroom bergaya pantai yang menjual motor Coastal Cruiser anti-karat dengan bagasi jaring nelayan.",
        residentNpcs: [
          { id: "mas_aris", name: "Mas Aris", role: "Spesialis Motor Pesisir", avatar: "🏄" },
        ],
        facilities: ["beli_motor", "tukar_tambah_motor", "cat_anti_karat"],
      },
    },
  },

  kampus_draken: {
    id: "kampus_draken",
    aliases: ["draken", "kampus_draken", "universitas_draken", "istana_draken", "kampus", "akademi_draken"],
    name: "Kampus Universitas Draken",
    title: "Pusat Riset Astral, Pendidikan Tinggi & Beasiswa VB",
    currency: "VB",
    currencyName: "Voucher Beasiswa (VB)",
    currencyCode: "scholarshipVouchers",
    themeColor: "#7C3AED",
    glowColor: "rgba(124, 58, 237, 0.4)",
    bgImage: "/assets/survival/background/sekolah_siang.jpeg",
    dangerLevel: "Aman Terpelajar (Lv. 15 - 45)",
    description:
      "Kompleks kampus universitas megah nan prestisius yang menaungi aula wisuda agung, gedung rektorat, laboratorium hextech, perpustakaan naskah kuno, dan pusat mobilitas mahasiswa berhadiah Voucher Beasiswa (VB).",
    mapCenter: { x: 74, y: 55 },
    locations: {
      gerbang_kampus: {
        id: "gerbang_kampus",
        name: "Gerbang Megah Kampus Draken",
        category: "social",
        icon: "fa-solid fa-graduation-cap",
        coords: { x: 72, y: 52 },
        roamCost: 7,
        workAvailable: false,
        description: "Pintu gerbang marmer putih berhias patung naga perunggu simbol kearifan ilmu pengetahuan Adisha.",
        shopItems: [
          { itemId: "buku_panduan_maba", name: "Buku Panduan Mahasiswa Draken", price: 1, currency: "VB", restores: { stamina: 15 }, icon: "📘" },
        ],
        residentNpcs: [
          { id: "gatot", name: "Gatot", role: "Komandan Keamanan Kampus", avatar: "🛡️" },
        ],
        facilities: ["registrasi_mahasiswa", "informasi_beasiswa", "tour_kampus"],
      },
      gedung_rektorat: {
        id: "gedung_rektorat",
        name: "Gedung Rektorat & Aula Wisuda",
        category: "social",
        icon: "fa-solid fa-landmark-dome",
        coords: { x: 76, y: 50 },
        roamCost: 6,
        workAvailable: false,
        description: "Gedung rektorat megah berlantaikan marmer kristal tempat pengukuhan beasiswa dan sidang senat guru besar.",
        shopItems: [],
        residentNpcs: [
          { id: "rektor_draken", name: "Prof. Dr. Draken", role: "Rektor Universitas", avatar: "🎓" },
        ],
        facilities: ["sidang_beasiswa_vb", "hall_of_fame_akademik", "konsultasi_studi"],
      },
      lab_riset_hextech: {
        id: "lab_riset_hextech",
        name: "Laboratorium Riset Hextech & Inovasi",
        category: "work",
        icon: "fa-solid fa-flask-vial",
        coords: { x: 78, y: 54 },
        roamCost: 8,
        workAvailable: true,
        jobTitle: "Asisten Peneliti Riset Hextech",
        workRequirements: { intelligence: 18 },
        workReward: { currency: "VB", amount: 1, exp: 35 },
        description: "Laboratorium canggih bertabur partikel plasma dan reaktor kristal mini untuk eksperimen teknologi maju.",
        shopItems: [
          { itemId: "kapsul_fokus", name: "Kapsul Suplemen Riset", price: 1, currency: "VB", restores: { stamina: 40, hunger: 10 }, icon: "💊" },
        ],
        residentNpcs: [
          { id: "dr_hex", name: "Dr. Hex", role: "Kepala Lab Inovasi", avatar: "👨‍🔬" },
        ],
        facilities: ["riset_teknologi", "kerja_laboran", "uji_coba_hextech"],
      },
      perpustakaan_kuno: {
        id: "perpustakaan_kuno",
        name: "Perpustakaan Riset Naskah Kuno",
        category: "work",
        icon: "fa-solid fa-book-skull",
        coords: { x: 75, y: 58 },
        roamCost: 8,
        workAvailable: true,
        jobTitle: "Penerjemah Naskah Kuno & Arsiparis",
        workRequirements: { intelligence: 22 },
        workReward: { currency: "VB", amount: 2, exp: 50 },
        description: "Buku-buku bersampul kulit naga berisi rahasia penciptaan dunia Adisha dan sejarah peradaban purba.",
        shopItems: [],
        residentNpcs: [
          { id: "arsiparis_alun", name: "Alun", role: "Kepala Kurator Naskah", avatar: "📜" },
        ],
        facilities: ["telaah_naskah_abyss", "kerja_penerjemah_kuno", "buka_lore_terlarang"],
      },
      dealer_draken: {
        id: "dealer_draken",
        name: "Pusat Mobilitas Mahasiswa Draken",
        category: "dealer",
        icon: "fa-solid fa-motorcycle",
        coords: { x: 71, y: 56 },
        roamCost: 6,
        workAvailable: false,
        vehicleId: "motor_astral_draken",
        description: "Pusat teknologi mobilitas kampus yang merakit motor listrik Astral berkinerja tinggi, ditenagai energi kristal beasiswa tanpa polusi.",
        residentNpcs: [
          { id: "asisten_dian", name: "Dian", role: "Spesialis E-Vehicle Kampus", avatar: "👩‍💼" },
        ],
        facilities: ["beli_motor", "tukar_tambah_motor", "pengisian_daya_astral"],
      },
    },
  },

  tambang_raksasa: {
    id: "tambang_raksasa",
    aliases: ["tambang", "tambang_raksasa", "quarry", "mine", "deep_mine"],
    name: "Kawasan Tambang Raksasa",
    title: "Lembah Penggalian Mineral Purba & Peleburan Emas",
    requiresVehicle: true, // Wajib memiliki kendaraan bermotor untuk bisa masuk!
    currency: "SC",
    currencyName: "Sukamaju Koin (SC)",
    currencyCode: "sukamajuCoins",
    themeColor: "#F59E0B",
    glowColor: "rgba(245, 158, 11, 0.4)",
    bgImage: "/assets/survival/background/tambang_siang.jpeg",
    dangerLevel: "Medan Berat & Berbahaya (Wajib Motor) (Lv. 25 - 50)",
    description:
      "Kawasan lembah penggalian tambang terbuka raksasa dengan jurang bebatuan terjal, terowongan kristal mineral, dan mesin derek uap. Hanya dapat ditembus dengan kendaraan bermotor tangguh.",
    mapCenter: { x: 82, y: 72 },
    locations: {
      mulut_tambang: {
        id: "mulut_tambang",
        name: "Mulut Tambang Terbuka & Pos Mandor",
        category: "explore",
        icon: "fa-solid fa-mountain",
        coords: { x: 80, y: 70 },
        roamCost: 8,
        workAvailable: false,
        description: "Gerbang jurang tambang raksasa dengan debu batuan emas dan pemandangan lubang galian sedalam ratusan meter.",
        shopItems: [
          { itemId: "air_mineral_tambang", name: "Air Pegunungan Dingin", price: 15, currency: "SC", restores: { thirst: 35, stamina: 15 }, icon: "💧" },
          { itemId: "ransum_tambang", name: "Ransum Kaleng Pekerja", price: 25, currency: "SC", restores: { hunger: 40, stamina: 25 }, icon: "🥫" },
        ],
        residentNpcs: [
          { id: "mandor_bowo", name: "Mandor Bowo", role: "Kepala Pengawas Tambang", avatar: "👷" },
        ],
        facilities: ["pos_keamanan_tambang", "pantau_lubang_galian", "briefing_keselamatan"],
      },
      pabrik_peleburan: {
        id: "pabrik_peleburan",
        name: "Pabrik Peleburan Emas & Logam",
        category: "work",
        icon: "fa-solid fa-fire-burner",
        coords: { x: 84, y: 68 },
        roamCost: 8,
        workAvailable: true,
        jobTitle: "Operator Tungku Peleburan Emas",
        workRequirements: { strength: 15, agility: 8 },
        workReward: { currency: "SC", amount: 85, exp: 28 },
        description: "Deru mesin konveyor dan bara api tungku blast furnace yang melelehkan bijih mentah menjadi batangan emas murni.",
        shopItems: [
          { itemId: "sarung_tangan_tahan_api", name: "Sarung Tangan Tahan Panas", price: 40, currency: "SC", restores: {}, icon: "🧤" },
        ],
        residentNpcs: [
          { id: "mas_hendro", name: "Mas Hendro", role: "Pelebur Emas Senior", avatar: "🔥" },
        ],
        facilities: ["lebur_batangan_emas", "kerja_peleburan", "uji_kadar_kemurnian"],
      },
      terowongan_kristal: {
        id: "terowongan_kristal",
        name: "Terowongan Kristal Mineral Inti",
        category: "work",
        icon: "fa-solid fa-gem",
        coords: { x: 85, y: 75 },
        roamCost: 10,
        workAvailable: true,
        jobTitle: "Penambang Kristal Mineral Murni",
        workRequirements: { strength: 18, agility: 12 },
        workReward: { currency: "SC", amount: 95, exp: 32 },
        description: "Lorong bawah tanah bertabur urat kristal biru dan mineral mentah yang memantulkan cahaya helm tambang.",
        shopItems: [],
        residentNpcs: [
          { id: "santo_tambang", name: "Santo", role: "Penambang Inti", avatar: "⛏️" },
        ],
        facilities: ["gali_kristal_langka", "kerja_penambang_inti", "eksplorasi_lorong_dalam"],
      },
      dealer_tambang: {
        id: "dealer_tambang",
        name: "Depo Alat Berat & Trike Tambang",
        category: "dealer",
        icon: "fa-solid fa-motorcycle",
        coords: { x: 79, y: 76 },
        roamCost: 8,
        workAvailable: false,
        vehicleId: "motor_trike_tambang",
        description: "Depo alat berat dan kendaraan roda tiga lapis baja berkekuatan tinggi, didesain untuk menahan getaran tambang dan mengangkut muatan berat.",
        residentNpcs: [
          { id: "pak_tarno", name: "Pak Tarno", role: "Penyedia Kendaraan Berat", avatar: "🚜" },
        ],
        facilities: ["beli_motor", "tukar_tambah_motor", "perkuat_sasis_baja"],
      },
    },
  },
};

// Pasang alias kompatibilitas: istana_draken mengarah langsung ke kampus_draken
Object.defineProperty(ADISHA_REGIONS, "istana_draken", {
  get() {
    return ADISHA_REGIONS.kampus_draken;
  },
  enumerable: true,
  configurable: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Helper Functions Kendaraan & Perjalanan (Roam)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mengambil informasi spesifikasi kendaraan dari katalog
 * @param {string} vehicleId
 * @returns {object|null}
 */
function getVehicleInfo(vehicleId) {
  if (!vehicleId) return null;
  return ADISHA_VEHICLES[vehicleId] || null;
}

/**
 * Menghitung nilai jual kembali kendaraan (70% dari harga asli dalam mata uang yang sama)
 * @param {string} vehicleId
 * @returns {{ resalePrice: number, currency: string, originalPrice: number, vehicleName: string }|null}
 */
function calculateResaleValue(vehicleId) {
  const v = getVehicleInfo(vehicleId);
  if (!v) return null;
  const resalePrice = Math.max(1, Math.floor(v.price * (v.resalePercent / 100)));
  return {
    vehicleId: v.id,
    vehicleName: v.name,
    originalPrice: v.price,
    resalePrice,
    currency: v.currency,
    resalePercent: v.resalePercent,
  };
}

/**
 * Validasi apakah pemain memiliki hak akses ke suatu wilayah (misal: Kawasan Tambang butuh kendaraan)
 * @param {string} areaId
 * @param {string|null} userVehicleId
 * @returns {{ canAccess: boolean, reason?: string }}
 */
function canAccessArea(areaId, userVehicleId) {
  const targetArea = ADISHA_REGIONS[areaId];
  if (!targetArea) {
    return { canAccess: false, reason: "Wilayah tujuan tidak terdaftar." };
  }

  // Jika wilayah wajib punya kendaraan
  if (targetArea.requiresVehicle && !userVehicleId) {
    return {
      canAccess: false,
      reason: `Akses ke ${targetArea.name} ditolak! Medan terjal dan berbahaya memerlukan kendaraan bermotor. Beli motor terlebih dahulu di dealer wilayah mana pun.`,
    };
  }

  return { canAccess: true };
}

/**
 * Menghitung biaya stamina berpindah lokasi dengan memperhitungkan diskon kendaraan
 * @param {string} fromAreaId
 * @param {string} toAreaId
 * @param {string} toLocationId
 * @param {string|null} userVehicleId
 * @returns {number} Biaya stamina setelah diskon
 */
function calculateRoamCost(fromAreaId, toAreaId, toLocationId, userVehicleId = null) {
  const targetArea = ADISHA_REGIONS[toAreaId];
  if (!targetArea) return 10;
  const targetLoc = targetArea.locations?.[toLocationId];
  const baseCost = targetLoc?.roamCost || 5;

  let totalCost = baseCost;
  // Jika berpindah ke kawasan/area yang berbeda: tambah biaya perjalanan lintas wilayah
  if (fromAreaId && fromAreaId !== toAreaId) {
    totalCost = baseCost + 12; // Misal 5 + 12 = 17 Stamina
  }

  // Jika pemain mengendarai motor: berikan diskon stamina roam
  if (userVehicleId) {
    const v = getVehicleInfo(userVehicleId);
    if (v && v.permanentBuffs?.staminaDiscountPercent) {
      const discount = v.permanentBuffs.staminaDiscountPercent / 100;
      totalCost = Math.max(2, Math.round(totalCost * (1 - discount)));
    }
  }

  return totalCost;
}

/**
 * Validasi apakah pemain mampu bekerja di lokasi
 * @param {object} location
 * @param {object} userStats { strength, intelligence, agility, charisma }
 * @returns {{ canWork: boolean, missing: string[] }}
 */
function evaluateWorkEligibility(location, userStats = {}) {
  if (!location || !location.workAvailable || !location.workRequirements) {
    return { canWork: true, missing: [] };
  }

  const reqs = location.workRequirements;
  const missing = [];

  const str = Number(userStats.strength || 1);
  const int = Number(userStats.intelligence || 1);
  const agi = Number(userStats.agility || 1);
  const cha = Number(userStats.charisma || 1);

  if (reqs.strength && str < reqs.strength) {
    missing.push(`Strength (STR ${str}/${reqs.strength})`);
  }
  if (reqs.intelligence && int < reqs.intelligence) {
    missing.push(`Intelligence (INT ${int}/${reqs.intelligence})`);
  }
  if (reqs.agility && agi < reqs.agility) {
    missing.push(`Agility (AGI ${agi}/${reqs.agility})`);
  }
  if (reqs.charisma && cha < reqs.charisma) {
    missing.push(`Charisma (CHA ${cha}/${reqs.charisma})`);
  }

  return {
    canWork: missing.length === 0,
    missing,
  };
}

module.exports = {
  ADISHA_REGIONS,
  ADISHA_VEHICLES,
  getVehicleInfo,
  calculateResaleValue,
  canAccessArea,
  calculateRoamCost,
  evaluateWorkEligibility,
};
