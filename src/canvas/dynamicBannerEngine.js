"use strict";

/**
 * dynamicBannerEngine.js - Generator Banner Gerak Dinamis & Kartu Kelulusan AI.
 *
 * Mengelola:
 *   1. Rendering Dynamic Motion Banner untuk Profil & Season Pass Graduation.
 *   2. Tema Visual Cyberpunk, Celestial, Abyss, dan Hoshino Aura.
 *   3. Tata letak partikel neon, garis grid holografis, badge kelulusan, dan status RPG.
 *   4. Render non-blocking kompatibel dengan Dedicated Canvas Worker Pool.
 */

const { createCanvas, loadImage } = require("./canvasRuntime");

const THEMES = {
  cyberpunk: {
    bgGrad: ["#090A15", "#160D27", "#050811"],
    accent: "#00F0FF",
    secondary: "#FF007F",
    text: "#FFFFFF",
    badgeBg: "rgba(255, 0, 127, 0.25)",
  },
  celestial: {
    bgGrad: ["#0A0E2A", "#1B1745", "#0F1A30"],
    accent: "#A78BFA",
    secondary: "#FCD34D",
    text: "#FFFFFF",
    badgeBg: "rgba(167, 139, 250, 0.25)",
  },
  abyss: {
    bgGrad: ["#050814", "#0C1B2B", "#061320"],
    accent: "#38BDF8",
    secondary: "#34D399",
    text: "#F1F5F9",
    badgeBg: "rgba(56, 189, 248, 0.25)",
  },
  hoshino_aura: {
    bgGrad: ["#14081E", "#2A0E38", "#12051D"],
    accent: "#EC4899",
    secondary: "#8B5CF6",
    text: "#FFFFFF",
    badgeBg: "rgba(236, 72, 153, 0.25)",
  },
};

/**
 * Menghasilkan buffer gambar dynamic motion banner.
 * @param {object} payload
 * @param {string} [payload.username="Adventurer"]
 * @param {string} [payload.avatarUrl]
 * @param {string} [payload.theme="cyberpunk"]
 * @param {number} [payload.seasonTier=30]
 * @param {string} [payload.title="Season Pass Graduate"]
 * @param {string} [payload.quote="Echoes of stellar journeys resonate forever."]
 * @param {object} [payload.stats={ level: 50, power: 9800, prestige: 1200 }]
 * @returns {Promise<Buffer>}
 */
async function generateDynamicMotionBanner(payload = {}) {
  const width = 900;
  const height = 320;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const themeKey = THEMES[payload.theme] ? payload.theme : "cyberpunk";
  const theme = THEMES[themeKey];

  // 1. Background Gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, theme.bgGrad[0]);
  grad.addColorStop(0.5, theme.bgGrad[1]);
  grad.addColorStop(1, theme.bgGrad[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Holographic Cyber Grid Lines
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Ambient Glow Circles
  ctx.save();
  const radGlow1 = ctx.createRadialGradient(width - 150, 100, 10, width - 150, 100, 250);
  radGlow1.addColorStop(0, theme.accent + "33");
  radGlow1.addColorStop(1, "transparent");
  ctx.fillStyle = radGlow1;
  ctx.fillRect(0, 0, width, height);

  const radGlow2 = ctx.createRadialGradient(150, height - 80, 10, 150, height - 80, 200);
  radGlow2.addColorStop(0, theme.secondary + "22");
  radGlow2.addColorStop(1, "transparent");
  ctx.fillStyle = radGlow2;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 4. Floating Cosmic Particles (Motion illusion)
  ctx.save();
  for (let i = 0; i < 45; i++) {
    const px = Math.floor(Math.sin(i * 137.5) * (width / 2) + width / 2);
    const py = Math.floor(Math.cos(i * 92.3) * (height / 2) + height / 2);
    const pSize = (i % 3) + 1;
    const alpha = ((i % 5) + 3) / 10;
    ctx.fillStyle = i % 2 === 0 ? theme.accent : theme.secondary;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, pSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 5. Border Frame Cyberpunk
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // Corner Accent Lines
  const cLen = 28;
  ctx.lineWidth = 4;
  ctx.strokeStyle = theme.secondary;
  // Kiri Atas
  ctx.beginPath();
  ctx.moveTo(10, 10 + cLen);
  ctx.lineTo(10, 10);
  ctx.lineTo(10 + cLen, 10);
  ctx.stroke();
  // Kanan Bawah
  ctx.beginPath();
  ctx.moveTo(width - 10, height - 10 - cLen);
  ctx.lineTo(width - 10, height - 10);
  ctx.lineTo(width - 10 - cLen, height - 10);
  ctx.stroke();
  ctx.restore();

  // 6. Avatar Area (Left Side)
  const avatarX = 90;
  const avatarY = height / 2;
  const avatarRadius = 55;

  ctx.save();
  // Avatar Outer Aura Ring
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 3;
  ctx.shadowColor = theme.accent;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();

  let avatarLoaded = false;
  if (payload.avatarUrl) {
    try {
      const avatarImg = await loadImage(payload.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();
      avatarLoaded = true;
    } catch (_) {
      avatarLoaded = false;
    }
  }

  if (!avatarLoaded) {
    // Fallback Initial Avatar Circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#1E293B";
    ctx.fill();
    ctx.fillStyle = theme.text;
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initial = (payload.username || "A").charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX, avatarY);
    ctx.restore();
  }

  // 7. Typography & Content (Right Side)
  const contentX = 180;

  // Badge Kelulusan Season Pass / Gelar
  ctx.save();
  const badgeText = `★ TIER ${payload.seasonTier || 30} • ${payload.title || "SEASON PASS GRADUATE"} ★`;
  ctx.font = "bold 13px sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 24;
  ctx.fillStyle = theme.badgeBg;
  ctx.strokeStyle = theme.secondary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(contentX, 45, badgeWidth, 26, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = theme.secondary;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, contentX + 12, 58);
  ctx.restore();

  // Username
  ctx.save();
  ctx.fillStyle = theme.text;
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(payload.username || "Adventurer", contentX, 85);
  ctx.restore();

  // AI Generated Subtitle Quote
  ctx.save();
  ctx.fillStyle = "#94A3B8";
  ctx.font = "italic 15px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const quote = `"${payload.quote || "Echoes of stellar journeys resonate forever."}"`;
  ctx.fillText(quote, contentX, 130);
  ctx.restore();

  // 8. Stats Metrics Bar (Level, Combat Power, Prestige)
  const stats = payload.stats || { level: 50, power: 9800, prestige: 1200 };
  const statBoxY = 175;
  const statItems = [
    { label: "LEVEL", val: `Lv. ${stats.level || 1}` },
    { label: "COMBAT RATING", val: `${(stats.power || 1000).toLocaleString("id-ID")} CP` },
    { label: "ASTRAL PRESTIGE", val: `${(stats.prestige || 500).toLocaleString("id-ID")} PTS` },
  ];

  statItems.forEach((st, idx) => {
    const boxX = contentX + idx * 190;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, statBoxY, 175, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#64748B";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(st.label, boxX + 12, statBoxY + 18);

    ctx.fillStyle = idx === 0 ? theme.accent : idx === 1 ? theme.secondary : "#F8FAFC";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(st.val, boxX + 12, statBoxY + 38);
    ctx.restore();
  });

  // 9. Watermark Footer Ekosistem
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("NAURA HOSHINO V2 • DYNAMIC MOTION SUITE", width - 35, height - 25);
  ctx.restore();

  return canvas.toBuffer("image/png");
}

module.exports = {
  generateDynamicMotionBanner,
  THEMES,
};
