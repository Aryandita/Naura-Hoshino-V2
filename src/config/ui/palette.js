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
  fishing: designTokens.SEMANTIC.fishing.hex,
  mining: designTokens.SEMANTIC.mining.hex,
  crafting: designTokens.SEMANTIC.crafting.hex,
  welcome: designTokens.SEMANTIC.welcome.hex,
  leave: designTokens.SEMANTIC.leave.hex,
  boost: designTokens.SEMANTIC.boost.hex,
  announcement: designTokens.SEMANTIC.announcement.hex,
  announce_update: designTokens.SEMANTIC.welcome.hex,
  announce_mt: designTokens.SEMANTIC.mining.hex,
  announce_event: designTokens.SEMANTIC.boost.hex,
  announce_warn: designTokens.SYSTEMS.battle.hex,

  // --- Status Colors ---
  success: designTokens.SEMANTIC.success.hex,
  error: designTokens.SEMANTIC.error.hex,
  warning: designTokens.SEMANTIC.warning.hex,
  info: designTokens.SEMANTIC.info.hex,

  // --- Survival Wilds Tokens ---
  wilds_emerald: designTokens.SURVIVAL.emerald.hex,
  wilds_moss: designTokens.SURVIVAL.moss.hex,
  wilds_amber: designTokens.SURVIVAL.amber.hex,
  wilds_bark: designTokens.SURVIVAL.bark.hex,
  wilds_river: designTokens.SURVIVAL.river.hex,
  wilds_danger: designTokens.SURVIVAL.danger.hex,

  // --- Premium Tier Colors ---
  premium_voter: designTokens.SEMANTIC.premium_voter.hex,
  premium_starter: designTokens.SEMANTIC.premium_starter.hex,
  premium_supporter: designTokens.SEMANTIC.premium_supporter.hex,
  premium_friends: designTokens.SEMANTIC.premium_friends.hex,
  premium_vip: designTokens.SEMANTIC.premium_vip.hex,
  premium_accent: designTokens.SEMANTIC.premium_accent.hex,
  premium_glow: designTokens.SEMANTIC.premium_glow.hex,
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
