"use strict";

const { createCanvas, loadImage, logger, drawAvatar, drawRoundedRect, truncateText } = require("./helpers/canvasPrimitives");


async function generateRankCard(
  user,
  level = 1,
  xp = 0,
  targetXp = 100,
  rankNumber = 1,
  roleBadge = "Novice",
  isPremium = false,
  customBg = null,
  customBorder = null,
) {
  const W = 920,
    H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const accentColor = isPremium ? "#FFD700" : "#FFB6C1";
  const accentGlow = isPremium
    ? "rgba(255, 215, 0, 0.4)"
    : "rgba(255, 182, 193, 0.35)";

  // 1. Background
  let bgImg = null;
  if (customBg) {
    try {
      bgImg = await loadImage(customBg);
    } catch (err) {
      logger.warn("[CanvasUtils:generateRankCard] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
    }
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, W, H);
    drawRoundedRect(ctx, 0, 0, W, H, 0, "rgba(8, 9, 12, 0.65)");
  } else {
    // Cyber Midnight Canvas
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#08090C");
    bgGrad.addColorStop(0.5, "#101422");
    bgGrad.addColorStop(1, "#171228");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle Cyber Grid & Ambient Glow
    ctx.save();
    const radialGlow = ctx.createRadialGradient(
      W - 100,
      60,
      10,
      W - 100,
      60,
      250,
    );
    radialGlow.addColorStop(0, accentGlow);
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, W, H);

    // Grid dots
    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    for (let gx = 30; gx < W; gx += 40) {
      for (let gy = 30; gy < H; gy += 40) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }
    ctx.restore();
  }

  // 2. Inner Glassmorphic Panel
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, 18, 18, W - 36, H - 36, 22, "rgba(255, 255, 255, 0.03)");
  ctx.restore();

  // Glass Rim with Multi-stop Neon Gradient
  const borderGrad = ctx.createLinearGradient(18, 18, W - 18, H - 18);
  borderGrad.addColorStop(
    0,
    isPremium ? "rgba(255, 215, 0, 0.6)" : "rgba(255, 182, 193, 0.55)",
  );
  borderGrad.addColorStop(0.5, "rgba(192, 132, 252, 0.35)");
  borderGrad.addColorStop(
    1,
    isPremium ? "rgba(255, 140, 0, 0.3)" : "rgba(6, 182, 212, 0.25)",
  );
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(18, 18, W - 36, H - 36, 22);
  else ctx.rect(18, 18, W - 36, H - 36);
  ctx.stroke();

  // 3. Avatar + Multi-layer Neon Ring
  const avatarSize = 150;
  const avatarX = 48,
    avatarY = 65;

  // Outer Glowing Halo
  ctx.save();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.shadowColor = accentColor;
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

  // Inner subtle ring
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 2,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  try {
    const avatarUrl = user.displayAvatarURL
      ? user.displayAvatarURL({ extension: "png", size: 256 })
      : user.avatarURL;
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

  // Custom Border asset if equipped
  if (customBorder) {
    try {
      const borderImg = await loadImage(customBorder);
      if (borderImg) {
        ctx.drawImage(
          borderImg,
          avatarX - 10,
          avatarY - 10,
          avatarSize + 20,
          avatarSize + 20,
        );
      }
    } catch (err) {
      logger.warn("[CanvasUtils:generateRankCard] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
    }
  }

  // 4. Metrics (Top Right): Clean Rank & Level Badge
  const cleanRank = String(rankNumber).replace(/^#+/, "");
  ctx.textAlign = "right";

  // Rank text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 26px "MontserratBold", "InterBold", sans-serif';
  ctx.fillText(`RANK #${cleanRank}`, W - 45, 62);

  // Level Pill Badge (Top Right)
  const levelPillW = 120;
  const levelPillH = 30;
  const levelPillX = W - 45 - levelPillW;
  const levelPillY = 76;

  drawRoundedRect(
    ctx,
    levelPillX,
    levelPillY,
    levelPillW,
    levelPillH,
    10,
    "rgba(13, 17, 23, 0.8)",
  );
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(levelPillX, levelPillY, levelPillW, levelPillH, 10);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 15px "MontserratBold", "InterBold", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(
    `LEVEL ${level}`,
    levelPillX + levelPillW / 2,
    levelPillY + levelPillH / 2 + 5,
  );

  // 5. User Info (Left next to avatar)
  ctx.textAlign = "left";
  const textX = avatarX + avatarSize + 32;

  // Display Name
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 30px "MontserratBold", "EmojiFont", sans-serif';
  const displayName = truncateText(
    ctx,
    (user.displayName || user.username || "User").toUpperCase(),
    360,
  );
  ctx.fillText(displayName, textX, 86);

  // Role Pill Badge
  const badgeText = roleBadge ? String(roleBadge) : "Pendatang Baru";
  ctx.font = 'bold 14px "InterBold", "EmojiFont", sans-serif';
  const badgeWidth = Math.min(220, ctx.measureText(badgeText).width + 24);
  const badgeHeight = 26;
  const badgeY = 100;

  drawRoundedRect(
    ctx,
    textX,
    badgeY,
    badgeWidth,
    badgeHeight,
    8,
    "rgba(255, 255, 255, 0.06)",
  );
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(textX, badgeY, badgeWidth, badgeHeight, 8);
  ctx.stroke();

  ctx.fillStyle = "#A0AEC0";
  ctx.fillText(badgeText, textX + 12, badgeY + 18);

  // 6. XP Progress Bar (Cyber Recessed Glass Track)
  const barX = textX;
  const barY = 160;
  const barW = W - textX - 45;
  const barH = 22;
  const pct =
    targetXp > 0 ? Math.min(100, Math.max(0, (xp / targetXp) * 100)) : 0;

  // Recessed background track
  drawRoundedRect(ctx, barX, barY, barW, barH, 11, "rgba(0, 0, 0, 0.6)");
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 11);
  ctx.stroke();

  // Progress Fill with Neon Gradient
  const progressWidth = Math.max(11 * 2, (Math.min(pct, 100) / 100) * barW);
  if (pct > 0) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, barY, progressWidth, barH, 11);
    else ctx.rect(barX, barY, progressWidth, barH);
    ctx.clip();

    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    if (isPremium) {
      barGrad.addColorStop(0, "#FF8C00");
      barGrad.addColorStop(0.6, "#FFA500");
      barGrad.addColorStop(1, "#FFD700");
    } else {
      barGrad.addColorStop(0, "#F43F5E");
      barGrad.addColorStop(0.5, "#EC4899");
      barGrad.addColorStop(1, "#FFB6C1");
    }
    ctx.fillStyle = barGrad;
    ctx.fill();
    ctx.restore();

    // Glowing tip highlight
    if (pct > 5 && pct < 98) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(barX + progressWidth - 6, barY + barH / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }
  }

  // 7. XP Text & Percentage
  ctx.fillStyle = "#8E98B0";
  ctx.font = '15px "Inter", "EmojiFont", sans-serif';
  ctx.fillText(
    `${Number(xp).toLocaleString("id-ID")} / ${Number(targetXp).toLocaleString("id-ID")} XP`,
    barX,
    215,
  );

  ctx.textAlign = "right";
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 16px "MontserratBold", "InterBold", sans-serif';
  ctx.fillText(`${Math.floor(pct)}%`, barX + barW, 215);

  return canvas;
}
module.exports = { generateRankCard };
