"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual akuarium holografis Vivarium
 */
async function drawVivarium(vivariumData) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const fishes = vivariumData.fishes || [];

    // 1. Deep Ocean Background
    ctx.fillStyle = "#040814";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#082F49");
    bgGrad.addColorStop(0.5, "#0C4A6E");
    bgGrad.addColorStop(1, "#020617");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Cyan Border
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
    ctx.fillText("🌊 HOLOGRAPHIC DEEP-SEA VIVARIUM", 40, 50);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`TIKET PENGUNJUNG: +${vivariumData.hourlyIncome || 0} ⭐/JAM`, width - 40, 50);
    ctx.textAlign = "left";

    // 4. Aquarium Tank Frame
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(40, 80, width - 80, 280, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
    ctx.stroke();

    // Swimming Fishes
    const fishCoords = [
      { x: 100, y: 150 }, { x: 250, y: 220 }, { x: 420, y: 160 },
      { x: 580, y: 240 }, { x: 680, y: 150 }, { x: 180, y: 290 },
      { x: 340, y: 310 }, { x: 500, y: 290 },
    ];

    fishes.slice(0, 8).forEach((f, idx) => {
      const pos = fishCoords[idx] || { x: 100 + idx * 60, y: 200 };
      ctx.font = '42px "EmojiFont"';
      ctx.fillText(f.emoji || "🐟", pos.x, pos.y);
      ctx.font = '10px "Orbitron", "EmojiFont"';
      ctx.fillStyle = f.rarity === "MYTHIC" ? "#FFD700" : f.rarity === "EPIC" ? "#C084FC" : "#38BDF8";
      ctx.fillText(f.name.split(" ")[0], pos.x - 10, pos.y + 20);
    });

    if (fishes.length === 0) {
      ctx.font = '14px "Outfit", "EmojiFont"';
      ctx.fillStyle = "#94A3B8";
      ctx.textAlign = "center";
      ctx.fillText("Akuarium masih kosong. Pancing ikan laut dalam dan tempatkan di sini!", width / 2, 220);
      ctx.textAlign = "left";
    }

    // 5. Bottom Vivarium Stats
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(40, 380, width - 80, 60, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.font = 'bold 12px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`Koleksi Spesies: ${fishes.length} / 10 Ekor`, 60, 415);

    ctx.font = '12px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#86EFAC";
    ctx.textAlign = "right";
    ctx.fillText("Gunakan /survival activity fish aksi:collect untuk klaim koin!", width - 60, 415);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawVivarium,
  renderVivarium: drawVivarium,
};
