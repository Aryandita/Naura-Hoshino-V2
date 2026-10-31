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
 * Render Kartu Ramalan & Fortune Harian (720 x 280)
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
async function renderFortuneCard(payload = {}) {
  return runWithLimit("fortuneCard", async () => {
    const {
      username = "Pengguna",
      avatarURL = null,
      fortuneLevel = "Sangat Beruntung",
      stars = 5,
      luckyNumber = 7,
      luckyColor = "Emas",
      luckyItem = "Koin Keberuntungan",
      prediction = "Hari ini semesta memancarkan energi positif untukmu!",
    } = payload;

    const W = 720;
    const H = 280;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Celestial Deep Indigo Gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#080c18");
    bg.addColorStop(0.5, "#0f172a");
    bg.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Glowing Radial Accent
    const glow = ctx.createRadialGradient(W / 2, 80, 20, W / 2, 80, 260);
    glow.addColorStop(0, "rgba(245, 158, 11, 0.15)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Border Frame
    drawRoundedRect(ctx, 12, 12, W - 24, H - 24, 16, null, "rgba(245, 158, 11, 0.3)", 1.5);

    // 2. Avatar (Kiri: 80 x 80)
    const avX = 36;
    const avY = 40;
    const avSize = 80;

    let avDrawn = false;
    if (avatarURL) {
      try {
        const img = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avX, avY, avSize, avSize);
        ctx.restore();
        avDrawn = true;
      } catch (err) {
        logger.warn("[fortuneCanvas:renderFortuneCard] Avatar load fallback: " + (err?.message || err));
      }
    }
    if (!avDrawn) {
      drawRoundedRect(ctx, avX, avY, avSize, avSize, 40, "#1e1b4b", "#f59e0b", 2);
      ctx.fillStyle = "#f59e0b";
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🔮", avX + avSize / 2, avY + 52);
      ctx.textAlign = "left";
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 3. Header & User Identity
    const infoX = 135;
    drawRoundedRect(ctx, infoX, 32, 160, 22, 6, "rgba(245, 158, 11, 0.15)", "#f59e0b", 1);
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.fillText("✦ NAURA DAILY FORTUNE", infoX + 10, 47);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px MontserratBold, InterBold, sans-serif";
    ctx.fillText(username.substring(0, 18), infoX, 80);

    // Fortune Badge & Star Meter
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px InterBold, sans-serif";
    const starStr = "★".repeat(Math.min(5, Math.max(1, stars)));
    ctx.fillText(`${fortuneLevel} (${starStr})`, infoX, 104);

    // 4. Lucky Triad Strip (Kanan Atas)
    const tripX = 420;
    const tripY = 32;
    const tripW = W - tripX - 36;
    drawRoundedRect(ctx, tripX, tripY, tripW, 80, 10, "rgba(15, 23, 42, 0.7)", "rgba(245, 158, 11, 0.2)", 1);

    const colW = tripW / 3;

    // Angka Hoki
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("ANGKA HOKI", tripX + 16, tripY + 28);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 20px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${luckyNumber}`, tripX + 16, tripY + 58);

    // Warna Hoki
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("WARNA HOKI", tripX + colW + 10, tripY + 28);
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 15px MontserratBold, InterBold, sans-serif";
    ctx.fillText(luckyColor.substring(0, 8), tripX + colW + 10, tripY + 56);

    // Benda Hoki
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("BENDA HOKI", tripX + colW * 2 + 10, tripY + 28);
    ctx.fillStyle = "#ec4899";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText(luckyItem.substring(0, 12), tripX + colW * 2 + 10, tripY + 56);

    // 5. Prediction Text Box (Bawah)
    const predY = 135;
    const predW = W - 72;
    drawRoundedRect(ctx, 36, predY, predW, 95, 10, "rgba(15, 23, 42, 0.6)", "rgba(255, 255, 255, 0.06)", 1);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.fillText("🔮 PESAN BINTANG & RAMALAN HARI INI", 52, predY + 28);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px Inter, sans-serif";
    const words = prediction.split(" ");
    let line = "";
    let curY = predY + 52;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      if (ctx.measureText(testLine).width > predW - 36 && i > 0) {
        ctx.fillText(line.trim(), 52, curY);
        line = words[i] + " ";
        curY += 22;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line.trim(), 52, curY);
    }

    // Footer Watermark
    ctx.fillStyle = "rgba(245, 158, 11, 0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("NAURA HOSHINO V2 • CELESTIAL HOROSCOPE & ASTRAL MATRIX", 36, H - 16);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderFortuneCard,
};

