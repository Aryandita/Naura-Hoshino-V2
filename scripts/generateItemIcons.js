// Lokasi: scripts/generateItemIcons.js
// Generator aset gambar SVG vektor berkualitas tinggi untuk 150 item Naura Wilds
// Memiliki estetika Cyber-Anime Glassmorphism dengan border glow & palet warna tier resmi

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  BALANCED_ITEMS_CATALOG,
} = require("../src/survival/data/items_catalog");

// Target direktori aset publik
const TARGET_DIRS = [
  path.join(__dirname, "../dashboard-v2/public/items"),
  path.join(__dirname, "../dashboard-v2/dist/items"),
  path.join(__dirname, "../assets/items"),
];

// Pastikan semua direktori tujuan tersedia
for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper warna per tier
const TIER_CONFIG = {
  1: { glow: "#9CA3AF", badge: "I", name: "COMMON" },
  2: { glow: "#86EFAC", badge: "II", name: "UNCOMMON" },
  3: { glow: "#93C5FD", badge: "III", name: "RARE" },
  4: { glow: "#C084FC", badge: "IV", name: "EPIC" },
  5: { glow: "#FFD700", badge: "V", name: "LEGENDARY" },
  6: { glow: "#F9A8D4", badge: "VI", name: "MYTHIC" },
};

/**
 * Menghasilkan elemen visual spesifik berdasarkan iconType / category
 */
function getVectorArt(item) {
  const color = item.tierColor || "#FFB6C1";
  const icon = item.iconType || item.category;

  // 1. KATEGORI SENJATA (WEAPONS)
  if (
    icon.includes("sword") ||
    icon.includes("blade") ||
    icon.includes("rapier") ||
    icon.includes("excalibur")
  ) {
    return `
      <!-- Bilah Pedang -->
      <path d="M64 20 L72 32 L70 82 L64 90 L58 82 L56 32 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="64" y1="24" x2="64" y2="84" stroke="#ffffff" stroke-width="1.5" opacity="0.8" />
      <!-- Guard / Hulu -->
      <path d="M46 86 C54 84, 74 84, 82 86 L80 92 C72 90, 56 90, 48 92 Z" fill="#2d3748" stroke="${color}" stroke-width="1.5" />
      <!-- Gagang & Pommel -->
      <rect x="61" y="92" width="6" height="18" rx="2" fill="#1a202c" stroke="#4a5568" stroke-width="1" />
      <circle cx="64" cy="113" r="5" fill="${color}" stroke="#ffffff" stroke-width="1" />
    `;
  }

  if (icon.includes("dagger") || icon.includes("stiletto")) {
    return `
      <!-- Belati Ramping -->
      <path d="M64 28 L73 44 L69 82 L64 88 L59 82 L55 44 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="64" y1="32" x2="64" y2="82" stroke="#ffffff" stroke-width="1.5" opacity="0.8" />
      <path d="M50 86 L78 86 L76 91 L52 91 Z" fill="#2d3748" stroke="${color}" stroke-width="1.5" />
      <rect x="62" y="91" width="4" height="15" rx="1.5" fill="#1a202c" />
      <circle cx="64" cy="110" r="4" fill="${color}" />
    `;
  }

  if (icon.includes("bow")) {
    return `
      <!-- Busur Panah Tempur -->
      <path d="M42 30 C32 50, 32 78, 42 98 C46 95, 46 90, 44 86 C38 72, 38 56, 44 42 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <!-- Tali Busur -->
      <line x1="42" y1="32" x2="88" y2="64" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3,1" opacity="0.7" />
      <line x1="42" y1="96" x2="88" y2="64" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3,1" opacity="0.7" />
      <!-- Anak Panah Neon -->
      <line x1="38" y1="64" x2="96" y2="64" stroke="${color}" stroke-width="2.5" />
      <polygon points="96,64 88,60 90,64 88,68" fill="${color}" />
    `;
  }

  if (
    icon.includes("staff") ||
    icon.includes("wand") ||
    icon.includes("scepter")
  ) {
    return `
      <!-- Tongkat Sihir Magis -->
      <rect x="62" y="38" width="4" height="74" rx="2" fill="#2d3748" stroke="#4a5568" stroke-width="1" />
      <!-- Kristal Puncak Bertuah -->
      <circle cx="64" cy="30" r="14" fill="url(#orbGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <polygon points="64,18 72,30 64,42 56,30" fill="${color}" opacity="0.6" />
      <circle cx="64" cy="30" r="4" fill="#ffffff" />
      <!-- Efek Cincin Energi -->
      <ellipse cx="64" cy="30" rx="20" ry="6" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="4,2" opacity="0.7" />
    `;
  }

  if (
    icon.includes("spear") ||
    icon.includes("trident") ||
    icon.includes("lance") ||
    icon.includes("polearm") ||
    icon.includes("glaive")
  ) {
    return `
      <!-- Tombak & Trident -->
      <line x1="64" y1="42" x2="64" y2="114" stroke="#4a5568" stroke-width="4" stroke-linecap="round" />
      <path d="M64 16 L74 42 L64 38 L54 42 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <path d="M48 28 L54 44 L48 42 Z" fill="${color}" opacity="0.8" />
      <path d="M80 28 L74 44 L80 42 Z" fill="${color}" opacity="0.8" />
      <circle cx="64" cy="46" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("scythe") || icon.includes("reaper")) {
    return `
      <!-- Sabit Maut / Scythe -->
      <path d="M68 32 C68 32, 62 70, 58 112" stroke="#2d3748" stroke-width="4" stroke-linecap="round" />
      <path d="M68 32 C78 20, 98 22, 102 36 C92 38, 76 44, 66 52 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="68" cy="34" r="4" fill="${color}" />
    `;
  }

  // 2. KATEGORI ZIRAH (ARMORS)
  if (icon.includes("chest") || icon.includes("tunic")) {
    return `
      <!-- Baju Zirah / Chestplate -->
      <path d="M42 34 L54 28 L64 34 L74 28 L86 34 L82 72 L64 88 L46 72 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <path d="M50 42 L64 52 L78 42 L76 66 L64 78 L52 66 Z" fill="#1a202c" stroke="${color}" stroke-width="1.5" opacity="0.8" />
      <!-- Lambang Inti / Arc Reactor -->
      <circle cx="64" cy="56" r="6" fill="${color}" />
      <circle cx="64" cy="56" r="2.5" fill="#ffffff" />
    `;
  }

  if (
    icon.includes("helmet") ||
    icon.includes("cap") ||
    icon.includes("crown") ||
    icon.includes("diadem")
  ) {
    return `
      <!-- Helm Tempur / Mahkota -->
      <path d="M40 50 C40 30, 88 30, 88 50 L86 78 L78 84 L50 84 L42 78 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <!-- Celah Visor Neon -->
      <path d="M48 54 L80 54 L76 64 L52 64 Z" fill="${color}" opacity="0.9" filter="url(#glowFilter)" />
      <line x1="50" y1="59" x2="78" y2="59" stroke="#ffffff" stroke-width="1.5" />
    `;
  }

  if (icon.includes("shield") || icon.includes("buckler")) {
    return `
      <!-- Perisai / Shield -->
      <path d="M38 34 C54 32, 74 32, 90 34 L88 70 C84 88, 64 98, 64 98 C64 98, 44 88, 40 70 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2.5" filter="url(#glowFilter)" />
      <!-- Pola Emblim Perisai -->
      <path d="M46 42 L82 42 L80 66 C76 80, 64 88, 64 88 C64 88, 52 80, 48 66 Z" fill="#1a202c" stroke="${color}" stroke-width="1.5" />
      <circle cx="64" cy="62" r="7" fill="${color}" />
      <circle cx="64" cy="62" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("boots") || icon.includes("greaves")) {
    return `
      <!-- Sepatu Tempur / Boots -->
      <path d="M48 38 L62 38 L62 68 L76 74 L76 88 L44 88 L44 68 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="48" y1="48" x2="62" y2="48" stroke="${color}" stroke-width="2" />
      <line x1="48" y1="58" x2="62" y2="58" stroke="${color}" stroke-width="2" />
      <rect x="42" y="84" width="36" height="6" rx="2" fill="#2d3748" stroke="${color}" stroke-width="1" />
    `;
  }

  if (
    icon.includes("gloves") ||
    icon.includes("gauntlets") ||
    icon.includes("bracers")
  ) {
    return `
      <!-- Sarung Tangan / Gauntlets -->
      <path d="M46 44 C46 38, 82 38, 82 44 L80 84 L48 84 Z" fill="url(#armorGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <rect x="52" y="36" width="6" height="14" rx="3" fill="${color}" />
      <rect x="60" y="34" width="6" height="16" rx="3" fill="${color}" />
      <rect x="68" y="36" width="6" height="14" rx="3" fill="${color}" />
      <circle cx="64" cy="68" r="5" fill="${color}" />
    `;
  }

  // 3. KATEGORI ALAT KERJA (TOOLS)
  if (icon.includes("axe")) {
    return `
      <!-- Kapak Kayu / Besi -->
      <line x1="48" y1="102" x2="78" y2="34" stroke="#4a5568" stroke-width="5" stroke-linecap="round" />
      <!-- Mata Pisau Kapak -->
      <path d="M72 32 C86 20, 94 36, 88 56 C80 50, 74 48, 66 48 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="70" cy="46" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("pickaxe")) {
    return `
      <!-- Beliung Tambang -->
      <line x1="44" y1="104" x2="76" y2="40" stroke="#4a5568" stroke-width="5" stroke-linecap="round" />
      <!-- Lengkungan Beliung Runcing -->
      <path d="M48 30 C64 36, 82 36, 96 46 L86 52 C74 44, 62 44, 52 38 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="72" cy="42" r="3" fill="${color}" />
    `;
  }

  if (icon.includes("rod")) {
    return `
      <!-- Joran Pancing -->
      <path d="M40 102 C54 78, 68 50, 92 32" stroke="#4a5568" stroke-width="3.5" fill="none" stroke-linecap="round" />
      <!-- Senar Pancing -->
      <path d="M92 32 C96 52, 88 74, 84 94" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3,1" fill="none" />
      <!-- Kail / Umpan -->
      <path d="M84 94 C82 98, 86 102, 88 100" stroke="${color}" stroke-width="2" fill="none" />
      <circle cx="84" cy="94" r="3" fill="${color}" filter="url(#glowFilter)" />
    `;
  }

  if (
    icon.includes("shovel") ||
    icon.includes("drill") ||
    icon.includes("extractor")
  ) {
    return `
      <!-- Sekop / Bor Gali -->
      <line x1="64" y1="36" x2="64" y2="76" stroke="#4a5568" stroke-width="4" stroke-linecap="round" />
      <path d="M56 34 L72 34 M64 34 L64 42" stroke="#4a5568" stroke-width="3" stroke-linecap="round" />
      <path d="M52 76 C52 94, 64 102, 64 102 C64 102, 76 94, 76 76 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <line x1="64" y1="78" x2="64" y2="94" stroke="#ffffff" stroke-width="1.5" />
    `;
  }

  if (icon.includes("sickle")) {
    return `
      <!-- Sabit Panen -->
      <line x1="52" y1="98" x2="64" y2="74" stroke="#4a5568" stroke-width="5" stroke-linecap="round" />
      <path d="M64 74 C78 68, 92 50, 84 32 C72 44, 64 56, 56 64 Z" fill="url(#bladeGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <circle cx="62" cy="72" r="3" fill="${color}" />
    `;
  }

  // 4. KATEGORI KONSUMSI (CONSUMABLES)
  if (
    icon.includes("potion") ||
    icon.includes("elixir") ||
    icon.includes("tincture") ||
    icon.includes("tonic")
  ) {
    return `
      <!-- Botol Ramuan Kaca -->
      <path d="M58 32 L70 32 L70 42 L84 64 C88 74, 84 88, 76 94 C68 98, 60 98, 52 94 C44 88, 40 74, 44 64 L58 42 Z" fill="#1a202c" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <!-- Isi Cairan Ramuan -->
      <path d="M46 68 C56 64, 72 64, 82 68 L80 84 C76 92, 64 94, 64 94 C64 94, 52 92, 48 84 Z" fill="url(#potionGrad)" />
      <!-- Tutup Gabus -->
      <rect x="59" y="24" width="10" height="8" rx="2" fill="#d97706" />
      <!-- Gelembung Berpendar -->
      <circle cx="60" cy="78" r="2.5" fill="#ffffff" opacity="0.8" />
      <circle cx="68" cy="84" r="1.5" fill="#ffffff" opacity="0.6" />
    `;
  }

  if (icon.includes("apple") || icon.includes("berries")) {
    return `
      <!-- Buah Apel / Beri -->
      <path d="M64 42 C78 30, 92 48, 86 68 C82 86, 68 94, 64 94 C60 94, 46 86, 42 68 C36 48, 50 30, 64 42 Z" fill="url(#potionGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <!-- Tangkai & Daun -->
      <path d="M64 42 C64 32, 70 28, 74 26" stroke="#4a5568" stroke-width="2" fill="none" stroke-linecap="round" />
      <ellipse cx="68" cy="32" rx="5" ry="2" fill="#86efac" />
    `;
  }

  if (
    icon.includes("bread") ||
    icon.includes("toast") ||
    icon.includes("feast")
  ) {
    return `
      <!-- Roti Gandum / Masakan -->
      <ellipse cx="64" cy="64" rx="28" ry="18" fill="url(#potionGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <!-- Guratan Garis Roti -->
      <line x1="52" y1="58" x2="56" y2="70" stroke="#fef08a" stroke-width="2" stroke-linecap="round" />
      <line x1="64" y1="56" x2="64" y2="72" stroke="#fef08a" stroke-width="2" stroke-linecap="round" />
      <line x1="76" y1="58" x2="72" y2="70" stroke="#fef08a" stroke-width="2" stroke-linecap="round" />
    `;
  }

  if (
    icon.includes("ramen") ||
    icon.includes("soup") ||
    icon.includes("platter")
  ) {
    return `
      <!-- Mangkuk Ramen / Sup -->
      <path d="M38 56 C38 82, 90 82, 90 56 Z" fill="#2d3748" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <ellipse cx="64" cy="56" rx="26" ry="10" fill="url(#potionGrad)" stroke="${color}" stroke-width="1.5" />
      <!-- Sumpit -->
      <line x1="44" y1="36" x2="86" y2="60" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round" />
      <line x1="48" y1="34" x2="90" y2="58" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round" />
    `;
  }

  // 5. KATEGORI BAHAN BAKU (MATERIALS)
  if (
    icon.includes("ore") ||
    icon.includes("stone") ||
    icon.includes("obsidian")
  ) {
    return `
      <!-- Bongkahan Bijih Tambang / Batu -->
      <polygon points="64,28 88,44 82,78 64,96 42,82 40,48" fill="#2d3748" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <!-- Urat Kristal / Logam Menyala -->
      <polygon points="64,28 72,52 64,74 52,48" fill="url(#gemGrad)" opacity="0.9" />
      <polygon points="88,44 72,52 82,78" fill="${color}" opacity="0.6" />
      <circle cx="64" cy="52" r="3" fill="#ffffff" />
    `;
  }

  if (icon.includes("ingot") || icon.includes("plank")) {
    return `
      <!-- Batang Logam Ingot -->
      <polygon points="46,46 82,46 92,62 36,62" fill="url(#gemGrad)" stroke="${color}" stroke-width="1.5" filter="url(#glowFilter)" />
      <polygon points="36,62 92,62 86,84 42,84" fill="#1a202c" stroke="${color}" stroke-width="1.5" />
      <polygon points="82,46 92,62 86,84" fill="${color}" opacity="0.5" />
      <line x1="44" y1="62" x2="84" y2="62" stroke="#ffffff" stroke-width="1" />
    `;
  }

  if (
    icon.includes("gem") ||
    icon.includes("crystal") ||
    icon.includes("diamond")
  ) {
    return `
      <!-- Permata Crystalline -->
      <polygon points="64,24 88,44 64,102 40,44" fill="url(#gemGrad)" stroke="${color}" stroke-width="2" filter="url(#glowFilter)" />
      <polygon points="64,24 74,44 64,102 54,44" fill="#ffffff" opacity="0.4" />
      <line x1="40" y1="44" x2="88" y2="44" stroke="#ffffff" stroke-width="1.5" />
    `;
  }

  // DEFAULT / UNIVERSAL SPHERE / CORE
  return `
    <!-- Inti Energi Astral -->
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
  const color = item.tierColor || "#9CA3AF";

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
console.log("=== MEMBUAT ASET GAMBAR SVG UNTUK 150 ITEM NAURA WILDS ===");

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
