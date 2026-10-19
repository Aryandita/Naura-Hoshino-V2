"use strict";

// Palet warna, sprite monster, pembatas teks, tautan resmi, dan footer.
// Dipisah dari src/config/ui.js supaya berkas induknya tetap ringan dan mudah
// disunting tanpa harus mengirim ulang seluruh konfigurasi UI.
// Terintegrasi langsung dengan Single Source of Truth (SSOT) designTokens.js.

const designTokens = require("../tokens/designTokens");

const colors = {
  // --- Core Colors dari SSOT Tokens ---
  primary: designTokens.BRAND.primary.hex,
  secondary: designTokens.BRAND.secondary.hex,
  accent: designTokens.BRAND.accent.hex,
  dark: designTokens.BRAND.dark.hex,
  light: designTokens.BRAND.light.hex,

  // --- Custom Systems dari SSOT Tokens ---
  economy: designTokens.SYSTEMS.economy.hex,
  music: designTokens.SYSTEMS.music.hex,
  battle: designTokens.SYSTEMS.battle.hex,
  rank: designTokens.SYSTEMS.rank.hex,

  // --- Systems Lanjutan ---
  fishing: "#1E90FF",
  mining: "#8B4513",
  crafting: "#228B22",
  welcome: "#00FFFF",
  leave: "#FF69B4",
  boost: "#FFD700",
  announcement: "#001aff",
  announce_update: "#00FFFF",
  announce_mt: "#8B4513",
  announce_event: "#FFD700",
  announce_warn: "#DC143C",

  // --- Status Colors ---
  success: "#00FF00",
  error: "#FF0000",
  warning: "#FFB347",
  info: "#57C7FF",

  // --- Survival Wilds Tokens ---
  wilds_emerald: designTokens.SURVIVAL.emerald.hex,
  wilds_moss: designTokens.SURVIVAL.moss.hex,
  wilds_amber: designTokens.SURVIVAL.amber.hex,
  wilds_bark: designTokens.SURVIVAL.bark.hex,
  wilds_river: designTokens.SURVIVAL.river.hex,
  wilds_danger: designTokens.SURVIVAL.danger.hex,

  // --- Premium Tier Colors ---
  premium_voter: "#F43F5E",
  premium_starter: "#38bdf8",
  premium_supporter: "#C0C0C0",
  premium_friends: "#A855F7",
  premium_vip: "#FFD700",
  premium_accent: "#FDE68A",
  premium_glow: "rgba(255,215,0,0.3)",
};

const monsters = {
  slime: "./assets/survival/monsters/slime.png",
  goblin: "./assets/survival/monsters/goblin.png",
};

const dividers = {
  musicDividers:
    "\u22B1 \u2500\u2500\u2500\u2500\u2500\u2500 {.\u22C5 \u266B \u22C5.} \u2500\u2500\u2500\u2500\u2500 \u22B0",
  generalDividers: "",
};

const links = {
  dashboards: "hyperion.kythia.xyz:3070",
  support_server: "https://dsc.gg/naura-hoshino",
  invite:
    "https://discord.com/oauth2/authorize?client_id=1483665745727721543&permissions=8&scope=bot%20applications.commands",
  vote: "https://top.gg/bot/1483665745727721543?s=00487c531de33",
  saweria: "",
  email: "naurahoshino@gmail.com",
};

const { FOOTERS } = require("../version");
const footers = { ...FOOTERS };

module.exports = {
  colors,
  monsters,
  dividers,
  links,
  footers,
  designTokens,
  ...designTokens,
};
