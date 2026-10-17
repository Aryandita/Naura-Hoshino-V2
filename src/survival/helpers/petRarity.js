"use strict";

/**
 * petRarity.js - Sistem Tingkatan & Satwa Dunia Nyata Naura Wilds
 *
 * Mengatur tingkatan (Common s/d Mythic), spesies satwa dunia nyata,
 * batas 1 pet setia, serta tabel drop item eksklusif pet berbasis benda nyata.
 * Mematuhi prinsip /antislop-copywriting tanpa istilah klise dan bebas em-dash (\u2014).
 */

const PET_TIERS = Object.freeze({
  COMMON: {
    tier: 1,
    rarity: "Common",
    label: "Umum (Common)",
    badge: "I",
    color: "#9CA3AF",
    minDropTier: 1,
    maxDropTier: 2,
    forageXp: 15,
  },
  UNCOMMON: {
    tier: 2,
    rarity: "Uncommon",
    label: "Langka Lokal (Uncommon)",
    badge: "II",
    color: "#86EFAC",
    minDropTier: 1,
    maxDropTier: 2,
    forageXp: 25,
  },
  RARE: {
    tier: 3,
    rarity: "Rare",
    label: "Langka Alam (Rare)",
    badge: "III",
    color: "#93C5FD",
    minDropTier: 2,
    maxDropTier: 3,
    forageXp: 40,
  },
  EPIC: {
    tier: 4,
    rarity: "Epic",
    label: "Istimewa Rimba (Epic)",
    badge: "IV",
    color: "#C084FC",
    minDropTier: 2,
    maxDropTier: 4,
    forageXp: 60,
  },
  LEGENDARY: {
    tier: 5,
    rarity: "Legendary",
    label: "Legenda Satwa (Legendary)",
    badge: "V",
    color: "#FFD700",
    minDropTier: 3,
    maxDropTier: 5,
    forageXp: 90,
  },
  MYTHIC: {
    tier: 6,
    rarity: "Mythic",
    label: "Pusaka Hayati (Mythic)",
    badge: "VI",
    color: "#F43F5E",
    minDropTier: 4,
    maxDropTier: 6,
    forageXp: 130,
  },
});

// Satwa dunia nyata Indonesia & ekosistem tropis
const REAL_WORLD_SPECIES = Object.freeze({
  // Tier 1: Common
  kucing_kampung: {
    id: "kucing_kampung",
    name: "Kucing Kampung",
    latin: "Felis catus",
    tierKey: "COMMON",
    emoji: "🐱",
    description: "Kucing peliharaan lincah yang biasa menjelajahi pekarangan desa dan pandai berburu tikus.",
    baseAffection: 50,
  },
  anjing_gembala: {
    id: "anjing_gembala",
    name: "Anjing Gembala",
    latin: "Canis lupus familiaris",
    tierKey: "COMMON",
    emoji: "🐕",
    description: "Sahabat setia penjaga gubuk yang memiliki penciuman tajam untuk melacak jejak di jalan setapak.",
    baseAffection: 60,
  },
  ayam_hutan: {
    id: "ayam_hutan",
    name: "Ayam Hutan Merah",
    latin: "Gallus gallus",
    tierKey: "COMMON",
    emoji: "🐓",
    description: "Unggas gesit dengan kokok nyaring di fajar hari yang terbiasa mengais benih di bawah dedaunan jati.",
    baseAffection: 45,
  },

  // Tier 2: Uncommon
  celepuk_jawa: {
    id: "celepuk_jawa",
    name: "Burung Hantu Celepuk",
    latin: "Otus lempiji",
    tierKey: "UNCOMMON",
    emoji: "🦉",
    description: "Burung malam berbulu lurik abu-abu dengan mata bulat tajam yang mampu terbang tanpa suara.",
    baseAffection: 50,
  },
  musang_pandan: {
    id: "musang_pandan",
    name: "Musang Pandan",
    latin: "Paradoxurus hermaphroditus",
    tierKey: "UNCOMMON",
    emoji: "🦡",
    description: "Mamalia pemanjat pohon beraroma daun pandan segar yang gemar memilah buah kopi ransek terbaik.",
    baseAffection: 55,
  },
  kancil_jawa: {
    id: "kancil_jawa",
    name: "Kancil Jawa",
    latin: "Tragulus javanicus",
    tierKey: "UNCOMMON",
    emoji: "🦌",
    description: "Satwa mungil cerdik berterompah halus yang sanggup menyusup di rimbun semak tanpa patah ranting.",
    baseAffection: 50,
  },

  // Tier 3: Rare
  elang_jawa: {
    id: "elang_jawa",
    name: "Elang Jawa",
    latin: "Nisaetus bartelsi",
    tierKey: "RARE",
    emoji: "🦅",
    description: "Burung pemangsa bertaji kokoh dengan jambul khas, lambang ketangguhan penjaga kanopi pegunungan.",
    baseAffection: 55,
  },
  kucing_bakau: {
    id: "kucing_bakau",
    name: "Kucing Bakau",
    latin: "Prionailurus viverrinus",
    tierKey: "RARE",
    emoji: "🐈‍⬛",
    description: "Kucing perenang tangguh penghuni rawa bakau yang pandai menangkap ikan dan kepiting sungai.",
    baseAffection: 55,
  },
  rusa_bawean: {
    id: "rusa_bawean",
    name: "Rusa Bawean",
    latin: "Axis kuhlii",
    tierKey: "RARE",
    emoji: "🦌",
    description: "Rusa anggun endemik pulau kecil dengan tanduk cabang simetris yang melangkah tenang di savana.",
    baseAffection: 60,
  },

  // Tier 4: Epic
  owa_jawa: {
    id: "owa_jawa",
    name: "Owa Jawa",
    latin: "Hylobates moloch",
    tierKey: "EPIC",
    emoji: "🐒",
    description: "Primata berbulu perak keabuan dengan suara merdu bersahutan yang menjelajahi puncak kanopi hutan hujan.",
    baseAffection: 65,
  },
  trenggiling_sunda: {
    id: "trenggiling_sunda",
    name: "Trenggiling Sunda",
    latin: "Manis javanica",
    tierKey: "EPIC",
    emoji: "🦔",
    description: "Satwa berlapis sisik keratin tebal yang mampu menggulung tubuh rapat dan menggali tanah sarang rayap.",
    baseAffection: 60,
  },
  kasuari_gelambir: {
    id: "kasuari_gelambir",
    name: "Kasuari Gelambir Ganda",
    latin: "Casuarius casuarius",
    tierKey: "EPIC",
    emoji: "🦤",
    description: "Burung hutan lebat berkaki kekar dengan mahkota helm tanduk alami yang kokoh membelah belukar tebal.",
    baseAffection: 60,
  },

  // Tier 5: Legendary
  harimau_sumatera: {
    id: "harimau_sumatera",
    name: "Harimau Sumatera",
    latin: "Panthera tigris sumatrae",
    tierKey: "LEGENDARY",
    emoji: "🐅",
    description: "Kucing loreng agung penguasa rimba bukit barisan dengan tatapan berwibawa dan langkah tenang berdaya cengkeram tinggi.",
    baseAffection: 70,
  },
  badak_jawa: {
    id: "badak_jawa",
    name: "Badak Jawa",
    latin: "Rhinoceros sondaicus",
    tierKey: "LEGENDARY",
    emoji: "🦏",
    description: "Raksasa perisai bercula tunggal dari semenanjung barat, pelindung purba yang berjalan sunyi di antara pohon palem hutan pantai.",
    baseAffection: 75,
  },
  komodo_flores: {
    id: "komodo_flores",
    name: "Komodo Flores",
    latin: "Varanus komodoensis",
    tierKey: "LEGENDARY",
    emoji: "🦎",
    description: "Kadal purba terberat di dunia dengan kulit bersisik keras bagai zirah besi yang berpatroli gagah di sabana pulau karang.",
    baseAffection: 70,
  },

  // Tier 6: Mythic
  gajah_sumatera_putih: {
    id: "gajah_sumatera_putih",
    name: "Gajah Sumatera Putih",
    latin: "Elephas maximus sumatranus",
    tierKey: "MYTHIC",
    emoji: "🐘",
    description: "Satwa mulia berbadan kekar dengan pigmen kulit cerah langka, lambang kedamaian hutan yang dijaga penuh rasa hormat oleh suku pedalaman.",
    baseAffection: 80,
  },
  cenderawasih_kuning: {
    id: "cenderawasih_kuning",
    name: "Cenderawasih Kuning Besar",
    latin: "Paradisaea apoda",
    tierKey: "MYTHIC",
    emoji: "🦚",
    description: "Burung berbulu hias kuning keemasan yang menari anggun di dahan tertinggi menyambut sinar pertama mentari fajar.",
    baseAffection: 85,
  },
  penyu_belimbing: {
    id: "penyu_belimbing",
    name: "Penyu Belimbing Samudra",
    latin: "Dermochelys coriacea",
    tierKey: "MYTHIC",
    emoji: "🐢",
    description: "Penyu samudra purba berlapis karapas lentur menyerupai kulit berusuk tujuh, pengarung arus laut dalam berjiwa tenang.",
    baseAffection: 80,
  },
});

// Pemetaan tipe pet lama (legacy) ke satwa dunia nyata & tier
const LEGACY_PET_MAP = Object.freeze({
  cat: "kucing_kampung",
  wolf: "anjing_gembala",
  dog: "anjing_gembala",
  owl: "celepuk_jawa",
  fox: "musang_pandan",
  spirit_fox: "musang_pandan",
  kitsune: "musang_pandan",
  panther: "kucing_bakau",
  tiger: "harimau_sumatera",
  direwolf: "anjing_gembala",
  fenrir: "harimau_sumatera",
  dragon: "komodo_flores",
  wyvern: "komodo_flores",
  ancient_dragon: "komodo_flores",
  kirin: "rusa_bawean",
  divine_kirin: "rusa_bawean",
  celestial_kirin: "rusa_bawean",
  leviathan: "penyu_belimbing",
  deep_leviathan: "penyu_belimbing",
  abyssal_leviathan: "penyu_belimbing",
  bahamut: "badak_jawa",
  dread_bahamut: "badak_jawa",
  calamity_bahamut: "badak_jawa",
  garuda: "elang_jawa",
  astral_garuda: "elang_jawa",
  solar_garuda: "cenderawasih_kuning",
});

/**
 * Mendapatkan profil kelangkaan dan spesies dari model UserPet
 * @param {object} pet - Instance atau plain object UserPet
 * @returns {object} Metadata spesies dan tier
 */
function getPetRarityInfo(pet) {
  if (!pet) {
    const defaultSpecies = REAL_WORLD_SPECIES.kucing_kampung;
    return {
      species: defaultSpecies,
      tier: PET_TIERS.COMMON,
      displayName: defaultSpecies.name,
      badge: PET_TIERS.COMMON.badge,
      color: PET_TIERS.COMMON.color,
    };
  }

  const rawType = String(pet.petType || "kucing_kampung").toLowerCase();
  const speciesKey = LEGACY_PET_MAP[rawType] || rawType;
  const species = REAL_WORLD_SPECIES[speciesKey] || REAL_WORLD_SPECIES.kucing_kampung;
  const tierKey = species.tierKey || "COMMON";
  const tier = PET_TIERS[tierKey] || PET_TIERS.COMMON;

  return {
    species,
    tier,
    displayName: pet.petName || species.name,
    badge: tier.badge,
    color: tier.color,
  };
}

// Item eksklusif hasil temuan ekspedisi/foraging pet
const PET_FORAGING_LOOT = Object.freeze([
  // Tier 1: Common
  {
    itemId: "obsidian_stone",
    tierRequired: 1,
    weight: 40,
    minQty: 1,
    maxQty: 3,
    narrative: "menemukan serpihan kaca vulkanik hitam pekat di antara bebatuan sungai.",
  },
  {
    itemId: "damar_resin",
    tierRequired: 1,
    weight: 35,
    minQty: 1,
    maxQty: 2,
    narrative: "mengendus getah damar harum yang menetes dari batang pohon tua.",
  },
  // Tier 2: Uncommon
  {
    itemId: "wild_honeycomb",
    tierRequired: 2,
    weight: 30,
    minQty: 1,
    maxQty: 2,
    narrative: "menemukan patahan sarang lebah hutan beraroma madu manis alami.",
  },
  {
    itemId: "petrified_wood",
    tierRequired: 2,
    weight: 25,
    minQty: 1,
    maxQty: 1,
    narrative: "menggali bongkahan fosil kayu jati purba dari endapan sedimen lembap.",
  },
  // Tier 3: Rare
  {
    itemId: "peacock_feather",
    tierRequired: 3,
    weight: 20,
    minQty: 1,
    maxQty: 1,
    narrative: "menemukan sehelai bulu ekor merak hijau berkilau zamrud yang gugur di semak lembah.",
  },
  {
    itemId: "freshwater_pearl",
    tierRequired: 3,
    weight: 18,
    minQty: 1,
    maxQty: 1,
    narrative: "menyelam sejenak dan membawa cangkang kerang berisi mutiara air tawar alami.",
  },
  // Tier 4: Epic
  {
    itemId: "cat_eye_resin",
    tierRequired: 4,
    weight: 12,
    minQty: 1,
    maxQty: 1,
    narrative: "menemukan kristal getah damar mata kucing bening yang memantulkan sinar fajar.",
  },
  // Tier 5: Legendary
  {
    itemId: "swallow_nest",
    tierRequired: 5,
    weight: 8,
    minQty: 1,
    maxQty: 1,
    narrative: "menjangkau ceruk tebing gua kapur dan membawa sarang burung walet utuh berkualitas tinggi.",
  },
  // Tier 6: Mythic
  {
    itemId: "amber_fossil",
    tierRequired: 6,
    weight: 4,
    minQty: 1,
    maxQty: 1,
    narrative: "menemukan batu ambar purba tembus pandang yang memerangkap jejak dedaunan kuno.",
  },
]);

/**
 * Menghitung hasil temuan ekspedisi pet berdasarkan tingkatan dan level
 * @param {object} pet - Instance UserPet
 * @returns {object} Hasil temuan item, koin, xp, dan narasi
 */
function rollPetForaging(pet) {
  const { tier, displayName, species } = getPetRarityInfo(pet);
  const petTierLevel = tier.tier;

  // Filter loot yang memenuhi syarat tier pet
  const eligibleLoot = PET_FORAGING_LOOT.filter(
    (loot) => petTierLevel >= loot.tierRequired,
  );

  const totalWeight = eligibleLoot.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = eligibleLoot[0];

  for (const item of eligibleLoot) {
    if (roll < item.weight) {
      chosen = item;
      break;
    }
    roll -= item.weight;
  }

  const qty = Math.floor(
    Math.random() * (chosen.maxQty - chosen.minQty + 1) + chosen.minQty,
  );
  const bonusCoins = Math.floor(150 * petTierLevel + Math.random() * 100);
  const earnedXp = tier.forageXp + (pet.petLevel || 1) * 2;

  return {
    item: chosen,
    itemId: chosen.itemId,
    qty,
    bonusCoins,
    earnedXp,
    petName: displayName,
    speciesName: species.name,
    tier,
    story: `${displayName} (${species.name}) ${chosen.narrative}`,
  };
}

module.exports = {
  PET_TIERS,
  REAL_WORLD_SPECIES,
  LEGACY_PET_MAP,
  getPetRarityInfo,
  PET_FORAGING_LOOT,
  rollPetForaging,
};
