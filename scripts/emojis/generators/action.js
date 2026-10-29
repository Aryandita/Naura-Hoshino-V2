// Lokasi: scripts/emojis/generators/action.js
// Generator SVG untuk Kategori 2: Actions & Commands (15 Emojis)
"use strict";

const { wrapSvg, drawSparkle, BRAND_PALETTE } = require("./common");

function renderPlay(t) {
  const scale = 1 + Math.sin(t * Math.PI * 2) * 0.05;
  return wrapSvg(`
    <!-- Outer Cyber Ring -->
    <circle cx="64" cy="64" r="48" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.dreamPurple}" stroke-width="3" filter="url(#glow-purple)" />
    <!-- Glowing Play Triangle -->
    <g transform="translate(64, 64) scale(${scale}) translate(-64, -64)">
      <polygon points="52,42 86,64 52,86" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
      <!-- Specular Highlight -->
      <polygon points="54,46 76,60 54,64" fill="${BRAND_PALETTE.white}" opacity="0.6" />
    </g>
  `);
}

function renderPause(t) {
  const opacity = 0.8 + Math.sin(t * Math.PI * 2) * 0.2;
  return wrapSvg(`
    <!-- Outer Glass Ring -->
    <circle cx="64" cy="64" r="48" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="3" filter="url(#glow-cyan)" />
    <!-- Twin Pause Bars -->
    <rect x="46" y="42" width="12" height="44" rx="6" fill="${BRAND_PALETTE.softRose}" opacity="${opacity}" filter="url(#glow-pink)" />
    <rect x="70" y="42" width="12" height="44" rx="6" fill="${BRAND_PALETTE.cyberCyan}" opacity="${opacity}" filter="url(#glow-cyan)" />
  `);
}

function renderSkip(t) {
  const shift = (t * 8) % 8;
  return wrapSvg(`
    <!-- Glass Disc Container -->
    <circle cx="64" cy="64" r="48" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.dreamPurple}" stroke-width="2.5" />
    <g transform="translate(${shift}, 0)">
      <!-- First Chevron -->
      <polygon points="40,44 58,64 40,84" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
      <!-- Second Chevron -->
      <polygon points="60,44 78,64 60,84" fill="${BRAND_PALETTE.deepMagenta}" filter="url(#glow-pink)" />
      <!-- Bar -->
      <rect x="84" y="44" width="6" height="40" rx="3" fill="${BRAND_PALETTE.cyberCyan}" />
    </g>
  `);
}

function renderStop(t) {
  const scale = 1 - Math.sin(t * Math.PI * 2) * 0.04;
  return wrapSvg(`
    <!-- Glass Disc Container -->
    <circle cx="64" cy="64" r="48" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.alertRed}" stroke-width="3" filter="url(#glow-pink)" />
    <!-- Stop Square -->
    <g transform="translate(64, 64) scale(${scale}) translate(-64, -64)">
      <rect x="44" y="44" width="40" height="40" rx="8" fill="url(#gradient-alert)" filter="url(#glow-pink)" />
      <rect x="48" y="48" width="32" height="14" rx="4" fill="${BRAND_PALETTE.white}" opacity="0.3" />
    </g>
  `);
}

function renderVolumeUp(t) {
  const stage = Math.floor(t * 3);
  return wrapSvg(`
    <!-- Speaker Body -->
    <polygon points="26,52 38,52 54,38 54,90 38,76 26,76" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <rect x="22" y="52" width="6" height="24" rx="3" fill="${BRAND_PALETTE.softRose}" />
    <!-- Sound Waves Expanding (Stage based rendering) -->
    ${stage >= 0 ? `<path d="M 66 50 Q 74 64 66 78" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="4" stroke-linecap="round" fill="none" />` : ""}
    ${stage >= 1 ? `<path d="M 78 42 Q 90 64 78 86" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="4" stroke-linecap="round" fill="none" />` : ""}
    ${stage >= 2 ? `<path d="M 90 34 Q 106 64 90 94" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="4" stroke-linecap="round" fill="none" />` : ""}
  `);
}

function renderVolumeDown(t) {
  const wavePulse = 0.5 + Math.sin(t * Math.PI * 2) * 0.4;
  return wrapSvg(`
    <!-- Speaker Body -->
    <polygon points="28,52 40,52 56,38 56,90 40,76 28,76" fill="${BRAND_PALETTE.skyBlue}" />
    <rect x="24" y="52" width="6" height="24" rx="3" fill="${BRAND_PALETTE.neutralGray}" />
    <!-- Single Sound Wave Arc -->
    <path d="M 70 52 Q 78 64 70 76" stroke="${BRAND_PALETTE.skyBlue}" stroke-width="4" stroke-linecap="round" fill="none" opacity="${wavePulse}" />
    <!-- Minus / Down Symbol -->
    <rect x="88" y="62" width="14" height="4" rx="2" fill="${BRAND_PALETTE.cyberCyan}" />
  `);
}

function renderQueue(t) {
  const slide = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Stack of 3 Pill Lines -->
    <rect x="28" y="${36 + slide}" width="54" height="10" rx="5" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <rect x="28" y="58" width="46" height="10" rx="5" fill="${BRAND_PALETTE.dreamPurple}" filter="url(#glow-purple)" />
    <rect x="28" y="${80 - slide}" width="54" height="10" rx="5" fill="${BRAND_PALETTE.nauraPink}" filter="url(#glow-pink)" />
    <!-- Music Note Corner Badge -->
    <circle cx="94" cy="62" r="16" fill="url(#gradient-dark-glass)" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="2" />
    <path d="M 90 68 L 90 54 L 100 50 L 100 64" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <circle cx="87" cy="68" r="4" fill="${BRAND_PALETTE.warmAmber}" />
  `);
}

function renderShuffle(t) {
  const glow = Math.sin(t * Math.PI * 2) * 0.3 + 0.7;
  return wrapSvg(`
    <!-- Curved Crossing Arrows -->
    <path d="M 28 42 C 54 42 74 86 100 86" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="6" stroke-linecap="round" fill="none" opacity="${glow}" filter="url(#glow-cyan)" />
    <polygon points="98,78 108,86 98,94" fill="${BRAND_PALETTE.cyberCyan}" />
    <path d="M 28 86 C 54 86 74 42 100 42" stroke="${BRAND_PALETTE.dreamPurple}" stroke-width="6" stroke-linecap="round" fill="none" opacity="${glow}" filter="url(#glow-purple)" />
    <polygon points="98,34 108,42 98,50" fill="${BRAND_PALETTE.dreamPurple}" />
    <!-- Intersection Glint Spark -->
    ${drawSparkle(64, 64, 6, BRAND_PALETTE.white, t * 180)}
  `);
}

function renderRepeat(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- Circular Arrows Ring -->
    <g transform="rotate(${rot} 64 64)">
      <path d="M 64 26 A 38 38 0 0 1 102 64 A 38 38 0 0 1 82 96" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="6" stroke-linecap="round" fill="none" filter="url(#glow-cyan)" />
      <polygon points="76,90 84,102 92,92" fill="${BRAND_PALETTE.cyberCyan}" />
      <path d="M 64 102 A 38 38 0 0 1 26 64 A 38 38 0 0 1 46 32" stroke="${BRAND_PALETTE.softRose}" stroke-width="6" stroke-linecap="round" fill="none" filter="url(#glow-pink)" />
      <polygon points="52,38 44,26 36,36" fill="${BRAND_PALETTE.softRose}" />
    </g>
    <!-- Center Loop Badge -->
    <circle cx="64" cy="64" r="14" fill="${BRAND_PALETTE.darkBg}" stroke="${BRAND_PALETTE.dreamPurple}" stroke-width="2" />
    <text x="64" y="69" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="14" fill="${BRAND_PALETTE.cyberCyan}">∞</text>
  `);
}

function renderLyrics(t) {
  const noteBounce = Math.sin(t * Math.PI * 2) * 3;
  return wrapSvg(`
    <!-- Lyric Lines Background -->
    <rect x="28" y="44" width="46" height="5" rx="2.5" fill="${BRAND_PALETTE.neutralGray}" opacity="0.6" />
    <rect x="28" y="60" width="54" height="5" rx="2.5" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.8" />
    <rect x="28" y="76" width="38" height="5" rx="2.5" fill="${BRAND_PALETTE.neutralGray}" opacity="0.6" />
    <!-- 3D Glass Eighth Note -->
    <g transform="translate(0, ${noteBounce})">
      <path d="M 78 72 L 78 38 L 98 32 L 98 44 L 78 50" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
      <ellipse cx="72" cy="74" rx="8" ry="6" fill="${BRAND_PALETTE.cyberCyan}" transform="rotate(-20 72 74)" />
      <ellipse cx="94" cy="66" rx="8" ry="6" fill="${BRAND_PALETTE.cyberCyan}" transform="rotate(-20 94 66)" />
    </g>
    <!-- Sparkle on Note -->
    ${drawSparkle(98, 32 + noteBounce, 6, BRAND_PALETTE.warmAmber, t * 180)}
  `);
}

function renderRadio(t) {
  const beaconPulse = Math.sin(t * Math.PI * 2) * 0.4 + 0.6;
  return wrapSvg(`
    <!-- Transmission Tower Legs & Mast -->
    <polygon points="64,28 42,100 86,100" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="3" fill="none" />
    <line x1="50" y1="74" x2="78" y2="74" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" />
    <line x1="56" y1="52" x2="72" y2="52" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" />
    <!-- Blinking Red/Pink Beacon -->
    <circle cx="64" cy="24" r="6" fill="${BRAND_PALETTE.deepMagenta}" opacity="${beaconPulse}" filter="url(#glow-pink)" />
    <!-- Spherical Radiating Radio Waves -->
    <path d="M 46 22 A 22 22 0 0 1 82 22" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" fill="none" stroke-dasharray="4 4" opacity="0.8" />
    <path d="M 36 16 A 34 34 0 0 1 92 16" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2.5" fill="none" stroke-dasharray="4 4" opacity="0.6" />
  `);
}

function renderMic(t) {
  const pulse = Math.sin(t * Math.PI * 2) * 2;
  return wrapSvg(`
    <!-- Acoustic Sound Ripple Circles -->
    <circle cx="64" cy="48" r="${28 + pulse}" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="1.5" fill="none" opacity="0.5" stroke-dasharray="3 3" />
    <!-- Studio Condenser Capsule -->
    <rect x="52" y="26" width="24" height="42" rx="12" fill="url(#gradient-platinum)" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" />
    <rect x="56" y="32" width="16" height="20" rx="4" fill="${BRAND_PALETTE.darkBg}" opacity="0.4" />
    <!-- Cyan Ring Collar -->
    <rect x="50" y="66" width="28" height="6" rx="2" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <!-- Stand Neck & Base -->
    <line x1="64" y1="72" x2="64" y2="98" stroke="${BRAND_PALETTE.neutralGray}" stroke-width="5" />
    <ellipse cx="64" cy="98" rx="20" ry="6" fill="${BRAND_PALETTE.darkMetal}" />
  `);
}

function renderHeadphones(t) {
  const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.04;
  return wrapSvg(`
    <!-- Headband Arch -->
    <path d="M 32 68 A 38 38 0 0 1 96 68" stroke="${BRAND_PALETTE.darkMetal}" stroke-width="7" fill="none" stroke-linecap="round" />
    <path d="M 36 64 A 34 34 0 0 1 92 64" stroke="${BRAND_PALETTE.cyberCyan}" stroke-width="2" fill="none" />
    <!-- Earcups with Pink Cushioned Pads -->
    <g transform="translate(64, 64) scale(${pulse}) translate(-64, -64)">
      <!-- Left Earcup -->
      <rect x="22" y="60" width="14" height="32" rx="7" fill="${BRAND_PALETTE.nauraPink}" filter="url(#glow-pink)" />
      <rect x="32" y="66" width="6" height="20" rx="3" fill="${BRAND_PALETTE.darkBg}" />
      <circle cx="29" cy="76" r="4" fill="${BRAND_PALETTE.cyberCyan}" />
      <!-- Right Earcup -->
      <rect x="92" y="60" width="14" height="32" rx="7" fill="${BRAND_PALETTE.nauraPink}" filter="url(#glow-pink)" />
      <rect x="90" y="66" width="6" height="20" rx="3" fill="${BRAND_PALETTE.darkBg}" />
      <circle cx="99" cy="76" r="4" fill="${BRAND_PALETTE.cyberCyan}" />
    </g>
    <!-- Floating Music Note -->
    <circle cx="106" cy="44" r="3.5" fill="${BRAND_PALETTE.warmAmber}" />
    <path d="M 106 44 L 106 32 L 114 30 L 114 42" stroke="${BRAND_PALETTE.warmAmber}" stroke-width="2" fill="none" />
  `);
}

function renderEqualizer(t) {
  const h1 = 30 + Math.sin(t * Math.PI * 2) * 14;
  const h2 = 44 + Math.sin(t * Math.PI * 2 + 1.2) * 18;
  const h3 = 54 + Math.sin(t * Math.PI * 2 + 2.4) * 16;
  const h4 = 38 + Math.sin(t * Math.PI * 2 + 3.6) * 18;
  const h5 = 26 + Math.sin(t * Math.PI * 2 + 4.8) * 12;
  return wrapSvg(`
    <!-- 5 Equalizer Bars -->
    <rect x="26" y="${94 - h1}" width="10" height="${h1}" rx="5" fill="${BRAND_PALETTE.cyberCyan}" filter="url(#glow-cyan)" />
    <rect x="42" y="${94 - h2}" width="10" height="${h2}" rx="5" fill="${BRAND_PALETTE.skyBlue}" />
    <rect x="58" y="${94 - h3}" width="10" height="${h3}" rx="5" fill="${BRAND_PALETTE.dreamPurple}" filter="url(#glow-purple)" />
    <rect x="74" y="${94 - h4}" width="10" height="${h4}" rx="5" fill="${BRAND_PALETTE.deepMagenta}" filter="url(#glow-pink)" />
    <rect x="90" y="${94 - h5}" width="10" height="${h5}" rx="5" fill="${BRAND_PALETTE.nauraPink}" />
    <!-- Floating Peak Caps -->
    <rect x="26" y="${88 - h1}" width="10" height="3" rx="1.5" fill="${BRAND_PALETTE.white}" />
    <rect x="42" y="${88 - h2}" width="10" height="3" rx="1.5" fill="${BRAND_PALETTE.white}" />
    <rect x="58" y="${88 - h3}" width="10" height="3" rx="1.5" fill="${BRAND_PALETTE.white}" />
    <rect x="74" y="${88 - h4}" width="10" height="3" rx="1.5" fill="${BRAND_PALETTE.white}" />
    <rect x="90" y="${88 - h5}" width="10" height="3" rx="1.5" fill="${BRAND_PALETTE.white}" />
  `);
}

function renderDisc(t) {
  const rot = t * 360;
  return wrapSvg(`
    <!-- Vinyl Disc Outer Body -->
    <circle cx="64" cy="64" r="48" fill="${BRAND_PALETTE.darkBg}" stroke="${BRAND_PALETTE.darkMetal}" stroke-width="2" />
    <!-- Microgroove Rings -->
    <circle cx="64" cy="64" r="42" stroke="${BRAND_PALETTE.darkSlate}" stroke-width="1" fill="none" opacity="0.6" />
    <circle cx="64" cy="64" r="34" stroke="${BRAND_PALETTE.darkSlate}" stroke-width="1" fill="none" opacity="0.6" />
    <circle cx="64" cy="64" r="26" stroke="${BRAND_PALETTE.darkSlate}" stroke-width="1" fill="none" opacity="0.6" />
    <!-- Iridescent Light Streak rotating -->
    <g transform="rotate(${rot} 64 64)">
      <polygon points="64,64 34,22 46,18" fill="${BRAND_PALETTE.cyberCyan}" opacity="0.25" />
      <polygon points="64,64 94,106 82,110" fill="${BRAND_PALETTE.dreamPurple}" opacity="0.25" />
    </g>
    <!-- Center Label with Naura Star -->
    <circle cx="64" cy="64" r="16" fill="url(#gradient-magenta)" />
    ${drawSparkle(64, 64, 7, BRAND_PALETTE.cyberCyan, rot)}
    <circle cx="64" cy="64" r="3" fill="${BRAND_PALETTE.white}" />
  `);
}

const ACTION_GENERATORS = {
  naura_play: renderPlay,
  naura_pause: renderPause,
  naura_skip: renderSkip,
  naura_stop: renderStop,
  naura_volume_up: renderVolumeUp,
  naura_volume_down: renderVolumeDown,
  naura_queue: renderQueue,
  naura_shuffle: renderShuffle,
  naura_repeat: renderRepeat,
  naura_lyrics: renderLyrics,
  naura_radio: renderRadio,
  naura_mic: renderMic,
  naura_headphones: renderHeadphones,
  naura_equalizer: renderEqualizer,
  naura_disc: renderDisc,
};

module.exports = {
  ACTION_GENERATORS,
};
