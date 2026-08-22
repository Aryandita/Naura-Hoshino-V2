"use strict";

const { createCanvas, loadImage } = require("@napi-rs/canvas");

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, lineWidth = 1) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Render Kartu Tarot Omikuji Cyber-Anime
 * @param {Object} omikuji
 * @param {Object} user
 * @returns {Promise<Buffer>}
 */
async function renderOmikujiCard(omikuji, user) {
  const W = 640;
  const H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const tier = omikuji.tier || {};
  const accentColor = tier.color || "#06B6D4";

  // 1. Deep Midnight Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#06080E");
  bgGrad.addColorStop(0.5, "#0E1424");
  bgGrad.addColorStop(1, "#170E2A");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Ambient Stardust Glow
  ctx.save();
  const radGlow = ctx.createRadialGradient(W / 2, 200, 20, W / 2, 200, 320);
  radGlow.addColorStop(0, `${accentColor}33`);
  radGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, W, H);

  // Star Points
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  for (let i = 0; i < 45; i++) {
    const sx = (i * 73 + 19) % W;
    const sy = (i * 97 + 31) % H;
    const sr = (i % 3) + 1;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Outer Frame & Glass Panel
  drawRoundedRect(ctx, 24, 24, W - 48, H - 48, 28, "rgba(255, 255, 255, 0.02)", "rgba(255, 255, 255, 0.12)", 1.5);
  drawRoundedRect(ctx, 36, 36, W - 72, H - 72, 22, "rgba(13, 17, 23, 0.7)", `${accentColor}66`, 2);

  // 4. Header: Celestial Tag & Date
  ctx.textAlign = "center";
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillStyle = accentColor;
  ctx.fillText("✦ HOSHINO ASTRAL SANCTUARY ✦", W / 2, 75);

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = "#8E98B0";
  ctx.fillText(`TAROT OMIKUJI · ${omikuji.date || "TODAY"}`, W / 2, 95);

  // 5. Center Crest & Tier Name
  ctx.font = 'bold 28px "Orbitron", sans-serif';
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(tier.name || "Bintang Kosmik", W / 2, 145);

  // Star Icons
  let starsStr = "";
  for (let s = 0; s < (tier.starCount || 3); s++) starsStr += "★ ";
  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = accentColor;
  ctx.fillText(starsStr.trim(), W / 2, 175);

  // 6. User Avatar (Center Capsule)
  const avatarSize = 100;
  const avX = W / 2 - avatarSize / 2;
  const avY = 205;

  ctx.save();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(W / 2, avY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  try {
    const avatarUrl = user?.displayAvatarURL
      ? user.displayAvatarURL({ extension: "png", size: 256 })
      : user?.avatarURL;
    if (avatarUrl) {
      const img = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, avY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, avX, avY, avatarSize, avatarSize);
      ctx.restore();
    }
  } catch (_) {
    drawRoundedRect(ctx, avX, avY, avatarSize, avatarSize, avatarSize / 2, "#1E2633");
  }

  // Display Name under Avatar
  ctx.textAlign = "center";
  ctx.font = 'bold 20px "Outfit", sans-serif';
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText((omikuji.displayName || "Pengelana").toUpperCase(), W / 2, 335);

  // 7. Categories Matrix (Rezeki, Asmara, Petualangan, Mood)
  const catY = 365;
  const cats = [
    { label: "💰 Rezeki", val: omikuji.categories?.wealth || 85, color: "#10B981" },
    { label: "💖 Asmara", val: omikuji.categories?.romance || 80, color: "#FFB6C1" },
    { label: "⚔️ Petualangan", val: omikuji.categories?.adventure || 90, color: "#06B6D4" },
    { label: "✨ Mood", val: omikuji.categories?.mood || 88, color: "#C084FC" },
  ];

  for (let i = 0; i < cats.length; i++) {
    const c = cats[i];
    const bx = 60 + (i % 2) * 270;
    const by = catY + Math.floor(i / 2) * 65;

    drawRoundedRect(ctx, bx, by, 250, 52, 12, "rgba(255, 255, 255, 0.03)", "rgba(255, 255, 255, 0.08)", 1);
    ctx.textAlign = "left";
    ctx.font = '13px "Outfit", sans-serif';
    ctx.fillStyle = "#A0AEC0";
    ctx.fillText(c.label, bx + 14, by + 24);

    ctx.textAlign = "right";
    ctx.font = 'bold 15px "Orbitron", sans-serif';
    ctx.fillStyle = c.color;
    ctx.fillText(`${c.val}%`, bx + 236, by + 24);

    // Mini bar
    drawRoundedRect(ctx, bx + 14, by + 34, 222, 6, 3, "rgba(0, 0, 0, 0.5)");
    drawRoundedRect(ctx, bx + 14, by + 34, (c.val / 100) * 222, 6, 3, c.color);
  }

  // 8. Lucky Charms (Number & Color)
  const charmY = 520;
  drawRoundedRect(ctx, 60, charmY, W - 120, 60, 14, "rgba(255, 255, 255, 0.03)", "rgba(255, 255, 255, 0.08)");

  ctx.textAlign = "center";
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillStyle = "#8E98B0";
  ctx.fillText("LUCKY ELEMENTS", W / 2, charmY + 22);

  ctx.font = 'bold 14px "Orbitron", sans-serif';
  ctx.fillStyle = "#FFD700";
  ctx.fillText(`ANGKA: #${omikuji.luckyNumber || 7}  ·  WARNA: ${omikuji.luckyColor || "Sakura Pink"}`, W / 2, charmY + 44);

  // 9. Personal Quote
  const quoteY = 610;
  drawRoundedRect(ctx, 60, quoteY, W - 120, 100, 16, "rgba(6, 182, 212, 0.05)", "rgba(6, 182, 212, 0.25)");

  ctx.textAlign = "center";
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = accentColor;
  ctx.fillText("NAURA'S PERSONAL INSIGHT", W / 2, quoteY + 25);

  ctx.font = 'italic 14px "Outfit", sans-serif';
  ctx.fillStyle = "#E2E8F0";
  const quoteText = omikuji.personalQuote || '"Semesta sedang memayungi langkahmu."';
  ctx.fillText(quoteText, W / 2, quoteY + 60, W - 160);

  // 10. Reward Pill & Footer
  const rewardY = 735;
  drawRoundedRect(ctx, 120, rewardY, W - 240, 48, 24, "rgba(16, 185, 129, 0.15)", "rgba(16, 185, 129, 0.4)");
  ctx.font = 'bold 14px "Orbitron", sans-serif';
  ctx.fillStyle = "#10B981";
  ctx.fillText(`+${tier.rewardCoin || 500} COINS  ·  +${tier.rewardStamina || 20} STAMINA`, W / 2, rewardY + 29);

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = "#64748B";
  ctx.fillText("✿ NAURA HOSHINO · ASTRAL SANCTUARY ✿", W / 2, 835);

  return canvas.toBuffer("image/png");
}

/**
 * Render Banner Cuaca Astral Server
 * @param {Object} weather
 * @returns {Promise<Buffer>}
 */
async function renderAstralWeatherBanner(weather) {
  const W = 900;
  const H = 340;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const accentColor = weather.color || "#10B981";

  // Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#080B12");
  bgGrad.addColorStop(0.5, "#0E1526");
  bgGrad.addColorStop(1, "#17122A");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Radial Glow
  ctx.save();
  const radGlow = ctx.createRadialGradient(W - 150, 100, 10, W - 150, 100, 300);
  radGlow.addColorStop(0, `${accentColor}44`);
  radGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Glass Frame
  drawRoundedRect(ctx, 20, 20, W - 40, H - 40, 22, "rgba(255,255,255,0.02)", `${accentColor}55`, 1.5);

  // Header Tag
  ctx.textAlign = "left";
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillStyle = accentColor;
  ctx.fillText("// SERVER_ASTRAL_WEATHER_", 48, 56);

  // Weather Title
  ctx.font = 'bold 36px "Orbitron", sans-serif';
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${weather.emoji || "✨"} ${weather.name || "Aurora of Fortune"}`, 48, 104);

  // Description
  ctx.font = '15px "Outfit", sans-serif';
  ctx.fillStyle = "#A0AEC0";
  ctx.fillText(weather.description || "Pancaran aura kosmik menaungi server hari ini.", 48, 138, W - 100);

  // Buff Pills Container
  const pillY = 170;
  const buffs = weather.buffs || {};
  const buffKeys = Object.keys(buffs);

  for (let i = 0; i < buffKeys.length; i++) {
    const k = buffKeys[i];
    const val = buffs[k];
    const bx = 48 + i * 260;

    drawRoundedRect(ctx, bx, pillY, 240, 68, 14, "rgba(255,255,255,0.03)", "rgba(255,255,255,0.1)");
    ctx.textAlign = "left";
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = "#8E98B0";
    ctx.fillText(k.toUpperCase(), bx + 16, pillY + 26);

    ctx.font = 'bold 20px "Orbitron", sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText(`+${val}% ACTIVE`, bx + 16, pillY + 54);
  }

  // Footer
  ctx.textAlign = "left";
  ctx.font = 'italic 13px "Outfit", sans-serif';
  ctx.fillStyle = "#64748B";
  ctx.fillText(`"${weather.lore || "Bintang-bintang bersinar terang di atas server."}"`, 48, 290, W - 100);

  return canvas.toBuffer("image/png");
}

module.exports = {
  renderOmikujiCard,
  renderAstralWeatherBanner,
};
