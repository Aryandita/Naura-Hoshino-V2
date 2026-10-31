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
 * Render Kartu Informasi Server Discord (900 x 360)
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
async function renderServerInfo(payload = {}) {
  return runWithLimit("serverInfoCard", async () => {
    const {
      guildName = "Discord Server",
      guildIconURL = null,
      memberCount = 100,
      onlineCount = 50,
      channelCount = 20,
      roleCount = 15,
      boostTier = 0,
      boostCount = 0,
      createdAt = "2024",
      ownerName = "Server Owner",
      verificationLevel = "Sedang",
    } = payload;

    const W = 900;
    const H = 360;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Cyber Blurple Gradient Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#080a14");
    bg.addColorStop(0.5, "#0f1329");
    bg.addColorStop(1, "#181a38");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle Radial Glow
    const glow = ctx.createRadialGradient(120, 100, 10, 120, 100, 260);
    glow.addColorStop(0, "rgba(88, 101, 242, 0.2)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Frame Border
    drawRoundedRect(ctx, 14, 14, W - 28, H - 28, 18, null, "rgba(255, 255, 255, 0.08)", 1.5);

    // 2. Guild Icon (Kiri: 110 x 110)
    const iconX = 45;
    const iconY = 45;
    const iconSize = 110;

    let iconDrawn = false;
    if (guildIconURL) {
      try {
        const img = await loadImage(guildIconURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        ctx.restore();
        iconDrawn = true;
      } catch (err) {
        logger.warn("[serverinfoCanvas:renderServerInfo] Guild icon fallback: " + (err?.message || err));
      }
    }

    if (!iconDrawn) {
      drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 55, "#1e1b4b", "#5865f2", 2);
      ctx.fillStyle = "#5865f2";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏰", iconX + iconSize / 2, iconY + 70);
      ctx.textAlign = "left";
    }

    // Outer Icon Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(88, 101, 242, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 3. Guild Identity
    const infoX = 180;
    drawRoundedRect(ctx, infoX, 40, 150, 24, 6, "rgba(88, 101, 242, 0.2)", "#5865f2", 1);
    ctx.fillStyle = "#818cf8";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.fillText("✦ DISCORD SERVER", infoX + 12, 56);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px MontserratBold, InterBold, sans-serif";
    ctx.fillText(guildName.substring(0, 26), infoX, 94);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Inter, sans-serif";
    ctx.fillText(`👑 Owner: ${ownerName} • 🗓️ Dibuat: ${createdAt}`, infoX, 122);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`🔒 Verifikasi: ${verificationLevel} • 🚀 Boost Level: ${boostTier} (${boostCount} Boost)`, infoX, 144);

    // 4. Metrics Grid (Bawah)
    const gridY = 180;
    const gridW = W - 90;
    drawRoundedRect(ctx, 45, gridY, gridW, 110, 14, "rgba(15, 23, 42, 0.7)", "rgba(255, 255, 255, 0.08)", 1);

    const colW = gridW / 4;

    // Col 1: Members
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("👥 ANGGOTA TOTAL", 45 + 24, gridY + 36);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 24px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${memberCount.toLocaleString()}`, 45 + 24, gridY + 70);
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.fillText(`🟢 ${onlineCount.toLocaleString()} Online`, 45 + 24, gridY + 92);

    // Col 2: Channels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("📢 SALURAN", 45 + colW + 24, gridY + 36);
    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 24px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${channelCount}`, 45 + colW + 24, gridY + 70);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("Teks & Suara", 45 + colW + 24, gridY + 92);

    // Col 3: Roles
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("🎭 PERAN / ROLES", 45 + colW * 2 + 24, gridY + 36);
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 24px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${roleCount}`, 45 + colW * 2 + 24, gridY + 70);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("Hirarki Peran", 45 + colW * 2 + 24, gridY + 92);

    // Col 4: Boosts
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("✨ NITRO BOOST", 45 + colW * 3 + 24, gridY + 36);
    ctx.fillStyle = "#ec4899";
    ctx.font = "bold 24px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`Level ${boostTier}`, 45 + colW * 3 + 24, gridY + 70);
    ctx.fillStyle = "#f472b6";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`${boostCount} Penguat Aktif`, 45 + colW * 3 + 24, gridY + 92);

    // Footer Watermark
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("NAURA HOSHINO V2 • GUILD TELEMETRY & SERVER SPOTLIGHT", 45, H - 20);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderServerInfo,
};

