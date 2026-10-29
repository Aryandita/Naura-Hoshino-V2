// Lokasi: scripts/emojis/generators/rpg.js
// Generator SVG untuk Kategori 3: RPG & Survival (20 Emojis)
"use strict";

const { wrapSvg, drawSparkle, BRAND_PALETTE } = require("./common");

function renderSword(t) {
  const gleamPos = (t * 60);
  return wrapSvg(`
    <!-- 45-degree Crystalline Blade -->
    <g transform="rotate(-45 64 64)">
      <!-- Blade Body -->
      <polygon points="60,20 64,12 68,20 68,76 60,76" fill="url(#gradient-blade)" filter="url(#glow-cyan)" />
      <line x1="64" y1="14" x2="64" y2="76" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" />
      <!-- Gleam Sweep -->
      <circle cx="64" cy="${20 + gleamPos}" r="4" fill="${BRAND_PALETTE.white}" opacity="0.8" />
      <!-- Crossguard -->
      <rect x="46" y="76" width="36" height="8" rx="4" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" />
      <!-- Hilt Grip -->
      <rect x="60" y="84" width="8" height="22" rx="3" fill="${BRAND_PALETTE.darkSlate}" />
      <line x1="60" y1="90" x2="68" y2="90" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1" />
      <line x1="60" y1="96" x2="68" y2="96" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1" />
      <!-- Pommel with Pink Gem -->
      <circle cx="64" cy="110" r="6" fill="${BRAND_PALETTE.deepMagenta}" filter="url(#glow-pink)" />
    </g>
    <!-- Star Sparkle on Blade Tip -->
    ${drawSparkle(98, 30, 7, BRAND_PALETTE.white, t * 180)}
  `);
}

function renderShield(t) {
  const veinPulse = 0.6 + Math.sin(t * Math.PI * 2) * 0.4;
  return wrapSvg(`
    <!-- Cyan Energy Barrier Ring -->
    <circle cx="64" cy="64" r="50" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" opacity="0.6" stroke-dasharray="4 4" filter="url(#glow-cyan)" />
    <!-- Buckler Outer Rim -->
    <circle cx="64" cy="64" r="44" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.neutralGray}" stroke-width="3" />
    <!-- Rivets -->
    <circle cx="64" cy="24" r="2.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="64" cy="104" r="2.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="24" cy="64" r="2.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="104" cy="64" r="2.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- Inner Dark Glass Face -->
    <circle cx="64" cy="64" r="34" fill="url(#gradient-dark-glass)" />
    <!-- Nature Green Leaf Emblem -->
    <path d="M 64 36 C 80 44 84 68 64 88 C 44 68 48 44 64 36 Z" fill="url(#gradient-nature)" filter="url(#glow-green)" />
    <!-- Leaf Veins -->
    <line x1="64" y1="42" x2="64" y2="82" stroke="${BRAND_PALETTE.white}" stroke-width="2" opacity="${veinPulse}" />
    <line x1="64" y1="56" x2="74" y2="50" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" opacity="${veinPulse}" />
    <line x1="64" y1="68" x2="72" y2="62" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" opacity="${veinPulse}" />
    <line x1="64" y1="56" x2="54" y2="50" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" opacity="${veinPulse}" />
    <line x1="64" y1="68" x2="56" y2="62" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" opacity="${veinPulse}" />
  `);
}

function renderPotionHp(t) {
  const bubbleY1 = 80 - ((t * 36) % 36);
  const bubbleY2 = 80 - (((t + 0.5) * 36) % 36);
  return wrapSvg(`
    <!-- Glass Flask Neck & Cork -->
    <rect x="54" y="24" width="20" height="10" rx="3" fill="#D97706" />
    <rect x="56" y="34" width="16" height="16" fill="url(#gradient-glass)" stroke="${BRAND_PALETTE.white}" stroke-width="1" />
    <!-- Glass Spherical Flask Body -->
    <circle cx="64" cy="74" r="34" fill="url(#gradient-glass)" stroke="${BRAND_PALETTE.white}" stroke-width="2" />
    <!-- Ruby Red Liquid Fill -->
    <path d="M 34 74 A 30 30 0 0 0 94 74 Q 80 70 64 74 Q 48 78 34 74 Z" fill="url(#gradient-alert)" filter="url(#glow-pink)" />
    <!-- Rising Heart Bubbles -->
    <path d="M 52 ${bubbleY1} C 52 ${bubbleY1 - 4} 48 ${bubbleY1 - 4} 48 ${bubbleY1 + 1} C 48 ${bubbleY1 + 5} 52 ${bubbleY1 + 8} 52 ${bubbleY1 + 8} C 52 ${bubbleY1 + 8} 56 ${bubbleY1 + 5} 56 ${bubbleY1 + 1} C 56 ${bubbleY1 - 4} 52 ${bubbleY1 - 4} 52 ${bubbleY1} Z" fill="${BRAND_PALETTE.white}" opacity="0.8" />
    <circle cx="72" cy="${bubbleY2}" r="3" fill="${BRAND_PALETTE.white}" opacity="0.7" />
    <!-- Specular Highlight on Glass -->
    <ellipse cx="48" cy="62" rx="6" ry="12" fill="${BRAND_PALETTE.white}" opacity="0.4" transform="rotate(-30 48 62)" />
  `);
}

function renderPotionMp(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- Silver Crystal Cap -->
    <polygon points="56,22 72,22 76,32 52,32" fill="url(#gradient-platinum)" stroke="${BRAND_PALETTE.white}" stroke-width="1" />
    <!-- Faceted Crystal Vial Body -->
    <polygon points="52,32 76,32 94,60 84,104 44,104 34,60" fill="url(#gradient-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
    <!-- Swirling Sapphire/Cyan Mana Fluid -->
    <polygon points="40,64 88,64 80,100 48,100" fill="url(#gradient-cyber)" filter="url(#glow-cyan)" />
    <!-- Internal Mana Vortex Star -->
    ${drawSparkle(64, 82, 8, BRAND_PALETTE.white, rot)}
    <!-- Specular Facet Gleams -->
    <line x1="52" y1="34" x2="48" y2="98" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" opacity="0.7" />
    <line x1="76" y1="34" x2="80" y2="98" stroke="${BRAND_PALETTE.white}" stroke-width="1.5" opacity="0.7" />
  `);
}

function renderCoinSc(t) {
  const gleamX = 36 + (t * 56);
  return wrapSvg(`
    <!-- Heavy Gold Milled Rim -->
    <ellipse cx="64" cy="64" rx="46" ry="46" fill="url(#gradient-amber)" stroke="${BRAND_PALETTE.goldDark}" stroke-width="4" filter="url(#glow-gold)" />
    <!-- Inner Coin Face -->
    <ellipse cx="64" cy="64" rx="38" ry="38" fill="url(#gradient-gold-plate)" />
    <!-- Milled Dots Border -->
    <circle cx="64" cy="64" r="35" stroke="${BRAND_PALETTE.goldDark}" stroke-width="1.5" stroke-dasharray="2 4" fill="none" />
    <!-- Embossed "SC" Lettering -->
    <text x="64" y="74" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="28" fill="${BRAND_PALETTE.goldText}">SC</text>
    <!-- Surface Light Sweep Reflection -->
    <line x1="${gleamX}" y1="26" x2="${gleamX + 16}" y2="102" stroke="${BRAND_PALETTE.white}" stroke-width="4" opacity="0.5" stroke-linecap="round" />
  `);
}

function renderCoinPd(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- Holographic Cyan Projection Ring -->
    <circle cx="64" cy="64" r="50" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" opacity="0.7" stroke-dasharray="6 3" transform="rotate(${rot} 64 64)" filter="url(#glow-cyan)" />
    <!-- Polished Platinum Coin Body -->
    <circle cx="64" cy="64" r="44" fill="url(#gradient-platinum)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="3" />
    <!-- Inner Cyber Ring -->
    <circle cx="64" cy="64" r="36" fill="${BRAND_PALETTE.darkBg}" />
    <!-- Embossed "PD" with Neon Luster -->
    <text x="64" y="74" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="28" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)">PD</text>
    <!-- Diamond Accent Dots -->
    <circle cx="64" cy="34" r="2.5" fill="${BRAND_PALETTE.white}" />
    <circle cx="64" cy="94" r="2.5" fill="${BRAND_PALETTE.white}" />
  `);
}

function renderGemVb(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Octagonal Faceted Amethyst Crystal -->
    <polygon points="46,24 82,24 104,46 104,82 82,104 46,104 24,82 24,46" fill="url(#gradient-magic)" stroke="${BRAND_PALETTE.white}" stroke-width="2.5" filter="url(#glow-purple)" />
    <!-- Inner Facet Triangles -->
    <polygon points="46,24 82,24 64,64" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.6" />
    <polygon points="82,24 104,46 64,64" fill="#9333EA" opacity="0.7" />
    <polygon points="104,46 104,82 64,64" fill="${BRAND_PALETTE.deepMagenta}" opacity="0.5" />
    <polygon points="104,82 82,104 64,64" fill="#9333EA" opacity="0.7" />
    <polygon points="82,104 46,104 64,64" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.6" />
    <polygon points="46,104 24,82 64,64" fill="#7E22CE" opacity="0.8" />
    <polygon points="24,82 24,46 64,64" fill="#6B21A8" opacity="0.7" />
    <polygon points="24,46 46,24 64,64" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.5" />
    <!-- Glowing Energy Core -->
    <circle cx="64" cy="64" r="${8 + pulse}" fill="${BRAND_PALETTE.white}" filter="url(#glow-cyan)" />
  `);
}

function renderDiamondBa(t) {
  const glint = t * 360;
  return wrapSvg(`
    <!-- Brilliant Cut Diamond Crown & Pavilion -->
    <polygon points="40,32 88,32 108,54 64,104 20,54" fill="url(#gradient-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" filter="url(#glow-cyan)" />
    <!-- Table and Star Facets -->
    <polygon points="48,32 80,32 88,44 40,44" fill="${BRAND_PALETTE.white}" opacity="0.7" />
    <polygon points="40,44 88,44 64,54" fill="${BRAND_PALETTE.cyberCyan}" opacity="0.6" />
    <!-- Lower Pavilion Facets -->
    <polygon points="20,54 40,44 64,54 64,104" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.5" />
    <polygon points="108,54 88,44 64,54 64,104" fill="${BRAND_PALETTE.deepMagenta}" opacity="0.5" />
    <!-- Prismatic Rainbow Sparkles -->
    ${drawSparkle(32, 40, 6, BRAND_PALETTE.warmAmber, glint)}
    ${drawSparkle(96, 42, 6, BRAND_PALETTE.cyberCyan, -glint)}
    ${drawSparkle(64, 86, 7, BRAND_PALETTE.white, glint * 0.5)}
  `);
}

function renderHeartFull(t) {
  const beat = 1 + (Math.sin(t * Math.PI * 2) > 0.6 ? 0.08 : 0);
  return wrapSvg(`
    <!-- Glossy Red-Pink Full Heart -->
    <g transform="translate(64, 64) scale(${beat}) translate(-64, -64)">
      <path d="M 64 34 C 44 14 16 32 20 62 C 24 88 56 104 64 110 C 72 104 104 88 108 62 C 112 32 84 14 64 34 Z" fill="url(#gradient-magenta)" stroke="${BRAND_PALETTE.alertRed}" stroke-width="3" filter="url(#glow-pink)" />
      <!-- Specular Reflection Arc -->
      <path d="M 32 46 C 30 36 44 28 54 34" stroke="${BRAND_PALETTE.white}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8" />
      <!-- Cyber Circuit Vein Lines -->
      <path d="M 64 48 L 64 74 L 78 84" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" opacity="0.8" filter="url(#glow-cyan)" />
      <circle cx="78" cy="84" r="3" fill="${BRAND_PALETTE.cyberCyan}" />
      <circle cx="64" cy="48" r="2.5" fill="${BRAND_PALETTE.cyberCyan}" />
    </g>
  `);
}

function renderHeartHalf(t) {
  const spark = Math.sin(t * Math.PI * 4) * 0.4 + 0.6;
  return wrapSvg(`
    <!-- Left Half: Glowing Ruby Red -->
    <path d="M 64 34 C 44 14 16 32 20 62 C 24 88 56 104 64 110 L 64 34 Z" fill="url(#gradient-alert)" filter="url(#glow-pink)" />
    <!-- Right Half: Hollow Dark Slate with Cracks -->
    <path d="M 64 34 L 64 110 C 72 104 104 88 108 62 C 112 32 84 14 64 34 Z" fill="${BRAND_PALETTE.darkSlate}" stroke="${BRAND_PALETTE.darkMetal}" stroke-width="2" />
    <!-- Jagged Fissure Crack Down Center -->
    <path d="M 64 34 L 61 50 L 67 68 L 61 88 L 64 110" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" fill="none" opacity="${spark}" filter="url(#glow-cyan)" />
    <!-- Crack Branch -->
    <path d="M 67 68 L 84 62 L 92 70" stroke="${BRAND_PALETTE.alertRed}" stroke-width="1.5" fill="none" opacity="${spark}" />
  `);
}

function renderEnergy(t) {
  const zap = Math.sin(t * Math.PI * 6) * 1.5;
  return wrapSvg(`
    <!-- Jagged Multi-Angled Lightning Bolt -->
    <g transform="translate(${zap}, 0)">
      <polygon points="72,14 36,62 62,62 46,114 96,52 68,52 86,14" fill="${BRAND_PALETTE.warmAmber}" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2.5" filter="url(#glow-gold)" />
      <!-- Cyan Core Energy Streak -->
      <polygon points="70,22 44,58 64,58 54,98 86,54 66,54 78,22" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
      <!-- Spark Arcs -->
      <line x1="28" y1="56" x2="36" y2="60" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
      <line x1="94" y1="64" x2="102" y2="68" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
    </g>
  `);
}

function renderFood(t) {
  const steamY = ((t * 18) % 18);
  return wrapSvg(`
    <!-- Modern Bento Box Container -->
    <rect x="22" y="44" width="84" height="60" rx="10" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.nauraPink}" stroke-width="3" />
    <!-- Compartment Divider -->
    <line x1="64" y1="46" x2="64" y2="102" stroke="${BRAND_PALETTE.darkBg}" stroke-width="3" />
    <!-- Onigiri Rice Ball (Left) -->
    <polygon points="43,54 28,84 58,84" fill="${BRAND_PALETTE.white}" stroke="${BRAND_PALETTE.neutralGray}" stroke-width="1.5" />
    <rect x="38" y="74" width="10" height="10" rx="2" fill="${BRAND_PALETTE.darkBg}" />
    <!-- Tamagoyaki Egg Roll & Veggies (Right) -->
    <rect x="70" y="52" width="30" height="14" rx="4" fill="${BRAND_PALETTE.warmAmber}" />
    <circle cx="76" cy="80" r="6" fill="${BRAND_PALETTE.natureGreen}" />
    <circle cx="90" cy="82" r="6" fill="${BRAND_PALETTE.alertRed}" />
    <!-- Wafting Steam Curls -->
    <path d="M 40 ${38 - steamY} Q 46 ${32 - steamY} 40 ${26 - steamY}" stroke="${BRAND_PALETTE.white}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6" />
    <path d="M 80 ${38 - steamY} Q 86 ${32 - steamY} 80 ${26 - steamY}" stroke="${BRAND_PALETTE.white}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6" />
  `);
}

function renderWater(t) {
  const rippleR = 14 + (t * 26);
  const rippleAlpha = 1 - t;
  return wrapSvg(`
    <!-- Water Ripple Surface -->
    <ellipse cx="64" cy="88" rx="${rippleR * 1.5}" ry="${rippleR * 0.6}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" fill="none" opacity="${rippleAlpha}" filter="url(#glow-cyan)" />
    <ellipse cx="64" cy="88" rx="${(rippleR * 0.8) * 1.5}" ry="${(rippleR * 0.8) * 0.6}" stroke="${BRAND_PALETTE.skyBlue}" stroke-width="2" fill="none" opacity="${rippleAlpha * 0.8}" />
    <!-- Falling Crystal Water Droplet -->
    <path d="M 64 24 C 64 24 50 52 50 64 C 50 72 56 78 64 78 C 72 78 78 72 78 64 C 78 52 64 24 64 24 Z" fill="url(#gradient-cyber)" filter="url(#glow-cyan)" />
    <!-- Droplet Specular Reflection -->
    <ellipse cx="58" cy="62" rx="3" ry="6" fill="${BRAND_PALETTE.white}" opacity="0.7" transform="rotate(-20 58 62)" />
  `);
}

function renderFire(t) {
  const flameOsc = Math.sin(t * Math.PI * 4) * 3;
  return wrapSvg(`
    <!-- Crossed Cyber Logs -->
    <polygon points="26,92 98,78 102,86 30,100" fill="${BRAND_PALETTE.darkSlate}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1" />
    <polygon points="30,78 102,92 98,100 26,86" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1" />
    <!-- Stylized Outer Flame (Red) -->
    <path d="M 64 20 C 86 42 96 68 86 86 C 76 96 52 96 42 86 C 32 68 42 42 64 20 Z" fill="url(#gradient-alert)" filter="url(#glow-pink)" />
    <!-- Mid Flame (Amber Gold) -->
    <path d="M ${64 + flameOsc} 38 C 78 52 84 72 76 84 C 68 92 52 92 48 84 C 44 72 50 52 ${64 + flameOsc} 38 Z" fill="${BRAND_PALETTE.warmAmber}" />
    <!-- Inner Core Flame (Cyan/White) -->
    <path d="M ${64 - flameOsc} 54 C 70 64 72 78 68 84 C 64 88 58 88 56 84 C 54 78 58 64 ${64 - flameOsc} 54 Z" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <!-- Rising Spark Embers -->
    <circle cx="50" cy="${32 - (t * 16)}" r="2" fill="${BRAND_PALETTE.warmAmber}" />
    <circle cx="78" cy="${28 - (t * 16)}" r="2.5" fill="${BRAND_PALETTE.white}" />
  `);
}

function renderTree(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 0.3 + 0.7;
  return wrapSvg(`
    <!-- Cyber Sap Trunk with Roots -->
    <path d="M 56 98 L 58 72 L 52 64 L 62 60 L 64 72 L 72 98 Z" fill="${BRAND_PALETTE.darkMetal}" />
    <!-- Glowing Cyan Sap Veins -->
    <line x1="62" y1="96" x2="60" y2="68" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" opacity="${pulse}" filter="url(#glow-cyan)" />
    <line x1="60" y1="74" x2="52" y2="64" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" opacity="${pulse}" />
    <!-- Lush Multi-Layer Green Canopy -->
    <circle cx="64" cy="44" r="26" fill="url(#gradient-nature)" filter="url(#glow-green)" />
    <circle cx="44" cy="52" r="18" fill="${BRAND_PALETTE.natureGreen}" />
    <circle cx="84" cy="52" r="18" fill="${BRAND_PALETTE.natureGreen}" />
    <circle cx="64" cy="34" r="18" fill="#4ADE80" opacity="0.8" />
    <!-- Sakura / Tech Nodes in Canopy -->
    <circle cx="52" cy="40" r="3" fill="${BRAND_PALETTE.nauraPink}" />
    <circle cx="76" cy="42" r="3" fill="${BRAND_PALETTE.cyberCyan}" />
  `);
}

function renderPickaxe(t) {
  const rot = Math.sin(t * Math.PI * 2) * 12;
  return wrapSvg(`
    <g transform="rotate(${rot} 64 64)">
      <!-- Metallic Handle -->
      <line x1="30" y1="98" x2="88" y2="40" stroke="${BRAND_PALETTE.darkMetal}" stroke-width="7" stroke-linecap="round" />
      <line x1="30" y1="98" x2="88" y2="40" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" stroke-linecap="round" />
      <!-- Dual-Headed Cyan Crystal Pick Head -->
      <path d="M 64 24 Q 90 28 106 48 L 98 56 Q 84 40 68 40 L 78 54 L 66 64 L 54 48 Q 44 64 30 76 L 24 68 Q 44 48 64 24 Z" fill="url(#gradient-cyber)" stroke="${BRAND_PALETTE.white}" stroke-width="2" filter="url(#glow-cyan)" />
      <!-- Impact Sparks -->
      ${drawSparkle(106, 48, 5, BRAND_PALETTE.warmAmber, t * 180)}
    </g>
    <!-- Durability Meter Bar (Bottom Left) -->
    <rect x="22" y="106" width="36" height="6" rx="3" fill="${BRAND_PALETTE.darkBg}" stroke="${BRAND_PALETTE.neutralGray}" stroke-width="1" />
    <rect x="23" y="107" width="26" height="4" rx="2" fill="${BRAND_PALETTE.natureGreen}" />
  `);
}

function renderBackpack(t) {
  const jiggle = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Compact Adventurer Backpack Body -->
    <rect x="28" y="${36 + jiggle}" width="72" height="68" rx="16" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.dreamPurple}" stroke-width="3" filter="url(#glow-purple)" />
    <!-- Top Flap Lid -->
    <path d="M 28 ${52 + jiggle} Q 64 ${62 + jiggle} 100 ${52 + jiggle} L 100 ${36 + jiggle} L 28 ${36 + jiggle} Z" fill="${BRAND_PALETTE.nauraPink}" opacity="0.9" />
    <!-- Straps & Brass Buckles -->
    <rect x="42" y="${38 + jiggle}" width="8" height="48" fill="${BRAND_PALETTE.darkSlate}" />
    <rect x="40" y="${64 + jiggle}" width="12" height="8" rx="2" fill="${BRAND_PALETTE.warmAmber}" stroke="${BRAND_PALETTE.goldDark}" stroke-width="1" />
    <rect x="78" y="${38 + jiggle}" width="8" height="48" fill="${BRAND_PALETTE.darkSlate}" />
    <rect x="76" y="${64 + jiggle}" width="12" height="8" rx="2" fill="${BRAND_PALETTE.warmAmber}" stroke="${BRAND_PALETTE.goldDark}" stroke-width="1" />
    <!-- Naura Star Badge on Pocket -->
    <circle cx="64" cy="${82 + jiggle}" r="10" fill="${BRAND_PALETTE.darkBg}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" />
    ${drawSparkle(64, 82 + jiggle, 6, BRAND_PALETTE.cyberCyan, t * 180)}
  `);
}

function renderMap(t) {
  const radarR = 8 + (t * 18);
  return wrapSvg(`
    <!-- Three-Fold Parchment Map Sheets -->
    <polygon points="22,34 50,28 50,96 22,102" fill="#FEF3C7" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
    <polygon points="50,28 78,34 78,102 50,96" fill="#FDE68A" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
    <polygon points="78,34 106,28 106,96 78,102" fill="#FEF3C7" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
    <!-- Topography Grid Lines -->
    <path d="M 26 50 Q 50 60 74 48 Q 94 62 102 54" stroke="${BRAND_PALETTE.skyBlue}" stroke-width="1.5" fill="none" opacity="0.7" stroke-dasharray="2 3" />
    <path d="M 28 74 Q 60 68 84 82" stroke="${BRAND_PALETTE.skyBlue}" stroke-width="1.5" fill="none" opacity="0.7" stroke-dasharray="2 3" />
    <!-- Waypoint Destination Pin -->
    <circle cx="64" cy="56" r="${radarR}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" fill="none" opacity="${1 - t}" />
    <path d="M 64 44 C 58 44 54 48 54 54 C 54 62 64 74 64 74 C 64 74 74 62 74 54 C 74 48 70 44 64 44 Z" fill="${BRAND_PALETTE.alertRed}" filter="url(#glow-pink)" />
    <circle cx="64" cy="54" r="3" fill="${BRAND_PALETTE.white}" />
  `);
}

function renderTreasure(t) {
  const hop = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Radiant Beams of Golden Light Leaking from Lid -->
    <polygon points="64,54 30,16 46,12" fill="${BRAND_PALETTE.warmAmber}" opacity="0.4" filter="url(#glow-gold)" />
    <polygon points="64,54 82,12 98,16" fill="${BRAND_PALETTE.warmAmber}" opacity="0.4" filter="url(#glow-gold)" />
    <polygon points="64,54 58,10 70,10" fill="${BRAND_PALETTE.cyberCyan}" opacity="0.5" filter="url(#glow-cyan)" />
    <!-- Chest Base Container -->
    <rect x="24" y="${58 + hop}" width="80" height="46" rx="8" fill="${BRAND_PALETTE.darkMetal}" stroke="${BRAND_PALETTE.goldDark}" stroke-width="3" />
    <!-- Chest Curved Lid -->
    <path d="M 22 ${56 + hop} Q 64 ${36 + hop} 106 ${56 + hop} L 102 ${62 + hop} L 26 ${62 + hop} Z" fill="#92400E" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="3" />
    <!-- Gold Corner Brackets -->
    <rect x="24" y="${58 + hop}" width="10" height="46" fill="url(#gradient-amber)" />
    <rect x="94" y="${58 + hop}" width="10" height="46" fill="url(#gradient-amber)" />
    <!-- Ornate Golden Padlock -->
    <circle cx="64" cy="${64 + hop}" r="8" fill="${BRAND_PALETTE.warmAmber}" stroke="${BRAND_PALETTE.goldDark}" stroke-width="2" />
    <circle cx="64" cy="${64 + hop}" r="2.5" fill="${BRAND_PALETTE.darkBg}" />
  `);
}

function renderLevelUp(t) {
  const lift = (t * 8);
  return wrapSvg(`
    <!-- Surrounding Starburst Aura -->
    <circle cx="64" cy="64" r="48" stroke="${BRAND_PALETTE.natureGreen}" stroke-width="2" fill="none" opacity="0.5" stroke-dasharray="6 4" filter="url(#glow-green)" />
    <!-- Lower Chevron -->
    <g transform="translate(0, ${-lift})">
      <path d="M 32 86 L 64 62 L 96 86 L 90 94 L 64 74 L 38 94 Z" fill="url(#gradient-nature)" filter="url(#glow-green)" />
      <!-- Upper Winged Chevron -->
      <path d="M 28 62 L 64 32 L 100 62 L 92 70 L 64 46 L 36 70 Z" fill="url(#gradient-amber)" filter="url(#glow-gold)" />
      <!-- Top Arrowhead -->
      <polygon points="64,20 48,38 80,38" fill="${BRAND_PALETTE.white}" />
    </g>
    <!-- Trailing Sparkles -->
    ${drawSparkle(34, 76, 6, BRAND_PALETTE.cyberCyan, t * 180)}
    ${drawSparkle(94, 76, 6, BRAND_PALETTE.warmAmber, -t * 180)}
    ${drawSparkle(64, 24, 7, BRAND_PALETTE.white, t * 360)}
  `);
}

const RPG_GENERATORS = {
  naura_sword: renderSword,
  naura_shield: renderShield,
  naura_potion_hp: renderPotionHp,
  naura_potion_mp: renderPotionMp,
  naura_coin_sc: renderCoinSc,
  naura_coin_pd: renderCoinPd,
  naura_gem_vb: renderGemVb,
  naura_diamond_ba: renderDiamondBa,
  naura_heart_full: renderHeartFull,
  naura_heart_half: renderHeartHalf,
  naura_energy: renderEnergy,
  naura_food: renderFood,
  naura_water: renderWater,
  naura_fire: renderFire,
  naura_tree: renderTree,
  naura_pickaxe: renderPickaxe,
  naura_backpack: renderBackpack,
  naura_map: renderMap,
  naura_treasure: renderTreasure,
  naura_level_up: renderLevelUp,
};

module.exports = {
  RPG_GENERATORS,
};
