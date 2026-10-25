"use strict";

/**
 * Roam Locations Data
 * Sub-lokasi yang bisa dikunjungi dalam satu kawasan via /survival roam
 * 
 * Currency tiers:
 * - fragment (SC): Desa, Tier 1
 * - coin (PD): Kota, Tier 2  
 * - coupon (VB): Prestige, Tier 3
 * - diamond (BA): Endgame, Tier 4
 */

const ROAM_LOCATIONS = {
  desa_sukamaju: {
    id: "desa_sukamaju",
    name: "Desa Sukamaju",
    currency: "fragment",
    description: "Desa tenang dengan suasana pedesaan yang asri.",
    locations: {
      warung: {
        id: "warung",
        name: "Warung Bu Yati",
        type: "shop",
        workAvailable: false,
        shopItems: [
          { itemId: "nasi_goreng", price: 15, restores: { stamina: 20, hunger: 30, thirst: 5 } },
          { itemId: "teh_manis", price: 8, restores: { stamina: 5, hunger: 5, thirst: 25 } },
          { itemId: "kopi_desa", price: 10, restores: { stamina: 15, hunger: 5, thirst: 20 } },
          { itemId: "soto_ayam", price: 20, restores: { stamina: 25, hunger: 35, thirst: 10 } },
          { itemId: "ticket_picnic", price: 200, restores: {}, isTicket: true, ticketFor: "ningsih" },
          { itemId: "ticket_beach", price: 300, restores: {}, isTicket: true, ticketFor: "tari" },
        ],
        npcSpawn: ["ningsih", "mang_ujang", "bu_ratna"],
        eventChance: 0.15,
        description: "Aroma nasi goreng dan kopi hangat menyambutmu.",
      },
      sekolah: {
        id: "sekolah",
        name: "SD Desa Sukamaju",
        type: "work",
        workAvailable: true,
        workRequirements: { intelligence: 5 },
        workReward: { currency: "fragment", amount: 50, exp: 10 },
        npcSpawn: ["bu_ratna", "budi", "siti"],
        eventChance: 0.10,
        description: "Suara anak-anak belajar terdengar dari dalam kelas.",
      },
      kebun: {
        id: "kebun",
        name: "Kebun Warga",
        type: "work",
        workAvailable: true,
        workRequirements: { strength: 3 },
        workReward: { currency: "fragment", amount: 35, exp: 8 },
        npcSpawn: ["ningsih", "ki_prawiro"],
        eventChance: 0.12,
        description: "Tanah subur dengan deretan tanaman sayur dan bunga.",
      },
      sungai: {
        id: "sungai",
        name: "Sungai Jernih",
        type: "explore",
        workAvailable: false,
        npcSpawn: ["tari", "mang_ujang"],
        eventChance: 0.18,
        description: "Air jernih mengalir tenang, cocok untuk memancing.",
      },
      balai_desa: {
        id: "balai_desa",
        name: "Balai Desa",
        type: "social",
        workAvailable: false,
        npcSpawn: ["kades_tirto", "bagas", "gatot"],
        eventChance: 0.08,
        description: "Pusat kegiatan warga dan pengumuman penting.",
      },
    },
  },

  kota_pratama: {
    id: "kota_pratama",
    name: "Kota Pratama",
    currency: "coin",
    description: "Kota modern dengan fasilitas lengkap.",
    locations: {
      cafe: {
        id: "cafe",
        name: "Cafe Naura",
        type: "shop",
        workAvailable: false,
        shopItems: [
          { itemId: "latte", price: 25, restores: { stamina: 20, hunger: 10, thirst: 30 } },
          { itemId: "croissant", price: 30, restores: { stamina: 10, hunger: 25, thirst: 5 } },
          { itemId: "cake_slice", price: 45, restores: { stamina: 15, hunger: 30, thirst: 10 } },
          { itemId: "smoothie", price: 35, restores: { stamina: 25, hunger: 15, thirst: 35 } },
          { itemId: "ticket_cafe", price: 500, restores: {}, isTicket: true, ticketFor: "bidan_sari" },
          { itemId: "ticket_library", price: 400, restores: {}, isTicket: true, ticketFor: "bu_ratna" },
        ],
        npcSpawn: ["bidan_sari", "bu_ratna", "luna_gacha"],
        eventChance: 0.15,
        description: "Interior cozy dengan aroma kopi premium.",
      },
      klinik: {
        id: "klinik",
        name: "Klinik Sehat",
        type: "work",
        workAvailable: true,
        workRequirements: { intelligence: 15, specialSkill: "medical" },
        workReward: { currency: "coin", amount: 80, exp: 20 },
        npcSpawn: ["bidan_sari"],
        eventChance: 0.10,
        description: "Tempat pengobatan dan pemulihan kesehatan.",
      },
      pasar_kota: {
        id: "pasar_kota",
        name: "Pasar Modern Pratama",
        type: "shop",
        workAvailable: true,
        workRequirements: { charisma: 8 },
        workReward: { currency: "coin", amount: 60, exp: 15 },
        shopItems: [
          { itemId: "buah_segar", price: 20, restores: { stamina: 10, hunger: 20, thirst: 15 } },
          { itemId: "roti_premium", price: 35, restores: { stamina: 15, hunger: 30, thirst: 5 } },
          { itemId: "jus_alami", price: 25, restores: { stamina: 10, hunger: 10, thirst: 30 } },
        ],
        npcSpawn: ["ningsih", "pak_damar"],
        eventChance: 0.12,
        description: "Pasar besar dengan beragam barang dan makanan.",
      },
      perpustakaan: {
        id: "perpustakaan",
        name: "Perpustakaan Kota",
        type: "work",
        workAvailable: true,
        workRequirements: { intelligence: 10 },
        workReward: { currency: "coin", amount: 55, exp: 18 },
        npcSpawn: ["bu_ratna"],
        eventChance: 0.08,
        description: "Ruang baca tenang dengan koleksi buku lengkap.",
      },
      taman_kota: {
        id: "taman_kota",
        name: "Taman Pratama",
        type: "explore",
        workAvailable: false,
        npcSpawn: ["tari", "luna_gacha", "kades_tirto"],
        eventChance: 0.20,
        description: "Taman hijau dengan air mancur dan bangku santai.",
      },
    },
  },

  desa_khulkhas: {
    id: "desa_khulkhas",
    name: "Desa Khul'Khas",
    currency: "fragment",
    description: "Desa misterius di pedalaman hutan.",
    locations: {
      pondok_herbal: {
        id: "pondok_herbal",
        name: "Pondok Herbal",
        type: "shop",
        workAvailable: false,
        shopItems: [
          { itemId: "ramuan_stamina", price: 40, restores: { stamina: 40, hunger: 10, thirst: 10 } },
          { itemId: "jamu_tradisional", price: 30, restores: { stamina: 20, hunger: 15, thirst: 20 } },
          { itemId: "teh_herbal", price: 20, restores: { stamina: 15, hunger: 5, thirst: 25 } },
        ],
        npcSpawn: ["ki_prawiro"],
        eventChance: 0.15,
        description: "Aroma rempah dan herbal memenuhi ruangan.",
      },
      hutan_belantara: {
        id: "hutan_belantara",
        name: "Hutan Belantara",
        type: "explore",
        workAvailable: true,
        workRequirements: { strength: 8, agility: 5 },
        workReward: { currency: "fragment", amount: 45, exp: 12 },
        npcSpawn: ["ki_prawiro", "gatot"],
        eventChance: 0.25,
        description: "Hutan lebat dengan suara binatang liar.",
      },
      gua_tersembunyi: {
        id: "gua_tersembunyi",
        name: "Gua Tersembunyi",
        type: "explore",
        workAvailable: false,
        npcSpawn: ["gatot"],
        eventChance: 0.30,
        description: "Gua gelap dengan kristal berkilau di dinding.",
      },
    },
  },

  istana_draken: {
    id: "istana_draken",
    name: "Istana Draken",
    currency: "diamond",
    description: "Istana megah di puncak gunung.",
    locations: {
      aula_utama: {
        id: "aula_utama",
        name: "Aula Utama",
        type: "social",
        workAvailable: false,
        npcSpawn: [],
        eventChance: 0.10,
        description: "Ruangan luas dengan pilar-pilar emas.",
      },
      ruang_takhta: {
        id: "ruang_takhta",
        name: "Ruang Takhta",
        type: "explore",
        workAvailable: false,
        npcSpawn: [],
        eventChance: 0.15,
        description: "Takhta kosong dengan aura misterius.",
      },
      perpustakaan_kuno: {
        id: "perpustakaan_kuno",
        name: "Perpustakaan Kuno",
        type: "work",
        workAvailable: true,
        workRequirements: { intelligence: 25 },
        workReward: { currency: "diamond", amount: 5, exp: 50 },
        npcSpawn: [],
        eventChance: 0.12,
        description: "Buku-buku kuno berisi pengetahuan terlarang.",
      },
    },
  },
};

// Date ticket configuration
const DATE_TICKETS = {
  ningsih: {
    itemId: "ticket_picnic",
    itemName: "Tiket Piknik Kebun",
    location: "kebun",
    area: "desa_sukamaju",
    cost: 200,
    currency: "fragment",
    description: "Piknik sederhana di kebun bunga bersama Ningsih.",
  },
  tari: {
    itemId: "ticket_beach",
    itemName: "Tiket Pantai Sore",
    location: "sungai",
    area: "desa_sukamaju",
    cost: 300,
    currency: "fragment",
    description: "Menikmati sunset di tepi sungai bersama Tari.",
  },
  bidan_sari: {
    itemId: "ticket_cafe",
    itemName: "Tiket Cafe Malam",
    location: "cafe",
    area: "kota_pratama",
    cost: 500,
    currency: "coin",
    description: "Makan malam romantis di Cafe Naura.",
  },
  bu_ratna: {
    itemId: "ticket_library",
    itemName: "Tiket Perpustakaan",
    location: "perpustakaan",
    area: "kota_pratama",
    cost: 400,
    currency: "coin",
    description: "Membaca bersama di perpustakaan yang tenang.",
  },
};

// Work requirements helper
function canWorkAt(location, userStats) {
  if (!location.workAvailable || !location.workRequirements) return true;
  
  const reqs = location.workRequirements;
  if (reqs.strength && (!userStats.strength || userStats.strength < reqs.strength)) return false;
  if (reqs.intelligence && (!userStats.intelligence || userStats.intelligence < reqs.intelligence)) return false;
  if (reqs.agility && (!userStats.agility || userStats.agility < reqs.agility)) return false;
  if (reqs.charisma && (!userStats.charisma || userStats.charisma < reqs.charisma)) return false;
  if (reqs.specialSkill && !userStats.skills?.includes(reqs.specialSkill)) return false;
  
  return true;
}

module.exports = {
  ROAM_LOCATIONS,
  DATE_TICKETS,
  canWorkAt,
};
