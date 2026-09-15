"use strict";

/**
 * @namespace: src/canvas/storySceneCanvas.js
 * @type: Canvas Renderer
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 2.2.0
 * @description AI Dynamic Story Scene Visualizer Canvas (800x400)
 */

const { createCanvas, runWithLimit } = require("./canvasRuntime");

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
 * Render visual ilustrasi adegan cerita RPG dinamis bertenaga Canvas
 * @param {object} data - { turn, maxTurns, narrative, title, location }
 * @returns {Promise<Buffer>}
 */
async function renderStoryScene(data = {}) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const turn = Number(data.turn) || 1;
    const maxTurns = Number(data.maxTurns) || 5;
    const title = (data.title || "Ekspedisi Gerbang Neo-Hoshino").toUpperCase();
    const narrative = data.narrative || "Langkah kakimu bergema menembus kabut lembah astral. Udara dingin berdesir lembut di antara reruntuhan kristal kuno.";
    const location = data.location || "Reruntuhan Lembah Astral";

    // 1. Background Gradient Cyber-Fantasy
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0a0714");
    bgGrad.addColorStop(0.5, "#140e2b");
    bgGrad.addColorStop(1, "#08060f");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Cyberpunk Hex Grid Glow Lines
    ctx.save();
    ctx.strokeStyle = "rgba(139, 92, 246, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Neon Nebula Ambient Glow (Top Right Cyan, Bottom Left Pink)
    ctx.save();
    const glow1 = ctx.createRadialGradient(width - 100, 80, 20, width - 100, 80, 240);
    glow1.addColorStop(0, "rgba(56, 189, 248, 0.22)");
    glow1.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(120, height - 80, 20, 120, height - 80, 260);
    glow2.addColorStop(0, "rgba(244, 114, 182, 0.2)");
    glow2.addColorStop(1, "rgba(244, 114, 182, 0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 4. Framed Scene Card (Glassmorphism Box)
    ctx.save();
    ctx.fillStyle = "rgba(18, 14, 34, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    const pad = 28;
    ctx.beginPath();
    ctx.roundRect(pad, pad, width - pad * 2, height - pad * 2, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 5. Header: Badge Bab Cerita
    ctx.save();
    ctx.fillStyle = "#8B5CF6";
    ctx.beginPath();
    ctx.roundRect(pad + 20, pad + 20, 140, 28, 6);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`BAB ${turn} / ${maxTurns} • SCENE`, pad + 32, pad + 38);

    // Header: Lokasi
    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`📍 ${location}`, width - pad - 24, pad + 38);
    ctx.restore();

    // 6. Judul Adegan Cerita
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(title, pad + 20, pad + 85);

    // Separator line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad + 20, pad + 102);
    ctx.lineTo(width - pad - 20, pad + 102);
    ctx.stroke();
    ctx.restore();

    // 7. Narasi Adegan (Italic Quotes)
    ctx.save();
    ctx.font = "italic 16px sans-serif";
    ctx.fillStyle = "#E2E8F0";
    const maxWidth = width - (pad + 20) * 2;
    const lines = wrapText(ctx, `"${narrative}"`, maxWidth);

    let startY = pad + 135;
    for (const line of lines.slice(0, 6)) {
      ctx.fillText(line, pad + 20, startY);
      startY += 26;
    }
    ctx.restore();

    // 8. Footer Info
    ctx.save();
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("✨ AI Dungeon Master • Naura Hoshino V2", pad + 20, height - pad - 18);

    ctx.textAlign = "right";
    ctx.fillStyle = "#F472B6";
    ctx.fillText("PILIH TINDAKANMU DI BAWAH ⚔️", width - pad - 20, height - pad - 18);
    ctx.restore();

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderStoryScene,
};
