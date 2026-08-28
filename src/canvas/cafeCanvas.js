"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");
const { getRecipeById } = require("../survival/data/cafeRecipes");

/**
 * Render visual interior & etalase makanan Cozy Cyber-Cafe
 */
async function drawCafeCard(cafeData) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const themeColors = {
      CYBER_NEON: {
        primary: "#FFB6C1",
        secondary: "#4C1D95",
        accent: "#38BDF8",
      },
      MAID_CLASSIC: {
        primary: "#F9A8D4",
        secondary: "#831843",
        accent: "#FDE047",
      },
      SAKURA_ZEN: {
        primary: "#FDA4AF",
        secondary: "#064E3B",
        accent: "#86EFAC",
      },
    };

    const theme = themeColors[cafeData.theme] || themeColors.CYBER_NEON;
    const level = cafeData.level || 1;
    const rep = cafeData.reputation || 0;
    const uncollected = Number(cafeData.uncollectedRevenue || 0);

    // 1. Background (Dark Glassmorphism)
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, theme.secondary);
    bgGrad.addColorStop(0.6, "#0E0E17");
    bgGrad.addColorStop(1, "#050608");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Border
    ctx.save();
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header: Cafe Title & Badges
    ctx.font = '13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = "left";
    ctx.fillText("☕ COZY CYBER-CAFE & MAID LOUNGE", 40, 50);

    // Badges (Top Right)
    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "right";
    ctx.fillText(`LEVEL ${level}  |  ⭐ ${rep} REP`, width - 40, 50);

    // Cafe Name
    ctx.font = 'bold 28px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.fillText(cafeData.cafeName || "Cyber Maid Lounge", 40, 90);

    // 4. Quick Overview Bar (Idle Revenue & Served Count)
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(40, 115, width - 80, 50, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.font = '13px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#E2E8F0";
    ctx.fillText(`💰 Pendapatan Pasif:`, 55, 146);

    ctx.font = 'bold 14px "Orbitron", "EmojiFont"';
    ctx.fillStyle = uncollected > 0 ? "#86EFAC" : "#9CA3AF";
    ctx.fillText(`${uncollected.toLocaleString("id-ID")} ⭐`, 200, 146);

    ctx.font = '13px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#E2E8F0";
    ctx.textAlign = "right";
    ctx.fillText(`👥 Tamu Dilayani:`, width - 180, 146);

    ctx.font = 'bold 14px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#38BDF8";
    ctx.fillText(`${cafeData.customersServed || 0}`, width - 55, 146);
    ctx.textAlign = "left";

    // 5. Active Dishes Showcase Grid (Bottom Area)
    ctx.font = 'bold 15px "Orbitron", "EmojiFont"';
    ctx.fillStyle = theme.primary;
    ctx.fillText("🍽️ ETALASE MENU SIAP SAJI", 40, 200);

    const dishes = cafeData.activeDishes || {};
    const dishEntries = Object.entries(dishes).filter(
      ([, count]) => Number(count) > 0,
    );

    if (dishEntries.length === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(40, 220, width - 80, 230, 14);
      ctx.fill();

      ctx.font = '15px "Outfit", "EmojiFont"';
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.textAlign = "center";
      ctx.fillText(
        "Etalase masih kosong! Masak hidangan baru dengan /survival cafe cook",
        width / 2,
        340,
      );
    } else {
      const cardW = (width - 110) / 3;
      const cardH = 230;

      dishEntries.slice(0, 3).forEach(([recipeId, count], idx) => {
        const recipe = getRecipeById(recipeId) || {
          name: recipeId,
          emoji: "🍱",
          price: 200,
          buff: { description: "Buff Khusus" },
        };
        const cardX = 40 + idx * (cardW + 15);
        const cardY = 220;

        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 12);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.stroke();

        // Emoji & Title
        ctx.font = '36px "EmojiFont"';
        ctx.textAlign = "center";
        ctx.fillText(recipe.emoji || "🍽️", cardX + cardW / 2, cardY + 50);

        ctx.font = 'bold 14px "Outfit", "EmojiFont"';
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(
          recipe.name.substring(0, 18),
          cardX + cardW / 2,
          cardY + 85,
        );

        // Stock Badge
        ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
        ctx.fillStyle = "#86EFAC";
        ctx.fillText(`STOK: ${count} PORSI`, cardX + cardW / 2, cardY + 115);

        // Price
        ctx.font = '12px "Orbitron", "EmojiFont"';
        ctx.fillStyle = "#FFD700";
        ctx.fillText(
          `${recipe.price || 200} ⭐ / porsi`,
          cardX + cardW / 2,
          cardY + 140,
        );

        // Buff description
        ctx.font = '11px "Outfit", "EmojiFont"';
        ctx.fillStyle = "#93C5FD";
        const buffDesc = recipe.buff ? recipe.buff.description : "+Buff Khusus";
        ctx.fillText(buffDesc.substring(0, 24), cardX + cardW / 2, cardY + 185);
      });
    }

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawCafeCard,
  renderCafeCard: drawCafeCard,
};
