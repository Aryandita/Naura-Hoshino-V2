// Lokasi: scripts/generateItemIcons.js
// Generator aset gambar SVG vektor berkualitas tinggi untuk 123 item Naura Wilds
// Memiliki estetika Cyber-Anime Glassmorphism dengan border glow & palet warna tier resmi

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  BALANCED_ITEMS_CATALOG,
} = require("../src/survival/data/items_catalog");

// Target direktori aset publik
const TARGET_DIRS = [
  path.join(__dirname, "../dashboard/public/items"),
  path.join(__dirname, "../dashboard/dist/items"),
  path.join(__dirname, "../assets/items"),
];

// Pastikan semua direktori tujuan tersedia
for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper warna per tier (Sistem 5-Tier Naura Wilds)
const TIER_CONFIG = {
  1: { glow: "#9CA3AF", badge: "I", name: "COMMON" },
  2: { glow: "#86EFAC", badge: "II", name: "UNCOMMON" },
  3: { glow: "#93C5FD", badge: "III", name: "RARE" },
  4: { glow: "#C084FC", badge: "IV", name: "EPIC" },
  5: { glow: "#FFD700", badge: "V", name: "LEGENDARY" },
};

/**
 * Menghasilkan elemen visual spesifik berdasarkan iconType / category
 */
function getVectorArt(item) {
  const color = item.tierColor || "#9CA3AF";
  const icon = (item.iconType || item.category || "").toLowerCase();

  // 1. KATEGORI SENJATA & ALAT TEMPUR (WEAPONS)
  if (icon.includes("excalibur")) {
    return `
      <!-- Pedang Legendaris Excalibur Prime -->
      <polygon points="64,12 70,30 64,26 58,30" fill="${color}" filter="url(#glowFilter)" />
      <path d="M64 18 L73 34 L71 80 L64 88 L57 80 L55 34 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2.5" filter="url(#glowFilter)" />
      <line x1="64" y1="22" x2="64" y2="82" stroke="#ffffff" stroke-width="2" opacity="0.9" />
      <!-- Sayap Pelindung Garde Bertuah -->
      <path d="M40 82 C52 78, 58 84, 64 86 C70 84, 76 78, 88 82 L84 89 C74 86, 68 90, 64 90 C60 90, 54 86, 44 89 Z" fill="#1e293b" stroke="${color}" stroke-width="2" />
      <circle cx="64" cy="87" r="4.5" fill="${color}" filter="url(#glowFilter)" />
      <circle cx="64" cy="87" r="2" fill="#ffffff" />
      <rect x="61" y="90" width="6" height="20" rx="3" fill="#0f172a" stroke="${color}" stroke-width="1.2" />
      <polygon points="64,112 70,119 58,119" fill="${color}" stroke="#ffffff" stroke-width="1" />
    `;
  }

  if (icon.includes("sword") || icon.includes("blade") || icon.includes("rapier")) {
    return `
      <!-- Bilah Pedang Presisi -->
      <path d="M64 20 L72 32 L70 82 L64 90 L58 82 L56 32 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="64" y1="24" x2="64" y2="84" stroke="#ffffff" stroke-width="1.5" opacity="0.8" />
      <path d="M46 86 C54 84, 74 84, 82 86 L80 92 C72 90, 56 90, 48 92 Z" fill="#2d3748" stroke="${color}" stroke-width="1.5" />
      <rect x="61" y="92" width="6" height="18" rx="2" fill="#1a202c" stroke="#4a5568" stroke-width="1" />
      <circle cx="64" cy="113" r="5" fill="${color}" stroke="#ffffff" stroke-width="1" />
    `;
  }

  if (icon.includes("dagger") || icon.includes("stiletto")) {
    return `
      <!-- Belati Taktis Ramping -->
      <path d="M64 28 L73 44 L69 82 L64 88 L59 82 L55 44 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="64" y1="32" x2="64" y2="82" stroke="#ffffff" stroke-width="1.5" opacity="0.8" />
      <path d="M50 86 L78 86 L76 91 L52 91 Z" fill="#2d3748" stroke="${color}" stroke-width="1.5" />
      <rect x="62" y="91" width="4" height="15" rx="1.5" fill="#1a202c" />
      <circle cx="64" cy="110" r="4" fill="${color}" />
    `;
  }

  if (icon.includes("bow")) {
    return `
      <!-- Busur Senar Plasma -->
      <path d="M42 30 C32 50, 32 78, 42 98 C46 95, 46 90, 44 86 C38 72, 38 56, 44 42 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="42" y1="32" x2="88" y2="64" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3,1" opacity="0.7" />
      <line x1="42" y1="96" x2="88" y2="64" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3,1" opacity="0.7" />
      <line x1="38" y1="64" x2="96" y2="64" stroke="${color}" stroke-width="2.5" />
      <polygon points="96,64 88,60 90,64 88,68" fill="${color}" />
    `;
  }

  if (icon.includes("wand") || icon.includes("staff") || icon.includes("scepter")) {
    return `
      <!-- Tongkat Sihir Magitech -->
      <rect x="62" y="38" width="4" height="74" rx="2" fill="#2d3748" stroke="#4a5568" stroke-width="1" />
      <circle cx="64" cy="30" r="14" fill="url(#orbGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <polygon points="64,18 72,30 64,42 56,30" fill="${color}" opacity="0.6" />
      <circle cx="64" cy="30" r="4" fill="#ffffff" />
      <ellipse cx="64" cy="30" rx="20" ry="6" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="4,2" opacity="0.7" />
    `;
  }

  if (icon.includes("spear") || icon.includes("trident") || icon.includes("lance") || icon.includes("polearm")) {
    return `
      <!-- Tombak & Trident Tempur -->
      <line x1="64" y1="42" x2="64" y2="114" stroke="#4a5568" stroke-width="4" stroke-linecap="round" />
      <path d="M64 16 L74 42 L64 38 L54 42 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <path d="M48 28 L54 44 L48 42 Z" fill="${color}" opacity="0.8" />
      <path d="M80 28 L74 44 L80 42 Z" fill="${color}" opacity="0.8" />
      <circle cx="64" cy="46" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("scythe") || icon.includes("reaper")) {
    return `
      <!-- Sabit Bulan Sabit / Scythe -->
      <path d="M68 32 C68 32, 62 70, 58 112" stroke="#2d3748" stroke-width="4" stroke-linecap="round" />
      <path d="M68 32 C78 20, 98 22, 102 36 C92 38, 76 44, 66 52 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="68" cy="34" r="4" fill="${color}" />
    `;
  }

  // 2. KATEGORI PERLENGKAPAN & ZIRAH (ARMOR)
  if (icon.includes("chest") || icon.includes("tunic") || icon.includes("vest") || icon.includes("exosuit")) {
    return `
      <!-- Pelindung Dada Zirah / Chestplate -->
      <path d="M42 34 L54 28 L64 34 L74 28 L86 34 L82 72 L64 88 L46 72 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <path d="M50 42 L64 52 L78 42 L76 66 L64 78 L52 66 Z" fill="#1a202c" stroke="${color}" stroke-width="1.5" opacity="0.8" />
      <circle cx="64" cy="56" r="6" fill="${color}" />
      <circle cx="64" cy="56" r="2.5" fill="#ffffff" />
    `;
  }

  if (icon.includes("helm") || icon.includes("cap") || icon.includes("crown") || icon.includes("hood")) {
    return `
      <!-- Helm Tempur & Pelindung Kepala -->
      <path d="M40 50 C40 30, 88 30, 88 50 L86 78 L78 84 L50 84 L42 78 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <path d="M48 54 L80 54 L76 64 L52 64 Z" fill="${color}" opacity="0.9" filter="url(#glowFilter)" />
      <line x1="50" y1="59" x2="78" y2="59" stroke="#ffffff" stroke-width="1.5" />
    `;
  }

  if (icon.includes("shield") || icon.includes("buckler")) {
    return `
      <!-- Perisai Energi & Pelindung -->
      <path d="M38 34 C54 32, 74 32, 90 34 L88 70 C84 88, 64 98, 64 98 C64 98, 44 88, 40 70 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2.5" filter="url(#glowFilter)" />
      <path d="M46 42 L82 42 L80 66 C76 80, 64 88, 64 88 C64 88, 52 80, 48 66 Z" fill="#1a202c" stroke="${color}" stroke-width="1.5" />
      <circle cx="64" cy="62" r="7" fill="${color}" />
      <circle cx="64" cy="62" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("boots") || icon.includes("treads") || icon.includes("greaves")) {
    return `
      <!-- Sepatu Tempur / Exo-Boots -->
      <path d="M48 38 L62 38 L62 68 L76 74 L76 88 L44 88 L44 68 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="48" y1="48" x2="62" y2="48" stroke="${color}" stroke-width="2" />
      <line x1="48" y1="58" x2="62" y2="58" stroke="${color}" stroke-width="2" />
      <rect x="42" y="84" width="36" height="6" rx="2" fill="#2d3748" stroke="${color}" stroke-width="1" />
    `;
  }

  // 3. KATEGORI ALAT KERJA (TOOLS)
  if (icon.includes("axe")) {
    return `
      <!-- Kapak Kayu & Tempur -->
      <line x1="48" y1="102" x2="78" y2="34" stroke="#4a5568" stroke-width="5" stroke-linecap="round" />
      <path d="M72 32 C86 20, 94 36, 88 56 C80 50, 74 48, 66 48 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="70" cy="46" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("pickaxe")) {
    return `
      <!-- Beliung Tambang Presisi -->
      <line x1="44" y1="104" x2="76" y2="40" stroke="#4a5568" stroke-width="5" stroke-linecap="round" />
      <path d="M48 30 C64 36, 82 36, 96 46 L86 52 C74 44, 62 44, 52 38 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="72" cy="42" r="3" fill="${color}" />
    `;
  }

  if (icon.includes("hammer")) {
    return `
      <!-- Palu Tempa Pandai Besi -->
      <line x1="44" y1="106" x2="76" y2="42" stroke="#4a5568" stroke-width="5" stroke-linecap="round" />
      <rect x="66" y="28" width="28" height="18" rx="3" transform="rotate(-30 76 38)" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="72" y1="32" x2="84" y2="52" stroke="${color}" stroke-width="2" />
    `;
  }

  if (icon.includes("hoe")) {
    return `
      <!-- Cangkul Pertanian Modern -->
      <line x1="44" y1="104" x2="76" y2="38" stroke="#4a5568" stroke-width="4.5" stroke-linecap="round" />
      <path d="M72 38 L92 48 L84 72 L66 60 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="72" cy="48" r="2.5" fill="#ffffff" />
    `;
  }

  if (icon.includes("can")) {
    return `
      <!-- Ceret Penyiram Tanaman Magitech -->
      <path d="M42 56 L72 56 C76 56, 78 60, 78 66 L74 94 C74 98, 70 102, 64 102 L48 102 C42 102, 38 98, 38 94 L38 66 C38 60, 40 56, 42 56 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <!-- Gagang Lengkung -->
      <path d="M38 66 C28 66, 28 92, 38 92" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" />
      <!-- Corong Penyiram -->
      <line x1="74" y1="80" x2="98" y2="60" stroke="#4a5568" stroke-width="4" stroke-linecap="round" />
      <ellipse cx="98" cy="58" rx="6" ry="4" transform="rotate(-30 98 58)" fill="${color}" filter="url(#glowFilter)" />
      <circle cx="102" cy="70" r="2" fill="${color}" opacity="0.8" />
    `;
  }

  if (icon.includes("rod")) {
    return `
      <!-- Joran Pancing Karbon -->
      <path d="M40 102 C54 78, 68 50, 92 32" stroke="#4a5568" stroke-width="3.5" fill="none" stroke-linecap="round" />
      <path d="M92 32 C96 52, 88 74, 84 94" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3,1" fill="none" />
      <path d="M84 94 C82 98, 86 102, 88 100" stroke="${color}" stroke-width="2" fill="none" />
      <circle cx="84" cy="94" r="3" fill="${color}" filter="url(#glowFilter)" />
    `;
  }

  // 4. KATEGORI KONSUMSI & MAKANAN (CONSUMABLES)
  if (icon.includes("potion") || icon.includes("elixir") || icon.includes("tonic")) {
    return `
      <!-- Botol Ramuan Alkimia -->
      <path d="M58 32 L70 32 L70 42 L84 64 C88 74, 84 88, 76 94 C68 98, 60 98, 52 94 C44 88, 40 74, 44 64 L58 42 Z" fill="#1a202c" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <path d="M46 68 C56 64, 72 64, 82 68 L80 84 C76 92, 64 94, 64 94 C64 94, 52 92, 48 84 Z" fill="url(#potionGrad)" />
      <rect x="59" y="24" width="10" height="8" rx="2" fill="#d97706" />
      <circle cx="60" cy="78" r="2.5" fill="#ffffff" opacity="0.8" />
      <circle cx="68" cy="84" r="1.5" fill="#ffffff" opacity="0.6" />
    `;
  }

  if (icon.includes("drink")) {
    return `
      <!-- Kaleng Minuman Berenergi / Soda -->
      <rect x="48" y="36" width="32" height="66" rx="6" fill="#1e293b" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <rect x="52" y="52" width="24" height="34" rx="3" fill="url(#potionGrad)" />
      <ellipse cx="64" cy="36" rx="14" ry="4" fill="#475569" stroke="${color}" stroke-width="1.5" />
      <circle cx="64" cy="36" r="2.5" fill="#ffffff" />
      <line x1="56" y1="62" x2="72" y2="76" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
    `;
  }

  if (icon.includes("food") || icon.includes("bread") || icon.includes("ramen") || icon.includes("meat")) {
    return `
      <!-- Sajian Kuliner Hangat / Ramen -->
      <path d="M36 60 C36 88, 92 88, 92 60 Z" fill="#1e293b" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <ellipse cx="64" cy="60" rx="28" ry="10" fill="url(#potionGrad)" stroke="${color}" stroke-width="1.5" />
      <path d="M52 50 C52 40, 56 36, 56 30" stroke="#f1f5f9" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7" />
      <path d="M64 48 C64 38, 68 34, 68 28" stroke="#f1f5f9" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.8" />
      <path d="M76 50 C76 40, 72 36, 72 30" stroke="#f1f5f9" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7" />
    `;
  }

  // 5. KATEGORI BAHAN BAKU & MATERIAL (MATERIALS)
  if (icon.includes("herb")) {
    return `
      <!-- Tanaman Herbal Bioluminescent -->
      <path d="M64 96 C64 74, 64 54, 64 36" stroke="#10b981" stroke-width="3" stroke-linecap="round" />
      <!-- Daun Tengah -->
      <path d="M64 36 C56 22, 72 22, 64 36" fill="url(#gemGrad)" stroke="${color}" stroke-width="1.5" filter="url(#glowFilter)" />
      <!-- Daun Kiri & Kanan -->
      <path d="M64 62 C46 54, 46 72, 64 68" fill="url(#gemGrad)" stroke="${color}" stroke-width="1.5" filter="url(#glowFilter)" />
      <path d="M64 52 C82 44, 82 62, 64 58" fill="url(#gemGrad)" stroke="${color}" stroke-width="1.5" filter="url(#glowFilter)" />
      <circle cx="64" cy="30" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("essence") || icon.includes("drop")) {
    return `
      <!-- Esensi Magis / Tetesan Elemen -->
      <path d="M64 24 C78 44, 86 64, 82 78 C76 94, 52 94, 46 78 C42 64, 50 44, 64 24 Z" fill="url(#orbGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="64" cy="68" r="8" fill="#ffffff" opacity="0.8" filter="url(#glowFilter)" />
      <circle cx="64" cy="68" r="3" fill="${color}" />
    `;
  }

  if (icon.includes("ore") || icon.includes("stone")) {
    return `
      <!-- Bongkahan Bijih & Batu Kristal -->
      <polygon points="64,28 88,44 82,78 64,96 42,82 40,48" fill="#2d3748" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <polygon points="64,28 72,52 64,74 52,48" fill="url(#gemGrad)" opacity="0.9" />
      <polygon points="88,44 72,52 82,78" fill="${color}" opacity="0.6" />
      <circle cx="64" cy="52" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("ingot")) {
    return `
      <!-- Batangan Logam Mulia Bertumpuk -->
      <polygon points="46,46 82,46 92,62 36,62" fill="url(#gemGrad)" stroke="${color}" stroke-width="1.5" filter="url(#glowFilter)" />
      <polygon points="36,62 92,62 86,84 42,84" fill="#1a202c" stroke="${color}" stroke-width="1.5" />
      <polygon points="82,46 92,62 86,84" fill="${color}" opacity="0.5" />
      <line x1="44" y1="62" x2="84" y2="62" stroke="#ffffff" stroke-width="1" />
    `;
  }

  if (icon.includes("crystal")) {
    return `
      <!-- Kristal Murni Crystalline -->
      <polygon points="64,24 88,44 64,102 40,44" fill="url(#gemGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <polygon points="64,24 74,44 64,102 54,44" fill="#ffffff" opacity="0.4" />
      <line x1="40" y1="44" x2="88" y2="44" stroke="#ffffff" stroke-width="1.5" />
    `;
  }

  if (icon.includes("wood")) {
    return `
      <!-- Gelondongan Kayu Hutan -->
      <ellipse cx="64" cy="46" rx="26" ry="12" fill="#78350f" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <ellipse cx="64" cy="46" rx="16" ry="7" fill="none" stroke="#d97706" stroke-width="1.5" />
      <circle cx="64" cy="46" r="3" fill="${color}" />
      <path d="M38 46 L38 84 C38 90, 50 96, 64 96 C78 96, 90 90, 90 84 L90 46" fill="#451a03" stroke="${color}" stroke-width="2" />
    `;
  }

  if (icon.includes("fabric")) {
    return `
      <!-- Gulungan Serat Nanoweave & Kain Sutra -->
      <rect x="42" y="38" width="44" height="24" rx="12" fill="url(#gemGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <path d="M42 50 C42 74, 52 90, 68 94 L86 94 C76 86, 74 68, 74 50 Z" fill="#1e293b" stroke="${color}" stroke-width="1.5" />
      <line x1="48" y1="50" x2="80" y2="50" stroke="#ffffff" stroke-width="1.2" opacity="0.8" />
    `;
  }

  if (icon.includes("fuel")) {
    return `
      <!-- Tabung Plasma & Bahan Bakar Reaktor -->
      <rect x="46" y="32" width="36" height="68" rx="8" fill="#1e293b" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <rect x="52" y="44" width="24" height="44" rx="4" fill="url(#potionGrad)" />
      <line x1="56" y1="54" x2="68" y2="54" stroke="#ffffff" stroke-width="2" />
      <line x1="56" y1="64" x2="72" y2="64" stroke="#ffffff" stroke-width="2" />
      <line x1="56" y1="74" x2="64" y2="74" stroke="#ffffff" stroke-width="2" />
    `;
  }

  // 6. KATEGORI KHUSUS & MATA UANG (SPECIAL)
  if (icon.includes("key")) {
    return `
      <!-- Kunci Dungeon Kuno & Gerbang Rahasia -->
      <circle cx="64" cy="40" r="14" fill="#1e293b" stroke="${color}" stroke-width="2.5" filter="url(#glowFilter)" />
      <circle cx="64" cy="40" r="6" fill="${color}" />
      <line x1="64" y1="54" x2="64" y2="102" stroke="${color}" stroke-width="4" stroke-linecap="round" />
      <path d="M64 84 L76 84 M64 96 L76 96" stroke="${color}" stroke-width="3" stroke-linecap="round" />
    `;
  }

  if (icon.includes("ticket") || icon.includes("coupon") || icon.includes("voucher") || icon.includes("pass")) {
    return `
      <!-- Tiket Hologram / Kupon Gacha Emas -->
      <rect x="36" y="44" width="56" height="40" rx="6" fill="#1e293b" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="52" y1="44" x2="52" y2="84" stroke="${color}" stroke-width="1.5" stroke-dasharray="3,2" />
      <polygon points="68,54 71,62 79,62 73,67 75,75 68,70 61,75 63,67 57,62 65,62" fill="${color}" filter="url(#glowFilter)" />
    `;
  }

  if (icon.includes("coin") || icon.includes("token")) {
    return `
      <!-- Koin Bintang Naura & Medali Logam -->
      <circle cx="64" cy="64" r="30" fill="url(#gemGrad)" stroke="${color}" stroke-width="2.5" filter="url(#glowFilter)" />
      <circle cx="64" cy="64" r="22" fill="#1e293b" stroke="${color}" stroke-width="1.5" />
      <polygon points="64,48 68,58 78,58 70,64 73,74 64,68 55,74 58,64 50,58 60,58" fill="${color}" />
    `;
  }

  if (icon.includes("charm") || icon.includes("crest")) {
    return `
      <!-- Jimat Pelindung & Lambang Kehormatan -->
      <path d="M64 34 L84 54 L64 94 L44 54 Z" fill="url(#orbGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="64" cy="30" r="4" fill="#e2e8f0" stroke="${color}" stroke-width="1.5" />
      <circle cx="64" cy="58" r="8" fill="#1e293b" stroke="${color}" stroke-width="1.5" />
      <circle cx="64" cy="58" r="3" fill="#ffffff" />
    `;
  }

  // DEFAULT / UNIVERSAL SPHERE / CORE
  return `
    <!-- Inti Energi Astral Naura -->
    <circle cx="64" cy="64" r="28" fill="url(#orbGrad)" stroke="${color}" stroke-width="2.5" filter="url(#glowFilter)" />
    <circle cx="64" cy="64" r="14" fill="#1a202c" stroke="${color}" stroke-width="1.5" />
    <circle cx="64" cy="64" r="5" fill="#ffffff" />
    <ellipse cx="64" cy="64" rx="36" ry="12" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3" />
  `;
}

/**
 * Menghasilkan markup SVG penuh untuk satu item
 */
function buildItemSvg(item) {
  const tierCfg = TIER_CONFIG[item.tier] || TIER_CONFIG[1];
  const color = item.tierColor || tierCfg.glow;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <!-- Filter Bayangan Halus untuk Latar Putih Bersih -->
    <filter id="itemShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.14" />
    </filter>

    <!-- Filter Glow Berwarna Halus Sesuai Tier -->
    <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="${color}" flood-opacity="0.45" />
    </filter>

    <!-- Gradien Bilah Senjata -->
    <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="50%" stop-color="${color}" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>

    <!-- Gradien Zirah -->
    <linearGradient id="armorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="35%" stop-color="#cbd5e1" />
      <stop offset="70%" stop-color="#64748b" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>

    <!-- Gradien Ramuan -->
    <linearGradient id="potionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="60%" stop-color="${color}" />
      <stop offset="100%" stop-color="#475569" />
    </linearGradient>

    <!-- Gradien Permata -->
    <linearGradient id="gemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="45%" stop-color="${color}" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>

    <!-- Gradien Bola Inti -->
    <radialGradient id="orbGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="45%" stop-color="${color}" />
      <stop offset="100%" stop-color="#0f172a" />
    </radialGradient>
  </defs>

  <!-- Latar Belakang Putih Polos Murni -->
  <rect x="0" y="0" width="128" height="128" rx="16" fill="#ffffff" />

  <!-- Bingkai Halus dengan Aksen Warna Tier -->
  <rect x="2.5" y="2.5" width="123" height="123" rx="14" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.3" />

  <!-- Bayangan Ambien Halus di Bawah Objek -->
  <ellipse cx="64" cy="116" rx="28" ry="4" fill="#000000" opacity="0.06" />

  <!-- Vektor Karya Seni Item Spesifik (Di-wrap dengan filter shadow halus) -->
  <g id="itemArt" filter="url(#itemShadow)">
    ${getVectorArt(item)}
  </g>

  <!-- Indikator Angka Tier Romawi di Sudut Kiri Atas -->
  <g id="tierBadge" transform="translate(8, 8)">
    <rect x="0" y="0" width="22" height="15" rx="4" fill="#ffffff" stroke="${color}" stroke-width="1.2" />
    <text x="11" y="11" font-family="'Orbitron', 'Outfit', sans-serif" font-size="8" font-weight="800" fill="${color}" text-anchor="middle">
      ${tierCfg.badge}
    </text>
  </g>

  <!-- Watermark Huruf 'N' Resmi Naura Hoshino di Sudut Kanan Bawah -->
  <g id="watermarkN" transform="translate(98, 98)">
    <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="${color}" stroke-width="1.2" stroke-opacity="0.85" />
    <text x="12" y="16.5" font-family="'Orbitron', 'Outfit', sans-serif" font-size="11" font-weight="900" fill="${color}" text-anchor="middle" opacity="0.9">N</text>
  </g>
</svg>
`;
}

// Jalankan pembuatan aset
console.log("=== MEMBUAT ASET GAMBAR SVG UNTUK 123 ITEM NAURA WILDS (5-TIER) ===");

const activeIds = new Set(BALANCED_ITEMS_CATALOG.map((i) => `${i.id}.svg`));

// Bersihkan file aset yang sudah usang dan tidak ada di katalog baru
for (const dir of TARGET_DIRS) {
  if (fs.existsSync(dir)) {
    const existingFiles = fs.readdirSync(dir);
    let removed = 0;
    for (const f of existingFiles) {
      if (f.endsWith(".svg") && !activeIds.has(f)) {
        fs.unlinkSync(path.join(dir, f));
        removed += 1;
      }
    }
    if (removed > 0) {
      console.log(`Membersihkan ${removed} berkas SVG usang dari: ${dir}`);
    }
  }
}

let createdCount = 0;
for (const item of BALANCED_ITEMS_CATALOG) {
  const svgContent = buildItemSvg(item);
  const fileName = `${item.id}.svg`;

  // Simpan ke semua direktori target
  for (const dir of TARGET_DIRS) {
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, svgContent, "utf8");
  }
  createdCount += 1;
}

console.log(
  `Berhasil menghasilkan ${createdCount} berkas SVG berkualitas tinggi ke:`,
);
for (const dir of TARGET_DIRS) {
  console.log(` - ${dir}`);
}
