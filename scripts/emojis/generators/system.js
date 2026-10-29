// Lokasi: scripts/emojis/generators/system.js
// Generator SVG untuk Kategori 4: System & UI (15 Emojis)
"use strict";

const { wrapSvg, BRAND_PALETTE } = require("./common");

function renderSettings(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- 6-Toothed Cog / Gear -->
    <g transform="rotate(${rot} 64 64)">
      <!-- Outer Gear Teeth -->
      <path d="M 60 18 L 68 18 L 71 28 L 81 33 L 90 27 L 96 33 L 90 42 L 95 52 L 105 55 L 105 63 L 95 66 L 90 76 L 96 85 L 90 91 L 81 85 L 71 90 L 68 100 L 60 100 L 57 90 L 47 85 L 38 91 L 32 85 L 38 76 L 33 66 L 23 63 L 23 55 L 33 52 L 38 42 L 32 33 L 38 27 L 47 33 L 57 28 Z" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="3" filter="url(#glow-cyan)" />
      <!-- Center Circular Hub -->
      <circle cx="64" cy="64" r="22" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" />
      <circle cx="64" cy="64" r="10" fill="${BRAND_PALETTE.darkBg}" />
    </g>
    <!-- Circuit Glow Nodes -->
    <circle cx="64" cy="64" r="5" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
  `);
}

function renderInfo(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 0.05 + 1;
  return wrapSvg(`
    <!-- Outer Glow Aura -->
    <circle cx="64" cy="64" r="48" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" opacity="0.6" filter="url(#glow-cyan)" />
    <!-- Smooth Circular Disc -->
    <g transform="translate(64, 64) scale(${pulse}) translate(-64, -64)">
      <circle cx="64" cy="64" r="44" fill="${BRAND_PALETTE.skyBlue}" stroke="${BRAND_PALETTE.white}" stroke-width="2.5" />
      <!-- Bold White Lowercase "i" Glyph -->
      <circle cx="64" cy="42" r="5" fill="${BRAND_PALETTE.white}" />
      <rect x="58" y="54" width="12" height="34" rx="6" fill="${BRAND_PALETTE.white}" />
    </g>
  `);
}

function renderWarning(t) {
  const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.06;
  return wrapSvg(`
    <!-- Warning Perimeter Halo -->
    <circle cx="64" cy="64" r="50" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="2" fill="none" opacity="0.5" stroke-dasharray="6 4" filter="url(#glow-gold)" />
    <!-- Rounded-Corner Amber Triangle -->
    <g transform="translate(64, 64) scale(${pulse}) translate(-64, -64)">
      <polygon points="64,20 18,98 110,98" fill="url(#gradient-amber)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="4" stroke-linejoin="round" />
      <!-- Inner Dark Triangle -->
      <polygon points="64,28 26,92 102,92" fill="${BRAND_PALETTE.warmAmber}" stroke-linejoin="round" />
      <!-- Bold "!" Glyph -->
      <rect x="60" y="44" width="8" height="26" rx="4" fill="${BRAND_PALETTE.darkBg}" />
      <circle cx="64" cy="80" r="4.5" fill="${BRAND_PALETTE.darkBg}" />
    </g>
  `);
}

function renderError(t) {
  const shake = Math.sin(t * Math.PI * 6) * 2;
  return wrapSvg(`
    <!-- Red Warning Aura -->
    <circle cx="64" cy="64" r="50" stroke="${BRAND_PALETTE.alertRed}" stroke-width="2" fill="none" opacity="0.6" filter="url(#glow-pink)" />
    <!-- Alert Red Circular Container -->
    <g transform="translate(${shake}, 0)">
      <circle cx="64" cy="64" r="44" fill="url(#gradient-alert)" stroke="${BRAND_PALETTE.white}" stroke-width="2.5" />
      <!-- Crisp Bold White "X" Mark -->
      <line x1="44" y1="44" x2="84" y2="84" stroke="${BRAND_PALETTE.white}" stroke-width="9" stroke-linecap="round" />
      <line x1="84" y1="44" x2="44" y2="84" stroke="${BRAND_PALETTE.white}" stroke-width="9" stroke-linecap="round" />
    </g>
  `);
}

function renderSuccess(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Radiating Green Burst Rays -->
    <circle cx="64" cy="64" r="${48 + pulse}" stroke="${BRAND_PALETTE.natureGreen}" stroke-width="2" fill="none" opacity="0.6" filter="url(#glow-green)" />
    <!-- Emerald Green Circle Container -->
    <circle cx="64" cy="64" r="44" fill="url(#gradient-nature)" stroke="${BRAND_PALETTE.white}" stroke-width="2.5" />
    <!-- Bold White Tick Checkmark -->
    <path d="M 40 64 L 56 80 L 88 48" stroke="${BRAND_PALETTE.white}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <!-- Confetti Dots -->
    <circle cx="28" cy="34" r="3" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="100" cy="36" r="3" fill="${BRAND_PALETTE.warmAmber}" />
  `);
}

function renderLoading(t) {
  const rot = t * 360;
  const segments = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * 45;
    const color = i === 0 ? BRAND_PALETTE.white : i < 3 ? BRAND_PALETTE.cyberCyan : BRAND_PALETTE.dreamPurple;
    const height = 14 + (8 - i) * 1.5;
    segments.push(`
      <rect x="61" y="18" width="6" height="${height}" rx="3" fill="${color}" transform="rotate(${angle} 64 64)" filter="url(#glow-cyan)" />
    `);
  }
  return wrapSvg(`
    <!-- Radial Spinner with Continuous Geometric Rotation -->
    <g transform="rotate(${rot} 64 64)">
      ${segments.join("\n")}
    </g>
  `);
}

function renderLock(t) {
  const beamPulse = Math.sin(t * Math.PI * 2) * 0.3 + 0.7;
  return wrapSvg(`
    <!-- Closed Curved Shackle -->
    <path d="M 44 60 L 44 42 A 20 20 0 0 1 84 42 L 84 60" stroke="${BRAND_PALETTE.neutralGray}" stroke-width="7" fill="none" stroke-linecap="round" />
    <!-- Sturdy Metallic Padlock Body -->
    <rect x="34" y="54" width="60" height="50" rx="10" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="3" filter="url(#glow-gold)" />
    <!-- Glowing Cyan Keyhole Slot -->
    <circle cx="64" cy="74" r="6" fill="${BRAND_PALETTE.cyberCyan}" opacity="${beamPulse}" filter="url(#glow-cyan)" />
    <polygon points="61,76 67,76 69,88 59,88" fill="${BRAND_PALETTE.cyberCyan}" opacity="${beamPulse}" />
  `);
}

function renderUnlock(t) {
  const bounce = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Nature Green Unlocked Aura -->
    <circle cx="64" cy="64" r="50" stroke="${BRAND_PALETTE.natureGreen}" stroke-width="2" fill="none" opacity="0.5" stroke-dasharray="4 4" filter="url(#glow-green)" />
    <!-- Popped Open Shackle Pivoted 30 Degrees -->
    <g transform="translate(0, ${bounce})">
      <path d="M 40 46 L 40 34 A 20 20 0 0 1 80 34 L 80 44" stroke="${BRAND_PALETTE.neutralGray}" stroke-width="7" fill="none" stroke-linecap="round" transform="rotate(-30 40 46)" />
      <!-- Padlock Body -->
      <rect x="34" y="54" width="60" height="50" rx="10" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.natureGreen}" stroke-width="3" filter="url(#glow-green)" />
      <!-- Keyhole -->
      <circle cx="64" cy="74" r="6" fill="${BRAND_PALETTE.natureGreen}" />
      <polygon points="61,76 67,76 69,88 59,88" fill="${BRAND_PALETTE.natureGreen}" />
    </g>
  `);
}

function renderSearch(t) {
  const glint = (t * 24);
  return wrapSvg(`
    <!-- 45-degree Tilted Magnifying Glass -->
    <g transform="rotate(-45 64 64)">
      <!-- Metallic Handle -->
      <line x1="64" y1="84" x2="64" y2="114" stroke="${BRAND_PALETTE.darkMetal}" stroke-width="8" stroke-linecap="round" />
      <line x1="64" y1="84" x2="64" y2="114" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" stroke-linecap="round" />
      <!-- Outer Rim Lens Frame -->
      <circle cx="64" cy="52" r="28" fill="url(#gradient-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="4" filter="url(#glow-cyan)" />
      <!-- Glass Lens Reflection Flare -->
      <ellipse cx="${52 + glint * 0.5}" cy="${44 + glint * 0.5}" rx="8" ry="3" fill="${BRAND_PALETTE.white}" opacity="0.6" transform="rotate(30 64 52)" />
    </g>
  `);
}

function renderMenu(t) {
  const expand = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Three Horizontal Rounded Pill Bars with Bullet Dots -->
    <!-- Bar 1 -->
    <circle cx="34" cy="40" r="4" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <rect x="44" y="36" width="${54 + expand}" height="8" rx="4" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- Bar 2 -->
    <circle cx="34" cy="64" r="4" fill="${BRAND_PALETTE.dreamPurple}" filter="url(#glow-purple)" />
    <rect x="44" y="60" width="54" height="8" rx="4" fill="${BRAND_PALETTE.white}" />
    <!-- Bar 3 -->
    <circle cx="34" cy="88" r="4" fill="${BRAND_PALETTE.nauraPink}" filter="url(#glow-pink)" />
    <rect x="44" y="84" width="${54 - expand}" height="8" rx="4" fill="${BRAND_PALETTE.nauraPink}" />
  `);
}

function renderClose(t) {
  const scale = 1 - Math.sin(t * Math.PI * 2) * 0.04;
  return wrapSvg(`
    <!-- Frosted Glass Circle Backing -->
    <circle cx="64" cy="64" r="44" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.softRose}" stroke-width="3" filter="url(#glow-pink)" />
    <!-- Rounded Cross Mark (X) -->
    <g transform="translate(64, 64) scale(${scale}) translate(-64, -64)">
      <line x1="44" y1="44" x2="84" y2="84" stroke="${BRAND_PALETTE.white}" stroke-width="7" stroke-linecap="round" />
      <line x1="84" y1="44" x2="44" y2="84" stroke="${BRAND_PALETTE.white}" stroke-width="7" stroke-linecap="round" />
    </g>
  `);
}

function renderBack(t) {
  const shift = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    <!-- Glass Circle Container -->
    <circle cx="64" cy="64" r="46" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" />
    <!-- Left-pointing Bold Chevron Arrow with Trailing Speed Bar -->
    <g transform="translate(${-shift}, 0)">
      <polygon points="62,38 38,64 62,90 70,82 52,64 70,46" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
      <rect x="76" y="48" width="6" height="32" rx="3" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.8" />
      <rect x="86" y="54" width="4" height="20" rx="2" fill="${BRAND_PALETTE.softRose}" opacity="0.6" />
    </g>
  `);
}

function renderNext(t) {
  const shift = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    <!-- Glass Circle Container -->
    <circle cx="64" cy="64" r="46" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" />
    <!-- Right-pointing Bold Chevron Arrow with Trailing Speed Bar -->
    <g transform="translate(${shift}, 0)">
      <polygon points="66,38 90,64 66,90 58,82 76,64 58,46" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
      <rect x="46" y="48" width="6" height="32" rx="3" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.8" />
      <rect x="38" y="54" width="4" height="20" rx="2" fill="${BRAND_PALETTE.softRose}" opacity="0.6" />
    </g>
  `);
}

function renderRefresh(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- Dual Semi-Circular Arrows Ring -->
    <g transform="rotate(${rot} 64 64)">
      <!-- Top Semi-Circle (Cyan) -->
      <path d="M 64 26 A 38 38 0 0 1 102 64" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="6" stroke-linecap="round" fill="none" filter="url(#glow-cyan)" />
      <polygon points="96,56 104,70 114,60" fill="${BRAND_PALETTE.cyberCyan}" />
      <!-- Bottom Semi-Circle (Magenta) -->
      <path d="M 64 102 A 38 38 0 0 1 26 64" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="6" stroke-linecap="round" fill="none" filter="url(#glow-pink)" />
      <polygon points="32,72 24,58 14,68" fill="${BRAND_PALETTE.deepMagenta}" />
    </g>
    <!-- Center Dot -->
    <circle cx="64" cy="64" r="6" fill="${BRAND_PALETTE.white}" />
  `);
}

function renderNotification(t) {
  const swing = Math.sin(t * Math.PI * 4) * 8;
  return wrapSvg(`
    <!-- Radiating Alert Soundwaves -->
    <path d="M 40 32 A 34 34 0 0 1 88 32" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="2" fill="none" stroke-dasharray="3 3" opacity="0.6" />
    <!-- Notification Bell Body -->
    <g transform="rotate(${swing} 64 36)">
      <!-- Bell Dome & Lip -->
      <path d="M 64 30 C 52 30 46 50 42 70 L 34 76 L 34 82 L 94 82 L 94 76 L 86 70 C 82 50 76 30 64 30 Z" fill="url(#gradient-amber)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2.5" filter="url(#glow-gold)" />
      <!-- Top Loop Ring -->
      <circle cx="64" cy="24" r="5" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="2.5" fill="none" />
      <!-- Clapper Ball -->
      <circle cx="64" cy="88" r="7" fill="${BRAND_PALETTE.goldDark}" />
    </g>
    <!-- Alert Red Badge in Corner -->
    <circle cx="88" cy="34" r="8" fill="${BRAND_PALETTE.alertRed}" filter="url(#glow-pink)" />
    <circle cx="88" cy="34" r="3" fill="${BRAND_PALETTE.white}" />
  `);
}

const SYSTEM_GENERATORS = {
  naura_settings: renderSettings,
  naura_info: renderInfo,
  naura_warning: renderWarning,
  naura_error: renderError,
  naura_success: renderSuccess,
  naura_loading: renderLoading,
  naura_lock: renderLock,
  naura_unlock: renderUnlock,
  naura_search: renderSearch,
  naura_menu: renderMenu,
  naura_close: renderClose,
  naura_back: renderBack,
  naura_next: renderNext,
  naura_refresh: renderRefresh,
  naura_notification: renderNotification,
};

module.exports = {
  SYSTEM_GENERATORS,
};
