// Lokasi: scripts/emojis/generators/special.js
// Generator SVG untuk Kategori 6: Special Naura Signatures (10 Emojis)
"use strict";

const { wrapSvg, drawSparkle, drawBaseHead, drawAnimeEyes, BRAND_PALETTE } = require("./common");

function renderSmile(t) {
  const rot = t * 360;
  return wrapSvg(`
    ${drawBaseHead(0)}
    ${drawAnimeEyes(48, 80, 58, "wink")}
    <!-- Sweet Gentle Smile -->
    <path d="M 54 70 Q 64 78 74 70" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Signature Twin Star Sparkles -->
    ${drawSparkle(24, 38, 7, BRAND_PALETTE.warmAmber, rot)}
    ${drawSparkle(104, 38, 7, BRAND_PALETTE.cyberCyan, -rot)}
  `);
}

function renderWave(t) {
  const waveHand = Math.sin(t * Math.PI * 4) * 12;
  return wrapSvg(`
    ${drawBaseHead(0)}
    ${drawAnimeEyes(48, 80, 58, "happy")}
    <path d="M 56 70 Q 64 76 72 70" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Waving Chibi Hand Attached to Body -->
    <g transform="rotate(${waveHand} 96 74)">
      <rect x="88" y="58" width="16" height="22" rx="8" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" filter="url(#glow-pink)" />
      <circle cx="96" cy="54" r="5" fill="${BRAND_PALETTE.softRose}" />
    </g>
    <!-- Cheerful Sparkle -->
    ${drawSparkle(106, 36, 6, BRAND_PALETTE.cyberCyan, t * 180)}
  `);
}

function renderSparkle(t) {
  const rot = t * 360;
  const pulse = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Dynamic Cluster of 4-Pointed Stars Bursting Outwards -->
    <!-- Center Hero Star (Cyan) -->
    ${drawSparkle(64, 64, 22 + pulse, BRAND_PALETTE.cyberCyan, rot)}
    <!-- Top-Right Star (Amber) -->
    ${drawSparkle(96, 36, 12, BRAND_PALETTE.warmAmber, -rot * 1.5)}
    <!-- Bottom-Left Star (Pink) -->
    ${drawSparkle(32, 92, 14, BRAND_PALETTE.nauraPink, -rot)}
    <!-- Top-Left Star (Purple) -->
    ${drawSparkle(36, 36, 10, BRAND_PALETTE.dreamPurple, rot * 2)}
    <!-- Bottom-Right Star (White) -->
    ${drawSparkle(92, 92, 10, BRAND_PALETTE.white, rot * 1.5)}
    <!-- Center Core Glow -->
    <circle cx="64" cy="64" r="6" fill="${BRAND_PALETTE.white}" filter="url(#glow-cyan)" />
  `);
}

function renderMagicCast(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- Concentric Magic Rune Summoning Circle -->
    <!-- Outer Rune Ring -->
    <circle cx="64" cy="64" r="48" stroke="${BRAND_PALETTE.dreamPurple}" stroke-width="2" fill="none" opacity="0.8" filter="url(#glow-purple)" />
    <!-- Rotating Geometric Runes -->
    <g transform="rotate(${rot} 64 64)">
      <!-- Octagram / Square Inscribed -->
      <rect x="30" y="30" width="68" height="68" fill="none" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" />
      <rect x="30" y="30" width="68" height="68" fill="none" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" transform="rotate(45 64 64)" />
      <!-- Radial Glyph Lines -->
      <circle cx="64" cy="20" r="3" fill="${BRAND_PALETTE.white}" />
      <circle cx="64" cy="108" r="3" fill="${BRAND_PALETTE.white}" />
      <circle cx="20" cy="64" r="3" fill="${BRAND_PALETTE.white}" />
      <circle cx="108" cy="64" r="3" fill="${BRAND_PALETTE.white}" />
    </g>
    <!-- Inner Circle with Miracle Core -->
    <circle cx="64" cy="64" r="26" fill="url(#gradient-magic)" opacity="0.6" />
    <circle cx="64" cy="64" r="14" fill="${BRAND_PALETTE.white}" filter="url(#glow-cyan)" />
    <!-- Counter-rotating Core Star -->
    ${drawSparkle(64, 64, 18, BRAND_PALETTE.cyberCyan, -rot * 2)}
  `);
}

function renderHeartHands(t) {
  const beat = 1 + (Math.sin(t * Math.PI * 2) > 0.6 ? 0.08 : 0);
  return wrapSvg(`
    <!-- Two Hands Forming Heart Shape -->
    <!-- Left Hand -->
    <path d="M 40 44 C 32 32 20 44 26 58 C 32 72 56 86 64 92 C 58 84 46 68 40 44 Z" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
    <!-- Right Hand -->
    <path d="M 88 44 C 96 32 108 44 102 58 C 96 72 72 86 64 92 C 70 84 82 68 88 44 Z" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
    <!-- Inner Glowing Heart -->
    <g transform="translate(64, 56) scale(${beat}) translate(-64, -56)">
      <path d="M 64 48 C 60 40 50 40 48 46 C 46 52 56 60 64 66 C 72 60 82 52 80 46 C 78 40 68 40 64 48 Z" fill="url(#gradient-magenta)" filter="url(#glow-pink)" />
    </g>
    <!-- Sparkle on Top -->
    ${drawSparkle(64, 30, 6, BRAND_PALETTE.white, t * 180)}
  `);
}

function renderPeaceSign(t) {
  const bounce = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <g transform="translate(0, ${bounce})">
      ${drawBaseHead(0)}
      ${drawAnimeEyes(48, 80, 58, "wink")}
      <path d="M 56 70 Q 64 76 72 70" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2" stroke-linecap="round" fill="none" />
      <!-- V-Peace Sign Glove Hand in Foreground -->
      <g transform="translate(74, 54)">
        <rect x="0" y="24" width="28" height="26" rx="8" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
        <!-- Index Finger -->
        <rect x="4" y="0" width="7" height="26" rx="3.5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" transform="rotate(-15 7 13)" />
        <!-- Middle Finger -->
        <rect x="16" y="0" width="7" height="26" rx="3.5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" transform="rotate(15 19 13)" />
        <!-- Curled Other Fingers -->
        <circle cx="8" cy="30" r="5" fill="${BRAND_PALETTE.softRose}" />
        <circle cx="18" cy="30" r="5" fill="${BRAND_PALETTE.softRose}" />
      </g>
    </g>
    <!-- Golden Star Glint on Fingertip -->
    ${drawSparkle(98, 48 + bounce, 7, BRAND_PALETTE.warmAmber, t * 180)}
  `);
}

function renderFingerHeart(t) {
  const heartFloat = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    <!-- Hand Making Finger Heart Gesture -->
    <!-- Palm / Fist -->
    <rect x="42" y="66" width="44" height="40" rx="14" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-pink)" />
    <!-- Crossed Thumb & Index Finger -->
    <!-- Thumb (Diagonal Left) -->
    <rect x="44" y="50" width="12" height="26" rx="6" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" transform="rotate(25 50 63)" />
    <!-- Index Finger (Diagonal Right) -->
    <rect x="68" y="44" width="12" height="30" rx="6" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" transform="rotate(-20 74 59)" />
    <!-- Floating Miniature Pink Heart Above Fingers -->
    <g transform="translate(64, ${32 + heartFloat}) scale(1.1) translate(-64, -32)">
      <path d="M 64 26 C 60 18 50 18 48 24 C 46 30 56 38 64 44 C 72 38 82 30 80 24 C 78 18 68 18 64 26 Z" fill="${BRAND_PALETTE.deepMagenta}" filter="url(#glow-pink)" />
    </g>
    <!-- Sparkles -->
    ${drawSparkle(42, 28 + heartFloat, 5, BRAND_PALETTE.cyberCyan, t * 180)}
    ${drawSparkle(86, 26 + heartFloat, 6, BRAND_PALETTE.warmAmber, -t * 180)}
  `);
}

function renderSalute(t) {
  const bounce = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    ${drawBaseHead(bounce)}
    <!-- Determined Salute Eyes -->
    <ellipse cx="48" cy="${58 + bounce}" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <circle cx="48" cy="${58 + bounce}" r="4" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="46" cy="${56 + bounce}" r="2" fill="${BRAND_PALETTE.white}" />
    <ellipse cx="80" cy="${58 + bounce}" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <circle cx="80" cy="${58 + bounce}" r="4" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="78" cy="${56 + bounce}" r="2" fill="${BRAND_PALETTE.white}" />
    <!-- Straight Resolute Mouth -->
    <line x1="56" y1="${72 + bounce}" x2="72" y2="${72 + bounce}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" />
    <!-- Salute Hand at Brow Temple -->
    <g transform="translate(76, ${42 + bounce})">
      <rect x="0" y="0" width="28" height="10" rx="5" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" transform="rotate(-20 14 5)" />
      <!-- Cuff -->
      <rect x="22" y="2" width="10" height="14" rx="3" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1" />
    </g>
    <!-- Shiny Uniform Star Badge -->
    ${drawSparkle(34, 46 + bounce, 6, BRAND_PALETTE.warmAmber, t * 180)}
  `);
}

function renderHug(t) {
  const squeeze = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Pink Heart Comfort Aura -->
    <circle cx="64" cy="64" r="48" stroke="${BRAND_PALETTE.nauraPink}" stroke-width="2" fill="none" opacity="0.6" filter="url(#glow-pink)" />
    ${drawBaseHead(0)}
    <!-- Happy Closed Squeezing Eyes -->
    <path d="M 40 58 Q 48 64 56 58" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M 72 58 Q 80 64 88 58" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <!-- Sweet Open Grin -->
    <path d="M 56 70 Q 64 78 72 70" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2" stroke-linecap="round" fill="none" />
    <!-- Outstretched Hugging Chibi Arms -->
    <!-- Left Arm -->
    <path d="M 32 74 C 20 74 14 60 22 54 C 30 48 38 64 42 70 Z" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" transform="translate(${squeeze}, 0)" />
    <!-- Right Arm -->
    <path d="M 96 74 C 108 74 114 60 106 54 C 98 48 90 64 86 70 Z" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" transform="translate(${-squeeze}, 0)" />
    <!-- Floating Warm Sparkles -->
    ${drawSparkle(20, 36, 5, BRAND_PALETTE.warmAmber, t * 180)}
    ${drawSparkle(108, 36, 5, BRAND_PALETTE.cyberCyan, -t * 180)}
  `);
}

function renderKiss(t) {
  const heartFlyX = 78 + (t * 26);
  const heartFlyY = 64 - (t * 24);
  return wrapSvg(`
    ${drawBaseHead(0)}
    <!-- Left Winking Eye -->
    <path d="M 40 58 Q 48 52 56 60" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <!-- Right Open Anime Eye -->
    <ellipse cx="80" cy="58" rx="8" ry="9" fill="${BRAND_PALETTE.darkBg}" />
    <circle cx="80" cy="58" r="4.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="78" cy="55" r="2.5" fill="${BRAND_PALETTE.white}" />
    <!-- Puckered Kiss Mouth (3) -->
    <path d="M 60 70 Q 64 68 62 73 Q 64 78 60 76" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <!-- Flying Blowing Heart -->
    <g transform="translate(${heartFlyX}, ${heartFlyY}) scale(0.9) translate(-64, -64)">
      <path d="M 64 56 C 60 48 50 48 48 54 C 46 60 56 68 64 74 C 72 68 82 60 80 54 C 78 48 68 48 64 56 Z" fill="${BRAND_PALETTE.deepMagenta}" filter="url(#glow-pink)" />
    </g>
    <!-- Kiss Sparkle -->
    ${drawSparkle(heartFlyX + 8, heartFlyY - 8, 5, BRAND_PALETTE.warmAmber, t * 360)}
  `);
}

const SPECIAL_GENERATORS = {
  naura_smile: renderSmile,
  naura_wave: renderWave,
  naura_sparkle: renderSparkle,
  naura_magic_cast: renderMagicCast,
  naura_heart_hands: renderHeartHands,
  naura_peace_sign: renderPeaceSign,
  naura_finger_heart: renderFingerHeart,
  naura_salute: renderSalute,
  naura_hug: renderHug,
  naura_kiss: renderKiss,
};

module.exports = {
  SPECIAL_GENERATORS,
};
