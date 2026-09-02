"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual greenhouse hydroponic pods
 */
async function renderGreenhouseCard(greenhouseData) {
  return await runWithLimit(async () => {
    const width = 850;
    const height = 520;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const primaryColor = "#10B981"; // Emerald green
    const secondaryColor = "#064E3B";
    const accentColor = "#34D399";

    // 1. Background (Dark Glassmorphism)
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, secondaryColor);
    bgGrad.addColorStop(0.5, "#0A1F18");
    bgGrad.addColorStop(1, "#050B08");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Border
    ctx.save();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header
    ctx.font = '13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = accentColor;
    ctx.textAlign = "left";
    ctx.fillText("🌿 CYBER-AGRONOMY & HYDROPONIC GREENHOUSE", 40, 50);

    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "right";
    ctx.fillText(
      `GRID LV.${greenhouseData.gridLevel}  |  🌾 ${greenhouseData.totalHarvests || 0} TOTAL PANEN`,
      width - 40,
      50,
    );

    // Title
    ctx.font = 'bold 24px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.fillText("Lahan Hidroponik Otomatis", 40, 85);

    // Separator
    ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 105);
    ctx.lineTo(width - 40, 105);
    ctx.stroke();

    // 4. Hydroponic Pods Grid (up to 6 slots)
    const slots = greenhouseData.slots || [];
    const cols = 3;
    const startX = 40;
    const startY = 125;
    const podWidth = 240;
    const podHeight = 165;
    const gapX = 25;
    const gapY = 20;

    slots.forEach((slot, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = startX + col * (podWidth + gapX);
      const y = startY + row * (podHeight + gapY);

      // Pod Background
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.roundRect(x, y, podWidth, podHeight, 12);
      ctx.fill();

      // Pod Border
      ctx.strokeStyle = slot.isEmpty
        ? "rgba(255, 255, 255, 0.1)"
        : slot.isMature
          ? "#FBBF24"
          : "rgba(16, 185, 129, 0.5)";
      ctx.lineWidth = slot.isMature ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, podWidth, podHeight, 12);
      ctx.stroke();

      // Pod Header
      ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
      ctx.fillStyle = slot.isMature ? "#FBBF24" : accentColor;
      ctx.textAlign = "left";
      ctx.fillText(`POD #${idx + 1}`, x + 15, y + 25);

      if (slot.isEmpty) {
        ctx.font = '13px "Inter", "EmojiFont"';
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.textAlign = "center";
        ctx.fillText("Lahan Kosong", x + podWidth / 2, y + podHeight / 2);
        ctx.font = '10px "Inter", "EmojiFont"';
        ctx.fillText("Siap Ditanami", x + podWidth / 2, y + podHeight / 2 + 20);
      } else {
        const seed = slot.seed || {};
        ctx.font = 'bold 14px "MontserratBold", "EmojiFont"';
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.fillText(`${seed.emoji || "🌱"} ${seed.name || "Tanaman"}`, x + 15, y + 52);

        // Status / Stage Badge
        ctx.font = '11px "Inter", "EmojiFont"';
        ctx.fillStyle = slot.isMature ? "#34D399" : "#A7F3D0";
        const statusText = slot.isMature
          ? "✨ Siap Dipanen!"
          : `⏳ ${slot.stage} (${slot.remainingMinutes}m)`;
        ctx.fillText(statusText, x + 15, y + 75);

        // Progress Bar
        const barX = x + 15;
        const barY = y + 90;
        const barW = podWidth - 30;
        const barH = 10;

        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 5);
        ctx.fill();

        const fillW = Math.max(6, (barW * (slot.progressPercent || 0)) / 100);
        ctx.fillStyle = slot.isMature ? "#FBBF24" : "#10B981";
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillW, barH, 5);
        ctx.fill();

        // Footer details
        ctx.font = '10px "Inter", "EmojiFont"';
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.fillText(`💧 Kelembaban: ${slot.moisture || 100}%`, x + 15, y + 125);

        if (slot.isFertilized) {
          ctx.fillStyle = "#F59E0B";
          ctx.fillText("⚡ Terpupuk (+50% Panen)", x + 15, y + 145);
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fillText("Pupuk: Belum aktif", x + 15, y + 145);
        }
      }
    });

    // 5. Footer info
    ctx.font = '11px "Inter", "EmojiFont"';
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText(
      "Gunakan /survival farm plant/water/harvest untuk merawat greenhouse.",
      width / 2,
      height - 25,
    );

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderGreenhouseCard,
};
