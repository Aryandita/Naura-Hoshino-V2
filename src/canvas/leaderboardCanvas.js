"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

function drawRoundedRect(ctx, x, y, w, h, r, fillColor, strokeColor = null, lineWidth = 1) {
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Render Papan Peringkat Top 10 Resolusi Tinggi (800 x 520)
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
async function renderLeaderboard(payload = {}) {
  return runWithLimit("leaderboardCard", async () => {
    const {
      title = "Top 10 Global Leaderboard",
      category = "Umum",
      entries = [],
      callerRank = null, // { rank: 12, score: 500, username: "Player" }
    } = payload;

    const W = 800;
    const H = 520;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Deep Celestial Purple Gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b0817");
    bg.addColorStop(0.5, "#130f26");
    bg.addColorStop(1, "#1c1438");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle Radial Glow
    const glow = ctx.createRadialGradient(W / 2, 60, 20, W / 2, 60, 350);
    glow.addColorStop(0, "rgba(168, 85, 247, 0.15)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Frame Border
    drawRoundedRect(ctx, 12, 12, W - 24, H - 24, 16, null, "rgba(255, 255, 255, 0.08)", 1.5);

    // Header Tag
    drawRoundedRect(ctx, 36, 26, 120, 26, 6, "rgba(168, 85, 247, 0.2)", "#c084fc", 1);
    ctx.fillStyle = "#e9d5ff";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.fillText(category.toUpperCase(), 48, 43);

    // Header Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px MontserratBold, InterBold, sans-serif";
    ctx.fillText(title, 168, 46);

    // 2. Leaderboard Entries (Up to 8 shown on card)
    const listY = 70;
    const itemH = 42;
    const maxItems = Math.min(8, entries.length);
    const maxScore = entries[0]?.score > 0 ? entries[0].score : 1;

    for (let i = 0; i < maxItems; i++) {
      const item = entries[i];
      const y = listY + i * (itemH + 6);
      const rank = i + 1;

      let rankColor = "#94a3b8";
      let rankBg = "rgba(255, 255, 255, 0.04)";
      let borderCol = "rgba(255, 255, 255, 0.06)";

      if (rank === 1) {
        rankColor = "#fbbf24";
        rankBg = "rgba(245, 158, 11, 0.12)";
        borderCol = "rgba(245, 158, 11, 0.4)";
      } else if (rank === 2) {
        rankColor = "#cbd5e1";
        rankBg = "rgba(148, 163, 184, 0.12)";
        borderCol = "rgba(148, 163, 184, 0.4)";
      } else if (rank === 3) {
        rankColor = "#fb923c";
        rankBg = "rgba(234, 88, 12, 0.12)";
        borderCol = "rgba(234, 88, 12, 0.35)";
      }

      drawRoundedRect(ctx, 36, y, W - 72, itemH, 8, rankBg, borderCol, 1);

      // Rank Badge
      const rankLabel = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
      ctx.font = rank <= 3 ? "18px sans-serif" : "bold 14px InterBold, sans-serif";
      ctx.fillStyle = rankColor;
      ctx.textAlign = "center";
      ctx.fillText(rankLabel, 60, y + 26);
      ctx.textAlign = "left";

      // Username
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px InterBold, sans-serif";
      const uName = String(item.username || "Pemain").substring(0, 22);
      ctx.fillText(uName, 90, y + 26);

      // Score Bar Fill
      const barPct = Math.min(1, Math.max(0, (item.score || 0) / maxScore));
      const scoreBarW = 200;
      const scoreBarX = W - 320;
      const fillW = Math.max(6, scoreBarW * barPct);

      drawRoundedRect(ctx, scoreBarX, y + 16, scoreBarW, 10, 5, "rgba(255, 255, 255, 0.08)");
      if (fillW > 0) {
        drawRoundedRect(ctx, scoreBarX, y + 16, fillW, 10, 5, rankColor);
      }

      // Score Text
      ctx.fillStyle = rankColor;
      ctx.font = "bold 13px InterBold, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${(item.score || 0).toLocaleString()}`, W - 56, y + 26);
      ctx.textAlign = "left";
    }

    // 3. Caller Rank Footer Bar
    const footerY = H - 58;
    drawRoundedRect(ctx, 36, footerY, W - 72, 38, 8, "rgba(15, 23, 42, 0.8)", "rgba(56, 189, 248, 0.3)", 1);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText("⭐ POSISI KAMU", 52, footerY + 24);

    if (callerRank) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px InterBold, sans-serif";
      ctx.fillText(`${callerRank.username || "Kamu"} • Peringkat #${callerRank.rank || "-"}`, 180, footerY + 24);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px InterBold, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${(callerRank.score || 0).toLocaleString()} Poin`, W - 56, footerY + 24);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText("Mainkan aktivitas untuk masuk ke leaderboard!", 180, footerY + 24);
    }

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderLeaderboard,
};
