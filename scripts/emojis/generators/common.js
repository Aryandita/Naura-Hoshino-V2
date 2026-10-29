// Lokasi: scripts/emojis/generators/common.js
// Komponen dan Helper SVG Bersama untuk Naura Emoji Design System
"use strict";

const { BRAND_PALETTE } = require("../catalog");
const { getSvgDefs } = require("../defs");

/**
 * Membungkus konten elemen SVG ke dalam tag root SVG standar 128x128
 */
function wrapSvg(innerContent, viewBox = "0 0 128 128") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="128" height="128">
  ${getSvgDefs()}
  ${innerContent}
</svg>`;
}

/**
 * Menggambar bintang 4-sudut (anime sparkle)
 */
function drawSparkle(cx, cy, size, color = BRAND_PALETTE.cyberCyan, rotDeg = 0) {
  const r = size;
  const inR = size * 0.22;
  const rot = rotDeg ? `transform="rotate(${rotDeg} ${cx} ${cy})"` : "";
  return `<path d="M ${cx} ${cy - r} Q ${cx + inR * 0.8} ${cy - inR * 0.8} ${cx + r} ${cy} Q ${cx + inR * 0.8} ${cy + inR * 0.8} ${cx} ${cy + r} Q ${cx - inR * 0.8} ${cy + inR * 0.8} ${cx - r} ${cy} Q ${cx - inR * 0.8} ${cy - inR * 0.8} ${cx} ${cy - r} Z" fill="${color}" ${rot} />`;
}

/**
 * Menggambar kepala dasar Naura (anime circular face)
 */
function drawBaseHead(bounceY = 0, extraGlow = null) {
  const cy = 64 + bounceY;
  const glow = extraGlow ? `filter="url(#${extraGlow})"` : `filter="url(#glow-pink)"`;
  return `
    <!-- Base Head Shadow & Glow -->
    <circle cx="64" cy="${cy}" r="40" fill="url(#gradient-skin)" ${glow} />
    <!-- Specular Highlight Top Left -->
    <ellipse cx="50" cy="${cy - 22}" rx="16" ry="7" fill="${BRAND_PALETTE.white}" opacity="0.4" transform="rotate(-20 50 ${cy - 22})" />
    <!-- Cheeks Blush -->
    <circle cx="40" cy="${cy + 10}" r="9" fill="url(#gradient-blush)" />
    <circle cx="88" cy="${cy + 10}" r="9" fill="url(#gradient-blush)" />
    <!-- Stylized Hair Bangs -->
    <path d="M 28 ${cy - 16} Q 36 ${cy - 36} 64 ${cy - 38} Q 92 ${cy - 36} 100 ${cy - 16} Q 88 ${cy - 10} 78 ${cy - 18} Q 64 ${cy - 8} 50 ${cy - 18} Q 38 ${cy - 10} 28 ${cy - 16} Z" fill="url(#gradient-magenta)" opacity="0.9" />
    <!-- Hair Cyber Highlight -->
    <path d="M 36 ${cy - 24} Q 64 ${cy - 32} 92 ${cy - 24}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" fill="none" opacity="0.8" />
  `;
}

/**
 * Menggambar mata anime Naura
 */
function drawAnimeEyes(cxL, cxR, cy, eyeType = "normal", blink = 0) {
  if (blink > 0.6) {
    // Closed curved blinking eyes
    return `
      <path d="M ${cxL - 8} ${cy} Q ${cxL} ${cy - 5} ${cxL + 8} ${cy}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <path d="M ${cxR - 8} ${cy} Q ${cxR} ${cy - 5} ${cxR + 8} ${cy}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    `;
  }

  if (eyeType === "happy") {
    // Happy arc eyes (^ ^)
    return `
      <path d="M ${cxL - 9} ${cy + 2} Q ${cxL} ${cy - 8} ${cxL + 9} ${cy + 2}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
      <path d="M ${cxR - 9} ${cy + 2} Q ${cxR} ${cy - 8} ${cxR + 9} ${cy + 2}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    `;
  }

  if (eyeType === "wink") {
    // Left eye winks closed, right eye wide open
    return `
      <path d="M ${cxL - 8} ${cy} Q ${cxL} ${cy - 6} ${cxL + 8} ${cy}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
      <circle cx="${cxR}" cy="${cy}" r="9" fill="${BRAND_PALETTE.darkBg}" />
      <circle cx="${cxR}" cy="${cy}" r="7" fill="${BRAND_PALETTE.cyberCyan}" />
      <circle cx="${cxR + 2}" cy="${cy - 2}" r="3" fill="${BRAND_PALETTE.white}" />
    `;
  }

  if (eyeType === "love") {
    // Heart-shaped pupils
    return `
      <g transform="translate(${cxL - 8}, ${cy - 8}) scale(0.8)">
        <path d="M 10 3.2 C 10 0 5 0 5 4 C 5 7 10 11 10 11 C 10 11 15 7 15 4 C 15 0 10 0 10 3.2 Z" fill="${BRAND_PALETTE.deepMagenta}" filter="url(#glow-pink)" />
      </g>
      <g transform="translate(${cxR - 8}, ${cy - 8}) scale(0.8)">
        <path d="M 10 3.2 C 10 0 5 0 5 4 C 5 7 10 11 10 11 C 10 11 15 7 15 4 C 15 0 10 0 10 3.2 Z" fill="${BRAND_PALETTE.deepMagenta}" filter="url(#glow-pink)" />
      </g>
    `;
  }

  if (eyeType === "stars") {
    // Starry eyes
    return `
      ${drawSparkle(cxL, cy, 9, BRAND_PALETTE.warmAmber, 15)}
      ${drawSparkle(cxR, cy, 9, BRAND_PALETTE.warmAmber, 15)}
    `;
  }

  // Normal anime cyan eyes
  return `
    <!-- Left Eye -->
    <ellipse cx="${cxL}" cy="${cy}" rx="8" ry="10" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="${cxL}" cy="${cy + 1}" rx="6" ry="8" fill="${BRAND_PALETTE.cyberCyan}" />
    <ellipse cx="${cxL}" cy="${cy + 3}" rx="4" ry="5" fill="${BRAND_PALETTE.dreamPurple}" />
    <circle cx="${cxL - 2}" cy="${cy - 3}" r="3.2" fill="${BRAND_PALETTE.white}" />
    <circle cx="${cxL + 3}" cy="${cy + 3}" r="1.5" fill="${BRAND_PALETTE.white}" />
    <!-- Right Eye -->
    <ellipse cx="${cxR}" cy="${cy}" rx="8" ry="10" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="${cxR}" cy="${cy + 1}" rx="6" ry="8" fill="${BRAND_PALETTE.cyberCyan}" />
    <ellipse cx="${cxR}" cy="${cy + 3}" rx="4" ry="5" fill="${BRAND_PALETTE.dreamPurple}" />
    <circle cx="${cxR - 2}" cy="${cy - 3}" r="3.2" fill="${BRAND_PALETTE.white}" />
    <circle cx="${cxR + 3}" cy="${cy + 3}" r="1.5" fill="${BRAND_PALETTE.white}" />
  `;
}

module.exports = {
  wrapSvg,
  drawSparkle,
  drawBaseHead,
  drawAnimeEyes,
  BRAND_PALETTE,
};
