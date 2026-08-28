"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual ruang 2.5D Guild Hall Lounge
 */
async function drawGuildHall(hallData) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const clanName = hallData.clanName || "Neo Clan";
    const furnitures = hallData.layout ? hallData.layout.furniture || [] : [];

    // 1. Background
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#1E1B4B");
    bgGrad.addColorStop(0.5, "#0F172A");
    bgGrad.addColorStop(1, "#050608");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Border
    ctx.save();
    ctx.strokeStyle = "#F472B6";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#F472B6";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header
    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#F472B6";
    ctx.fillText("🏰 2.5D GUILD HALL & CLAN LOUNGE", 40, 50);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(
      `KAS KLAN: ${(hallData.vault || 0).toLocaleString("id-ID")} ⭐`,
      width - 40,
      50,
    );
    ctx.textAlign = "left";

    // 4. Clan Name
    ctx.font = 'bold 26px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`Klan: ${clanName}`, 40, 95);

    // 5. Center Isometric Room Frame
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(40, 120, width - 80, 240, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    // Room Isometric Elements
    ctx.font = '40px "EmojiFont"';
    ctx.fillText("🛋️", 100, 220); // Sofa
    if (furnitures.includes("coffee_maker")) ctx.fillText("☕", 220, 220);
    if (furnitures.includes("arcade_cabinet")) ctx.fillText("🕹️", 340, 220);
    if (furnitures.includes("sakura_bonsai")) ctx.fillText("🌸", 480, 220);
    if (furnitures.includes("trophy_case")) ctx.fillText("🏆", 620, 220);

    ctx.font = 'bold 14px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#38BDF8";
    ctx.textAlign = "center";
    ctx.fillText(
      "☕ Lounge Barista Aktif: Minum kopi untuk +25 Energy harian!",
      width / 2,
      310,
    );
    ctx.textAlign = "left";

    // 6. Bottom Decor Summary
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(40, 380, width - 80, 80, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#86EFAC";
    ctx.fillText(`🎨 DEKORASI TERPASANG (${furnitures.length} Item):`, 55, 415);

    ctx.font = '12px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#CBD5E1";
    const decorStr =
      furnitures.map((f) => f.replace("_", " ").toUpperCase()).join("  •  ") ||
      "Belum ada furnitur terpasang";
    ctx.fillText(decorStr, 55, 440);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawGuildHall,
  renderGuildHall: drawGuildHall,
};
