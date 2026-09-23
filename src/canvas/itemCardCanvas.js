"use strict";

const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");

/**
 * Memotong teks agar pas dengan lebar canvas
 */
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Render visual kartu inspeksi item RPG holografis (640x360)
 * @param {object} item
 * @param {object} [options]
 * @returns {Promise<Buffer>}
 */
async function renderItemCard(item, options = {}) {
  return await runWithLimit(async () => {
    const is2K = options.resolution === "2k" || options.highFidelity || false;
    const scale = is2K ? 2 : 1;
    const width = 640;
    const height = 360;
    const canvas = createCanvas(width * scale, height * scale);
    const ctx = canvas.getContext("2d");
    if (scale !== 1) {
      ctx.scale(scale, scale);
    }

    const tierColor = item.tierColor || "#9CA3AF";
    const tier = Math.max(1, Math.min(6, item.tier || 1));
    const rarity = item.rarity || "Common";
    const category = (item.category || "item").toUpperCase();

    // 1. Base Dark Cyberpunk Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0c0e14");
    bgGrad.addColorStop(0.5, "#10141f");
    bgGrad.addColorStop(1, "#07090d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle Cyber Grid Accent
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Radial Glow from Top Left & Center
    const glowGrad = ctx.createRadialGradient(100, 100, 10, 100, 100, 260);
    glowGrad.addColorStop(0, `${tierColor}33`);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, width, height);

    // 4. Outer Container Frame with Tier Glow
    ctx.save();
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(16, 16, width - 32, height - 32, 16);
    ctx.stroke();
    ctx.restore();

    // 5. Left Slot: Item Hologram Box (160x160)
    const boxX = 36;
    const boxY = 46;
    const boxSize = 164;

    ctx.fillStyle = "rgba(18, 22, 34, 0.85)";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxSize, boxSize, 14);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxSize, boxSize, 14);
    ctx.stroke();

    // Corner Accents for Hologram Box
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 3;
    const cornerLen = 12;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + cornerLen);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + cornerLen, boxY);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(boxX + boxSize - cornerLen, boxY + boxSize);
    ctx.lineTo(boxX + boxSize, boxY + boxSize);
    ctx.lineTo(boxX + boxSize, boxY + boxSize - cornerLen);
    ctx.stroke();

    // Load & Draw SVG / PNG Icon
    try {
      const svgPath = path.join(
        __dirname,
        "../../assets/items",
        `${item.id}.svg`,
      );
      let img = null;
      if (fs.existsSync(svgPath)) {
        const svgBuf = fs.readFileSync(svgPath);
        img = await loadImage(svgBuf);
      }
      if (img) {
        const imgSize = 120;
        const imgX = boxX + (boxSize - imgSize) / 2;
        const imgY = boxY + (boxSize - imgSize) / 2;
        ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
      } else {
        ctx.font = "64px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          item.emoji || "📦",
          boxX + boxSize / 2,
          boxY + boxSize / 2,
        );
      }
    } catch (err) {
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.emoji || "📦", boxX + boxSize / 2, boxY + boxSize / 2);
    }

    // Badge Under Item Box: Rarity & Tier
    const badgeY = boxY + boxSize + 14;
    ctx.fillStyle = `${tierColor}26`;
    ctx.beginPath();
    ctx.roundRect(boxX, badgeY, boxSize, 32, 8);
    ctx.fill();

    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, badgeY, boxSize, 32, 8);
    ctx.stroke();

    ctx.fillStyle = tierColor;
    ctx.font = "bold 13px 'Montserrat', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `T${tier} ${rarity.toUpperCase()}`,
      boxX + boxSize / 2,
      badgeY + 16,
    );

    // Stars below badge
    let starStr = "";
    for (let s = 0; s < tier; s++) starStr += "★";
    for (let s = tier; s < 6; s++) starStr += "☆";
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(starStr, boxX + boxSize / 2, badgeY + 44);

    // 6. Right Side Content
    const rightX = 224;
    let currY = 46;

    // Category Tag
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(rightX, currY, 110, 24, 6);
    ctx.fill();

    ctx.fillStyle = "#94A3B8";
    ctx.font = "bold 11px 'Montserrat', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(category, rightX + 12, currY + 12);

    // Item Name
    currY += 40;
    ctx.fillStyle = "#F8FAFC";
    ctx.font = "bold 22px 'Montserrat', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(item.name || "Item Tanpa Nama", rightX, currY);

    // Item Lore / Description (wrapped)
    currY += 34;
    ctx.fillStyle = "#94A3B8";
    ctx.font = "13px 'Montserrat', sans-serif";
    const descLines = wrapText(
      ctx,
      item.description || "Tidak ada deskripsi.",
      width - rightX - 40,
    );
    for (let i = 0; i < Math.min(descLines.length, 3); i++) {
      ctx.fillText(descLines[i], rightX, currY + i * 18);
    }

    // 7. Stats Grid (Attack, Defense, Durability, Heal, Energy, etc.)
    currY += Math.min(descLines.length, 3) * 18 + 14;

    const stats = [];
    if (item.attack)
      stats.push({ label: "ATK", value: `+${item.attack}`, color: "#F43F5E" });
    if (item.defense)
      stats.push({ label: "DEF", value: `+${item.defense}`, color: "#38BDF8" });
    if (item.durability)
      stats.push({
        label: "DUR",
        value: `${item.durability}`,
        color: "#A855F7",
      });
    if (item.heal)
      stats.push({ label: "HEAL", value: `+${item.heal}`, color: "#10B981" });
    if (item.energy)
      stats.push({ label: "ENRG", value: `+${item.energy}`, color: "#F59E0B" });
    if (item.speed)
      stats.push({ label: "SPD", value: `+${item.speed}`, color: "#EC4899" });
    if (item.critRate)
      stats.push({
        label: "CRIT",
        value: `${item.critRate}%`,
        color: "#EAB308",
      });

    if (stats.length > 0) {
      let statX = rightX;
      for (const st of stats.slice(0, 4)) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(statX, currY, 82, 34, 6);
        ctx.fill();

        ctx.fillStyle = "#64748B";
        ctx.font = "bold 10px 'Montserrat', sans-serif";
        ctx.fillText(st.label, statX + 8, currY + 6);

        ctx.fillStyle = st.color;
        ctx.font = "bold 13px 'Montserrat', sans-serif";
        ctx.fillText(st.value, statX + 8, currY + 18);

        statX += 90;
      }
      currY += 46;
    } else {
      currY += 12;
    }

    // 8. Economics Bottom Bar (Price & Sell Price)
    const econY = height - 60;
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.beginPath();
    ctx.roundRect(rightX, econY, width - rightX - 36, 32, 8);
    ctx.fill();

    ctx.font = "12px 'Montserrat', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#E2E8F0";
    ctx.fillText("Beli:", rightX + 12, econY + 16);
    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 13px 'Montserrat', sans-serif";
    ctx.fillText(`${item.price || 0} NSF`, rightX + 44, econY + 16);

    ctx.fillStyle = "#E2E8F0";
    ctx.font = "12px 'Montserrat', sans-serif";
    ctx.fillText("Jual:", rightX + 150, econY + 16);
    ctx.fillStyle = "#10B981";
    ctx.font = "bold 13px 'Montserrat', sans-serif";
    ctx.fillText(`${item.sellPrice || 0} NSF`, rightX + 182, econY + 16);

    // Brand Watermark
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "9px 'Montserrat', sans-serif";
    ctx.textAlign = "right";
    const mimeType = options.format === "webp" ? "image/webp" : "image/png";
    return canvas.toBuffer(mimeType);
  });
}

module.exports = {
  renderItemCard,
};
