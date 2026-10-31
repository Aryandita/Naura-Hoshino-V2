"use strict";

const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");
const { logger } = require("../managers/logger");

function drawRoundedRect(ctx, x, y, w, h, r, fillColor, strokeColor = null, lineWidth = 1) {
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Render Kartu Daily Reward & Streak Matrix (800 x 300)
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
async function renderDailyCard(payload = {}) {
  return runWithLimit("dailyCard", async () => {
    const {
      username = "Pengguna",
      avatarURL = null,
      streak = 1,
      rewardCoins = 500,
      claimed = true,
      bonusMultiplier = "1.0x",
      activeMission = "Selesaikan 1 Minigame",
      missionProgress = 1,
      missionTotal = 1,
    } = payload;

    const W = 800;
    const H = 300;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Cyber Midnight Gradient Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#080b14");
    bg.addColorStop(0.5, "#0d1527");
    bg.addColorStop(1, "#151b33");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Glowing accents
    const glow1 = ctx.createRadialGradient(100, 100, 10, 100, 100, 200);
    glow1.addColorStop(0, "rgba(245, 197, 24, 0.12)");
    glow1.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

    const glow2 = ctx.createRadialGradient(700, 250, 10, 700, 250, 220);
    glow2.addColorStop(0, "rgba(34, 197, 94, 0.1)");
    glow2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    // Outer Border
    drawRoundedRect(ctx, 10, 10, W - 20, H - 20, 18, null, "rgba(255, 255, 255, 0.08)", 1.5);

    // 2. Avatar Section (Kiri)
    const avatarX = 40;
    const avatarY = 55;
    const avatarSize = 90;

    let avatarDrawn = false;
    if (avatarURL) {
      try {
        const img = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        avatarDrawn = true;
      } catch (err) {
        logger.warn("[dailyCanvas:renderDailyCard] Avatar fallback: " + (err?.message || err));
      }
    }

    if (!avatarDrawn) {
      drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 45, "#1e293b", "#38bdf8", 2);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🌟", avatarX + avatarSize / 2, avatarY + 58);
      ctx.textAlign = "left";
    }

    // Avatar Glow Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = claimed ? "rgba(34, 197, 94, 0.5)" : "rgba(245, 197, 24, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 3. User Info & Header (Kanan Avatar)
    const infoX = 155;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.fillText("DAILY REWARD STATION", infoX, 55);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px MontserratBold, InterBold, sans-serif";
    ctx.fillText(username.substring(0, 18), infoX, 85);

    // Status Pill
    const statusText = claimed ? "✓ KLAIM BERHASIL" : "⚡ SIAP KLAIM";
    const statusColor = claimed ? "#22c55e" : "#f59e0b";
    drawRoundedRect(ctx, infoX, 98, 120, 24, 6, "rgba(0, 0, 0, 0.4)", statusColor, 1);
    ctx.fillStyle = statusColor;
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.fillText(statusText, infoX + 10, 114);

    // Streak Pill
    const streakText = `🔥 Streak: ${streak} Hari`;
    drawRoundedRect(ctx, infoX + 130, 98, 125, 24, 6, "rgba(239, 68, 68, 0.15)", "#f87171", 1);
    ctx.fillStyle = "#fca5a5";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.fillText(streakText, infoX + 140, 114);

    // 4. Reward Box (Kanan Atas)
    const boxX = 450;
    const boxY = 40;
    const boxW = 310;
    const boxH = 95;
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 12, "rgba(15, 23, 42, 0.7)", "rgba(245, 197, 24, 0.3)", 1);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText("💰 REWARD HARI INI", boxX + 16, boxY + 28);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`+${rewardCoins} Koin`, boxX + 16, boxY + 64);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`Multiplier: ${bonusMultiplier}`, boxX + 16, boxY + 84);

    // 5. Mission Progress Section (Bawah)
    const misY = 160;
    const misW = W - 80;
    drawRoundedRect(ctx, 40, misY, misW, 90, 12, "rgba(15, 23, 42, 0.6)", "rgba(255, 255, 255, 0.08)", 1);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText("🎯 MISI HARIAN AKTIF", 56, misY + 26);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(activeMission, 56, misY + 50);

    // Progress Bar
    const barX = 56;
    const barY = misY + 62;
    const barW = misW - 32;
    const barH = 12;
    const pct = Math.min(1, Math.max(0, missionTotal > 0 ? missionProgress / missionTotal : 1));

    drawRoundedRect(ctx, barX, barY, barW, barH, 6, "rgba(255, 255, 255, 0.1)");
    if (pct > 0) {
      const fillW = Math.max(barH, barW * pct);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      barGrad.addColorStop(0, "#38bdf8");
      barGrad.addColorStop(1, "#22c55e");
      drawRoundedRect(ctx, barX, barY, fillW, barH, 6, barGrad);
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${missionProgress} / ${missionTotal}`, barX + barW, misY + 50);
    ctx.textAlign = "left";

    // Footer Watermark
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("NAURA HOSHINO V2 • DAILY MISSION & STREAK MATRIX", 40, H - 18);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderDailyCard,
};

