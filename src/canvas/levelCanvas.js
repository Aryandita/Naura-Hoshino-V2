"use strict";

const { createCanvas, drawAvatar, drawRoundedRect, truncateText } = require("./helpers/canvasPrimitives");


async function generateLevel(user, level) {
  const W = 840,
    H = 260;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Background Gradient (Cyber Midnight)
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#08090C");
  bgGrad.addColorStop(0.5, "#140e28");
  bgGrad.addColorStop(1, "#0a1120");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Ambient Radial Glow & Festive Sparkles
  const radialGlow = ctx.createRadialGradient(
    W * 0.7,
    H * 0.4,
    10,
    W * 0.7,
    H * 0.4,
    300,
  );
  radialGlow.addColorStop(0, "rgba(255, 182, 193, 0.18)");
  radialGlow.addColorStop(0.5, "rgba(192, 132, 252, 0.12)");
  radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, W, H);

  // Subtle Sparkle particles
  const stars = [
    { x: 180, y: 40, r: 2, a: 0.7 },
    { x: 420, y: 35, r: 3, a: 0.9 },
    { x: 680, y: 50, r: 2.5, a: 0.8 },
    { x: 780, y: 120, r: 2, a: 0.6 },
    { x: 740, y: 210, r: 3, a: 0.75 },
    { x: 320, y: 225, r: 2, a: 0.5 },
    { x: 540, y: 230, r: 2.5, a: 0.8 },
  ];
  ctx.save();
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 0, ${s.a})`;
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 8;
    ctx.fill();
  }
  ctx.restore();

  // 3. Frosted Glass Panel with Neon Border
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, 16, 16, W - 32, H - 32, 22, "rgba(255, 255, 255, 0.03)");
  ctx.restore();

  // Glass Border with Multi-stop Neon Gradient
  const borderGrad = ctx.createLinearGradient(16, 16, W - 16, H - 16);
  borderGrad.addColorStop(0, "rgba(255, 182, 193, 0.6)");
  borderGrad.addColorStop(0.5, "rgba(192, 132, 252, 0.4)");
  borderGrad.addColorStop(1, "rgba(6, 182, 212, 0.3)");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(16, 16, W - 32, H - 32, 22);
  else ctx.rect(16, 16, W - 32, H - 32);
  ctx.stroke();

  // 4. Avatar Section (Left)
  const avatarSize = 140;
  const avatarX = 48;
  const avatarY = 60;

  // Dual Glowing Ring around Avatar
  ctx.save();
  ctx.strokeStyle = "rgba(255, 215, 0, 0.85)";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#FFD700";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 7,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();

  // Inner ring
  ctx.strokeStyle = "rgba(255, 182, 193, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 2,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  // Avatar Image
  const avatarUrl = user.displayAvatarURL
    ? user.displayAvatarURL({ extension: "png", size: 256 })
    : user.avatarURL;
  try {
    await drawAvatar(ctx, avatarUrl, avatarX, avatarY, avatarSize, null);
  } catch (_) {
    drawRoundedRect(
      ctx,
      avatarX,
      avatarY,
      avatarSize,
      avatarSize,
      avatarSize / 2,
      "#1E2633",
    );
  }

  // 5. Text & Badges (Right Section)
  const textX = avatarX + avatarSize + 36;

  // Level Up Capsule Chip (Top)
  const chipW = 160;
  const chipH = 28;
  const chipY = 48;
  drawRoundedRect(
    ctx,
    textX,
    chipY,
    chipW,
    chipH,
    14,
    "rgba(255, 182, 193, 0.12)",
  );
  ctx.strokeStyle = "rgba(255, 182, 193, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(textX, chipY, chipW, chipH, 14);
  ctx.stroke();

  ctx.fillStyle = "#FFB6C1";
  ctx.font =
    'bold 14px "MontserratBold", "InterBold", "SymbolFont", "EmojiFont", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("✦ LEVEL UP! ✦", textX + chipW / 2, chipY + 19);

  // User Display Name
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font =
    'bold 34px "MontserratBold", "EmojiFont", "SymbolFont", sans-serif';
  const nameStr = truncateText(
    ctx,
    user.displayName || user.username || "User",
    480,
  );
  ctx.fillText(nameStr, textX, 118);

  // Milestone Badge Pill
  const pillW = 340;
  const pillH = 40;
  const pillY = 138;
  drawRoundedRect(
    ctx,
    textX,
    pillY,
    pillW,
    pillH,
    12,
    "rgba(13, 17, 23, 0.75)",
  );
  ctx.strokeStyle = "rgba(255, 215, 0, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(textX, pillY, pillW, pillH, 12);
  ctx.stroke();

  ctx.fillStyle = "#FFD700";
  ctx.font =
    'bold 18px "MontserratBold", "InterBold", "EmojiFont", "SymbolFont", sans-serif';
  ctx.fillText(`🎉 Kini mencapai Level ${level}`, textX + 16, pillY + 26);

  // Subtitle / Brand Tag
  ctx.fillStyle = "#8E98B0";
  ctx.font = '13px "Inter", "EmojiFont", "SymbolFont", sans-serif';
  ctx.fillText(
    "🌸 Naura Hoshino RPG Leveling System",
    textX + 2,
    pillY + pillH + 26,
  );

  return canvas;
}

module.exports = { generateLevel };
