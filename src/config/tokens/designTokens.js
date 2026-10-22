"use strict";

/**
 * Single Source of Truth (SSOT) Design System Tokens
 * Menyediakan representasi terpadu (Hex, Discord Integer, RGB String, CSS Var)
 * untuk Discord Components V2, Canvas Rendering, dan Web Dashboard CSS.
 */

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

function hexToInt(hex) {
  return parseInt(hex.replace("#", ""), 16);
}

function createToken(hex, cssVar, label = "") {
  return Object.freeze({
    hex: hex.toUpperCase(),
    int: hexToInt(hex),
    rgb: hexToRgb(hex),
    cssVar,
    label,
  });
}

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
  common: Object.freeze({ ...createToken("#9CA3AF", "--rarity-common", "Common"), emoji: "⚪", tier: 1 }),
  uncommon: Object.freeze({ ...createToken("#86EFAC", "--rarity-uncommon", "Uncommon"), emoji: "🟢", tier: 2 }),
  rare: Object.freeze({ ...createToken("#93C5FD", "--rarity-rare", "Rare"), emoji: "🔵", tier: 3 }),
  epic: Object.freeze({ ...createToken("#C084FC", "--rarity-epic", "Epic"), emoji: "🟣", tier: 4 }),
  legendary: Object.freeze({ ...createToken("#FFD700", "--rarity-legendary", "Legendary"), emoji: "🟡", tier: 5 }),
  mythic: Object.freeze({ ...createToken("#F9A8D4", "--rarity-mythic", "Mythic"), emoji: "🔴", tier: 6 }),
});

const STATUS = Object.freeze({
  online: Object.freeze({ ...createToken("#22C55E", "--status-online", "Online"), badge: "🟢 AKTIF" }),
  idle: Object.freeze({ ...createToken("#F59E0B", "--status-warn", "Idle"), badge: "🟡 ISTIRAHAT" }),
  dnd: Object.freeze({ ...createToken("#EF4444", "--status-offline", "Do Not Disturb"), badge: "🔴 SIBUK" }),
  maintenance: Object.freeze({ ...createToken("#A855F7", "--status-maintenance", "Maintenance"), badge: "🟣 PEMELIHARAAN" }),
  syncing: Object.freeze({ ...createToken("#38BDF8", "--status-info", "Syncing"), badge: "⚡ SINKRON" }),
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
  announcement: createToken("#001aff", "--semantic-announcement", "Announcement"),
  premium_voter: createToken("#F43F5E", "--premium-voter", "Premium Voter"),
  premium_starter: createToken("#38bdf8", "--premium-starter", "Premium Starter"),
  premium_supporter: createToken("#C0C0C0", "--premium-supporter", "Premium Supporter"),
  premium_friends: createToken("#A855F7", "--premium-friends", "Premium Friends"),
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
  getColorHex,
  getColorInt,
  getColorRgb,
  getRarityToken,
  getStatusToken,
  generateCssVariables,
  hexToRgb,
  hexToInt,
};
