"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

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
 * Render Kartu Tarot Mistis (440 x 660)
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
async function renderTarotCard(payload = {}) {
  return runWithLimit("tarotCard", async () => {
    const {
      cardName = "The Star",
      cardNumeral = "XVII",
      arcana = "Major Arcana",
      orientation = "Upright",
      keywords = "Harapan, Inspirasi, Ketenangan",
      summary = "Bintang membawa kedamaian dan harapan baru dalam perjalananmu.",
      symbol = "⭐",
    } = payload;

    const W = 440;
    const H = 660;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Deep Occult Midnight Violet Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0614");
    bg.addColorStop(0.5, "#150d2a");
    bg.addColorStop(1, "#1c1138");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Glowing Occult Orb
    const glow = ctx.createRadialGradient(W / 2, 260, 20, W / 2, 260, 220);
    glow.addColorStop(0, "rgba(245, 158, 11, 0.2)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Double Border with Gold Inlay
    drawRoundedRect(ctx, 16, 16, W - 32, H - 32, 20, null, "rgba(245, 158, 11, 0.4)", 2);
    drawRoundedRect(ctx, 24, 24, W - 48, H - 48, 16, null, "rgba(255, 255, 255, 0.08)", 1);

    // Corner Accents
    ctx.fillStyle = "#f59e0b";
    ctx.font = "14px sans-serif";
    ctx.fillText("✦", 32, 42);
    ctx.fillText("✦", W - 42, 42);
    ctx.fillText("✦", 32, H - 32);
    ctx.fillText("✦", W - 42, H - 32);

    // Header Roman Numeral
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 16px MontserratBold, serif";
    ctx.textAlign = "center";
    ctx.fillText(cardNumeral, W / 2, 64);

    // Card Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px MontserratBold, InterBold, sans-serif";
    ctx.fillText(cardName.toUpperCase(), W / 2, 98);

    // Arcana & Orientation Pill
    const tagText = `${arcana.toUpperCase()} • ${orientation.toUpperCase()}`;
    ctx.font = "bold 11px InterBold, sans-serif";
    const tagW = ctx.measureText(tagText).width + 24;
    drawRoundedRect(ctx, W / 2 - tagW / 2, 114, tagW, 24, 6, "rgba(245, 158, 11, 0.15)", "#f59e0b", 1);
    ctx.fillStyle = "#fde68a";
    ctx.fillText(tagText, W / 2, 130);

    // Central Mystic Art Frame (240 x 240)
    const artSize = 220;
    const artX = W / 2 - artSize / 2;
    const artY = 160;
    drawRoundedRect(ctx, artX, artY, artSize, artSize, 14, "rgba(15, 10, 30, 0.7)", "rgba(245, 158, 11, 0.3)", 1.5);

    // Mystic Circles in Center
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, artY + artSize / 2, 80, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2, artY + artSize / 2, 60, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(168, 85, 247, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Central Symbol
    ctx.font = "72px sans-serif";
    ctx.fillText(symbol, W / 2, artY + artSize / 2 + 25);

    // Keywords Section
    const keyY = 425;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText("✦ KATA KUNCI ✦", W / 2, keyY);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(keywords, W / 2, keyY + 26);

    // Summary Interpretation Box
    const sumY = 485;
    const sumW = W - 80;
    drawRoundedRect(ctx, 40, sumY, sumW, 100, 10, "rgba(10, 8, 20, 0.6)", "rgba(255, 255, 255, 0.06)", 1);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Inter, sans-serif";
    const words = summary.split(" ");
    let line = "";
    let curY = sumY + 30;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      if (ctx.measureText(testLine).width > sumW - 32 && i > 0) {
        ctx.fillText(line.trim(), W / 2, curY);
        line = words[i] + " ";
        curY += 22;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line.trim(), W / 2, curY);
    }

    // Footer Watermark
    ctx.fillStyle = "rgba(245, 158, 11, 0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("NAURA HOSHINO V2 • TAROT & CELESTIAL DIVINATION", W / 2, H - 32);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderTarotCard,
};

