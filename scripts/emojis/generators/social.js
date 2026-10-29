// Lokasi: scripts/emojis/generators/social.js
// Generator SVG untuk Kategori 5: Social & Community (10 Emojis)
"use strict";

const { wrapSvg, drawSparkle, BRAND_PALETTE } = require("./common");

function renderHandshake(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Warm Pink/Cyan Partnership Aura -->
    <ellipse cx="64" cy="64" rx="${46 + pulse}" ry="${36 + pulse}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" opacity="0.5" filter="url(#glow-cyan)" />
    <!-- Left Hand / Cuff (Cyber Cyan) -->
    <path d="M 20 54 L 38 54 L 54 62 L 58 72 L 44 80 L 20 80 Z" fill="${BRAND_PALETTE.cyberCyan}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-cyan)" />
    <rect x="18" y="52" width="6" height="30" rx="3" fill="${BRAND_PALETTE.darkMetal}" />
    <!-- Right Hand / Cuff (Naura Pink) -->
    <path d="M 108 54 L 90 54 L 74 62 L 70 72 L 84 80 L 108 80 Z" fill="${BRAND_PALETTE.nauraPink}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
    <rect x="104" y="52" width="6" height="30" rx="3" fill="${BRAND_PALETTE.darkMetal}" />
    <!-- Clasping Center Fingers -->
    <rect x="52" y="60" width="24" height="12" rx="6" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
    <!-- Sparkle on Handshake Center -->
    ${drawSparkle(64, 52, 7, BRAND_PALETTE.warmAmber, t * 180)}
  `);
}

function renderGift(t) {
  const hop = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Cyber Gift Box Body (Naura Pink) -->
    <rect x="30" y="${50 + hop}" width="68" height="54" rx="8" fill="url(#gradient-magenta)" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
    <!-- Glowing Cyan Vertical Ribbon -->
    <rect x="58" y="${50 + hop}" width="12" height="54" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <!-- Glowing Cyan Horizontal Ribbon -->
    <rect x="30" y="${70 + hop}" width="68" height="12" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <!-- Box Lid -->
    <rect x="26" y="${42 + hop}" width="76" height="14" rx="4" fill="${BRAND_PALETTE.nauraPink}" stroke="${BRAND_PALETTE.white}" stroke-width="2" />
    <rect x="58" y="${42 + hop}" width="12" height="14" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- Bow Loops on Top -->
    <ellipse cx="50" cy="${34 + hop}" rx="12" ry="7" fill="${BRAND_PALETTE.cyberCyan}" transform="rotate(-30 50 ${34 + hop})" />
    <ellipse cx="78" cy="${34 + hop}" rx="12" ry="7" fill="${BRAND_PALETTE.cyberCyan}" transform="rotate(30 78 ${34 + hop})" />
    <circle cx="64" cy="${36 + hop}" r="5" fill="${BRAND_PALETTE.white}" />
    <!-- Sparkles Floating Off Gift -->
    ${drawSparkle(24, 30, 5, BRAND_PALETTE.warmAmber, t * 180)}
    ${drawSparkle(104, 32, 6, BRAND_PALETTE.white, -t * 180)}
  `);
}

function renderTrophy(t) {
  const gleamX = 42 + (t * 44);
  return wrapSvg(`
    <!-- Golden Pedestal Base -->
    <polygon points="40,104 88,104 82,92 46,92" fill="url(#gradient-amber)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
    <rect x="58" y="78" width="12" height="16" fill="url(#gradient-amber)" />
    <!-- Trophy Handles -->
    <path d="M 38 42 C 22 42 22 66 38 70" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#glow-gold)" />
    <path d="M 90 42 C 106 42 106 66 90 70" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#glow-gold)" />
    <!-- Championship Cup Body -->
    <path d="M 36 32 L 92 32 L 86 66 C 82 80 46 80 42 66 Z" fill="url(#gradient-gold-plate)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2.5" filter="url(#glow-gold)" />
    <!-- Embossed Star on Cup Center -->
    ${drawSparkle(64, 52, 8, BRAND_PALETTE.white, 0)}
    <!-- Light Sweep Reflection -->
    <line x1="${gleamX}" y1="34" x2="${gleamX + 10}" y2="74" stroke="${BRAND_PALETTE.white}" stroke-width="3" opacity="0.6" stroke-linecap="round" />
  `);
}

function renderStar(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- 5-Pointed 3D Faceted Star Body -->
    <g transform="translate(64, 64) scale(1.1) translate(-64, -64)">
      <!-- Golden Star Base -->
      <polygon points="64,18 78,48 110,52 86,74 92,106 64,90 36,106 42,74 18,52 50,48" fill="url(#gradient-gold-plate)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="3" stroke-linejoin="round" filter="url(#glow-gold)" />
      <!-- Facet Shading Lines -->
      <line x1="64" y1="18" x2="64" y2="68" stroke="${BRAND_PALETTE.white}" stroke-width="2" />
      <line x1="110" y1="52" x2="64" y2="68" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
      <line x1="92" y1="106" x2="64" y2="68" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
      <line x1="36" y1="106" x2="64" y2="68" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
      <line x1="18" y1="52" x2="64" y2="68" stroke="${BRAND_PALETTE.white}" stroke-width="2" />
    </g>
    <!-- Sparkling Glints on Tips -->
    ${drawSparkle(64, 14, 7, BRAND_PALETTE.white, rot)}
    ${drawSparkle(116, 52, 6, BRAND_PALETTE.cyberCyan, -rot)}
  `);
}

function renderCrown(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Royal Imperial Crown Base Band -->
    <rect x="28" y="78" width="72" height="16" rx="4" fill="url(#gradient-amber)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2.5" filter="url(#glow-gold)" />
    <!-- Base Jewels -->
    <circle cx="40" cy="86" r="3.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="64" cy="86" r="4.5" fill="${BRAND_PALETTE.deepMagenta}" />
    <circle cx="88" cy="86" r="3.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- 3 Crown Peaks -->
    <polygon points="28,78 32,40 50,62 64,28 78,62 96,40 100,78" fill="url(#gradient-gold-plate)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2.5" filter="url(#glow-gold)" />
    <!-- Jewels on Peaks -->
    <circle cx="32" cy="38" r="5" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <circle cx="64" cy="${26 + pulse * 0.5}" r="7" fill="${BRAND_PALETTE.dreamPurple}" filter="url(#glow-purple)" />
    <circle cx="96" cy="38" r="5" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
  `);
}

function renderMedal(t) {
  const shine = (t * 360);
  return wrapSvg(`
    <!-- Ribbon V-Bands (Pink & Cyan) -->
    <polygon points="46,18 64,46 54,46 36,18" fill="${BRAND_PALETTE.nauraPink}" />
    <polygon points="82,18 64,46 74,46 92,18" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- Golden Circular Medallion -->
    <circle cx="64" cy="74" r="32" fill="url(#gradient-amber)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="3" filter="url(#glow-gold)" />
    <circle cx="64" cy="74" r="26" fill="url(#gradient-gold-plate)" />
    <!-- Embossed "1st" & Star -->
    ${drawSparkle(64, 72, 10, BRAND_PALETTE.goldText, 0)}
    <text x="64" y="94" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="12" fill="${BRAND_PALETTE.goldText}">1st</text>
    <!-- Star Sparkle on Medallion Rim -->
    ${drawSparkle(88, 56, 5, BRAND_PALETTE.white, shine)}
  `);
}

function renderThumbsUp(t) {
  const bounce = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Glove Hand with Upward Thumb -->
    <g transform="translate(0, ${bounce})">
      <!-- Cyber Glow Cuff -->
      <rect x="22" y="74" width="24" height="26" rx="6" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
      <line x1="28" y1="86" x2="40" y2="86" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
      <!-- Hand Palm & Curled Fingers -->
      <rect x="42" y="62" width="46" height="34" rx="12" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
      <!-- Upright Thumb -->
      <path d="M 44 64 L 44 32 C 44 24 56 24 56 32 L 56 64 Z" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="2" />
    </g>
    <!-- Starburst Flash at Thumb Tip -->
    ${drawSparkle(50, 24 + bounce, 8, BRAND_PALETTE.warmAmber, t * 180)}
  `);
}

function renderClap(t) {
  const clapShift = Math.sin(t * Math.PI * 4) * 3;
  return wrapSvg(`
    <!-- Two Cute Clapping Hands -->
    <!-- Left Hand -->
    <g transform="translate(${clapShift}, 0) rotate(15 48 64)">
      <rect x="30" y="44" width="36" height="40" rx="12" fill="${BRAND_PALETTE.nauraPink}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
      <rect x="42" y="32" width="10" height="22" rx="5" fill="${BRAND_PALETTE.nauraPink}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
    </g>
    <!-- Right Hand -->
    <g transform="translate(${-clapShift}, 0) rotate(-15 80 64)">
      <rect x="62" y="44" width="36" height="40" rx="12" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
      <rect x="76" y="32" width="10" height="22" rx="5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
    </g>
    <!-- Rhythm Shockwave Sparks -->
    ${drawSparkle(64, 38, 7, BRAND_PALETTE.warmAmber, t * 180)}
    ${drawSparkle(64, 88, 6, BRAND_PALETTE.cyberCyan, -t * 180)}
  `);
}

function renderWaveHello(t) {
  const wave = Math.sin(t * Math.PI * 4) * 12;
  return wrapSvg(`
    <!-- Waving Hand with Wrist -->
    <g transform="rotate(${wave} 64 88)">
      <rect x="56" y="78" width="16" height="24" rx="6" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
      <!-- Open Palm -->
      <rect x="44" y="48" width="40" height="34" rx="12" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
      <!-- 4 Extended Fingers -->
      <rect x="46" y="24" width="7" height="28" rx="3.5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
      <rect x="56" y="20" width="7" height="32" rx="3.5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
      <rect x="66" y="22" width="7" height="30" rx="3.5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
      <rect x="76" y="28" width="7" height="24" rx="3.5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
      <!-- Thumb -->
      <path d="M 44 56 L 34 48 C 30 44 38 38 42 44 L 46 54 Z" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
    </g>
    <!-- Motion Sparkle -->
    ${drawSparkle(96, 26, 6, BRAND_PALETTE.warmAmber, t * 180)}
  `);
}

function renderVipBadge(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- Hexagonal Holographic VIP Shield Badge -->
    <polygon points="64,18 102,38 102,82 64,104 26,82 26,38" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="3" filter="url(#glow-gold)" />
    <!-- Inner Purple Hexagon -->
    <polygon points="64,24 96,42 96,78 64,98 32,78 32,42" fill="url(#gradient-magic)" opacity="0.8" />
    <!-- Embossed "VIP" with Gold Luster -->
    <text x="64" y="70" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="24" fill="${BRAND_PALETTE.goldLight}" filter="url(#glow-gold)">VIP</text>
    <!-- Neon Hologram Border Shimmer -->
    <line x1="32" y1="42" x2="96" y2="42" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" opacity="0.8" />
    <line x1="32" y1="78" x2="96" y2="78" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" opacity="0.8" />
    <!-- Starburst Sparkle -->
    ${drawSparkle(98, 38, 7, BRAND_PALETTE.white, rot)}
  `);
}

const SOCIAL_GENERATORS = {
  naura_handshake: renderHandshake,
  naura_gift: renderGift,
  naura_trophy: renderTrophy,
  naura_star: renderStar,
  naura_crown: renderCrown,
  naura_medal: renderMedal,
  naura_thumbs_up: renderThumbsUp,
  naura_clap: renderClap,
  naura_wave_hello: renderWaveHello,
  naura_vip_badge: renderVipBadge,
};

module.exports = {
  SOCIAL_GENERATORS,
};
