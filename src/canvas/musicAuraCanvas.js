"use strict";

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
 * Render visual kartu Music Aura bertenaga AI (800x450)
 * @param {object} data - { username, avatarUrl, auraName, description, primaryColor, secondaryColor, signatureTrack, genres, energy, tempo }
 * @returns {Promise<Buffer>}
 */
async function renderMusicAura(data) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const username = data.username || "Petualang";
    const auraName = (data.auraName || "ASTRAL MELODIC VOYAGER").toUpperCase();
    const primaryColor = data.primaryColor || "#38BDF8";
    const secondaryColor = data.secondaryColor || "#C084FC";
    const signatureTrack = data.signatureTrack || "Lagu Favorit Komunitas";
    const description =
      data.description ||
      "Jiwa musikmu memancarkan resonansi frekuensi kosmik yang tenang, memadukan ketukan ritmis dengan harmoni melankolis nan indah.";
    const genres =
      Array.isArray(data.genres) && data.genres.length > 0
        ? data.genres.slice(0, 3)
        : ["Lo-Fi", "Electronic", "Anime"];

    // 1. Dark Cyber Ambient Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#080a10");
    bgGrad.addColorStop(0.5, "#0d111d");
    bgGrad.addColorStop(1, "#05070a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Dual Aura Glow Orbs
    const auraOrb1 = ctx.createRadialGradient(220, 180, 20, 220, 180, 320);
    auraOrb1.addColorStop(0, `${primaryColor}40`);
    auraOrb1.addColorStop(0.7, `${primaryColor}10`);
    auraOrb1.addColorStop(1, "transparent");
    ctx.fillStyle = auraOrb1;
    ctx.fillRect(0, 0, width, height);

    const auraOrb2 = ctx.createRadialGradient(620, 280, 30, 620, 280, 360);
    auraOrb2.addColorStop(0, `${secondaryColor}38`);
    auraOrb2.addColorStop(0.7, `${secondaryColor}0c`);
    auraOrb2.addColorStop(1, "transparent");
    ctx.fillStyle = auraOrb2;
    ctx.fillRect(0, 0, width, height);

    // 3. Glassmorphism Card Frame
    ctx.save();
    const frameGrad = ctx.createLinearGradient(0, 0, width, height);
    frameGrad.addColorStop(0, primaryColor);
    frameGrad.addColorStop(0.5, secondaryColor);
    frameGrad.addColorStop(1, "#38BDF8");
    ctx.strokeStyle = frameGrad;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(16, 16, width - 32, height - 32, 18);
    ctx.stroke();
    ctx.restore();

    // 4. Left Column: Avatar & Vibe Pod
    const avatarCenterX = 135;
    const avatarCenterY = 160;
    const avatarRadius = 60;

    // Outer Aura Ring
    ctx.save();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    let avatarDrawn = false;
    if (data.avatarUrl) {
      try {
        const avatarImg = await loadImage(data.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
          avatarImg,
          avatarCenterX - avatarRadius,
          avatarCenterY - avatarRadius,
          avatarRadius * 2,
          avatarRadius * 2,
        );
        ctx.restore();
        avatarDrawn = true;
      } catch (err) {}
    }

    if (!avatarDrawn) {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = primaryColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        username.charAt(0).toUpperCase(),
        avatarCenterX,
        avatarCenterY,
      );
    }

    // Username under Avatar
    ctx.font = "bold 16px 'Montserrat', sans-serif";
    ctx.fillStyle = "#F8FAFC";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const displayUser =
      username.length > 15 ? username.substring(0, 14) + "..." : username;
    ctx.fillText(displayUser, avatarCenterX, avatarCenterY + avatarRadius + 14);

    // Pill: Genre Badges
    let genreY = avatarCenterY + avatarRadius + 44;
    for (const g of genres) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.roundRect(avatarCenterX - 55, genreY, 110, 22, 11);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(avatarCenterX - 55, genreY, 110, 22, 11);
      ctx.stroke();

      ctx.font = "bold 10px 'Montserrat', sans-serif";
      ctx.fillStyle = "#CBD5E1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(g, avatarCenterX, genreY + 11);

      genreY += 28;
    }

    // 5. Right Column: Music Aura & Analytics
    const contentX = 245;
    let currY = 44;

    // Header Label
    ctx.font = "bold 11px 'Montserrat', sans-serif";
    ctx.fillStyle = primaryColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("🎵 AURAL RESONANCE IDENTITY", contentX, currY);

    // Grand Aura Title
    currY += 20;
    const titleGrad = ctx.createLinearGradient(
      contentX,
      currY,
      contentX + 400,
      currY,
    );
    titleGrad.addColorStop(0, primaryColor);
    titleGrad.addColorStop(1, secondaryColor);
    ctx.fillStyle = titleGrad;
    ctx.font = "bold 26px 'Montserrat', sans-serif";
    ctx.fillText(auraName, contentX, currY);

    // Audio Waveform Visualizer Simulation (28 vertical bars)
    currY += 38;
    const waveWidth = width - contentX - 44;
    const barCount = 30;
    const barWidth = 6;
    const spacing = (waveWidth - barCount * barWidth) / (barCount - 1);

    // Pseudo-random deterministic heights for waveform
    const heights = [
      14, 22, 35, 18, 28, 42, 30, 16, 24, 46, 52, 38, 20, 32, 48, 44, 26, 36,
      50, 34, 18, 28, 40, 32, 16, 22, 36, 28, 18, 12,
    ];

    for (let i = 0; i < barCount; i++) {
      const bx = contentX + i * (barWidth + spacing);
      const bh = heights[i % heights.length];
      const by = currY + (52 - bh) / 2;

      const barGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      barGrad.addColorStop(0, primaryColor);
      barGrad.addColorStop(1, secondaryColor);
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(bx, by, barWidth, bh, 3);
      ctx.fill();
    }

    // AI Soul Analysis Description
    currY += 66;
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "13px 'Montserrat', sans-serif";
    const descLines = wrapText(ctx, description, width - contentX - 46);
    for (let i = 0; i < Math.min(descLines.length, 3); i++) {
      ctx.fillText(descLines[i], contentX, currY + i * 20);
    }

    // Signature Track Box
    currY += Math.min(descLines.length, 3) * 20 + 16;
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.beginPath();
    ctx.roundRect(contentX, currY, width - contentX - 44, 44, 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(contentX, currY, width - contentX - 44, 44, 10);
    ctx.stroke();

    ctx.font = "bold 11px 'Montserrat', sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("LAGU TANDA TANGAN:", contentX + 14, currY + 22);

    ctx.font = "bold 13px 'Montserrat', sans-serif";
    ctx.fillStyle = "#F8FAFC";
    const displayTrack =
      signatureTrack.length > 32
        ? signatureTrack.substring(0, 31) + "..."
        : signatureTrack;
    ctx.fillText(displayTrack, contentX + 160, currY + 22);

    // Metrics Bottom Footer
    const footY = height - 48;
    ctx.font = "bold 11px 'Montserrat', sans-serif";
    ctx.fillStyle = primaryColor;
    ctx.fillText(`⚡ Vibe: ${data.energy || "84%"} Harmoni`, contentX, footY);

    ctx.fillStyle = secondaryColor;
    ctx.fillText(`⏱️ Tempo: ${data.tempo || "118 BPM"}`, contentX + 160, footY);

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "9px 'Montserrat', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("NAURA HOSHINO • ASTRAL MUSIC AI", width - 44, footY);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderMusicAura,
};
