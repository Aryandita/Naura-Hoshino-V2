const path = require("path");
const { createCanvas, loadImage } = require("./canvasRuntime");

function drawRoundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius,
  fillStyle,
  strokeStyle,
  lineWidth = 1,
) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Render Kamar Isometrik 2.5D Naura Living Room
 * @param {Object} roomData
 * @param {Object} user
 * @param {Object} pet
 * @returns {Promise<Buffer>}
 */
async function renderRoomCanvas(roomData, user, pet = null, options = {}) {
  const is2K = options.resolution === "2k" || options.highFidelity || false;
  const scale = is2K ? 2 : 1;
  const W = 960;
  const H = 560;
  const canvas = createCanvas(W * scale, H * scale);
  const ctx = canvas.getContext("2d");
  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  const displayName =
    roomData.displayName || user?.displayName || user?.username || "Pengelana";
  const level = roomData.level || 1;
  const comfort = roomData.comfortScore || 100;
  const likes = roomData.likesCount || 0;

  // 1. Cyber Midnight Canvas Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#070A10");
  bgGrad.addColorStop(0.5, "#0D1322");
  bgGrad.addColorStop(1, "#151026");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Ambient Radial Glow
  ctx.save();
  const radGlow = ctx.createRadialGradient(W / 2, 280, 20, W / 2, 280, 420);
  radGlow.addColorStop(0, "rgba(6, 182, 212, 0.25)");
  radGlow.addColorStop(0.6, "rgba(192, 132, 252, 0.1)");
  radGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 3. 2.5D Isometric Room Walls & Floor
  const originX = W / 2;
  const originY = 320;
  const tileW = 64;
  const tileH = 32;
  const gridSize = 6;

  // Isometric Floor Grid
  ctx.save();
  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      const isoX = originX + (gx - gy) * (tileW / 2);
      const isoY = originY + (gx + gy) * (tileH / 2) - 100;

      ctx.beginPath();
      ctx.moveTo(isoX, isoY);
      ctx.lineTo(isoX + tileW / 2, isoY + tileH / 2);
      ctx.lineTo(isoX, isoY + tileH);
      ctx.lineTo(isoX - tileW / 2, isoY + tileH / 2);
      ctx.closePath();

      const isPreviewTile =
        options.previewPlacement &&
        Number(options.previewPlacement.x) === gx &&
        Number(options.previewPlacement.y) === gy;

      if (isPreviewTile) {
        ctx.fillStyle = "rgba(6, 182, 212, 0.45)";
        ctx.fill();
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        const isEven = (gx + gy) % 2 === 0;
        ctx.fillStyle = isEven
          ? "rgba(18, 24, 38, 0.85)"
          : "rgba(13, 17, 28, 0.85)";
        ctx.fill();
        ctx.strokeStyle = "rgba(6, 182, 212, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Left Wall (Isometric Back-Left)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    originX - (gridSize * tileW) / 2,
    originY - 100 + (gridSize * tileH) / 2,
  );
  ctx.lineTo(originX, originY - 100);
  ctx.lineTo(originX, originY - 260);
  ctx.lineTo(
    originX - (gridSize * tileW) / 2,
    originY - 260 + (gridSize * tileH) / 2,
  );
  ctx.closePath();
  ctx.fillStyle = "rgba(10, 14, 24, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.stroke();
  ctx.restore();

  // Right Wall (Isometric Back-Right)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(originX, originY - 100);
  ctx.lineTo(
    originX + (gridSize * tileW) / 2,
    originY - 100 + (gridSize * tileH) / 2,
  );
  ctx.lineTo(
    originX + (gridSize * tileW) / 2,
    originY - 260 + (gridSize * tileH) / 2,
  );
  ctx.lineTo(originX, originY - 260);
  ctx.closePath();
  ctx.fillStyle = "rgba(15, 20, 32, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.stroke();
  ctx.restore();

  // 4. Wall Mounted Live Holo-Card Frame (Left Wall)
  const holoX = originX - 140;
  const holoY = originY - 220;
  drawRoundedRect(
    ctx,
    holoX - 35,
    holoY - 10,
    70,
    95,
    8,
    "rgba(6, 182, 212, 0.15)",
    "#06B6D4",
    1.5,
  );

  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillStyle = "#06B6D4";
  ctx.textAlign = "center";
  ctx.fillText("HOLO-CARD", holoX, holoY + 5);
  ctx.font = "24px sans-serif";
  ctx.fillText("🎴", holoX, holoY + 40);
  ctx.font = 'bold 8px "Outfit", sans-serif';
  ctx.fillStyle = "#E2E8F0";
  ctx.fillText(
    roomData.holoCardName ? roomData.holoCardName.slice(0, 10) : "Waifu Frame",
    holoX,
    holoY + 70,
  );

  // 5. Furniture Items Placement (Icons & Capsules)
  const furniture =
    roomData.furniture && roomData.furniture.length > 0
      ? roomData.furniture
      : [
          { name: "Cyber Bed", icon: "🛏️", x: 1, y: 1 },
          { name: "Kotatsu Table", icon: "🍵", x: 3, y: 3 },
          { name: "Neon Synthesizer", icon: "🎹", x: 4, y: 1 },
          { name: "Bonsai Plant", icon: "🪴", x: 1, y: 4 },
        ];

  for (const item of furniture) {
    const fx = item.x || 2;
    const fy = item.y || 2;
    const itemX = originX + (fx - fy) * (tileW / 2);
    const itemY = originY + (fx + fy) * (tileH / 2) - 100;

    // Item shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(itemX, itemY + tileH / 2, 20, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fill();

    // Item Icon
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(6, 182, 212, 0.6)";
    ctx.shadowBlur = 10;
    ctx.fillText(item.icon || "🛋️", itemX, itemY + 8);
    ctx.restore();
  }

  // 5b. Live Placement Preview Hologram Indicator
  if (options.previewPlacement) {
    const px = Math.max(
      0,
      Math.min(gridSize - 1, Number(options.previewPlacement.x) || 0),
    );
    const py = Math.max(
      0,
      Math.min(gridSize - 1, Number(options.previewPlacement.y) || 0),
    );
    const prevX = originX + (px - py) * (tileW / 2);
    const prevY = originY + (px + py) * (tileH / 2) - 100;

    ctx.save();
    // Holographic pulsing ground target
    ctx.beginPath();
    ctx.ellipse(prevX, prevY + tileH / 2, 24, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();

    // Preview Item Icon
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#38BDF8";
    ctx.shadowBlur = 15;
    ctx.fillText(options.previewPlacement.icon || "✨", prevX, prevY + 6);

    // Floating Placement Badge
    drawRoundedRect(
      ctx,
      prevX - 55,
      prevY - 36,
      110,
      22,
      6,
      "rgba(14, 165, 233, 0.85)",
      "#E0F2FE",
      1,
    );
    ctx.fillStyle = "#FFFFFF";
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.shadowBlur = 0;
    ctx.fillText(`PREVIEW (${px}, ${py})`, prevX, prevY - 22);
    ctx.restore();
  }

  // 6. Chibi Naura Living Companion in Room
  try {
    const nauraImgPath = path.join(
      __dirname,
      "../../assets/Naura_Expression/Happy.png",
    );
    const nauraImg = await loadImage(nauraImgPath);
    const nauraW = 92;
    const nauraH = 92;
    const nauraX = originX - 90;
    const nauraY = originY - 110;

    // Shadow under Naura
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      nauraX + nauraW / 2,
      nauraY + nauraH - 6,
      26,
      10,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fill();
    ctx.drawImage(nauraImg, nauraX, nauraY, nauraW, nauraH);

    // Speech bubble
    drawRoundedRect(
      ctx,
      nauraX - 35,
      nauraY - 26,
      130,
      24,
      10,
      "rgba(15, 23, 42, 0.88)",
      "#FFB6C1",
      1,
    );
    ctx.textAlign = "center";
    ctx.font = 'bold 10px "Outfit", sans-serif';
    ctx.fillStyle = "#FFB6C1";
    ctx.fillText("Naura menemanimu! ✨", nauraX + 30, nauraY - 10);
    ctx.restore();
  } catch (_) {}

  // 7. Active Pet (Walking / Sleeping on Floor)
  const petX = originX + 30;
  const petY = originY - 40;
  ctx.save();
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "#FFB6C1";
  ctx.shadowBlur = 12;
  ctx.fillText(pet?.icon || "🐾", petX, petY);
  ctx.restore();

  // 7. Top Header Glass Bar (Room Stats)
  drawRoundedRect(
    ctx,
    24,
    20,
    W - 48,
    64,
    16,
    "rgba(13, 17, 23, 0.8)",
    "rgba(255, 255, 255, 0.1)",
    1,
  );

  // Avatar in Top Left
  const avSize = 44;
  try {
    const avatarUrl = user?.displayAvatarURL
      ? user.displayAvatarURL({ extension: "png", size: 128 })
      : user?.avatarURL;
    if (avatarUrl) {
      const img = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(52, 52, avSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 52 - avSize / 2, 52 - avSize / 2, avSize, avSize);
      ctx.restore();
    }
  } catch (_) {
    drawRoundedRect(ctx, 30, 30, avSize, avSize, avSize / 2, "#1E2633");
  }

  // Room Title & Owner
  ctx.textAlign = "left";
  ctx.font = 'bold 18px "Orbitron", sans-serif';
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`${displayName}'s Cyber Pod`, 88, 46);

  ctx.font = '12px "Outfit", sans-serif';
  ctx.fillStyle = "#8E98B0";
  ctx.fillText(
    `Kenyamanan: ${comfort}/1000 · ${furniture.length} Furnitur Terpasang`,
    88,
    68,
  );

  // Top Right Metrics: Level & Likes
  ctx.textAlign = "right";
  ctx.font = 'bold 15px "Orbitron", sans-serif';
  ctx.fillStyle = "#06B6D4";
  ctx.fillText(`ROOM LVL ${level}`, W - 48, 46);

  ctx.font = 'bold 13px "Outfit", sans-serif';
  ctx.fillStyle = "#FFB6C1";
  ctx.fillText(`${likes} Likes ❤️`, W - 48, 68);

  // 8. Outer Glass Frame
  drawRoundedRect(
    ctx,
    16,
    12,
    W - 32,
    H - 24,
    20,
    null,
    "rgba(255, 255, 255, 0.08)",
    1.5,
  );

  const mimeType = options.format === "webp" ? "image/webp" : "image/png";
  return canvas.toBuffer(mimeType);
}

module.exports = {
  renderRoomCanvas,
};
