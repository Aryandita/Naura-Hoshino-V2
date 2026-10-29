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
 * Render Kartu Anime Spotlight Resolusi Tinggi (960 x 540)
 */
async function renderAnimeCard(payload) {
  return runWithLimit("animeCard", async () => {
    const {
      title = "Judul Anime",
      titleJapanese = "",
      posterURL = null,
      score = "N/A",
      type = "TV",
      episodes = "Unknown",
      status = "N/A",
      genres = "Anime",
      studio = "N/A",
      seasonYear = "N/A",
      synopsis = "Tidak ada sinopsis.",
      sourceName = "MyAnimeList",
      botAvatarURL = null,
    } = payload;

    const W = 960;
    const H = 540;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Dark Anime Cyber Backdrop
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0714");
    bg.addColorStop(0.5, "#130f24");
    bg.addColorStop(1, "#1e1638");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Purple & Pink Soft Radial Lighting
    const glow = ctx.createRadialGradient(200, 260, 20, 200, 260, 400);
    glow.addColorStop(0, "rgba(168, 85, 247, 0.18)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 2. Poster Section (Kiri: 280 x 420)
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
        drawRoundedRect(ctx, posterX, posterY, posterW, posterH, 18, null, "rgba(168, 85, 247, 0.4)", 2);
        posterRendered = true;
      } catch (err) {
        logger.warn("[animeCanvas:renderAnimeCard] Poster load fallback: " + (err?.message || err));
      }
    }

    if (!posterRendered) {
      // Fallback Poster Art
      drawRoundedRect(ctx, posterX, posterY, posterW, posterH, 18, "#181228", "#8b5cf6", 2);
      ctx.fillStyle = "#8b5cf6";
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🎬", posterX + posterW / 2, posterY + 180);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 16px InterBold, sans-serif";
      ctx.fillText("NAURA ANIME SPOTLIGHT", posterX + posterW / 2, posterY + 240);
      ctx.textAlign = "left";
    }

    // 3. Right Content Panel
    const rightX = 350;
    const rightW = W - 390;

    // Header Tag Pill
    drawRoundedRect(ctx, rightX, 40, 160, 30, 8, "rgba(168, 85, 247, 0.2)", "#a855f7", 1);
    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText(`✦ ${sourceName.toUpperCase()}`, rightX + 16, 60);

    // Judul Anime Utama
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px MontserratBold, InterBold, sans-serif";
    const titleLines = wrapLines(ctx, title, rightW);
    const primaryTitle = titleLines[0] || title;
    ctx.fillText(primaryTitle, rightX, 105);

    // Judul Bahasa Jepang / Subtitle
    if (titleJapanese) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "15px Inter, sans-serif";
      ctx.fillText(titleJapanese, rightX, 134);
    }

    // 4. Badges Strip (Score, Format, Status, Episodes)
    const badgeY = titleJapanese ? 154 : 134;

    // Score Badge (Gold)
    drawRoundedRect(ctx, rightX, badgeY, 120, 34, 10, "rgba(245, 158, 11, 0.2)", "#f59e0b", 1.2);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px MontserratBold, InterBold, sans-serif";
    const scoreMatch = String(score).match(/(\d+(?:\.\d+)?)/);
    const cleanScore = scoreMatch ? scoreMatch[1] : "8.5";
    ctx.fillText(`★  ${cleanScore} / 10`, rightX + 14, badgeY + 22);

    // Format Pill
    drawRoundedRect(ctx, rightX + 130, badgeY, 90, 34, 10, "rgba(99, 102, 241, 0.2)", "#6366f1", 1);
    ctx.fillStyle = "#818cf8";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText(String(type).toUpperCase(), rightX + 144, badgeY + 22);

    // Status Pill
    const isCompleted = String(status).toLowerCase().includes("finish") || String(status).toLowerCase().includes("selesai");
    const statusColor = isCompleted ? "#22c55e" : "#06b6d4";
    drawRoundedRect(ctx, rightX + 230, badgeY, 130, 34, 10, "rgba(0, 0, 0, 0.4)", statusColor, 1);
    ctx.fillStyle = statusColor;
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText(String(status).toUpperCase().substring(0, 16), rightX + 242, badgeY + 22);

    // Episodes Pill
    drawRoundedRect(ctx, rightX + 370, badgeY, 110, 34, 10, "rgba(255, 255, 255, 0.06)", "rgba(255, 255, 255, 0.15)", 1);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText(String(episodes), rightX + 384, badgeY + 22);

    // 5. Studio & Musim Metadata Box
    const metaY = badgeY + 48;
    drawRoundedRect(ctx, rightX, metaY, rightW, 44, 12, "rgba(15, 23, 42, 0.65)", "rgba(255, 255, 255, 0.08)", 1);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px Inter, sans-serif";
    const studioText = studio && studio !== "N/A" ? studio : "Studio Produksi";
    const seasonText = seasonYear && seasonYear !== "N/A" ? seasonYear : "Rilis";
    ctx.fillText(`🎨 Studio: `, rightX + 16, metaY + 27);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 14px InterBold, sans-serif";
    ctx.fillText(studioText, rightX + 85, metaY + 27);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(` •  Musim: `, rightX + 260, metaY + 27);
    ctx.fillStyle = "#f472b6";
    ctx.font = "bold 14px InterBold, sans-serif";
    ctx.fillText(seasonText, rightX + 335, metaY + 27);

    // 6. Genre Pills
    const genreY = metaY + 54;
    const genreList = String(genres).split(",").map((g) => g.trim()).slice(0, 4);
    let currGenreX = rightX;
    genreList.forEach((g) => {
      const gWidth = Math.max(ctx.measureText(g).width + 30, 70);
      drawRoundedRect(ctx, currGenreX, genreY, gWidth, 28, 8, "rgba(244, 114, 182, 0.15)", "#ec4899", 1);
      ctx.fillStyle = "#f472b6";
      ctx.font = "bold 12px InterBold, sans-serif";
      ctx.fillText(g, currGenreX + 14, genreY + 19);
      currGenreX += gWidth + 12;
    });

    // 7. Synopsis Text Box
    const synY = genreY + 40;
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
    const footerText = "NAURA HOSHINO ANIME SPOTLIGHT • GLOBAL ANIME INTELLIGENCE";
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
        logger.warn("[animeCanvas:renderAnimeCard] Avatar load failed: " + (err?.message || err));
      }
    }

    const textX = avatarDrawn ? footerStartX + avatarSize + footerGap : footerStartX;
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.fillText(footerText, textX, H - 20);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderAnimeCard,
};
