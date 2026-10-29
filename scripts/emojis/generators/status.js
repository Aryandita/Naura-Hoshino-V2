// Lokasi: scripts/emojis/generators/status.js
// Generator SVG untuk Kategori 1: Status & Reactions (20 Emojis)
"use strict";

const { wrapSvg, drawSparkle, drawBaseHead, drawAnimeEyes, BRAND_PALETTE } = require("./common");

function renderHappy(t) {
  const bounce = Math.sin(t * Math.PI * 2) * 2;
  const mouthOpen = 8 + Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    ${drawBaseHead(bounce)}
    ${drawAnimeEyes(48, 80, 58 + bounce, "happy")}
    <!-- Mouth: Joyful Open Smile -->
    <path d="M 54 ${70 + bounce} Q 64 ${70 + mouthOpen + bounce} 74 ${70 + bounce} Z" fill="url(#gradient-magenta)" />
    <!-- Sparkle Stars -->
    ${drawSparkle(24, 38 + bounce * 0.5, 7, BRAND_PALETTE.warmAmber, t * 360)}
    ${drawSparkle(104, 42 - bounce * 0.5, 6, BRAND_PALETTE.cyberCyan, -t * 360)}
  `);
}

function renderSad(t) {
  const tearDropY = 68 + (t * 24);
  const tearOpacity = 1 - Math.abs(t - 0.5) * 1.5;
  return wrapSvg(`
    ${drawBaseHead(0)}
    <!-- Eyebrows: Sad Down-curved -->
    <path d="M 40 48 Q 48 52 56 50" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <path d="M 88 48 Q 80 52 72 50" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Eyes: Drooping watery eyes -->
    <ellipse cx="48" cy="60" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="48" cy="61" rx="5" ry="6" fill="${BRAND_PALETTE.skyBlue}" />
    <ellipse cx="80" cy="60" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="80" cy="61" rx="5" ry="6" fill="${BRAND_PALETTE.skyBlue}" />
    <!-- Mouth: Downturned Wavy Tremble -->
    <path d="M 56 74 Q 64 68 72 74" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Falling Tears -->
    <ellipse cx="46" cy="${tearDropY}" rx="3" ry="5" fill="${BRAND_PALETTE.cyberCyan}" opacity="${Math.max(0, tearOpacity)}" />
    <ellipse cx="82" cy="${tearDropY + 4}" rx="3" ry="5" fill="${BRAND_PALETTE.cyberCyan}" opacity="${Math.max(0, tearOpacity)}" />
    <!-- Rain aura tint -->
    <circle cx="64" cy="64" r="42" stroke="${BRAND_PALETTE.skyBlue}" stroke-width="1.5" fill="none" opacity="0.4" stroke-dasharray="4 6" />
  `);
}

function renderAngry(t) {
  const steamPulse = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    ${drawBaseHead(0, "glow-pink")}
    <!-- Flushed Angry Forehead Mark -->
    <path d="M 32 36 L 40 44 M 40 36 L 32 44" stroke="${BRAND_PALETTE.alertRed}" stroke-width="2.5" stroke-linecap="round" />
    <!-- Eyebrows: Sharp V-shape -->
    <path d="M 40 48 L 56 56" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3.5" stroke-linecap="round" />
    <path d="M 88 48 L 72 56" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3.5" stroke-linecap="round" />
    <!-- Eyes: Angry sharp pupils -->
    <ellipse cx="48" cy="62" rx="7" ry="6" fill="${BRAND_PALETTE.darkBg}" />
    <circle cx="48" cy="62" r="3" fill="${BRAND_PALETTE.cyberCyan}" />
    <ellipse cx="80" cy="62" rx="7" ry="6" fill="${BRAND_PALETTE.darkBg}" />
    <circle cx="80" cy="62" r="3" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- Mouth: Angry clenched frown -->
    <path d="M 52 76 Q 64 68 76 76" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <!-- Steam Puffs -->
    <ellipse cx="22" cy="${34 - steamPulse}" rx="${5 + steamPulse}" ry="${4 + steamPulse}" fill="${BRAND_PALETTE.white}" opacity="0.7" />
    <ellipse cx="106" cy="${34 - steamPulse}" rx="${5 + steamPulse}" ry="${4 + steamPulse}" fill="${BRAND_PALETTE.white}" opacity="0.7" />
  `);
}

function renderSurprised(t) {
  const pop = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    ${drawBaseHead(pop * 0.5)}
    <!-- High Eyebrows -->
    <path d="M 40 44 Q 48 40 56 44" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <path d="M 72 44 Q 80 40 88 44" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Wide Dilated Eyes with Stars -->
    <ellipse cx="48" cy="${58 + pop * 0.5}" rx="9" ry="11" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="48" cy="${58 + pop * 0.5}" rx="7" ry="9" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="46" cy="${55 + pop * 0.5}" r="3.5" fill="${BRAND_PALETTE.white}" />
    <ellipse cx="80" cy="${58 + pop * 0.5}" rx="9" ry="11" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="80" cy="${58 + pop * 0.5}" rx="7" ry="9" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="78" cy="${55 + pop * 0.5}" r="3.5" fill="${BRAND_PALETTE.white}" />
    <!-- Mouth: Open "O" -->
    <ellipse cx="64" cy="${74 + pop * 0.5}" rx="6" ry="8" fill="url(#gradient-magenta)" />
    <!-- Bouncing Exclamation Mark -->
    <g transform="translate(100, ${24 - pop})">
      <rect x="0" y="0" width="6" height="14" rx="3" fill="${BRAND_PALETTE.warmAmber}" filter="url(#glow-gold)" />
      <circle cx="3" cy="19" r="3" fill="${BRAND_PALETTE.warmAmber}" />
    </g>
  `);
}

function renderLove(t) {
  const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.08;
  const heartFloatY = 32 - ((t * 20) % 20);
  return wrapSvg(`
    ${drawBaseHead(0)}
    ${drawAnimeEyes(48, 80, 60, "love")}
    <!-- Sweet Open Smile -->
    <path d="M 54 70 Q 64 78 74 70" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Rising Floating Hearts -->
    <g transform="translate(64, 64) scale(${pulse}) translate(-64, -64)">
      <path d="M 24 ${heartFloatY} C 24 ${heartFloatY - 5} 18 ${heartFloatY - 5} 18 ${heartFloatY + 2} C 18 ${heartFloatY + 7} 24 ${heartFloatY + 11} 24 ${heartFloatY + 11} C 24 ${heartFloatY + 11} 30 ${heartFloatY + 7} 30 ${heartFloatY + 2} C 30 ${heartFloatY - 5} 24 ${heartFloatY - 5} 24 ${heartFloatY} Z" fill="${BRAND_PALETTE.deepMagenta}" opacity="0.8" filter="url(#glow-pink)" />
      <path d="M 104 ${heartFloatY + 4} C 104 ${heartFloatY - 1} 98 ${heartFloatY - 1} 98 ${heartFloatY + 6} C 98 ${heartFloatY + 11} 104 ${heartFloatY + 15} 104 ${heartFloatY + 15} C 104 ${heartFloatY + 15} 110 ${heartFloatY + 11} 110 ${heartFloatY + 6} C 110 ${heartFloatY - 1} 104 ${heartFloatY - 1} 104 ${heartFloatY + 4} Z" fill="${BRAND_PALETTE.softRose}" opacity="0.8" filter="url(#glow-pink)" />
    </g>
  `);
}

function renderThinking(t) {
  const dotCycle = Math.floor(t * 3);
  return wrapSvg(`
    ${drawBaseHead(0)}
    <!-- Eyes Looking Up-Right -->
    <ellipse cx="48" cy="58" rx="8" ry="10" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="51" cy="56" rx="5" ry="7" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="53" cy="54" r="2.5" fill="${BRAND_PALETTE.white}" />
    <ellipse cx="80" cy="58" rx="8" ry="10" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="83" cy="56" rx="5" ry="7" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="85" cy="54" r="2.5" fill="${BRAND_PALETTE.white}" />
    <!-- Finger on Chin Hand Gesture -->
    <ellipse cx="64" cy="78" rx="7" ry="5" fill="${BRAND_PALETTE.softRose}" />
    <path d="M 58 72 Q 64 74 70 71" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2" fill="none" />
    <!-- Thought Bubble -->
    <path d="M 88 34 Q 92 24 102 26 Q 112 24 114 34 Q 118 42 108 46 Q 98 48 90 42 Z" fill="${BRAND_PALETTE.white}" opacity="0.9" filter="url(#glow-cyan)" />
    <circle cx="84" cy="48" r="2.5" fill="${BRAND_PALETTE.white}" opacity="0.8" />
    <!-- Animated Thought Dots -->
    <circle cx="96" cy="34" r="2" fill="${BRAND_PALETTE.cyberCyan}" opacity="${dotCycle === 0 ? 1 : 0.3}" />
    <circle cx="102" cy="34" r="2" fill="${BRAND_PALETTE.cyberCyan}" opacity="${dotCycle === 1 ? 1 : 0.3}" />
    <circle cx="108" cy="34" r="2" fill="${BRAND_PALETTE.cyberCyan}" opacity="${dotCycle === 2 ? 1 : 0.3}" />
  `);
}

function renderWink(t) {
  const winkSparkleRot = t * 360;
  return wrapSvg(`
    ${drawBaseHead(0)}
    ${drawAnimeEyes(48, 80, 60, "wink")}
    <!-- Playful Tongue -->
    <path d="M 58 71 Q 64 71 70 71 Q 68 79 62 78 Z" fill="${BRAND_PALETTE.deepMagenta}" />
    <!-- Golden Star Sparkle on Wink Eye -->
    ${drawSparkle(46, 52, 8, BRAND_PALETTE.warmAmber, winkSparkleRot)}
  `);
}

function renderCry(t) {
  // Quivering mouth (bibir gemetar): 3 oscillation cycles per loop, zero at t=0
  const mouthTremble = Math.sin(t * Math.PI * 6) * 1.5;

  // Stream wave ripple: gentle undulation of cascading tear streams
  const waveX = Math.sin(t * Math.PI * 2) * 1.8;

  // Flowing tears (air mata mengalir): continuous downward travel along vertical stream
  const flowProgress1 = (t + 0.0) % 1.0;
  const flowProgress2 = (t + 0.5) % 1.0;
  const drop1Y = 62 + flowProgress1 * 44;
  const drop2Y = 62 + flowProgress2 * 44;

  // Opacity bell curves: smooth fade-in at top and fade-out at bottom for seamless looping
  const drop1Op = Math.sin(flowProgress1 * Math.PI) * 0.95;
  const drop2Op = Math.sin(flowProgress2 * Math.PI) * 0.95;

  // Detached dripping splash below chin
  const dripProgress = (t + 0.25) % 1.0;
  const dripY = 104 + dripProgress * 12;
  const dripOp = Math.sin(dripProgress * Math.PI) * 0.7;

  return wrapSvg(`
    ${drawBaseHead(0)}
    <!-- Eyes Squeezed Arcs -->
    <path d="M 40 58 Q 48 64 56 58" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M 72 58 Q 80 64 88 58" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    
    <!-- Torrential Streams of Tears with dynamic undulation -->
    <path d="M 42 62 C ${40 + waveX} 74 ${38 - waveX} 88 42 104" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.8" filter="url(#glow-cyan)" />
    <path d="M 86 62 C ${88 - waveX} 74 ${90 + waveX} 88 86 104" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.8" filter="url(#glow-cyan)" />
    
    <!-- Inner Flow Highlights (Glistening tear stream core) -->
    <path d="M 42 64 C ${40 + waveX * 0.5} 74 ${38 - waveX * 0.5} 88 42 102" stroke="${BRAND_PALETTE.white}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6" />
    <path d="M 86 64 C ${88 - waveX * 0.5} 74 ${90 + waveX * 0.5} 88 86 102" stroke="${BRAND_PALETTE.white}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6" />

    <!-- Flowing Tear Droplets (Air mata mengalir) -->
    <circle cx="${41 + waveX * 0.4}" cy="${drop1Y}" r="2.2" fill="${BRAND_PALETTE.white}" opacity="${Math.max(0, drop1Op).toFixed(2)}" />
    <circle cx="${87 - waveX * 0.4}" cy="${drop1Y}" r="2.2" fill="${BRAND_PALETTE.white}" opacity="${Math.max(0, drop1Op).toFixed(2)}" />
    <circle cx="${41 - waveX * 0.4}" cy="${drop2Y}" r="1.8" fill="${BRAND_PALETTE.cyberCyan}" opacity="${Math.max(0, drop2Op).toFixed(2)}" />
    <circle cx="${87 + waveX * 0.4}" cy="${drop2Y}" r="1.8" fill="${BRAND_PALETTE.cyberCyan}" opacity="${Math.max(0, drop2Op).toFixed(2)}" />

    <!-- Falling Detached Droplets below chin -->
    <circle cx="42" cy="${dripY}" r="1.5" fill="${BRAND_PALETTE.cyberCyan}" opacity="${Math.max(0, dripOp).toFixed(2)}" />
    <circle cx="86" cy="${dripY}" r="1.5" fill="${BRAND_PALETTE.cyberCyan}" opacity="${Math.max(0, dripOp).toFixed(2)}" />

    <!-- Quivering Mouth (Bibir gemetar) -->
    <path d="M 56 ${74 + mouthTremble * 0.4} Q 60 ${71 - mouthTremble} 64 ${74 + mouthTremble * 0.4} Q 68 ${77 + mouthTremble} 72 ${74 + mouthTremble * 0.4}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
  `);
}

function renderLaugh(t) {
  const laughVibe = Math.sin(t * Math.PI * 4) * 2;
  return wrapSvg(`
    ${drawBaseHead(laughVibe)}
    <!-- Closed Crescent Eyes (> <) -->
    <path d="M 40 56 L 48 62 L 40 68" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M 88 56 L 80 62 L 88 68" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <!-- Wide Open Laughing Mouth -->
    <path d="M 52 ${70 + laughVibe} Q 64 ${84 + laughVibe} 76 ${70 + laughVibe} Z" fill="url(#gradient-magenta)" />
    <!-- Teardrops of Joy -->
    <circle cx="32" cy="${60 + laughVibe}" r="3.5" fill="${BRAND_PALETTE.cyberCyan}" />
    <circle cx="96" cy="${60 + laughVibe}" r="3.5" fill="${BRAND_PALETTE.cyberCyan}" />
  `);
}

function renderShy(t) {
  const tapOffset = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    ${drawBaseHead(0)}
    <!-- Downward Bashful Eyes -->
    <ellipse cx="48" cy="62" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="48" cy="64" rx="5" ry="5" fill="${BRAND_PALETTE.cyberCyan}" />
    <ellipse cx="80" cy="62" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <ellipse cx="80" cy="64" rx="5" ry="5" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- Intense Nose-Bridge Blush -->
    <rect x="42" y="66" width="44" height="6" rx="3" fill="url(#gradient-blush)" />
    <!-- Shy Smile -->
    <path d="M 58 74 Q 64 77 70 74" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2" stroke-linecap="round" fill="none" />
    <!-- Tapping Fingertips (👉👈) -->
    <rect x="${50 - tapOffset}" y="88" width="12" height="6" rx="3" fill="${BRAND_PALETTE.softRose}" />
    <rect x="${66 + tapOffset}" y="88" width="12" height="6" rx="3" fill="${BRAND_PALETTE.softRose}" />
  `);
}

function renderExcited(t) {
  const squash = 1 + Math.sin(t * Math.PI * 4) * 0.05;
  return wrapSvg(`
    <g transform="translate(64, 64) scale(${1 / squash}, ${squash}) translate(-64, -64)">
      ${drawBaseHead(0)}
      ${drawAnimeEyes(48, 80, 58, "stars")}
      <!-- Ecstatic Grin -->
      <path d="M 52 69 Q 64 83 76 69 Z" fill="url(#gradient-magenta)" />
      <!-- Confetti Arcs -->
      <circle cx="26" cy="36" r="3" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
      <circle cx="102" cy="38" r="3" fill="${BRAND_PALETTE.warmAmber}" filter="url(#glow-gold)" />
      <circle cx="34" cy="88" r="2.5" fill="${BRAND_PALETTE.natureGreen}" />
      <circle cx="94" cy="86" r="2.5" fill="${BRAND_PALETTE.dreamPurple}" />
    </g>
  `);
}

function renderSleepy(t) {
  const zFloat = ((t * 24) % 24);
  return wrapSvg(`
    ${drawBaseHead(0)}
    <!-- Half-closed Sleepy Eyes -->
    <path d="M 40 60 Q 48 64 56 60" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <path d="M 72 60 Q 80 64 88 60" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Cute Sleepy "o" mouth -->
    <ellipse cx="64" cy="73" rx="3" ry="4" fill="${BRAND_PALETTE.deepMagenta}" opacity="0.7" />
    <!-- Floating Neon Zzz -->
    <text x="88" y="${46 - zFloat * 0.8}" font-family="sans-serif" font-weight="bold" font-size="14" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)">Z</text>
    <text x="100" y="${32 - zFloat * 0.8}" font-family="sans-serif" font-weight="bold" font-size="11" fill="${BRAND_PALETTE.dreamPurple}">z</text>
  `);
}

function renderConfused(t) {
  const rot = t * 360;
  return wrapSvg(`
    <g transform="rotate(${Math.sin(t * Math.PI * 2) * 8} 64 64)">
      ${drawBaseHead(0)}
      <!-- Spiral Hypnotic Eyes -->
      <circle cx="48" cy="60" r="8" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" stroke-dasharray="3 3" transform="rotate(${rot} 48 60)" />
      <circle cx="80" cy="60" r="8" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" stroke-dasharray="3 3" transform="rotate(${-rot} 80 60)" />
      <!-- Wavy Mouth -->
      <path d="M 54 74 Q 59 70 64 74 Q 69 78 74 74" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    </g>
    <!-- Floating Neon Amber Question Mark -->
    <text x="96" y="${36 + Math.sin(t * Math.PI * 2) * 3}" font-family="sans-serif" font-weight="bold" font-size="22" fill="${BRAND_PALETTE.warmAmber}" filter="url(#glow-gold)">?</text>
  `);
}

function renderProud(t) {
  const auraPulse = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    <!-- Radiating Golden Aura -->
    <circle cx="64" cy="64" r="${46 + auraPulse}" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="2" fill="none" opacity="0.6" filter="url(#glow-gold)" />
    ${drawBaseHead(0)}
    <!-- Smug Tilted Eyelids -->
    <path d="M 40 58 Q 48 52 56 60" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M 72 60 Q 80 52 88 58" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3" stroke-linecap="round" fill="none" />
    <!-- Smug Smirk -->
    <path d="M 56 73 Q 66 76 74 68" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Tooth / Cheek Sparkle -->
    ${drawSparkle(76, 68, 5, BRAND_PALETTE.white, t * 180)}
  `);
}

function renderScared(t) {
  const tremble = Math.sin(t * Math.PI * 8) * 2;
  return wrapSvg(`
    <g transform="translate(${tremble}, 0)">
      ${drawBaseHead(0)}
      <!-- Pale Blue Forehead Wash Gradient -->
      <path d="M 36 42 Q 64 36 92 42 L 92 56 Q 64 52 36 56 Z" fill="${BRAND_PALETTE.skyBlue}" opacity="0.4" />
      <!-- Pinpoint Shrunken Pupils -->
      <circle cx="48" cy="60" r="3" fill="${BRAND_PALETTE.darkBg}" />
      <circle cx="80" cy="60" r="3" fill="${BRAND_PALETTE.darkBg}" />
      <!-- Trembling Wavy Mouth -->
      <path d="M 52 74 Q 58 70 64 74 Q 70 78 76 74" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    </g>
    <!-- Big Animated Sweat Drop -->
    <path d="M 98 42 C 98 38 106 48 106 52 C 106 56 102 58 98 58 C 94 58 90 56 90 52 C 90 48 98 38 98 42 Z" fill="${BRAND_PALETTE.cyberCyan}" opacity="0.9" filter="url(#glow-cyan)" />
  `);
}

function renderDetermined(t) {
  const flameWave = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Stylized Cyan Flame Aura Rising -->
    <path d="M 30 ${76 + flameWave} Q 20 40 40 28 Q 64 16 88 28 Q 108 40 98 ${76 + flameWave} Z" fill="url(#gradient-cyber)" opacity="0.3" filter="url(#glow-cyan)" />
    ${drawBaseHead(0)}
    <!-- Resolute Angled Brows -->
    <path d="M 40 50 L 56 54" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3.5" stroke-linecap="round" />
    <path d="M 88 50 L 72 54" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="3.5" stroke-linecap="round" />
    <!-- Burning Cyan Pupils -->
    <ellipse cx="48" cy="60" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <circle cx="48" cy="60" r="4.5" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <ellipse cx="80" cy="60" rx="7" ry="8" fill="${BRAND_PALETTE.darkBg}" />
    <circle cx="80" cy="60" r="4.5" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <!-- Clenched Resolute Mouth -->
    <rect x="54" y="72" width="20" height="4" rx="2" fill="${BRAND_PALETTE.white}" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="1.5" />
  `);
}

function renderRelaxed(t) {
  const petalY = (t * 24);
  return wrapSvg(`
    <!-- Nature Green Aura -->
    <circle cx="64" cy="64" r="44" stroke="${BRAND_PALETTE.natureGreen}" stroke-width="1.5" fill="none" opacity="0.5" filter="url(#glow-green)" />
    ${drawBaseHead(0)}
    <!-- Peaceful Closed Curved Eyes -->
    <path d="M 40 58 Q 48 64 56 58" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <path d="M 72 58 Q 80 64 88 58" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <!-- Serene Gentle Smile -->
    <path d="M 58 71 Q 64 76 70 71" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2" stroke-linecap="round" fill="none" />
    <!-- Drifting Sakura Petals -->
    <ellipse cx="26" cy="${40 + petalY}" rx="4" ry="7" fill="${BRAND_PALETTE.nauraPink}" transform="rotate(30 26 ${40 + petalY})" opacity="0.8" />
    <ellipse cx="102" cy="${30 + petalY}" rx="4" ry="7" fill="${BRAND_PALETTE.softRose}" transform="rotate(-40 102 ${30 + petalY})" opacity="0.8" />
  `);
}

function renderEmbarrassed(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 0.1;
  return wrapSvg(`
    ${drawBaseHead(0, "glow-pink")}
    <!-- Intense Hot Magenta Face Glow -->
    <circle cx="64" cy="64" r="36" fill="${BRAND_PALETTE.deepMagenta}" opacity="${0.35 + pulse}" />
    <!-- Peeking Eyes Behind Hands -->
    <ellipse cx="48" cy="58" rx="5" ry="6" fill="${BRAND_PALETTE.cyberCyan}" />
    <ellipse cx="80" cy="58" rx="5" ry="6" fill="${BRAND_PALETTE.cyberCyan}" />
    <!-- Hands Covering Face (Peeking Fingers) -->
    <rect x="36" y="62" width="22" height="18" rx="6" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.nauraPink}" stroke-width="1.5" />
    <rect x="70" y="62" width="22" height="18" rx="6" fill="${BRAND_PALETTE.softRose}" stroke="${BRAND_PALETTE.nauraPink}" stroke-width="1.5" />
  `);
}

function renderCurious(t) {
  const lensGlintX = 86 + Math.sin(t * Math.PI * 2) * 8;
  return wrapSvg(`
    <g transform="rotate(8 64 64)">
      ${drawBaseHead(0)}
      <!-- One Raised Eyebrow -->
      <path d="M 40 44 Q 48 38 56 42" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <path d="M 72 48 Q 80 50 88 48" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <!-- Questioning Smile -->
      <path d="M 58 72 Q 64 71 70 74" stroke="${BRAND_PALETTE.deepMagenta}" stroke-width="2" stroke-linecap="round" fill="none" />
    </g>
    <!-- Futuristic Glassmorphic Magnifying Glass -->
    <circle cx="88" cy="64" r="18" fill="url(#gradient-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="3" filter="url(#glow-cyan)" />
    <!-- Cyan Crosshair -->
    <path d="M 88 52 L 88 76 M 76 64 L 100 64" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1" opacity="0.7" />
    <line x1="102" y1="78" x2="116" y2="92" stroke="${BRAND_PALETTE.darkMetal}" stroke-width="5" stroke-linecap="round" />
    <!-- Lens Reflection Flare -->
    <ellipse cx="${lensGlintX}" cy="58" rx="6" ry="2" fill="${BRAND_PALETTE.white}" opacity="0.6" transform="rotate(-30 ${lensGlintX} 58)" />
  `);
}

function renderCelebrate(t) {
  const bounce = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    <g transform="translate(0, ${bounce})">
      ${drawBaseHead(0)}
      ${drawAnimeEyes(48, 80, 58, "happy")}
      <!-- Party Horn in Mouth -->
      <path d="M 64 72 L 40 76 L 36 82 L 64 74 Z" fill="${BRAND_PALETTE.warmAmber}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" />
      <!-- Festive Party Hat -->
      <polygon points="64,18 46,38 82,38" fill="url(#gradient-magenta)" filter="url(#glow-pink)" />
      <circle cx="64" cy="18" r="4" fill="${BRAND_PALETTE.warmAmber}" />
      <path d="M 48 34 L 80 34" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
    </g>
    <!-- Confetti Burst -->
    ${drawSparkle(22, 28, 6, BRAND_PALETTE.warmAmber, t * 180)}
    ${drawSparkle(106, 26, 7, BRAND_PALETTE.cyberCyan, -t * 180)}
    ${drawSparkle(18, 70, 5, BRAND_PALETTE.natureGreen, t * 90)}
    ${drawSparkle(110, 68, 5, BRAND_PALETTE.dreamPurple, -t * 90)}
  `);
}

const STATUS_GENERATORS = {
  naura_happy: renderHappy,
  naura_sad: renderSad,
  naura_angry: renderAngry,
  naura_surprised: renderSurprised,
  naura_love: renderLove,
  naura_thinking: renderThinking,
  naura_wink: renderWink,
  naura_cry: renderCry,
  naura_laugh: renderLaugh,
  naura_shy: renderShy,
  naura_excited: renderExcited,
  naura_sleepy: renderSleepy,
  naura_confused: renderConfused,
  naura_proud: renderProud,
  naura_scared: renderScared,
  naura_determined: renderDetermined,
  naura_relaxed: renderRelaxed,
  naura_embarrassed: renderEmbarrassed,
  naura_curious: renderCurious,
  naura_celebrate: renderCelebrate,
};

module.exports = {
  STATUS_GENERATORS,
};
