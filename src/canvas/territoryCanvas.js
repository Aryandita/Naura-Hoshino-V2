"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render peta taktis wilayah klan Neo-Hoshino
 */
async function drawTerritoryMap(territories = []) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background (Tactical Grid)
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0F172A");
    bgGrad.addColorStop(0.5, "#090D16");
    bgGrad.addColorStop(1, "#040608");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Border
    ctx.save();
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#38BDF8";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header
    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#38BDF8";
    ctx.fillText("🗺️ PETA DOMINASI WILAYAH KLAN (NEO-HOSHINO)", 40, 50);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("🏰 5 SEKTOR STRATEGIS", width - 40, 50);
    ctx.textAlign = "left";

    // 4. Sector Cards Grid (5 Sektor)
    const cardW = (width - 110) / 2;
    const cardH = 110;

    territories.slice(0, 4).forEach((terr, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cardX = 40 + col * (cardW + 30);
      const cardY = 80 + row * (cardH + 20);

      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.stroke();

      ctx.font = 'bold 14px "MontserratBold", "EmojiFont"';
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(terr.name || "Sektor", cardX + 15, cardY + 30);

      ctx.font = '12px "Outfit", "EmojiFont"';
      ctx.fillStyle = terr.clanName ? "#86EFAC" : "#94A3B8";
      ctx.fillText(`Penguasa: ${terr.clanName || "Netral / Liar"}`, cardX + 15, cardY + 55);

      ctx.font = '11px "Orbitron", "EmojiFont"';
      ctx.fillStyle = "#F59E0B";
      ctx.fillText(`Poin Kontrol: ${terr.controlPoints || 0} / 1000`, cardX + 15, cardY + 75);

      ctx.font = '11px "Outfit", "EmojiFont"';
      ctx.fillStyle = "#38BDF8";
      ctx.fillText(`Pajak: ${terr.taxYield || 500} ⭐/jam`, cardX + 15, cardY + 95);
    });

    // 5. Center Sektor 5 (Babel Citadel / Central Hub)
    if (territories.length >= 5) {
      const terr5 = territories[4];
      const bottomY = 340;
      ctx.fillStyle = "rgba(255, 215, 0, 0.05)";
      ctx.beginPath();
      ctx.roundRect(40, bottomY, width - 80, 110, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 215, 0, 0.2)";
      ctx.stroke();

      ctx.font = 'bold 16px "MontserratBold", "EmojiFont"';
      ctx.fillStyle = "#FFD700";
      ctx.fillText(`👑 SEKTOR UTAMA: ${terr5.name}`, 60, bottomY + 35);

      ctx.font = '13px "Outfit", "EmojiFont"';
      ctx.fillStyle = terr5.clanName ? "#86EFAC" : "#94A3B8";
      ctx.fillText(`Klan Penguasa: ${terr5.clanName || "Belum Dikuasai"} | Poin Kontrol: ${terr5.controlPoints || 0}`, 60, bottomY + 65);

      ctx.font = '12px "Outfit", "EmojiFont"';
      ctx.fillStyle = "#E2E8F0";
      ctx.fillText(`Efek Bonus: ${terr5.buffEffect || "+Bonus Klan"} | Pajak: ${terr5.taxYield || 1000} ⭐/jam`, 60, bottomY + 90);
    }

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawTerritoryMap,
  renderTerritoryMap: drawTerritoryMap,
};
