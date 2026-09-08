// Lokasi: src/survival/data/items_catalog.js
// Katalog resmi 150 item seimbang (5 Kategori x 6 Tier x 5 Item)
// Sesuai standar desain Naura Wilds & sistem 6-tier resmi

"use strict";

const TIERS = Object.freeze({
  COMMON: { tier: 1, rarity: "Common", color: "#9CA3AF" },
  UNCOMMON: { tier: 2, rarity: "Uncommon", color: "#86EFAC" },
  RARE: { tier: 3, rarity: "Rare", color: "#93C5FD" },
  EPIC: { tier: 4, rarity: "Epic", color: "#C084FC" },
  LEGENDARY: { tier: 5, rarity: "Legendary", color: "#FFD700" },
  MYTHIC: { tier: 6, rarity: "Mythic", color: "#F9A8D4" },
});

// Helper pembangun item
function makeItem({
  id,
  name,
  description,
  price,
  category,
  tierKey,
  emoji,
  iconType,
  attributes = {},
}) {
  const tierInfo = TIERS[tierKey] || TIERS.COMMON;
  const sellPrice = Math.max(1, Math.floor(price * 0.5));
  return Object.freeze({
    id,
    name,
    description,
    price,
    sellPrice,
    category,
    tier: tierInfo.tier,
    rarity: tierInfo.rarity,
    tierColor: tierInfo.color,
    emoji: emoji || "📦",
    iconType: iconType || category,
    image: `/items/${id}.svg`,
    ...attributes,
  });
}

// ==========================================
// 1. KATEGORI: WEAPON (30 Item)
// ==========================================
const WEAPONS = [
  // Tier 1: Common (5)
  makeItem({
    id: "wooden_sword",
    name: "Pedang Kayu Latih",
    description: "Pedang kayu ringan untuk latihan dasar berpedang.",
    price: 300,
    category: "weapon",
    tierKey: "COMMON",
    emoji: "🗡️",
    iconType: "sword",
    attributes: { base_damage: 8, attack_speed: 1.0 },
  }),
  makeItem({
    id: "rusty_dagger",
    name: "Belati Berkarat",
    description: "Belati tua peninggalan bandit pinggiran hutan.",
    price: 250,
    category: "weapon",
    tierKey: "COMMON",
    emoji: "🗡️",
    iconType: "dagger",
    attributes: { base_damage: 6, crit_rate: 0.05 },
  }),
  makeItem({
    id: "training_bow",
    name: "Busur Pemula",
    description: "Busur kayu sederhana dari dahan pohon cemara.",
    price: 350,
    category: "weapon",
    tierKey: "COMMON",
    emoji: "🏹",
    iconType: "bow",
    attributes: { base_damage: 7, range: 12 },
  }),
  makeItem({
    id: "apprentice_staff",
    name: "Tongkat Magis Magang",
    description: "Tongkat kayu dengan batu kristal kecil di ujungnya.",
    price: 400,
    category: "weapon",
    tierKey: "COMMON",
    emoji: "🪄",
    iconType: "staff",
    attributes: { base_damage: 9, magic_power: 5 },
  }),
  makeItem({
    id: "copper_spear",
    name: "Tombak Tembaga",
    description:
      "Tombak berujung tempaan tembaga untuk tusukan jarak menengah.",
    price: 380,
    category: "weapon",
    tierKey: "COMMON",
    emoji: "🔱",
    iconType: "spear",
    attributes: { base_damage: 8, reach: 2 },
  }),

  // Tier 2: Uncommon (5)
  makeItem({
    id: "iron_broadsword",
    name: "Pedang Besi Tempa",
    description: "Bilah besi kokoh dengan ketajaman yang teruji di medan laga.",
    price: 1200,
    category: "weapon",
    tierKey: "UNCOMMON",
    emoji: "⚔️",
    iconType: "sword",
    attributes: { base_damage: 18, attack_speed: 1.1 },
  }),
  makeItem({
    id: "hunter_bow",
    name: "Busur Pemburu Liar",
    description:
      "Tali busur elastis bertegangan tinggi untuk berburu monster rimba.",
    price: 1350,
    category: "weapon",
    tierKey: "UNCOMMON",
    emoji: "🏹",
    iconType: "bow",
    attributes: { base_damage: 16, crit_rate: 0.08 },
  }),
  makeItem({
    id: "steel_dagger",
    name: "Belati Baja Karbon",
    description: "Belati ramping dengan goresan akurat untuk serangan kilat.",
    price: 1100,
    category: "weapon",
    tierKey: "UNCOMMON",
    emoji: "🗡️",
    iconType: "dagger",
    attributes: { base_damage: 14, crit_rate: 0.12 },
  }),
  makeItem({
    id: "oak_wand",
    name: "Tongkat Kayu Ek Bertuah",
    description: "Tongkat kayu ek tua yang dialiri energi alam liar.",
    price: 1400,
    category: "weapon",
    tierKey: "UNCOMMON",
    emoji: "🪄",
    iconType: "wand",
    attributes: { base_damage: 17, magic_power: 12 },
  }),
  makeItem({
    id: "iron_halberd",
    name: "Halberd Besi Berat",
    description: "Senjata gabungan kapak dan tombak berdaya hancur tinggi.",
    price: 1500,
    category: "weapon",
    tierKey: "UNCOMMON",
    emoji: "🪓",
    iconType: "polearm",
    attributes: { base_damage: 22, cleave: 0.2 },
  }),

  // Tier 3: Rare (5)
  makeItem({
    id: "silver_rapier",
    name: "Rapier Perak Anggun",
    description:
      "Pedang tusuk ramping berhulu perak murni pembasmi iblis malam.",
    price: 4500,
    category: "weapon",
    tierKey: "RARE",
    emoji: "🤺",
    iconType: "rapier",
    attributes: { base_damage: 35, crit_damage: 1.4 },
  }),
  makeItem({
    id: "composite_longbow",
    name: "Longbow Komposit Elit",
    description: "Busur tempur lapis baja dengan akurasi bidik superior.",
    price: 4800,
    category: "weapon",
    tierKey: "RARE",
    emoji: "🏹",
    iconType: "bow",
    attributes: { base_damage: 32, range: 25, crit_rate: 0.15 },
  }),
  makeItem({
    id: "assassin_stiletto",
    name: "Stiletto Bayangan",
    description:
      "Belati beracun tipis yang menembus celah pelindung zirah musuh.",
    price: 4200,
    category: "weapon",
    tierKey: "RARE",
    emoji: "🗡️",
    iconType: "dagger",
    attributes: { base_damage: 28, armor_pierce: 0.25 },
  }),
  makeItem({
    id: "elemental_staff",
    name: "Tongkat Empat Elemen",
    description: "Tongkat bertatahkan kristal api, es, petir, dan angin.",
    price: 5200,
    category: "weapon",
    tierKey: "RARE",
    emoji: "🔮",
    iconType: "staff",
    attributes: { base_damage: 34, elemental_boost: 0.2 },
  }),
  makeItem({
    id: "silver_trident",
    name: "Trisula Perak Samudra",
    description:
      "Trisula bermata tiga yang dipoles kristal mutiara laut dalam.",
    price: 4900,
    category: "weapon",
    tierKey: "RARE",
    emoji: "🔱",
    iconType: "trident",
    attributes: { base_damage: 36, water_bonus: 0.25 },
  }),

  // Tier 4: Epic (5)
  makeItem({
    id: "plasma_blade",
    name: "Pedang Sinar Plasma",
    description:
      "Bilah energi neon bersuhu ribuan derajat pemotong baja tebal.",
    price: 15000,
    category: "weapon",
    tierKey: "EPIC",
    emoji: "⚡",
    iconType: "sword_neon",
    attributes: { base_damage: 65, burn_damage: 15 },
  }),
  makeItem({
    id: "phantom_crossbow",
    name: "Crossbow Hantu Phantom",
    description:
      "Busur silang berpeluru proyektil bayangan tanpa suara desingan.",
    price: 16500,
    category: "weapon",
    tierKey: "EPIC",
    emoji: "🏹",
    iconType: "crossbow",
    attributes: { base_damage: 60, crit_rate: 0.25 },
  }),
  makeItem({
    id: "shadow_katana",
    name: "Katana Malam Pekat",
    description:
      "Pedang samurai legiun bayangan dengan tebasan membelah angin.",
    price: 17500,
    category: "weapon",
    tierKey: "EPIC",
    emoji: "🗡️",
    iconType: "katana",
    attributes: { base_damage: 68, bleed_chance: 0.35 },
  }),
  makeItem({
    id: "archmage_rod",
    name: "Tongkat Agung Archmage",
    description:
      "Pusaka penyihir agung yang memfokuskan resonansi mana kosmik.",
    price: 18000,
    category: "weapon",
    tierKey: "EPIC",
    emoji: "🔮",
    iconType: "staff_epic",
    attributes: { base_damage: 62, mana_reduction: 0.2 },
  }),
  makeItem({
    id: "thunder_glaive",
    name: "Glaive Badai Petir",
    description:
      "Senjata bilah galah yang memercikkan listrik statis bertegangan mega-volt.",
    price: 16800,
    category: "weapon",
    tierKey: "EPIC",
    emoji: "⚡",
    iconType: "glaive",
    attributes: { base_damage: 66, shock_chance: 0.3 },
  }),

  // Tier 5: Legendary (5)
  makeItem({
    id: "excalibur_neo",
    name: "Excalibur Neo-Hoshino",
    description:
      "Pedang suci legendaris yang bersinar terang membelah kegelapan abadi.",
    price: 55000,
    category: "weapon",
    tierKey: "LEGENDARY",
    emoji: "🌟",
    iconType: "excalibur",
    attributes: { base_damage: 120, holy_aura: 30 },
  }),
  makeItem({
    id: "solar_flame_bow",
    name: "Busur Api Surya Helios",
    description: "Busur yang ditempa dari percikan nyala matahari terbit.",
    price: 58000,
    category: "weapon",
    tierKey: "LEGENDARY",
    emoji: "🔥",
    iconType: "bow_fire",
    attributes: { base_damage: 115, burn_damage: 40 },
  }),
  makeItem({
    id: "void_edge",
    name: "Belati Singularity Void",
    description:
      "Bilah hitam pekat yang menyerap ruang dan waktu di sekitarnya.",
    price: 60000,
    category: "weapon",
    tierKey: "LEGENDARY",
    emoji: "🌌",
    iconType: "dagger_void",
    attributes: { base_damage: 110, true_damage: 25 },
  }),
  makeItem({
    id: "chrono_scepter",
    name: "Tongkat Distorsi Waktu",
    description: "Skeptrum berkekuatan kronos yang memperlambat reaksi musuh.",
    price: 64000,
    category: "weapon",
    tierKey: "LEGENDARY",
    emoji: "⏳",
    iconType: "scepter",
    attributes: { base_damage: 118, time_slow: 0.25 },
  }),
  makeItem({
    id: "dragon_lance",
    name: "Tombak Pembantai Naga",
    description: "Tombak ksatria yang dilapisi sisik dan taring naga purba.",
    price: 62000,
    category: "weapon",
    tierKey: "LEGENDARY",
    emoji: "🐉",
    iconType: "lance",
    attributes: { base_damage: 125, armor_break: 0.4 },
  }),

  // Tier 6: Mythic (5)
  makeItem({
    id: "hoshino_starlight_blade",
    name: "Bilah Bintang Hoshino Astral",
    description:
      "Pedang kosmik pamungkas yang ditempa langsung dari debu bintang surga.",
    price: 250000,
    category: "weapon",
    tierKey: "MYTHIC",
    emoji: "✨",
    iconType: "blade_mythic",
    attributes: { base_damage: 240, starlight_burst: 80, all_stats: 25 },
  }),
  makeItem({
    id: "celestial_bow",
    name: "Busur Konstelasi Zenith",
    description:
      "Anak panahnya berupa untaian cahaya galaksi yang tak pernah meleset.",
    price: 260000,
    category: "weapon",
    tierKey: "MYTHIC",
    emoji: "🌠",
    iconType: "bow_mythic",
    attributes: { base_damage: 230, auto_aim: true, crit_rate: 0.45 },
  }),
  makeItem({
    id: "abyssal_reaper",
    name: "Sabit Kematian Neo-Abyss",
    description:
      "Sabit penguasa jurang terdalam yang merenggut jiwa musuh dalam sekejap.",
    price: 275000,
    category: "weapon",
    tierKey: "MYTHIC",
    emoji: "💀",
    iconType: "scythe_mythic",
    attributes: { base_damage: 250, lifesteal: 0.35, execute_threshold: 0.15 },
  }),
  makeItem({
    id: "genesis_staff",
    name: "Tongkat Penciptaan Genesis",
    description:
      "Pusaka primordial asal mula alam semesta dengan sihir tanpa batas.",
    price: 280000,
    category: "weapon",
    tierKey: "MYTHIC",
    emoji: "🌌",
    iconType: "staff_mythic",
    attributes: { base_damage: 235, spell_echo: 2, mana_regen: 50 },
  }),
  makeItem({
    id: "infinity_spear",
    name: "Tombak Tak Hingga Ouroboros",
    description: "Tombak berputar siklus abadi yang menembus dimensi realitas.",
    price: 270000,
    category: "weapon",
    tierKey: "MYTHIC",
    emoji: "♾️",
    iconType: "spear_mythic",
    attributes: { base_damage: 245, pierce_infinite: true },
  }),
];

// ==========================================
// 2. KATEGORI: ARMOR (30 Item)
// ==========================================
const ARMORS = [
  // Tier 1: Common (5)
  makeItem({
    id: "cloth_tunic",
    name: "Tunika Kain Tipis",
    description:
      "Pakaian berbahan serat katun ringan untuk perlindungan dari debu.",
    price: 200,
    category: "armor",
    tierKey: "COMMON",
    emoji: "🥋",
    iconType: "chest_cloth",
    attributes: { defense: 4, max_hp: 10 },
  }),
  makeItem({
    id: "leather_cap",
    name: "Topi Kulit Sederhana",
    description:
      "Penutup kepala dari kulit binatang untuk menahan terik matahari.",
    price: 180,
    category: "armor",
    tierKey: "COMMON",
    emoji: "🧢",
    iconType: "helmet_leather",
    attributes: { defense: 3 },
  }),
  makeItem({
    id: "padded_boots",
    name: "Sepatu Bot Beralas Busa",
    description: "Sepatu empuk nyaman dipakai berjalan jauh di jalur setapak.",
    price: 220,
    category: "armor",
    tierKey: "COMMON",
    emoji: "👢",
    iconType: "boots_cloth",
    attributes: { defense: 3, movement_speed: 1.05 },
  }),
  makeItem({
    id: "wooden_buckler",
    name: "Perisai Kayu Bulat",
    description:
      "Perisai kecil dari papan kayu tebal penangkis sabetan cakar liar.",
    price: 250,
    category: "armor",
    tierKey: "COMMON",
    emoji: "🛡️",
    iconType: "shield_wood",
    attributes: { defense: 6, block_chance: 0.1 },
  }),
  makeItem({
    id: "linen_gloves",
    name: "Sarung Tangan Linen",
    description:
      "Sarung tangan pelindung telapak tangan dari gesekan tali dan kayu.",
    price: 150,
    category: "armor",
    tierKey: "COMMON",
    emoji: "🧤",
    iconType: "gloves_cloth",
    attributes: { defense: 2 },
  }),

  // Tier 2: Uncommon (5)
  makeItem({
    id: "iron_chestplate",
    name: "Baju Zirah Besi",
    description:
      "Pelat besi kokoh penutup dada yang mampu menahan tusukan panah.",
    price: 1300,
    category: "armor",
    tierKey: "UNCOMMON",
    emoji: "🦺",
    iconType: "chest_iron",
    attributes: { defense: 18, max_hp: 35 },
  }),
  makeItem({
    id: "iron_helmet",
    name: "Helm Pelindung Besi",
    description:
      "Helm tempaan pandai besi dengan celah penglihatan horizontal.",
    price: 950,
    category: "armor",
    tierKey: "UNCOMMON",
    emoji: "🪖",
    iconType: "helmet_iron",
    attributes: { defense: 12 },
  }),
  makeItem({
    id: "leather_boots",
    name: "Sepatu Bot Kulit Keras",
    description: "Sepatu bot tahan air bergesper besi untuk menjelajah rawa.",
    price: 900,
    category: "armor",
    tierKey: "UNCOMMON",
    emoji: "🥾",
    iconType: "boots_leather",
    attributes: { defense: 10, stamina_recovery: 0.05 },
  }),
  makeItem({
    id: "iron_shield",
    name: "Perisai Besi Segi Empat",
    description: "Perisai penjaga benteng berpelat besi anti-hantam.",
    price: 1100,
    category: "armor",
    tierKey: "UNCOMMON",
    emoji: "🛡️",
    iconType: "shield_iron",
    attributes: { defense: 16, block_chance: 0.18 },
  }),
  makeItem({
    id: "iron_gauntlets",
    name: "Sarung Tangan Besi Tempa",
    description:
      "Pelindung jemari dan pergelangan tangan dari hantaman senjata musuh.",
    price: 850,
    category: "armor",
    tierKey: "UNCOMMON",
    emoji: "🧤",
    iconType: "gloves_iron",
    attributes: { defense: 9, grip_strength: 10 },
  }),

  // Tier 3: Rare (5)
  makeItem({
    id: "steel_cuirass",
    name: "Zirah Baja Pelat Lengkung",
    description: "Zirah baja mengilap peredam benturan tebasan pedang musuh.",
    price: 4600,
    category: "armor",
    tierKey: "RARE",
    emoji: "🛡️",
    iconType: "chest_steel",
    attributes: { defense: 38, max_hp: 80, damage_reduction: 0.08 },
  }),
  makeItem({
    id: "reinforced_helm",
    name: "Helm Ksatria Bertanduk",
    description:
      "Helm zirah baja berornamen tanduk simbol keberanian prajurit.",
    price: 3600,
    category: "armor",
    tierKey: "RARE",
    emoji: "🪖",
    iconType: "helmet_steel",
    attributes: { defense: 26, stun_resistance: 0.2 },
  }),
  makeItem({
    id: "steel_greaves",
    name: "Greaves Pelindung Kaki Baja",
    description: "Pelindung tulang kering dan tempurung lutut dari baja tebal.",
    price: 3400,
    category: "armor",
    tierKey: "RARE",
    emoji: "🥾",
    iconType: "boots_steel",
    attributes: { defense: 24, knockback_resistance: 0.3 },
  }),
  makeItem({
    id: "tower_shield",
    name: "Perisai Menara Paladin",
    description:
      "Perisai setinggi tubuh yang melindungi penggunanya dari hujan panah.",
    price: 4200,
    category: "armor",
    tierKey: "RARE",
    emoji: "🛡️",
    iconType: "shield_tower",
    attributes: { defense: 36, block_chance: 0.3 },
  }),
  makeItem({
    id: "steel_bracers",
    name: "Bracers Baja Bertatah Batu",
    description:
      "Pelindung lengan berukir relief magis peningkat daya cengkeram.",
    price: 3200,
    category: "armor",
    tierKey: "RARE",
    emoji: "🦾",
    iconType: "gloves_steel",
    attributes: { defense: 22, parry_chance: 0.15 },
  }),

  // Tier 4: Epic (5)
  makeItem({
    id: "cyber_kinetic_armor",
    name: "Zirah Kinetik Cyber-Mesh",
    description:
      "Baju zirah berteknologi serat nano yang menyerap energi kinetik benturan.",
    price: 17000,
    category: "armor",
    tierKey: "EPIC",
    emoji: "🦺",
    iconType: "chest_cyber",
    attributes: { defense: 75, max_hp: 180, shield_barrier: 50 },
  }),
  makeItem({
    id: "plasma_visor",
    name: "Visor Taktis Plasma Neon",
    description:
      "Helm futuristik dengan HUD cerdas pendeteksi titik lemah musuh.",
    price: 14500,
    category: "armor",
    tierKey: "EPIC",
    emoji: "🥽",
    iconType: "helmet_cyber",
    attributes: { defense: 55, crit_detection: 0.2 },
  }),
  makeItem({
    id: "stealth_treads",
    name: "Sepatu Gravitasi Tanpa Jejak",
    description:
      "Sepatu bertenaga medan anti-gravitasi peredam suara langkah kaki.",
    price: 13800,
    category: "armor",
    tierKey: "EPIC",
    emoji: "👟",
    iconType: "boots_cyber",
    attributes: { defense: 50, dodge_chance: 0.18, movement_speed: 1.2 },
  }),
  makeItem({
    id: "force_barrier_shield",
    name: "Perisai Medan Pelindung Force",
    description:
      "Perisai hologram yang memancarkan dinding gaya pertahanan padat.",
    price: 16000,
    category: "armor",
    tierKey: "EPIC",
    emoji: "🛡️",
    iconType: "shield_cyber",
    attributes: { defense: 70, projectile_deflect: 0.35 },
  }),
  makeItem({
    id: "nano_mesh_gloves",
    name: "Sarung Tangan Serat Nano",
    description:
      "Sarung tangan sintetis berdaya regang tinggi pemancar pulsa kejutan.",
    price: 13000,
    category: "armor",
    tierKey: "EPIC",
    emoji: "🧤",
    iconType: "gloves_cyber",
    attributes: { defense: 48, attack_speed: 1.2 },
  }),

  // Tier 5: Legendary (5)
  makeItem({
    id: "aegis_of_radiance",
    name: "Zirah Emas Kemuliaan Aegis",
    description:
      "Baju zirah keemasan yang memancarkan aura suci pelumpuh kegelapan.",
    price: 65000,
    category: "armor",
    tierKey: "LEGENDARY",
    emoji: "✨",
    iconType: "chest_gold",
    attributes: { defense: 140, max_hp: 400, holy_ward: 0.25 },
  }),
  makeItem({
    id: "crown_of_valiance",
    name: "Mahkota Keberanian Raja Purba",
    description:
      "Mahkota emas permata merah simbol kegigihan pemimpin tanpa gentar.",
    price: 52000,
    category: "armor",
    tierKey: "LEGENDARY",
    emoji: "👑",
    iconType: "helmet_crown",
    attributes: { defense: 110, fear_immunity: true, bonus_exp: 0.15 },
  }),
  makeItem({
    id: "boots_of_hermes",
    name: "Sepatu Bersayap Hermes",
    description:
      "Sepatu magis bersayap emas yang memungkinkan pemakainya melayang di atas bahaya.",
    price: 49000,
    category: "armor",
    tierKey: "LEGENDARY",
    emoji: "🪽",
    iconType: "boots_wings",
    attributes: { defense: 100, evasion: 0.3, movement_speed: 1.4 },
  }),
  makeItem({
    id: "dragonscale_shield",
    name: "Perisai Sisik Naga Merah",
    description:
      "Perisai dari sisik naga legendaris yang kebal terhadap semburan api neraka.",
    price: 58000,
    category: "armor",
    tierKey: "LEGENDARY",
    emoji: "🛡️",
    iconType: "shield_dragon",
    attributes: { defense: 135, fire_immunity: true, thorns_damage: 45 },
  }),
  makeItem({
    id: "gauntlets_of_might",
    name: "Sarung Tangan Titan Perkasa",
    description:
      "Pelindung tangan raksasa yang melipatgandakan kekuatan fisik pemakainya.",
    price: 48000,
    category: "armor",
    tierKey: "LEGENDARY",
    emoji: "🥊",
    iconType: "gloves_titan",
    attributes: { defense: 105, bonus_attack_power: 40 },
  }),

  // Tier 6: Mythic (5)
  makeItem({
    id: "hoshino_astral_ward",
    name: "Jubah Astral Pelindung Hoshino",
    description:
      "Kain zirah tenunan nebula galaksi yang meregenerasi vitalitas secara instan.",
    price: 260000,
    category: "armor",
    tierKey: "MYTHIC",
    emoji: "🌌",
    iconType: "chest_mythic",
    attributes: {
      defense: 280,
      max_hp: 900,
      auto_hp_regen: 50,
      all_resist: 0.4,
    },
  }),
  makeItem({
    id: "celestial_diadem",
    name: "Diadem Nirwana Celestial",
    description:
      "Tiara cahaya abadi yang menganugerahkan kewaskitaan masa depan.",
    price: 240000,
    category: "armor",
    tierKey: "MYTHIC",
    emoji: "✨",
    iconType: "helmet_mythic",
    attributes: { defense: 230, fatal_strike_evasion: 0.4, max_stamina: 100 },
  }),
  makeItem({
    id: "void_walker_greaves",
    name: "Greaves Penjelajah Dimensi Void",
    description:
      "Pelindung kaki berongga dimensi yang dapat berteleportasi dari serangan fatal.",
    price: 235000,
    category: "armor",
    tierKey: "MYTHIC",
    emoji: "🌀",
    iconType: "boots_mythic",
    attributes: { defense: 220, phase_shift_chance: 0.35 },
  }),
  makeItem({
    id: "nebula_prism_guard",
    name: "Aegis Prisma Nebula Kosmis",
    description:
      "Perisai cermin prisma yang memantulkan 50% damage musuh kembali ke asalnya.",
    price: 270000,
    category: "armor",
    tierKey: "MYTHIC",
    emoji: "💎",
    iconType: "shield_mythic",
    attributes: { defense: 290, reflect_damage: 0.5, block_chance: 0.6 },
  }),
  makeItem({
    id: "stellar_aegis_brace",
    name: "Brace Pelindung Bintang Abadi",
    description: "Gelang zirah mitis penyerap kekuatan ledakan supernova.",
    price: 225000,
    category: "armor",
    tierKey: "MYTHIC",
    emoji: "💫",
    iconType: "gloves_mythic",
    attributes: { defense: 215, cooldown_reduction: 0.3 },
  }),
];

// ==========================================
// 3. KATEGORI: TOOL (30 Item)
// ==========================================
const TOOLS = [
  // Tier 1: Common (5)
  makeItem({
    id: "wooden_axe",
    name: "Kapak Kayu (Lv. 1)",
    description: "Kapak pemula untuk menebang kayu dahan pohon kecil di hutan.",
    price: 800,
    category: "tool",
    tierKey: "COMMON",
    emoji: "🪓",
    iconType: "axe",
    attributes: { upgrade_level: 1, base_efficiency: 10 },
  }),
  makeItem({
    id: "wooden_pickaxe",
    name: "Beliung Kayu (Lv. 1)",
    description:
      "Beliung sederhana untuk memecah batu kerikil dan batubara permukaan.",
    price: 800,
    category: "tool",
    tierKey: "COMMON",
    emoji: "⛏️",
    iconType: "pickaxe",
    attributes: { upgrade_level: 1, base_efficiency: 10 },
  }),
  makeItem({
    id: "fishing_rod",
    name: "Alat Pancing Bambu (Lv. 1)",
    description:
      "Pancing bambu ringan untuk menangkap ikan kecil di tepi dermaga.",
    price: 1500,
    category: "tool",
    tierKey: "COMMON",
    emoji: "🎣",
    iconType: "rod",
    attributes: { upgrade_level: 1, base_efficiency: 10 },
  }),
  makeItem({
    id: "basic_shovel",
    name: "Sekop Biasa",
    description: "Sekop standar agar pekerjaan menggali tanah lebih cepat.",
    price: 500,
    category: "tool",
    tierKey: "COMMON",
    emoji: "🪣",
    iconType: "shovel",
    attributes: { multiplier: 1.2 },
  }),
  makeItem({
    id: "wooden_sickle",
    name: "Sabit Kayu Pemula",
    description: "Sabit bergagang kayu untuk memanen rumput dan herba liar.",
    price: 450,
    category: "tool",
    tierKey: "COMMON",
    emoji: "🌾",
    iconType: "sickle",
    attributes: { harvest_speed: 1.1 },
  }),

  // Tier 2: Uncommon (5)
  makeItem({
    id: "iron_axe",
    name: "Kapak Besi (Lv. 2)",
    description: "Kapak dengan mata pisau besi tajam penumbang pohon jati.",
    price: 2500,
    category: "tool",
    tierKey: "UNCOMMON",
    emoji: "🪓",
    iconType: "axe_iron",
    attributes: { upgrade_level: 2, base_efficiency: 25 },
  }),
  makeItem({
    id: "iron_pickaxe",
    name: "Beliung Besi (Lv. 2)",
    description: "Beliung kokoh untuk menembus urat bijih besi di dalam gua.",
    price: 2500,
    category: "tool",
    tierKey: "UNCOMMON",
    emoji: "⛏️",
    iconType: "pickaxe_iron",
    attributes: { upgrade_level: 2, base_efficiency: 25 },
  }),
  makeItem({
    id: "fiber_fishing_rod",
    name: "Pancing Serat Kuat (Lv. 2)",
    description:
      "Pancing dengan senar serat nilon yang sanggup menahan ikan besar.",
    price: 3500,
    category: "tool",
    tierKey: "UNCOMMON",
    emoji: "🎣",
    iconType: "rod_fiber",
    attributes: { upgrade_level: 2, base_efficiency: 25 },
  }),
  makeItem({
    id: "iron_shovel",
    name: "Sekop Besi Pekerja",
    description: "Sekop baja tempa dengan bilah melengkung efisien.",
    price: 1800,
    category: "tool",
    tierKey: "UNCOMMON",
    emoji: "⛏️",
    iconType: "shovel_iron",
    attributes: { multiplier: 1.5 },
  }),
  makeItem({
    id: "iron_sickle",
    name: "Sabit Panen Besi",
    description:
      "Sabit bergerigi halus untuk melipatgandakan kecepatan panen kebun.",
    price: 1700,
    category: "tool",
    tierKey: "UNCOMMON",
    emoji: "🌾",
    iconType: "sickle_iron",
    attributes: { harvest_yield: 1.25 },
  }),

  // Tier 3: Rare (5)
  makeItem({
    id: "steel_axe",
    name: "Kapak Baja Bertuah (Lv. 3)",
    description:
      "Kapak baja tempered dengan bobot seimbang pemotong kayu purba.",
    price: 6500,
    category: "tool",
    tierKey: "RARE",
    emoji: "🪓",
    iconType: "axe_steel",
    attributes: { upgrade_level: 3, base_efficiency: 50 },
  }),
  makeItem({
    id: "steel_pickaxe",
    name: "Beliung Baja Murni (Lv. 3)",
    description: "Beliung kuat dengan ujung runcing penembus bebatuan kristal.",
    price: 6500,
    category: "tool",
    tierKey: "RARE",
    emoji: "⛏️",
    iconType: "pickaxe_steel",
    attributes: { upgrade_level: 3, base_efficiency: 50 },
  }),
  makeItem({
    id: "carbon_fishing_rod",
    name: "Pancing Karbon Presisi (Lv. 3)",
    description:
      "Joran berstruktur serat karbon sensitif untuk mendeteksi tarikan ikan langka.",
    price: 7500,
    category: "tool",
    tierKey: "RARE",
    emoji: "🎣",
    iconType: "rod_carbon",
    attributes: { upgrade_level: 3, base_efficiency: 50 },
  }),
  makeItem({
    id: "trench_shovel",
    name: "Sekop Parit Taktis",
    description:
      "Sekop berdaya gali tinggi yang mampu mengangkat tanah liat keras.",
    price: 5000,
    category: "tool",
    tierKey: "RARE",
    emoji: "⛏️",
    iconType: "shovel_steel",
    attributes: { multiplier: 2.0 },
  }),
  makeItem({
    id: "harvest_scythe",
    name: "Scythe Pemanen Gandum Emas",
    description:
      "Sabit panjang gagang ganda pembersih satu petak ladang dalam satu ayunan.",
    price: 5500,
    category: "tool",
    tierKey: "RARE",
    emoji: "🌾",
    iconType: "scythe_tool",
    attributes: { harvest_yield: 1.5, harvest_area: 2 },
  }),

  // Tier 4: Epic (5)
  makeItem({
    id: "laser_cutter_axe",
    name: "Kapak Pemotong Laser Plasma",
    description:
      "Alat penebang berenergi termal yang langsung mematangkan serat kayu.",
    price: 22000,
    category: "tool",
    tierKey: "EPIC",
    emoji: "⚡",
    iconType: "axe_laser",
    attributes: { upgrade_level: 4, base_efficiency: 90 },
  }),
  makeItem({
    id: "sonic_resonator_pickaxe",
    name: "Beliung Resonansi Sonik",
    description:
      "Beliung pemancar gelombang frekuensi tinggi peretak urat tambang dalam sekejap.",
    price: 22000,
    category: "tool",
    tierKey: "EPIC",
    emoji: "🔊",
    iconType: "pickaxe_sonic",
    attributes: { upgrade_level: 4, base_efficiency: 90 },
  }),
  makeItem({
    id: "titanium_deep_rod",
    name: "Joran Titanium Palung Laut",
    description:
      "Pancing berdaya tahan tekanan tinggi untuk memancing di Midnight Trench.",
    price: 24000,
    category: "tool",
    tierKey: "EPIC",
    emoji: "🎣",
    iconType: "rod_titanium",
    attributes: { upgrade_level: 4, base_efficiency: 90 },
  }),
  makeItem({
    id: "hydraulic_drill",
    name: "Bor Hidrolik Penggali Otomatis",
    description: "Bor bertenaga mikro-hidrolik penggali tanah ekspres.",
    price: 19000,
    category: "tool",
    tierKey: "EPIC",
    emoji: "🔩",
    iconType: "drill_cyber",
    attributes: { multiplier: 3.0 },
  }),
  makeItem({
    id: "plasma_reaper",
    name: "Sabit Reaper Energi Panen",
    description:
      "Alat panen otomatis pemetik sari tumbuhan tanpa merusak akarnya.",
    price: 20000,
    category: "tool",
    tierKey: "EPIC",
    emoji: "🌿",
    iconType: "reaper_cyber",
    attributes: { harvest_yield: 2.0, seed_save_chance: 0.3 },
  }),

  // Tier 5: Legendary (5)
  makeItem({
    id: "volcanic_fire_axe",
    name: "Kapak Magma Vulkanik (Lv. 5)",
    description:
      "Kapak berisi inti lava yang mengubah kayu tebangan menjadi arang berkilau.",
    price: 75000,
    category: "tool",
    tierKey: "LEGENDARY",
    emoji: "🌋",
    iconType: "axe_magma",
    attributes: { upgrade_level: 5, base_efficiency: 160 },
  }),
  makeItem({
    id: "meteor_strike_pickaxe",
    name: "Beliung Hantaman Meteorit",
    description:
      "Beliung dari pecahan meteor yang mengekstraksi permata tersembunyi.",
    price: 75000,
    category: "tool",
    tierKey: "LEGENDARY",
    emoji: "☄️",
    iconType: "pickaxe_meteor",
    attributes: { upgrade_level: 5, base_efficiency: 160 },
  }),
  makeItem({
    id: "abyssal_lure_rod",
    name: "Pancing Umpan Lumina Abisal",
    description:
      "Joran yang memancarkan pendar bioluminesensi penarik monster laut mitos.",
    price: 80000,
    category: "tool",
    tierKey: "LEGENDARY",
    emoji: "🦑",
    iconType: "rod_abyssal",
    attributes: { upgrade_level: 5, base_efficiency: 160 },
  }),
  makeItem({
    id: "terraformer_shovel",
    name: "Sekop Terraformer Bumi",
    description: "Alat pengubah topografi tanah dalam hitungan detik.",
    price: 68000,
    category: "tool",
    tierKey: "LEGENDARY",
    emoji: "🌍",
    iconType: "shovel_terra",
    attributes: { multiplier: 4.5 },
  }),
  makeItem({
    id: "golden_harvest_blade",
    name: "Sabit Kemakmuran Dewi Ceres",
    description:
      "Pusaka panen yang melipatgandakan hasil kebun menjadi 3 kali lipat.",
    price: 72000,
    category: "tool",
    tierKey: "LEGENDARY",
    emoji: "🌾",
    iconType: "sickle_ceres",
    attributes: { harvest_yield: 3.0, golden_crop_chance: 0.25 },
  }),

  // Tier 6: Mythic (5)
  makeItem({
    id: "hoshino_cosmic_cleaver",
    name: "Kapak Kosmik Hoshino Astral",
    description:
      "Pusaka penebang pohon berdaya cipta yang menumbuhkan tunas baru seketika.",
    price: 280000,
    category: "tool",
    tierKey: "MYTHIC",
    emoji: "🪓",
    iconType: "axe_mythic",
    attributes: {
      upgrade_level: 6,
      base_efficiency: 300,
      infinite_durability: true,
    },
  }),
  makeItem({
    id: "celestial_void_pickaxe",
    name: "Beliung Galaksi Celestial Void",
    description:
      "Beliung yang menambang mineral menembus lipatan ruang dimensi.",
    price: 280000,
    category: "tool",
    tierKey: "MYTHIC",
    emoji: "⛏️",
    iconType: "pickaxe_mythic",
    attributes: { upgrade_level: 6, base_efficiency: 300, instant_smelt: true },
  }),
  makeItem({
    id: "starlight_oceanic_rod",
    name: "Joran Samudra Cahaya Bintang",
    description:
      "Pancing suci yang mampu menjaring leviathan kuno dari palung laut terdalam.",
    price: 290000,
    category: "tool",
    tierKey: "MYTHIC",
    emoji: "✨",
    iconType: "rod_mythic",
    attributes: {
      upgrade_level: 6,
      base_efficiency: 300,
      mythic_catch_rate: 0.5,
    },
  }),
  makeItem({
    id: "quantum_core_extractor",
    name: "Ekstraktor Partikel Kuantum",
    description:
      "Alat pengurai molekul tanah penghasil bahan baku murni seketika.",
    price: 270000,
    category: "tool",
    tierKey: "MYTHIC",
    emoji: "⚛️",
    iconType: "extractor_mythic",
    attributes: { multiplier: 8.0 },
  }),
  makeItem({
    id: "chrono_harvester",
    name: "Sabit Percepatan Waktu Chrono",
    description:
      "Alat panen yang memajukan siklus pertumbuhan tanaman seketika.",
    price: 285000,
    category: "tool",
    tierKey: "MYTHIC",
    emoji: "⏳",
    iconType: "harvester_mythic",
    attributes: { harvest_yield: 5.0, instant_growth_pulse: true },
  }),
];

// ==========================================
// 4. KATEGORI: CONSUMABLE (30 Item)
// ==========================================
const CONSUMABLES = [
  // Tier 1: Common (5)
  makeItem({
    id: "apple",
    name: "Apel Segar Hutan",
    description:
      "Buah manis berair dari hutan. Mengisi +15 Lapar dan +5 Stamina.",
    price: 150,
    category: "consumable",
    tierKey: "COMMON",
    emoji: "🍎",
    iconType: "apple",
    attributes: { effects: { hunger: 15, stamina: 5 } },
  }),
  makeItem({
    id: "bread",
    name: "Roti Gandum Hangat",
    description:
      "Roti padat yang baru matang dari perapian. Mengisi +25 Lapar.",
    price: 200,
    category: "consumable",
    tierKey: "COMMON",
    emoji: "🍞",
    iconType: "bread",
    attributes: { effects: { hunger: 25, stamina: 8 } },
  }),
  makeItem({
    id: "water",
    name: "Air Mata Air Bersih",
    description:
      "Air pegunungan dingin penghilang dahaga. Mengisi +20 Stamina.",
    price: 100,
    category: "consumable",
    tierKey: "COMMON",
    emoji: "💧",
    iconType: "water",
    attributes: { effects: { stamina: 20 } },
  }),
  makeItem({
    id: "cooked_fish",
    name: "Ikan Bakar Rempah",
    description:
      "Ikan segar panggang dengan taburan garam laut. Mengisi +30 Lapar.",
    price: 350,
    category: "consumable",
    tierKey: "COMMON",
    emoji: "🐟",
    iconType: "fish_cooked",
    attributes: { effects: { hunger: 30, health: 15 } },
  }),
  makeItem({
    id: "berry",
    name: "Buah Liar Liar",
    description:
      "Segenggam beri hutan manis asam untuk camilan penambah energi.",
    price: 120,
    category: "consumable",
    tierKey: "COMMON",
    emoji: "🫐",
    iconType: "berries",
    attributes: { effects: { hunger: 10, stamina: 10 } },
  }),

  // Tier 2: Uncommon (5)
  makeItem({
    id: "healing_potion_small",
    name: "Ramuan Pemulih Kecil",
    description: "Cairan merah delima yang memulihkan +50 HP secara cepat.",
    price: 800,
    category: "consumable",
    tierKey: "UNCOMMON",
    emoji: "🧪",
    iconType: "potion_red_small",
    attributes: { effects: { health: 50 } },
  }),
  makeItem({
    id: "stamina_drink",
    name: "Minuman Isotonik Energi",
    description: "Minuman bervitamin yang memulihkan +60 Stamina seketika.",
    price: 750,
    category: "consumable",
    tierKey: "UNCOMMON",
    emoji: "🥤",
    iconType: "potion_green_small",
    attributes: { effects: { stamina: 60 } },
  }),
  makeItem({
    id: "cyber_ramen",
    name: "Cyber Neon Ramen",
    description:
      "Ramen kuah kaldu kental gurih dengan irisan daging tebal. +15% XP Profesi.",
    price: 950,
    category: "consumable",
    tierKey: "UNCOMMON",
    emoji: "🍜",
    iconType: "ramen",
    attributes: { effects: { hunger: 60, stamina: 40, buff: "PROFESSION_XP" } },
  }),
  makeItem({
    id: "honey_toast",
    name: "Roti Panggang Madu Liar",
    description:
      "Roti renyah dengan lelehan madu lebah hutan. Memulihkan vitalitas.",
    price: 850,
    category: "consumable",
    tierKey: "UNCOMMON",
    emoji: "🥞",
    iconType: "honey_toast",
    attributes: { effects: { hunger: 45, stamina: 35 } },
  }),
  makeItem({
    id: "energy_tea",
    name: "Teh Herbal Daun Mint",
    description: "Seduhan teh segar yang melenyapkan rasa kantuk dan lelah.",
    price: 700,
    category: "consumable",
    tierKey: "UNCOMMON",
    emoji: "🍵",
    iconType: "tea",
    attributes: { effects: { stamina: 50, focus_boost: 0.1 } },
  }),

  // Tier 3: Rare (5)
  makeItem({
    id: "healing_potion_medium",
    name: "Ramuan Pemulih Sedang",
    description: "Eliksir padat herba yang memulihkan +120 HP petualang.",
    price: 3200,
    category: "consumable",
    tierKey: "RARE",
    emoji: "🧪",
    iconType: "potion_red_med",
    attributes: { effects: { health: 120 } },
  }),
  makeItem({
    id: "vitality_brew",
    name: "Tonik Vitalitas Prima",
    description:
      "Ramuan yang menyegarkan kembali seluruh stamina (+120 Stamina).",
    price: 3000,
    category: "consumable",
    tierKey: "RARE",
    emoji: "🍶",
    iconType: "potion_green_med",
    attributes: { effects: { stamina: 120 } },
  }),
  makeItem({
    id: "sakura_latte",
    name: "Sakura Blossom Latte",
    description:
      "Kopi susu kelopak sakura hutan Neo-Hoshino. +10% Drop Tiket Dungeon.",
    price: 3500,
    category: "consumable",
    tierKey: "RARE",
    emoji: "🌸",
    iconType: "latte",
    attributes: {
      effects: { hunger: 50, stamina: 70, buff: "DUNGEON_PASS_DROP" },
    },
  }),
  makeItem({
    id: "smoked_abyssal_fillet",
    name: "Fillet Ikan Laut Dalam Asap",
    description:
      "Olahan ikan Midnight Trench yang memperkuat daya tahan tubuh.",
    price: 3800,
    category: "consumable",
    tierKey: "RARE",
    emoji: "🍣",
    iconType: "fillet",
    attributes: { effects: { hunger: 80, health: 60, def_buff: 15 } },
  }),
  makeItem({
    id: "mana_tonic",
    name: "Tonik Pemurni Mana",
    description:
      "Cairan kristal biru yang memulihkan cadangan sihir petualang.",
    price: 3400,
    category: "consumable",
    tierKey: "RARE",
    emoji: "🧪",
    iconType: "potion_blue_med",
    attributes: { effects: { mana: 100 } },
  }),

  // Tier 4: Epic (5)
  makeItem({
    id: "healing_potion_large",
    name: "Ramuan Pemulih Super",
    description:
      "Konsentrat sari bunga abadi yang memulihkan +300 HP seketika.",
    price: 12000,
    category: "consumable",
    tierKey: "EPIC",
    emoji: "⚗️",
    iconType: "potion_red_large",
    attributes: { effects: { health: 300 } },
  }),
  makeItem({
    id: "phoenix_elixir",
    name: "Eliksir Sayap Phoenix",
    description:
      "Cairan berkilau bulu phoenix yang menyembuhkan seluruh luka bakar dan racun.",
    price: 14000,
    category: "consumable",
    tierKey: "EPIC",
    emoji: "🔥",
    iconType: "potion_fire",
    attributes: { effects: { health: 250, cure_all: true } },
  }),
  makeItem({
    id: "starlight_boba",
    name: "Electric Starlight Boba",
    description:
      "Minuman boba bercahaya neon pemulih tenaga penuh. +10% Fragment Yield.",
    price: 13500,
    category: "consumable",
    tierKey: "EPIC",
    emoji: "🧋",
    iconType: "boba",
    attributes: {
      effects: { hunger: 100, stamina: 150, buff: "FRAGMENT_YIELD" },
    },
  }),
  makeItem({
    id: "abyssal_seafood_platter",
    name: "Hidangan Laut Palung Misterius",
    description:
      "Sajian kuliner laut dalam penambah +25% Attack Power di Dungeon.",
    price: 15000,
    category: "consumable",
    tierKey: "EPIC",
    emoji: "🦞",
    iconType: "platter",
    attributes: { effects: { hunger: 120, health: 100, buff: "DUNGEON_ATK" } },
  }),
  makeItem({
    id: "overdrive_serum",
    name: "Serum Stimulan Overdrive",
    description:
      "Serum sintetis yang melipatgandakan kecepatan gerak dan serang selama 10 menit.",
    price: 16000,
    category: "consumable",
    tierKey: "EPIC",
    emoji: "💉",
    iconType: "serum",
    attributes: { effects: { speed_boost: 0.5, attack_speed: 0.3 } },
  }),

  // Tier 5: Legendary (5)
  makeItem({
    id: "ambrosia_nectar",
    name: "Nektar Ambrosia Olympus",
    description:
      "Cairan dewa-dewi yang memulihkan HP dan Stamina hingga 100% penuh.",
    price: 45000,
    category: "consumable",
    tierKey: "LEGENDARY",
    emoji: "🏺",
    iconType: "ambrosia",
    attributes: { effects: { full_restore: true } },
  }),
  makeItem({
    id: "golden_apple_deluxe",
    name: "Apel Emas Murni Deluxe",
    description:
      "Apel berlapis emas murni dengan berkah pertahanan absolut selama 30 menit.",
    price: 48000,
    category: "consumable",
    tierKey: "LEGENDARY",
    emoji: "🍏",
    iconType: "golden_apple",
    attributes: { effects: { health: 500, invulnerable_seconds: 30 } },
  }),
  makeItem({
    id: "dragon_blood_elixir",
    name: "Eliksir Darah Naga Kuno",
    description:
      "Meminumnya menyulut kobaran api naga di urat nadi (+50% Serangan Tempur).",
    price: 52000,
    category: "consumable",
    tierKey: "LEGENDARY",
    emoji: "🩸",
    iconType: "dragon_potion",
    attributes: { effects: { atk_buff_percent: 50, duration_minutes: 60 } },
  }),
  makeItem({
    id: "celestial_feast",
    name: "Pesta Kuliner Perjamuan Surga",
    description:
      "Santapan perjamuan agung yang mencegah kematian 1x (Auto-Revive) saat tumbang.",
    price: 55000,
    category: "consumable",
    tierKey: "LEGENDARY",
    emoji: "🍗",
    iconType: "feast",
    attributes: { effects: { auto_revive: true, hunger: 200 } },
  }),
  makeItem({
    id: "time_warp_potion",
    name: "Ramuan Pemutar Waktu Chronos",
    description:
      "Memutar kembali cooldown seluruh skill dan aktivitas tanpa jeda.",
    price: 50000,
    category: "consumable",
    tierKey: "LEGENDARY",
    emoji: "⌛",
    iconType: "potion_chrono",
    attributes: { effects: { reset_all_cooldowns: true } },
  }),

  // Tier 6: Mythic (5)
  makeItem({
    id: "elixir_of_immortality",
    name: "Eliksir Keabadian Tirta Nirwana",
    description:
      "Tetesan ramuan legenda penciptaan yang menganugerahkan daya hidup abadi.",
    price: 240000,
    category: "consumable",
    tierKey: "MYTHIC",
    emoji: "✨",
    iconType: "potion_immortal",
    attributes: { effects: { max_hp_permanent_bonus: 50, full_heal: true } },
  }),
  makeItem({
    id: "hoshino_stardust_confection",
    name: "Manisan Bintang Hoshino",
    description:
      "Gula-gula manis bercahaya merah muda yang dibuat langsung oleh Naura. Mengembalikan 100% vitalitas.",
    price: 250000,
    category: "consumable",
    tierKey: "MYTHIC",
    emoji: "🍬",
    iconType: "candy_mythic",
    attributes: { effects: { all_vitals_max: true, affection_boost: 50 } },
  }),
  makeItem({
    id: "astral_miracle_broth",
    name: "Sup Mukjizat Kosmis Galaksi",
    description:
      "Kuah berkilau jutaan konstelasi yang memberikan berkah imunitas status negatif.",
    price: 260000,
    category: "consumable",
    tierKey: "MYTHIC",
    emoji: "🍲",
    iconType: "soup_mythic",
    attributes: { effects: { immune_all_debuffs: true, duration_hours: 4 } },
  }),
  makeItem({
    id: "primordial_dew",
    name: "Embun Purba Pohon Yggdrasil",
    description:
      "Satu tetes embun asal kehidupan yang membangkitkan kembali stamina tanpa batas.",
    price: 245000,
    category: "consumable",
    tierKey: "MYTHIC",
    emoji: "💧",
    iconType: "dew_mythic",
    attributes: { effects: { infinite_stamina_minutes: 30 } },
  }),
  makeItem({
    id: "chrono_revival_tincture",
    name: "Tinktur Kebangkitan Sang Pengelana",
    description:
      "Obat cair misterius yang menjamin keselamatan total saat ekspedisi The Neo-Abyss.",
    price: 255000,
    category: "consumable",
    tierKey: "MYTHIC",
    emoji: "🧪",
    iconType: "tincture_mythic",
    attributes: { effects: { abyss_insurance: true, double_loot: true } },
  }),
];

// ==========================================
// 5. KATEGORI: MATERIAL (30 Item)
// ==========================================
const MATERIALS = [
  // Tier 1: Common (5)
  makeItem({
    id: "wood",
    name: "Kayu Gelondongan",
    description:
      "Kayu mentah dari pohon hutan. Bahan dasar perkakas dan bangunan.",
    price: 50,
    category: "material",
    tierKey: "COMMON",
    emoji: "🪵",
    iconType: "wood",
  }),
  makeItem({
    id: "stone",
    name: "Batu Sungai",
    description: "Batu keras yang dapat dipecah menjadi material pondasi.",
    price: 50,
    category: "material",
    tierKey: "COMMON",
    emoji: "🪨",
    iconType: "stone",
  }),
  makeItem({
    id: "copper_ore",
    name: "Bijih Tembaga",
    description:
      "Batuan mineral berkilau kemerahan untuk peleburan ingot dasar.",
    price: 80,
    category: "material",
    tierKey: "COMMON",
    emoji: "🧱",
    iconType: "ore_copper",
  }),
  makeItem({
    id: "fiber",
    name: "Serat Tumbuhan Liar",
    description:
      "Untaian serat alami yang dapat dipilin menjadi tali dan kain.",
    price: 40,
    category: "material",
    tierKey: "COMMON",
    emoji: "🌾",
    iconType: "fiber",
  }),
  makeItem({
    id: "sand",
    name: "Pasir Kuarsa Pantai",
    description: "Pasir halus bahan baku pembuatan kaca dan botol ramuan.",
    price: 30,
    category: "material",
    tierKey: "COMMON",
    emoji: "🏖️",
    iconType: "sand",
  }),

  // Tier 2: Uncommon (5)
  makeItem({
    id: "iron_ore",
    name: "Bijih Besi Murni",
    description:
      "Mineral logam hitam pekat bahan baku pembuatan senjata dan zirah.",
    price: 200,
    category: "material",
    tierKey: "UNCOMMON",
    emoji: "⛏️",
    iconType: "ore_iron",
  }),
  makeItem({
    id: "coal",
    name: "Batubara Padat",
    description:
      "Bahan bakar perapian tungku peleburan logam dengan panas stabil.",
    price: 150,
    category: "material",
    tierKey: "UNCOMMON",
    emoji: "⬛",
    iconType: "coal",
  }),
  makeItem({
    id: "leather",
    name: "Kulit Hewan Olahan",
    description:
      "Kulit samak elastis untuk pelapis pegangan senjata dan baju zirah.",
    price: 250,
    category: "material",
    tierKey: "UNCOMMON",
    emoji: "📜",
    iconType: "leather",
  }),
  makeItem({
    id: "refined_wood",
    name: "Papan Kayu Halus",
    description:
      "Kayu olahan yang sudah diserut rapi untuk mebel dan gagang perkakas.",
    price: 180,
    category: "material",
    tierKey: "UNCOMMON",
    emoji: "🪵",
    iconType: "plank",
  }),
  makeItem({
    id: "clay",
    name: "Tanah Liat Porselen",
    description: "Tanah liat lentur bahan pembuatan keramik dan wadah kafe.",
    price: 120,
    category: "material",
    tierKey: "UNCOMMON",
    emoji: "🏺",
    iconType: "clay",
  }),

  // Tier 3: Rare (5)
  makeItem({
    id: "silver_ore",
    name: "Bijih Perak Mengilap",
    description:
      "Logam mulia konduktor sihir bahan pembuatan senjata anti-iblis.",
    price: 800,
    category: "material",
    tierKey: "RARE",
    emoji: "🪙",
    iconType: "ore_silver",
  }),
  makeItem({
    id: "steel_ingot",
    name: "Batang Baja Berkualitas",
    description:
      "Paduan besi dan karbon yang ditempa berulang kali tanpa retak.",
    price: 1100,
    category: "material",
    tierKey: "RARE",
    emoji: "🧱",
    iconType: "ingot_steel",
  }),
  makeItem({
    id: "topaz",
    name: "Permata Topaz Kuning",
    description:
      "Kristal mineral alami berhawa hangat penyimpan daya listrik alam.",
    price: 1500,
    category: "material",
    tierKey: "RARE",
    emoji: "💎",
    iconType: "gem_topaz",
  }),
  makeItem({
    id: "hardened_leather",
    name: "Kulit Badak Diperkeras",
    description:
      "Kulit binatang buas yang direbus minyak khusus hingga sekeras baja.",
    price: 950,
    category: "material",
    tierKey: "RARE",
    emoji: "🛡️",
    iconType: "leather_hard",
  }),
  makeItem({
    id: "obsidian",
    name: "Kaca Vulkanik Obsidian",
    description:
      "Batu hitam mengilap hasil pembekuan lava cair yang sangat tajam.",
    price: 1300,
    category: "material",
    tierKey: "RARE",
    emoji: "🪨",
    iconType: "obsidian",
  }),

  // Tier 4: Epic (5)
  makeItem({
    id: "plasma_core",
    name: "Inti Plasma Mikro-Fusi",
    description:
      "Kapsul energi bertegangan tinggi untuk menggerakkan mesin senjata canggih.",
    price: 5500,
    category: "material",
    tierKey: "EPIC",
    emoji: "🔋",
    iconType: "core_plasma",
  }),
  makeItem({
    id: "titanium_ore",
    name: "Bijih Titanium Palung Laut",
    description:
      "Logam ultraringan berdaya tahan luar biasa dari dasar samudra.",
    price: 4800,
    category: "material",
    tierKey: "EPIC",
    emoji: "⛏️",
    iconType: "ore_titanium",
  }),
  makeItem({
    id: "ruby_crystal",
    name: "Kristal Delima Api Merah",
    description: "Permata bercahaya merah tua penyimpan gelora api primordial.",
    price: 6000,
    category: "material",
    tierKey: "EPIC",
    emoji: "💎",
    iconType: "gem_ruby",
  }),
  makeItem({
    id: "abyssal_spores",
    name: "Spora Hayati Neo-Abyss",
    description:
      "Partikel biologis bercahaya ungu dari jurang dalam untuk mutasi tanaman.",
    price: 5200,
    category: "material",
    tierKey: "EPIC",
    emoji: "🍄",
    iconType: "spores",
  }),
  makeItem({
    id: "nano_fiber",
    name: "Anyaman Serat Karbon Nano",
    description:
      "Kain sintetis buatan lab militer yang tahan peluru dan sayatan pisau.",
    price: 4500,
    category: "material",
    tierKey: "EPIC",
    emoji: "🧵",
    iconType: "nanofiber",
  }),

  // Tier 5: Legendary (5)
  makeItem({
    id: "meteor_fragment",
    name: "Serpihan Meteorit Bintang Jatuh",
    description:
      "Pecahan batu antariksa yang memancarkan radiasi gravitasi stabil.",
    price: 22000,
    category: "material",
    tierKey: "LEGENDARY",
    emoji: "☄️",
    iconType: "meteor",
  }),
  makeItem({
    id: "dragon_scale",
    name: "Sisik Naga Zamrud Purba",
    description:
      "Sisik naga purba yang tahan terhadap panas magma dan gigitan es beku.",
    price: 25000,
    category: "material",
    tierKey: "LEGENDARY",
    emoji: "🐉",
    iconType: "scale",
  }),
  makeItem({
    id: "diamond",
    name: "Berlian Sempurna 100 Karat",
    description: "Batu mulia terkeras di dunia tanpa cacat sedikit pun.",
    price: 28000,
    category: "material",
    tierKey: "LEGENDARY",
    emoji: "💎",
    iconType: "gem_diamond",
  }),
  makeItem({
    id: "celestial_essence",
    name: "Esensi Cahaya Nirwana",
    description:
      "Cahaya suci yang dipadatkan menjadi embun kristal pembawa kedamaian.",
    price: 26000,
    category: "material",
    tierKey: "LEGENDARY",
    emoji: "✨",
    iconType: "essence_celestial",
  }),
  makeItem({
    id: "dark_matter_nugget",
    name: "Gumpalan Materi Gelap",
    description:
      "Massa padat misterius pembengkok gravitasi dan garis pandang.",
    price: 24000,
    category: "material",
    tierKey: "LEGENDARY",
    emoji: "🕳️",
    iconType: "dark_matter",
  }),

  // Tier 6: Mythic (5)
  makeItem({
    id: "hoshino_star_core",
    name: "Inti Bintang Hoshino Asli",
    description:
      "Kristal jantung galaksi bercahaya merah muda ciptaan Dewi Naura.",
    price: 120000,
    category: "material",
    tierKey: "MYTHIC",
    emoji: "⭐",
    iconType: "star_core_mythic",
  }),
  makeItem({
    id: "void_singularity_pearl",
    name: "Mutiara Singularitas Void",
    description:
      "Mutiara hitam pekat berputar abadi yang menampung pusaran lubang hitam.",
    price: 115000,
    category: "material",
    tierKey: "MYTHIC",
    emoji: "🔮",
    iconType: "pearl_void",
  }),
  makeItem({
    id: "cosmic_ether",
    name: "Eter Kosmis Penenun Galaksi",
    description:
      "Substansi tak berwujud pembentuk jalinan ruang dan waktu semesta.",
    price: 125000,
    category: "material",
    tierKey: "MYTHIC",
    emoji: "🌌",
    iconType: "ether_mythic",
  }),
  makeItem({
    id: "primordial_aetherium",
    name: "Logam Hidup Aetherium Murni",
    description:
      "Logam cair bercahaya emas yang berdetak seperti jantung makhluk hidup.",
    price: 130000,
    category: "material",
    tierKey: "MYTHIC",
    emoji: "✨",
    iconType: "aetherium",
  }),
  makeItem({
    id: "chronos_crystal",
    name: "Kristal Penghenti Waktu Chronos",
    description:
      "Kristal waktu yang membekukan aliran detik dan menit di sekitarnya.",
    price: 128000,
    category: "material",
    tierKey: "MYTHIC",
    emoji: "⏳",
    iconType: "chronos_crystal",
  }),
];

// Matriks Gabungan 150 Item Resmi Seimbang
const BALANCED_ITEMS_CATALOG = Object.freeze([
  ...WEAPONS,
  ...ARMORS,
  ...TOOLS,
  ...CONSUMABLES,
  ...MATERIALS,
]);

// Pemetaan cepat berdasarkan ID
const CATALOG_BY_ID = new Map();
for (const item of BALANCED_ITEMS_CATALOG) {
  CATALOG_BY_ID.set(item.id, item);
}

module.exports = {
  TIERS,
  WEAPONS,
  ARMORS,
  TOOLS,
  CONSUMABLES,
  MATERIALS,
  BALANCED_ITEMS_CATALOG,
  CATALOG_BY_ID,
  getItemFromCatalog: (id) => CATALOG_BY_ID.get(id) || null,
};
