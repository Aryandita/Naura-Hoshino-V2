"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render kartu bursa efek dan grafik performa saham
 */
async function drawStockMarket(stocks = []) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0F172A");
    bgGrad.addColorStop(0.5, "#0A0E1A");
    bgGrad.addColorStop(1, "#030712");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Emerald / Gold Border
    ctx.save();
    ctx.strokeStyle = "#10B981";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#10B981";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header
    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#10B981";
    ctx.fillText("📈 BURSA EFEK VIRTUAL NEO-HOSHINO", 40, 50);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("⚡ SIKLUS HARGA REAL-TIME", width - 40, 50);
    ctx.textAlign = "left";

    // 4. Stock Tickers Grid (Top 4 Stocks)
    const cardW = (width - 110) / 2;
    const cardH = 90;

    stocks.slice(0, 4).forEach((stk, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cardX = 40 + col * (cardW + 30);
      const cardY = 80 + row * (cardH + 15);

      const isUp = (stk.currentPrice || 100) >= (stk.previousPrice || 100);

      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = isUp
        ? "rgba(16, 185, 129, 0.3)"
        : "rgba(239, 68, 68, 0.3)";
      ctx.stroke();

      ctx.font = 'bold 15px "MontserratBold", "EmojiFont"';
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(stk.name || stk.ticker, cardX + 15, cardY + 28);

      ctx.font = 'bold 18px "Orbitron", "EmojiFont"';
      ctx.fillStyle = isUp ? "#34D399" : "#F87171";
      ctx.fillText(`${stk.currentPrice} ⭐`, cardX + 15, cardY + 58);

      ctx.font = '11px "Outfit", "EmojiFont"';
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(
        `Dividen: ${Math.floor((stk.dividendYield || 0.05) * 100)}% | ${isUp ? "▲ Bullish" : "▼ Bearish"}`,
        cardX + 15,
        cardY + 78,
      );
    });

    // 5. Special $NRA Volatile Index Card at Bottom
    const nraStock =
      stocks.find((s) => s.isHighRisk || s.ticker === "NAURA_COIN") ||
      stocks[4];
    if (nraStock) {
      const bottomY = 300;
      ctx.fillStyle = "rgba(236, 72, 153, 0.06)";
      ctx.beginPath();
      ctx.roundRect(40, bottomY, width - 80, 150, 12);
      ctx.fill();
      ctx.strokeStyle = "#EC4899";
      ctx.stroke();

      ctx.font = 'bold 16px "MontserratBold", "EmojiFont"';
      ctx.fillStyle = "#F472B6";
      ctx.fillText(`🔥 HIGH RISK INDEX: ${nraStock.name}`, 60, bottomY + 35);

      ctx.font = 'bold 24px "Orbitron", "EmojiFont"';
      ctx.fillStyle = "#FFD700";
      ctx.fillText(
        `HARGA: ${nraStock.currentPrice} ⭐ / LEMBAR`,
        60,
        bottomY + 75,
      );

      ctx.font = '13px "Outfit", "EmojiFont"';
      ctx.fillStyle = "#E2E8F0";
      ctx.fillText(
        "Indeks dengan volatilitas tinggi (-40% s.d. +60%)! Cocok untuk trader agresif.",
        60,
        bottomY + 110,
      );
      ctx.fillText(
        `Dividen Fantastis: ${Math.floor((nraStock.dividendYield || 0.12) * 100)}% per siklus!`,
        60,
        bottomY + 130,
      );
    }

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawStockMarket,
  renderStockMarket: drawStockMarket,
};
