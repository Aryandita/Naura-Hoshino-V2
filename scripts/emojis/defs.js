// Lokasi: scripts/emojis/defs.js
// SVG Defs, Palet Warna, dan Filter Glow untuk Naura Emoji Design System
// Sesuai docs/NAURA_EMOJI_DESIGN_SYSTEM.md Bagian 3

"use strict";

const { BRAND_PALETTE } = require("./catalog");

/**
 * Menghasilkan blok <defs> lengkap dengan gradien, filter glow, dan mask
 */
function getSvgDefs() {
  return `
    <defs>
      <!-- Base Gradients Sesuai Token Resmi -->
      <linearGradient id="gradient-skin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.nauraPink}" />
        <stop offset="100%" stop-color="${BRAND_PALETTE.softRose}" />
      </linearGradient>

      <linearGradient id="gradient-skin-dark" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.nauraPink}" />
        <stop offset="100%" stop-color="#FFA0B0" />
      </linearGradient>

      <linearGradient id="gradient-cyber" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.cyberCyan}" />
        <stop offset="100%" stop-color="#00C4D6" />
      </linearGradient>

      <linearGradient id="gradient-magic" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.dreamPurple}" />
        <stop offset="100%" stop-color="#9333EA" />
      </linearGradient>

      <linearGradient id="gradient-nature" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.natureGreen}" />
        <stop offset="100%" stop-color="#4ADE80" />
      </linearGradient>

      <linearGradient id="gradient-amber" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.goldLight}" />
        <stop offset="50%" stop-color="${BRAND_PALETTE.warmAmber}" />
        <stop offset="100%" stop-color="${BRAND_PALETTE.goldDark}" />
      </linearGradient>

      <linearGradient id="gradient-gold-plate" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF9D6" />
        <stop offset="40%" stop-color="${BRAND_PALETTE.warmAmber}" />
        <stop offset="100%" stop-color="${BRAND_PALETTE.goldDark}" />
      </linearGradient>

      <linearGradient id="gradient-platinum" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="50%" stop-color="#E2E8F0" />
        <stop offset="100%" stop-color="#94A3B8" />
      </linearGradient>

      <linearGradient id="gradient-magenta" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.deepMagenta}" />
        <stop offset="100%" stop-color="#DB2777" />
      </linearGradient>

      <linearGradient id="gradient-alert" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.alertRed}" />
        <stop offset="100%" stop-color="#DC2626" />
      </linearGradient>

      <linearGradient id="gradient-glass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.08" />
      </linearGradient>

      <linearGradient id="gradient-dark-glass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1E293B" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#0F172A" stop-opacity="0.95" />
      </linearGradient>

      <linearGradient id="gradient-blade" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.white}" />
        <stop offset="50%" stop-color="${BRAND_PALETTE.cyberCyan}" />
        <stop offset="100%" stop-color="${BRAND_PALETTE.dreamPurple}" />
      </linearGradient>

      <!-- Radial Glow & Blush Gradients -->
      <radialGradient id="gradient-blush" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.deepMagenta}" stop-opacity="0.5" />
        <stop offset="60%" stop-color="${BRAND_PALETTE.deepMagenta}" stop-opacity="0.2" />
        <stop offset="100%" stop-color="${BRAND_PALETTE.deepMagenta}" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="gradient-cyan-bloom" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.cyberCyan}" stop-opacity="0.6" />
        <stop offset="70%" stop-color="${BRAND_PALETTE.cyberCyan}" stop-opacity="0.1" />
        <stop offset="100%" stop-color="${BRAND_PALETTE.cyberCyan}" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="gradient-magic-bloom" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${BRAND_PALETTE.dreamPurple}" stop-opacity="0.6" />
        <stop offset="70%" stop-color="${BRAND_PALETTE.dreamPurple}" stop-opacity="0.1" />
        <stop offset="100%" stop-color="${BRAND_PALETTE.dreamPurple}" stop-opacity="0" />
      </radialGradient>

      <!-- Soft Glow Filters (Skia Compatible) -->
      <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-pink" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  `;
}

module.exports = {
  getSvgDefs,
};
