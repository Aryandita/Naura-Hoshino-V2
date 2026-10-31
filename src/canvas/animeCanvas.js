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

    // Judul Anime Utama (Adaptif Font Size)
    ctx.fillStyle = "#ffffff";
    let titleFontSize = 28;
    ctx.font = `bold ${titleFontSize}px MontserratBold, InterBold, sans-serif`;
    while (ctx.measureText(title).width > rightW && titleFontSize > 20) {
      titleFontSize -= 2;
      ctx.font = `bold ${titleFontSize}px MontserratBold, InterBold, sans-serif`;
    }
    const titleLines = wrapLines(ctx, title, rightW);
    let titleOffset = 0;
    if (titleLines.length > 1) {
      ctx.fillText(titleLines[0], rightX, 94);
      const secondLine = titleLines.length > 2 ? titleLines[1] + "..." : titleLines[1];
      ctx.fillText(secondLine, rightX, 118);
      titleOffset = 20;
    } else {
      ctx.fillText(titleLines[0] || title, rightX, 105);
    }

    // Judul Bahasa Jepang / Subtitle (Fallback aman terhadap glyph tofu di Linux)
    const { GlobalFonts } = require("./canvasRuntime");
    const hasCJKFont =
      GlobalFonts.has("SystemCJKWindows") ||
      GlobalFonts.has("SystemCJKWindows2") ||
      GlobalFonts.has("SystemCJKWindows3") ||
      GlobalFonts.has("SystemCJKLinux") ||
      GlobalFonts.has("SystemCJKLinux2");
    const hasCjkChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(String(titleJapanese));
    const shouldRenderSubtitle = Boolean(titleJapanese && (!hasCjkChars || hasCJKFont));

    if (shouldRenderSubtitle) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = '15px "SystemCJKWindows", "SystemCJKWindows2", "SystemCJKLinux", "Yu Gothic", "MS Gothic", Inter, sans-serif';
      ctx.fillText(titleJapanese, rightX, 134 + titleOffset);
    }

    // 4. Badges Strip (Score, Format, Status, Episodes)
    const badgeY = (shouldRenderSubtitle ? 154 : 134) + titleOffset;

    // Score Badge (Gold)
    const parseScore = (val) => {
      if (!val || val === "N/A") return null;
      const stripped = String(val)
        .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, "")
        .replace(/\*\*/g, "")
        .trim();
      const matches = stripped.match(/\b(10(?:\.0)?|[0-9](?:\.[0-9]+)?)\b/);
      return matches ? matches[1] : null;
    };
    const cleanScore = parseScore(payload.rawScore) || parseScore(score);
    const scoreLabel = cleanScore ? `★ ${cleanScore} / 10` : "★ N/A";

    // Format Pill
    const formatLabel = String(type || "TV").toUpperCase();

    // Status Pill (Sanitasi underscore & pemetaan label ramah pengguna)
    const rawStatus = String(status || "N/A").replace(/_/g, " ").trim();
    const upperStatus = rawStatus.toUpperCase();
    let statusLabel = rawStatus;
    let statusColor = "#06b6d4";

    if (
      upperStatus.includes("NOT YET") ||
      upperStatus.includes("BELUM") ||
      upperStatus.includes("TO BE AIRED") ||
      upperStatus.includes("UNRELEASED") ||
      upperStatus.includes("UPCOMING") ||
      upperStatus.includes("TBA")
    ) {
      statusLabel = "Belum Rilis";
      statusColor = "#38bdf8";
    } else if (
      upperStatus.includes("FINISH") ||
      upperStatus.includes("SELESAI") ||
      upperStatus.includes("TAMAT")
    ) {
      statusLabel = "Selesai";
      statusColor = "#22c55e";
    } else if (
      upperStatus.includes("RELEAS") ||
      upperStatus.includes("AIRING") ||
      upperStatus.includes("TAYANG")
    ) {
      statusLabel = "Tayang";
      statusColor = "#f59e0b";
    } else if (upperStatus.includes("CANCEL") || upperStatus.includes("DIBATALKAN") || upperStatus.includes("BATAL")) {
      statusLabel = "Dibatalkan";
      statusColor = "#ef4444";
    } else if (upperStatus.includes("HIATUS")) {
      statusLabel = "Hiatus";
      statusColor = "#a855f7";
    }

    // Episodes Pill
    const epLabel = String(episodes || "1 Ep").replace(/_/g, " ").trim();

    // Responsive Badges Strip (Anti-Overlap Engine)
    const badgeConfigs = [
      {
        label: scoreLabel,
        textColor: "#fbbf24",
        borderColor: "#f59e0b",
        bgColor: "rgba(245, 158, 11, 0.2)",
        font: "bold 13px MontserratBold, InterBold, sans-serif",
        minWidth: 104,
      },
      {
        label: formatLabel,
        textColor: "#818cf8",
        borderColor: "#6366f1",
        bgColor: "rgba(99, 102, 241, 0.2)",
        font: "bold 13px InterBold, sans-serif",
        minWidth: 70,
      },
      {
        label: statusLabel,
        textColor: statusColor,
        borderColor: statusColor,
        bgColor: "rgba(0, 0, 0, 0.4)",
        font: "bold 12px InterBold, sans-serif",
        minWidth: 90,
      },
      {
        label: epLabel,
        textColor: "#e2e8f0",
        borderColor: "rgba(255, 255, 255, 0.15)",
        bgColor: "rgba(255, 255, 255, 0.06)",
        font: "bold 13px InterBold, sans-serif",
        minWidth: 65,
      },
    ];

    const measuredBadges = badgeConfigs.map((b) => {
      ctx.font = b.font;
      const textW = Math.ceil(ctx.measureText(b.label).width);
      const pillW = Math.max(b.minWidth, textW + 24);
      return { ...b, textW, pillW };
    });

    const defaultGap = 10;
    const totalPillW = measuredBadges.reduce((acc, b) => acc + b.pillW, 0);
    const availableW = rightW;
    const requiredTotal = totalPillW + (measuredBadges.length - 1) * defaultGap;
    const badgeGap =
      requiredTotal > availableW
        ? Math.max(5, Math.floor((availableW - totalPillW) / (measuredBadges.length - 1)))
        : defaultGap;

    let curBadgeX = rightX;
    for (const b of measuredBadges) {
      drawRoundedRect(ctx, curBadgeX, badgeY, b.pillW, 34, 10, b.bgColor, b.borderColor, 1);
      ctx.fillStyle = b.textColor;
      ctx.font = b.font;
      const textX = curBadgeX + (b.pillW - b.textW) / 2;
      ctx.fillText(b.label, textX, badgeY + 22);
      curBadgeX += b.pillW + badgeGap;
    }

    // 5. Studio & Musim Metadata Box (2-Kolom Terstruktur & Anti-Tumpang-Tindih)
    const metaY = badgeY + 48;
    drawRoundedRect(ctx, rightX, metaY, rightW, 44, 12, "rgba(15, 23, 42, 0.65)", "rgba(255, 255, 255, 0.08)", 1);

    const colW = (rightW - 32) / 2;
    const leftColX = rightX + 16;
    const rightColX = rightX + 16 + colW;

    // Studio (Kolom Kiri)
    const studioLabel = "🎨 Studio: ";
    ctx.font = "14px Inter, sans-serif";
    const studioLabelW = ctx.measureText(studioLabel).width;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(studioLabel, leftColX, metaY + 27);

    const studioValX = leftColX + studioLabelW + 2;
    const maxStudioW = colW - studioLabelW - 8;
    let studioDisplay = studio && studio !== "N/A" ? String(studio).trim() : "Belum diumumkan";
    ctx.font = "bold 14px InterBold, sans-serif";
    while (ctx.measureText(studioDisplay).width > maxStudioW && studioDisplay.length > 4) {
      studioDisplay = studioDisplay.slice(0, -4).trim() + "...";
    }
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(studioDisplay, studioValX, metaY + 27);

    // Musim (Kolom Kanan)
    const musimLabel = "🗓️ Musim: ";
    ctx.font = "14px Inter, sans-serif";
    const musimLabelW = ctx.measureText(musimLabel).width;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(musimLabel, rightColX, metaY + 27);

    const musimValX = rightColX + musimLabelW + 2;
    const maxMusimW = colW - musimLabelW - 8;
    let seasonDisplay = seasonYear && seasonYear !== "N/A" ? String(seasonYear).trim() : "Akan datang";
    ctx.font = "bold 14px InterBold, sans-serif";
    while (ctx.measureText(seasonDisplay).width > maxMusimW && seasonDisplay.length > 4) {
      seasonDisplay = seasonDisplay.slice(0, -4).trim() + "...";
    }
    ctx.fillStyle = "#f472b6";
    ctx.fillText(seasonDisplay, musimValX, metaY + 27);

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
