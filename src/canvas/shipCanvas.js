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
 * Render Kartu Ship & Kompatibilitas Cinta (700 x 300)
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
async function renderShipCard(payload = {}) {
  return runWithLimit("shipCard", async () => {
    const {
      user1Name = "Pengguna 1",
      user1Avatar = null,
      user2Name = "Pengguna 2",
      user2Avatar = null,
      percentage = 50,
      comment = "Cocok banget!",
    } = payload;

    const W = 700;
    const H = 300;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Romantic Violet Gradient Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#130818");
    bg.addColorStop(0.5, "#240d29");
    bg.addColorStop(1, "#361230");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Center Heart Radial Glow
    const glow = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 220);
    glow.addColorStop(0, "rgba(244, 63, 94, 0.2)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Border Frame
    drawRoundedRect(ctx, 12, 12, W - 24, H - 24, 16, null, "rgba(244, 63, 94, 0.2)", 1.5);

    // Header Pill
    drawRoundedRect(ctx, W / 2 - 100, 24, 200, 26, 8, "rgba(244, 63, 94, 0.2)", "#f43f5e", 1);
    ctx.fillStyle = "#fda4af";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("💕 NAURA SHIP METER 💕", W / 2, 41);
    ctx.textAlign = "left";

    // 2. Avatar 1 (Kiri)
    const avSize = 84;
    const av1X = 60;
    const avY = 85;

    let av1Drawn = false;
    if (user1Avatar) {
      try {
        const img = await loadImage(user1Avatar);
        ctx.save();
        ctx.beginPath();
        ctx.arc(av1X + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, av1X, avY, avSize, avSize);
        ctx.restore();
        av1Drawn = true;
      } catch (err) {
        logger.warn("[shipCanvas:renderShipCard] User 1 avatar fallback: " + (err?.message || err));
      }
    }
    if (!av1Drawn) {
      drawRoundedRect(ctx, av1X, avY, avSize, avSize, 42, "#3b0764", "#ec4899", 2);
      ctx.fillStyle = "#f472b6";
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("💖", av1X + avSize / 2, avY + 54);
      ctx.textAlign = "left";
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(av1X + avSize / 2, avY + avSize / 2, avSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(244, 63, 94, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px InterBold, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(user1Name.substring(0, 14), av1X + avSize / 2, avY + avSize + 22);

    // 3. Avatar 2 (Kanan)
    const av2X = W - 60 - avSize;
    let av2Drawn = false;
    if (user2Avatar) {
      try {
        const img = await loadImage(user2Avatar);
        ctx.save();
        ctx.beginPath();
        ctx.arc(av2X + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, av2X, avY, avSize, avSize);
        ctx.restore();
        av2Drawn = true;
      } catch (err) {
        logger.warn("[shipCanvas:renderShipCard] User 2 avatar fallback: " + (err?.message || err));
      }
    }
    if (!av2Drawn) {
      drawRoundedRect(ctx, av2X, avY, avSize, avSize, 42, "#3b0764", "#ec4899", 2);
      ctx.fillStyle = "#f472b6";
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("💖", av2X + avSize / 2, avY + 54);
      ctx.textAlign = "left";
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(av2X + avSize / 2, avY + avSize / 2, avSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(244, 63, 94, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px InterBold, sans-serif";
    ctx.fillText(user2Name.substring(0, 14), av2X + avSize / 2, avY + avSize + 22);

    // 4. Center Meter & Percentage
    const centerX = W / 2;
    ctx.fillStyle = "#f43f5e";
    ctx.font = "bold 44px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${percentage}%`, centerX, 120);

    // Heart Icon between
    ctx.font = "26px sans-serif";
    ctx.fillText(percentage >= 50 ? "❤️" : "💔", centerX, 154);

    // Progress Bar
    const barW = 240;
    const barH = 14;
    const barX = centerX - barW / 2;
    const barY = 172;
    const pct = Math.min(1, Math.max(0, percentage / 100));

    drawRoundedRect(ctx, barX, barY, barW, barH, 7, "rgba(255, 255, 255, 0.1)");
    if (pct > 0) {
      const fillW = Math.max(barH, barW * pct);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      barGrad.addColorStop(0, "#f43f5e");
      barGrad.addColorStop(1, "#ec4899");
      drawRoundedRect(ctx, barX, barY, fillW, barH, 7, barGrad);
    }

    // Comment
    ctx.fillStyle = "#fbcfe8";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(`"${comment}"`, centerX, 220);
    ctx.textAlign = "left";

    // Footer Watermark
    ctx.fillStyle = "rgba(244, 63, 94, 0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("NAURA HOSHINO V2 • AFFINITY & COMPATIBILITY INTELLIGENCE", 36, H - 16);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderShipCard,
};

