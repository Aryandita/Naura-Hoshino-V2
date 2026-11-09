"use strict";

/* Canvas primitives shared by CanvasUtils. */



const { createCanvas, loadImage } = require("../canvasRuntime");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");




const UI_COLORS = {
  background: "#0a0d14",
  card: "#0c111c",
  primary: "#00D9FF",
  secondary: "#1a243d",
  textMain: "#ffffff",
  textSub: "#8e98b0",
  gold: "#FFD700",
};


// ==========================================
// 🛠️  HELPER DASAR (GABUNGAN)
// ==========================================
function drawRoundedRect(ctx, x, y, w, h, r, color, glowColor) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
  }
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawRoundedProgressBar(
  ctx,
  x,
  y,
  width,
  height,
  radius,
  percentage,
  gradientColors,
) {
  drawRoundedRect(ctx, x, y, width, height, radius, "rgba(0,0,0,0.5)");

  // ✨ FIX: Mengamankan nilai persentase agar tidak tembus (maksimal 100, minimal 0)
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const progressWidth = Math.max(radius * 2, (safePercentage / 100) * width);

  if (safePercentage > 0) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, progressWidth, height, radius);
    else ctx.rect(x, y, progressWidth, height);
    ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x + width, y);
    grad.addColorStop(0, gradientColors[0]);
    grad.addColorStop(1, gradientColors[1]);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }
}

async function drawAvatar(ctx, url, x, y, size, strokeColor) {
  try {
    const avatar = await loadImage(url);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, x, y, size, size);
    ctx.restore();
    if (strokeColor) {
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  } catch (e) {
    logger.error("Gagal meload avatar", e);
  }
}

const drawCircularImage = (ctx, img, x, y, radius, borderColor) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = UI_COLORS.card;
  ctx.fill();
  ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  if (borderColor) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2, true);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
};

const formatDur = (ms) => {
  if (!ms || isNaN(ms) || ms === 0) return "0 Menit";
  if (ms > 3600000000) return "Radio / Live Stream";
  const totalSeconds = Number(ms) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} J ${minutes} M`;
  return `${minutes} Menit`;
};

const drawArcProgressBar = (
  ctx,
  x,
  y,
  radius,
  current,
  total,
  color,
  width,
) => {
  if (!total || total === 0 || total > 3600000000) return;
  const percentage = Math.min(1, current / total);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
  ctx.strokeStyle = UI_COLORS.secondary;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2 * percentage, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
};

const wrapText = (ctx, text, x, y, maxWidth, lineHeight, maxLines) => {
  const words = text.toString().split(" ");
  let line = "";
  let currentY = y;
  let lineCount = 1;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      if (lineCount === maxLines) {
        ctx.fillText(line.trim() + "...", x, currentY);
        return currentY;
      }
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  if (lineCount <= maxLines) {
    ctx.fillText(line.trim(), x, currentY);
  }
  return currentY;
};

const truncateText = (ctx, text, maxWidth) => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (
    ctx.measureText(truncated + "...").width > maxWidth &&
    truncated.length > 0
  ) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
};

function getPlatformIcon(sourceName = "") {
  const s = String(sourceName || "").toLowerCase();
  if (s.includes("spotify")) return ui.getEmoji("spotify") || "🟢";
  if (s.includes("youtube") || s.includes("yt")) return ui.getEmoji("youtube") || "🔴";
  if (s.includes("soundcloud")) return ui.getEmoji("soundcloud") || "🟠";
  return ui.getEmoji("normal") || "🎵";
}

module.exports = { createCanvas, loadImage, logger, ui, UI_COLORS, drawRoundedRect, drawRoundedProgressBar, drawAvatar, drawCircularImage, formatDur, drawArcProgressBar, wrapText, truncateText, getPlatformIcon };
