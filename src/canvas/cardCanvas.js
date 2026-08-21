const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual kartu anime berkualitas tinggi
 */
async function drawAnimeCard(cardData) {
  return await runWithLimit(async () => {
    const width = 500;
    const height = 750;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const dyeColor = cardData.dyeColor || "#FFB6C1";
    const isGemMint = cardData.quality === "GEM_MINT";

    // 1. Dark Neon Card Outer Glow & Background
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 24);
    ctx.fill();

    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 400);
    bgGrad.addColorStop(0, "#1f1738");
    bgGrad.addColorStop(0.7, "#110e20");
    bgGrad.addColorStop(1, "#07080b");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(20, 20, width - 40, height - 40, 20);
    ctx.fill();

    // 2. Outer Frame Border (Hologram / Gold / Cyber / Dye)
    ctx.save();
    ctx.strokeStyle = dyeColor;
    ctx.lineWidth = isGemMint ? 4 : 2;
    ctx.shadowColor = dyeColor;
    ctx.shadowBlur = isGemMint ? 25 : 12;
    ctx.beginPath();
    ctx.roundRect(25, 25, width - 50, height - 50, 18);
    ctx.stroke();
    ctx.restore();

    // 3. Header: Series Badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.beginPath();
    ctx.roundRect(40, 45, width - 80, 40, 10);
    ctx.fill();

    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = dyeColor;
    ctx.textAlign = "left";
    ctx.fillText((cardData.seriesName || "Anime Realm").toUpperCase(), 55, 70);

    // Print Badge (Top Right)
    ctx.font = 'bold 14px "Orbitron", "EmojiFont"';
    ctx.fillStyle = cardData.printNumber <= 10 ? "#FFD700" : "#FFFFFF";
    ctx.textAlign = "right";
    ctx.fillText(`#${cardData.printNumber}`, width - 55, 70);

    // 4. Character Center Visual Placeholder / Art
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(40, 100, width - 80, 450, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    // Big Character Icon / Symbol
    ctx.font = '72px "EmojiFont"';
    ctx.textAlign = "center";
    ctx.fillText("🌸", width / 2, 340);

    // 5. Character Name Plate
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(40, 565, width - 80, 120, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 182, 193, 0.2)";
    ctx.stroke();

    // Name & Awakening Badge
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    const nameStr = (cardData.characterName || cardData.cardName || "Unknown").substring(0, 18);
    ctx.fillText(nameStr, 60, 600);

    if (cardData.isAwakened) {
      ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
      ctx.fillStyle = "#A855F7";
      ctx.fillText("⚡ AWAKENED", 60 + ctx.measureText(nameStr).width + 12, 600);
    }

    // Inscription / Digital Signature (if present)
    if (cardData.inscription) {
      ctx.font = 'italic 11px "Outfit", "EmojiFont"';
      ctx.fillStyle = "#F9A8D4";
      ctx.fillText(`✍️ "${cardData.inscription.substring(0, 30)}"`, 60, 620);
    }

    // Quality Stars
    const qualityMap = {
      GEM_MINT: { stars: "⭐⭐⭐⭐ GEM MINT", color: "#FFD700" },
      EXCELLENT: { stars: "⭐⭐⭐ EXCELLENT", color: "#86EFAC" },
      GOOD: { stars: "⭐⭐ GOOD", color: "#93C5FD" },
      POOR: { stars: "⭐ POOR", color: "#9CA3AF" },
    };
    const qual = qualityMap[cardData.quality] || qualityMap.GOOD;

    ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
    ctx.fillStyle = qual.color;
    ctx.fillText(qual.stars, 60, cardData.inscription ? 640 : 635);

    // 5.5 SSR & UR & Awakened Holo Shimmer Overlay (Rainbow Hologram Shader)
    const isSSRorUR = cardData.rarity === "SSR" || cardData.rarity === "UR" || cardData.rarity === "SECRET_RARE" || cardData.isAwakened;
    if (isSSRorUR) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const holoGrad = ctx.createLinearGradient(40, 100, width - 40, 550);
      holoGrad.addColorStop(0, "rgba(255, 0, 128, 0.25)");
      holoGrad.addColorStop(0.2, "rgba(255, 200, 0, 0.2)");
      holoGrad.addColorStop(0.4, "rgba(0, 255, 128, 0.25)");
      holoGrad.addColorStop(0.6, "rgba(0, 200, 255, 0.25)");
      holoGrad.addColorStop(0.8, "rgba(128, 0, 255, 0.2)");
      holoGrad.addColorStop(1, "rgba(255, 0, 128, 0.25)");

      ctx.fillStyle = holoGrad;
      ctx.beginPath();
      ctx.roundRect(40, 100, width - 80, 450, 16);
      ctx.fill();

      // Sparkles
      ctx.fillStyle = "#FFFFFF";
      const sparklePositions = [
        [80, 140], [420, 160], [120, 380], [380, 400], [250, 180], [160, 480], [340, 490]
      ];
      for (const [sx, sy] of sparklePositions) {
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - 8, sy);
        ctx.lineTo(sx + 8, sy);
        ctx.moveTo(sx, sy - 8);
        ctx.lineTo(sx, sy + 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Serial Code & Rarity (Bottom)
    ctx.font = '12px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(`CODE: ${cardData.cardCode || "NRA-0000"}`, 60, 668);

    ctx.textAlign = "right";
    ctx.fillStyle = isSSRorUR ? "#FFD700" : dyeColor;
    ctx.fillText((cardData.rarity || "RARE").replace("_", " "), width - 60, 668);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawAnimeCard,
  renderCard: drawAnimeCard,
};
