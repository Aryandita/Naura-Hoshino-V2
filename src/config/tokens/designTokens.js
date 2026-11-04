"use strict";

/**
 * Single Source of Truth (SSOT) Design System Tokens
 * Menyediakan representasi terpadu (Hex, Discord Integer, RGB String, CSS Var)
 * untuk Discord Components V2, Canvas Rendering, dan Web Dashboard CSS.
 * Mendukung Ekosistem 3-Pilar (Naura, Adisha/Survival, OSIS/Dashboard).
 */

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  const num = parseInt(clean, 16) || 0;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

function hexToInt(hex) {
  return parseInt(String(hex || "").replace("#", ""), 16) || 0;
}

/**
 * Pembuat token warna terpadu.
 * Mendukung tanda tangan (hex, cssVar, label) dan (keyOrCssVar, hex, label).
 */
function createToken(hexOrKey, cssVarOrHex, label = "") {
  let hex;
  let cssVar;
  if (typeof hexOrKey === "string" && hexOrKey.startsWith("#")) {
    hex = hexOrKey;
    cssVar = cssVarOrHex;
  } else if (typeof cssVarOrHex === "string" && cssVarOrHex.startsWith("#")) {
    hex = cssVarOrHex;
    cssVar =
      typeof hexOrKey === "string" && hexOrKey.startsWith("--")
        ? hexOrKey
        : `--pillar-${hexOrKey}`;
  } else {
    hex = hexOrKey;
    cssVar = cssVarOrHex;
  }

  const cleanHex = String(hex || "").toUpperCase();
  return Object.freeze({
    hex: cleanHex,
    int: hexToInt(cleanHex),
    rgb: hexToRgb(cleanHex),
    cssVar: cssVar || "",
    label,
  });
}

/**
 * Shared Primitive Foundation
 * Fondasi dasar bersama lintas 3 pilar: canvas, surface matte, tipografi, dan fisika spring.
 */
const SHARED_PRIMITIVES = Object.freeze({
  canvas: Object.freeze({
    void: createToken("#060810", "--canvas-void", "Onyx Void"),
    dark: createToken("#0B0C10", "--canvas-dark", "Onyx Dark"),
    shell: createToken("#12151F", "--surface-shell", "Outer Shell Matte"),
    elevated: createToken(
      "#171B26",
      "--surface-elevated-card",
      "Elevated Card Matte",
    ),
  }),
  typography: Object.freeze({
    display: "'Orbitron', sans-serif",
    body: "'Outfit', sans-serif",
    telemetry: "'JetBrains Mono', monospace",
  }),
  physics: Object.freeze({
    spring: "cubic-bezier(0.16, 1, 0.3, 1)",
    springTactile: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    springDurationMs: 320,
    maxTiltDeg: 3.5,
  }),
});

/**
 * 3-Pilar Ecosystem Tokens
 * Pilar 1: THEME_NAURA ("Senja Ruang Ekskul")
 * Pilar 2: THEME_SURVIVAL ("Jurnal Ekspedisi Dunia Adisha")
 * Pilar 3: THEME_DASHBOARD ("Studio Kontrol OSIS")
 */
const PILLARS = Object.freeze({
  THEME_NAURA: Object.freeze({
    id: "naura",
    name: "Senja Ruang Ekskul",
    icon: "🌸",
    discordAccent: 0xffc0cb,
    colors: Object.freeze({
      primary: createToken("#FFC0CB", "--pillar-naura-primary", "Sakura Pink"),
      chrome: createToken("#F472B6", "--pillar-naura-chrome", "Naura Rose"),
      soft: createToken("#FF9EBB", "--pillar-naura-soft", "Soft Blossom"),
      accent: createToken("#00FFFF", "--pillar-naura-accent", "Cyber Neon"),
      canvas: createToken("#060810", "--pillar-naura-canvas", "Onyx Void"),
      surface: createToken(
        "#12151F",
        "--pillar-naura-surface",
        "Ruang Ekskul Shell",
      ),
      elevated: createToken(
        "#171B26",
        "--pillar-naura-elevated",
        "Ruang Ekskul Card",
      ),
    }),
  }),
  THEME_SURVIVAL: Object.freeze({
    id: "survival",
    name: "Jurnal Ekspedisi Dunia Adisha",
    icon: "🏕️",
    discordAccent: 0x86efac,
    colors: Object.freeze({
      primary: createToken(
        "#86EFAC",
        "--pillar-survival-primary",
        "Emerald Leaf",
      ),
      vitals: createToken("#34D399", "--pillar-survival-vitals", "Moss Vitals"),
      amber: createToken("#FBBF24", "--pillar-survival-amber", "Amber Alert"),
      bark: createToken("#92400E", "--pillar-survival-bark", "Ancient Wood"),
      river: createToken("#7DD3FC", "--pillar-survival-river", "Crystal River"),
      canvas: createToken("#061209", "--pillar-survival-canvas", "Deep Forest"),
      surface: createToken(
        "#0B1C11",
        "--pillar-survival-surface",
        "Adisha Outpost Shell",
      ),
      elevated: createToken(
        "#122A1A",
        "--pillar-survival-elevated",
        "Adisha Tactical Card",
      ),
    }),
  }),
  THEME_DASHBOARD: Object.freeze({
    id: "dashboard",
    name: "Studio Kontrol OSIS",
    icon: "🎛️",
    discordAccent: 0x22d3ee,
    colors: Object.freeze({
      primary: createToken(
        "#22D3EE",
        "--pillar-dashboard-primary",
        "Signal Cyan",
      ),
      hub: createToken("#7B68EE", "--pillar-dashboard-hub", "Slate Purple"),
      economy: createToken(
        "#FFD700",
        "--pillar-dashboard-economy",
        "Economy Gold",
      ),
      purple: createToken(
        "#8A2BE2",
        "--pillar-dashboard-purple",
        "Studio Purple",
      ),
      canvas: createToken("#0B0C10", "--pillar-dashboard-canvas", "Onyx Dark"),
      surface: createToken(
        "#12151F",
        "--pillar-dashboard-surface",
        "Studio Kontrol Shell",
      ),
      elevated: createToken(
        "#171B26",
        "--pillar-dashboard-elevated",
        "Studio Kontrol Card",
      ),
    }),
  }),
});

const BRAND = Object.freeze({
  primary: createToken("#FFC0CB", "--naura-primary", "Sakura Pink"),
  secondary: createToken("#F472B6", "--naura-secondary", "Deep Blossom"),
  accent: createToken("#00FFFF", "--naura-accent", "Cyber Cyan"),
  dark: createToken("#060810", "--canvas-deep", "Onyx Void"),
  light: createToken("#F0F0F0", "--text-light", "Pure Snow"),
});

const SURVIVAL = Object.freeze({
  emerald: createToken("#86EFAC", "--wilds-emerald", "Emerald Leaf"),
  moss: createToken("#34D399", "--wilds-moss", "Moss Vitals"),
  amber: createToken("#FBBF24", "--wilds-amber", "Amber Warning"),
  bark: createToken("#92400E", "--wilds-bark", "Ancient Wood"),
  river: createToken("#7DD3FC", "--wilds-river", "Crystal River"),
  danger: createToken("#F87171", "--wilds-danger", "Critical Hazard"),
});

const RARITY = Object.freeze({
  common: Object.freeze({
    ...createToken("#9CA3AF", "--rarity-common", "Common"),
    emoji: "⚪",
    tier: 1,
  }),
  uncommon: Object.freeze({
    ...createToken("#86EFAC", "--rarity-uncommon", "Uncommon"),
    emoji: "🟢",
    tier: 2,
  }),
  rare: Object.freeze({
    ...createToken("#93C5FD", "--rarity-rare", "Rare"),
    emoji: "🔵",
    tier: 3,
  }),
  epic: Object.freeze({
    ...createToken("#C084FC", "--rarity-epic", "Epic"),
    emoji: "🟣",
    tier: 4,
  }),
  legendary: Object.freeze({
    ...createToken("#FFD700", "--rarity-legendary", "Legendary"),
    emoji: "🟡",
    tier: 5,
  }),
  mythic: Object.freeze({
    ...createToken("#F9A8D4", "--rarity-mythic", "Mythic"),
    emoji: "🔴",
    tier: 6,
  }),
});

const STATUS = Object.freeze({
  online: Object.freeze({
    ...createToken("#22C55E", "--status-online", "Online"),
    badge: "🟢 AKTIF",
  }),
  idle: Object.freeze({
    ...createToken("#F59E0B", "--status-warn", "Idle"),
    badge: "🟡 ISTIRAHAT",
  }),
  dnd: Object.freeze({
    ...createToken("#EF4444", "--status-offline", "Do Not Disturb"),
    badge: "🔴 SIBUK",
  }),
  maintenance: Object.freeze({
    ...createToken("#A855F7", "--status-maintenance", "Maintenance"),
    badge: "🟣 PEMELIHARAAN",
  }),
  syncing: Object.freeze({
    ...createToken("#38BDF8", "--status-info", "Syncing"),
    badge: "⚡ SINKRON",
  }),
});

const SYSTEMS = Object.freeze({
  economy: createToken("#FFD700", "--system-economy", "Global Economy"),
  music: createToken("#8A2BE2", "--system-music", "Audio DJ"),
  battle: createToken("#DC143C", "--system-battle", "PvP Coliseum"),
  rank: createToken("#9400D3", "--system-rank", "Milestone Tier"),
  hub: createToken("#7B68EE", "--system-hub", "Hub Central"),
});

const SEMANTIC = Object.freeze({
  success: createToken("#00FF00", "--semantic-success", "Success"),
  error: createToken("#FF0000", "--semantic-error", "Error"),
  warning: createToken("#FFB347", "--semantic-warning", "Warning"),
  info: createToken("#57C7FF", "--semantic-info", "Info"),
  crafting: createToken("#228B22", "--semantic-crafting", "Crafting"),
  mining: createToken("#8B4513", "--semantic-mining", "Mining"),
  fishing: createToken("#1E90FF", "--semantic-fishing", "Fishing"),
  welcome: createToken("#00FFFF", "--semantic-welcome", "Welcome"),
  leave: createToken("#FF69B4", "--semantic-leave", "Leave"),
  boost: createToken("#FFD700", "--semantic-boost", "Boost"),
  announcement: createToken(
    "#001aff",
    "--semantic-announcement",
    "Announcement",
  ),
  premium_voter: createToken("#F43F5E", "--premium-voter", "Premium Voter"),
  premium_starter: createToken(
    "#38bdf8",
    "--premium-starter",
    "Premium Starter",
  ),
  premium_supporter: createToken(
    "#C0C0C0",
    "--premium-supporter",
    "Premium Supporter",
  ),
  premium_friends: createToken(
    "#A855F7",
    "--premium-friends",
    "Premium Friends",
  ),
  premium_vip: createToken("#FFD700", "--premium-vip", "Premium VIP"),
  premium_accent: createToken("#FDE68A", "--premium-accent", "Premium Accent"),
  premium_glow: Object.freeze({
    hex: "rgba(255,215,0,0.3)",
    rgb: "",
    cssVar: "--premium-glow",
    label: "Premium Glow",
  }),
});

/**
 * Peta pencarian token cepat berdasarkan nama
 */
const TOKEN_LOOKUP = new Map();

for (const cat of [BRAND, SURVIVAL, RARITY, STATUS, SYSTEMS, SEMANTIC]) {
  for (const [key, token] of Object.entries(cat)) {
    TOKEN_LOOKUP.set(key.toLowerCase(), token);
  }
}

// Daftarkan token kanvas dan pilar dengan namespace aman agar tidak menimpa BRAND.primary
for (const [key, token] of Object.entries(SHARED_PRIMITIVES.canvas)) {
  TOKEN_LOOKUP.set(`canvas_${key.toLowerCase()}`, token);
}
for (const pillar of Object.values(PILLARS)) {
  for (const [key, token] of Object.entries(pillar.colors)) {
    TOKEN_LOOKUP.set(`${pillar.id}_${key.toLowerCase()}`, token);
  }
}

/**
 * Helper resolusi pilar berdasarkan ID, nama tema, atau alias navigasi.
 * @param {string} pillarId - 'naura', 'survival', 'dashboard', 'ekskul', 'adisha', 'kontrol', dll.
 * @returns {object} Object pilar beku dari PILLARS
 */
function getPillar(pillarId) {
  if (!pillarId) return PILLARS.THEME_NAURA;
  const key = String(pillarId).toLowerCase().trim();
  if (key === "naura" || key === "theme_naura" || key === "ekskul")
    return PILLARS.THEME_NAURA;
  if (
    key === "survival" ||
    key === "theme_survival" ||
    key === "adisha" ||
    key === "wilds"
  )
    return PILLARS.THEME_SURVIVAL;
  if (
    key === "dashboard" ||
    key === "theme_dashboard" ||
    key === "kontrol" ||
    key === "osis"
  )
    return PILLARS.THEME_DASHBOARD;
  return PILLARS.THEME_NAURA;
}

/**
 * Ambil token warna tertentu dari pilar.
 * @param {string} pillarId
 * @param {string} colorKey
 * @returns {object} Token object
 */
function getPillarColor(pillarId, colorKey) {
  const pillar = getPillar(pillarId);
  if (!colorKey || typeof colorKey !== "string") {
    return pillar.colors.primary;
  }
  return Object.prototype.hasOwnProperty.call(pillar.colors, colorKey) &&
    pillar.colors[colorKey]
    ? pillar.colors[colorKey]
    : pillar.colors.primary;
}

function getColorHex(name, fallback = "#FFC0CB") {
  if (!name) return fallback;
  const token = TOKEN_LOOKUP.get(String(name).toLowerCase());
  return token ? token.hex : fallback;
}

function getColorInt(name, fallbackHex = "#FFC0CB") {
  if (!name) return hexToInt(fallbackHex);
  const token = TOKEN_LOOKUP.get(String(name).toLowerCase());
  return token ? token.int : hexToInt(fallbackHex);
}

function getColorRgb(name, fallbackHex = "#FFC0CB") {
  if (!name) return hexToRgb(fallbackHex);
  const token = TOKEN_LOOKUP.get(String(name).toLowerCase());
  return token ? token.rgb : hexToRgb(fallbackHex);
}

function getRarityToken(rarityName) {
  const clean = String(rarityName || "common").toLowerCase();
  return RARITY[clean] || RARITY.common;
}

function getStatusToken(statusName) {
  const clean = String(statusName || "online").toLowerCase();
  return STATUS[clean] || STATUS.online;
}

function generateCssVariables() {
  const lines = [":root {"];
  for (const cat of [BRAND, SURVIVAL, RARITY, STATUS, SYSTEMS, SEMANTIC]) {
    for (const token of Object.values(cat)) {
      if (token && token.cssVar && token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
      }
    }
  }

  // Tambahkan variabel pilar
  for (const pillar of Object.values(PILLARS)) {
    for (const token of Object.values(pillar.colors)) {
      if (token && token.cssVar && token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
      }
    }
  }
  lines.push("}");
  return lines.join("\n");
}

module.exports = {
  BRAND,
  SURVIVAL,
  RARITY,
  STATUS,
  SYSTEMS,
  SEMANTIC,
  PILLARS,
  SHARED_PRIMITIVES,
  getPillar,
  getPillarColor,
  getColorHex,
  getColorInt,
  getColorRgb,
  getRarityToken,
  getStatusToken,
  generateCssVariables,
  createToken,
  hexToRgb,
  hexToInt,
};
