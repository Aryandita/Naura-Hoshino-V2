"use strict";

const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");
const { logger } = require("../managers/logger");

/**
 * Helper menggambar rounded rect
 */
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
 * Helper pembungkus teks panjang
 */
function wrapLines(ctx, text, maxWidth) {
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
 * Render Kartu Sinema & Film Resolusi Tinggi (960 x 540)
 */
async function renderMovieCard(payload) {
  return runWithLimit("movieCard", async () => {
    const {
      title = "Judul Film",
      posterURL = null,
      rating = "N/A",
      runtime = "N/A",
      genres = "Film",
      director = "N/A",
      actors = "N/A",
      synopsis = "Tidak ada sinopsis.",
      sourceName = "IMDb / OMDB",
      botAvatarURL = null,
    } = payload;

    const W = 960;
    const H = 540;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Cinematic Midnight Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#08060e");
    bg.addColorStop(0.5, "#100d1c");
    bg.addColorStop(1, "#1c142b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Warm Amber & Crimson Cinema Lighting Glow
    const glow = ctx.createRadialGradient(220, 240, 20, 220, 240, 380);
    glow.addColorStop(0, "rgba(245, 197, 24, 0.15)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 2. Poster Section (Kiri: 280 x 430)
    const posterX = 40;
    const posterY = 40;
    const posterW = 280;
    const posterH = 430;

    let posterRendered = false;
    if (posterURL) {
      try {
        const img = await loadImage(posterURL);
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(posterX, posterY, posterW, posterH, 18);
        } else {
          ctx.rect(posterX, posterY, posterW, posterH);
        }
        ctx.clip();
        ctx.drawImage(img, posterX, posterY, posterW, posterH);
        ctx.restore();

        // Poster Border
        drawRoundedRect(ctx, posterX, posterY, posterW, posterH, 18, null, "rgba(245, 197, 24, 0.4)", 2);
        posterRendered = true;
      } catch (err) {
        logger.warn("[movieCanvas:renderMovieCard] Poster load fallback: " + (err?.message || err));
      }
    }

    if (!posterRendered) {
      // Fallback Poster Art
      drawRoundedRect(ctx, posterX, posterY, posterW, posterH, 18, "#181424", "#f5c518", 2);
      ctx.fillStyle = "#f5c518";
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🎥", posterX + posterW / 2, posterY + 180);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 16px InterBold, sans-serif";
      ctx.fillText("NAURA CINEMA SPOTLIGHT", posterX + posterW / 2, posterY + 240);
      ctx.textAlign = "left";
    }

    // 3. Right Content Panel
    const rightX = 350;
    const rightW = W - 390;

    // Header Source Pill
    drawRoundedRect(ctx, rightX, 40, 160, 30, 8, "rgba(245, 197, 24, 0.15)", "#f5c518", 1);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText(`✦ ${sourceName.toUpperCase()}`, rightX + 16, 60);

    // Judul Film Utama
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px MontserratBold, InterBold, sans-serif";
    const titleLines = wrapLines(ctx, title, rightW);
    ctx.fillText(titleLines[0] || title, rightX, 106);

    // 4. Badges Strip (Score, Runtime, Genres)
    const badgeY = 132;

    // Rating Score Badge (Gold)
    drawRoundedRect(ctx, rightX, badgeY, 130, 34, 10, "rgba(245, 197, 24, 0.2)", "#f5c518", 1.2);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px MontserratBold, InterBold, sans-serif";
    const ratingMatch = String(rating).match(/(\d+(?:\.\d+)?)/);
    const cleanRating = ratingMatch ? ratingMatch[1] : "8.2";
    ctx.fillText(`IMDb ★ ${cleanRating} / 10`, rightX + 12, badgeY + 22);

    // Runtime Pill
    const cleanRuntime = runtime && runtime !== "N/A" ? runtime : "Durasi Standar";
    drawRoundedRect(ctx, rightX + 140, badgeY, 120, 34, 10, "rgba(56, 189, 248, 0.15)", "#38bdf8", 1);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText(`⏱️ ${cleanRuntime}`, rightX + 152, badgeY + 22);

    // Format Pill
    drawRoundedRect(ctx, rightX + 270, badgeY, 110, 34, 10, "rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.18)", 1);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText("FILM / SERIAL", rightX + 282, badgeY + 22);

    // 5. Credits Box (Sutradara & Pemeran)
    const credY = badgeY + 48;
    drawRoundedRect(ctx, rightX, credY, rightW, 76, 14, "rgba(15, 23, 42, 0.65)", "rgba(255, 255, 255, 0.08)", 1);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText("🎬 Sutradara: ", rightX + 16, credY + 28);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 14px InterBold, sans-serif";
    ctx.fillText(String(director).substring(0, 38), rightX + 105, credY + 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText("👥 Pemeran: ", rightX + 16, credY + 56);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(String(actors).substring(0, 42), rightX + 105, credY + 56);

    // 6. Genre Pills
    const genreY = credY + 88;
    const genreList = String(genres).split(",").map((g) => g.trim()).slice(0, 4);
    let currGenreX = rightX;
    genreList.forEach((g) => {
      const gWidth = Math.max(ctx.measureText(g).width + 28, 65);
      drawRoundedRect(ctx, currGenreX, genreY, gWidth, 28, 8, "rgba(245, 197, 24, 0.12)", "rgba(245, 197, 24, 0.3)", 1);
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 12px InterBold, sans-serif";
      ctx.fillText(g, currGenreX + 14, genreY + 19);
      currGenreX += gWidth + 10;
    });

    // 7. Synopsis Text Box
    const synY = genreY + 38;
    const synH = H - synY - 45;
    drawRoundedRect(ctx, rightX, synY, rightW, synH, 14, "rgba(15, 23, 42, 0.55)", "rgba(255, 255, 255, 0.06)", 1);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px Inter, sans-serif";

    const cleanSynopsis = synopsis.replace(/\n+/g, " ").trim();
    const synLines = wrapLines(ctx, cleanSynopsis, rightW - 32);
    synLines.slice(0, 4).forEach((l, idx) => {
      ctx.fillText(l, rightX + 16, synY + 28 + idx * 22);
    });

    // Footer Watermark with Bot Avatar
    const footerText = "NAURA HOSHINO CINEMA INTELLIGENCE • HOLLYWOOD & WORLD REGISTRY";
    ctx.font = "11px Inter, sans-serif";
    const footerTextWidth = ctx.measureText(footerText).width;
    const avatarSize = 24;
    const footerGap = 8;
    const footerStartX = rightX;

    let avatarDrawn = false;
    if (botAvatarURL) {
      try {
        const avatarImg = await loadImage(botAvatarURL);
        const avatarX = footerStartX;
        const avatarY = H - 20 - avatarSize / 2 - 3;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        avatarDrawn = true;
      } catch (err) {
        logger.warn("[movieCanvas:renderMovieCard] Avatar load failed: " + (err?.message || err));
      }
    }

    const textX = avatarDrawn ? footerStartX + avatarSize + footerGap : footerStartX;
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.fillText(footerText, textX, H - 20);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderMovieCard,
};
