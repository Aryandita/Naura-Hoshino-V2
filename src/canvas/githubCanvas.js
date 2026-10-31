"use strict";

const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");
const { logger } = require("../managers/logger");

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
 * Render GitHub Developer Card (800 x 280)
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
async function renderGithubCard(payload = {}) {
  return runWithLimit("githubCard", async () => {
    const {
      login = "octocat",
      name = "The Octocat",
      bio = "GitHub Developer",
      avatar_url = null,
      public_repos = 0,
      followers = 0,
      following = 0,
      location = "Internet",
      company = "Open Source",
    } = payload;

    const W = 800;
    const H = 280;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Dark GitHub Slate Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#090d16");
    bg.addColorStop(0.5, "#0d1117");
    bg.addColorStop(1, "#161b22");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle Radial Glow
    const glow = ctx.createRadialGradient(100, 100, 10, 100, 100, 220);
    glow.addColorStop(0, "rgba(88, 166, 255, 0.12)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Frame Border
    drawRoundedRect(ctx, 12, 12, W - 24, H - 24, 16, null, "rgba(255, 255, 255, 0.08)", 1.5);

    // 2. Avatar Section (Kiri: 90 x 90)
    const avatarX = 40;
    const avatarY = 45;
    const avatarSize = 90;

    let avatarDrawn = false;
    if (avatar_url) {
      try {
        const img = await loadImage(avatar_url);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        avatarDrawn = true;
      } catch (err) {
        logger.warn("[githubCanvas:renderGithubCard] Avatar load fallback: " + (err?.message || err));
      }
    }

    if (!avatarDrawn) {
      drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 45, "#1f2937", "#58a6ff", 2);
      ctx.fillStyle = "#58a6ff";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🐙", avatarX + avatarSize / 2, avatarY + 58);
      ctx.textAlign = "left";
    }

    // Border Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(88, 166, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 3. User Identity (Tengah)
    const infoX = 155;
    drawRoundedRect(ctx, infoX, 36, 120, 22, 6, "rgba(88, 166, 255, 0.15)", "#58a6ff", 1);
    ctx.fillStyle = "#58a6ff";
    ctx.font = "bold 11px InterBold, sans-serif";
    ctx.fillText("✦ GITHUB DEV", infoX + 12, 51);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px MontserratBold, InterBold, sans-serif";
    const displayName = name || login;
    ctx.fillText(displayName.substring(0, 24), infoX, 86);

    ctx.fillStyle = "#8b949e";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(`@${login}`, infoX, 108);

    // Bio
    ctx.fillStyle = "#c9d1d9";
    ctx.font = "13px Inter, sans-serif";
    const cleanBio = String(bio || "Tidak ada bio profil.").substring(0, 60);
    ctx.fillText(cleanBio, infoX, 134);

    // Location & Company
    ctx.fillStyle = "#8b949e";
    ctx.font = "12px Inter, sans-serif";
    const locComp = `📍 ${location || "Global"} • 🏢 ${company || "Independen"}`;
    ctx.fillText(locComp.substring(0, 50), infoX, 156);

    // 4. Stats Metrics Grid (Bawah)
    const statsY = 175;
    const statsW = W - 80;
    drawRoundedRect(ctx, 40, statsY, statsW, 60, 10, "rgba(22, 27, 34, 0.8)", "rgba(48, 54, 61, 0.6)", 1);

    const statColW = statsW / 3;

    // Stat 1: Repos
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("📦 REPOSITORI", 40 + 24, statsY + 24);
    ctx.fillStyle = "#58a6ff";
    ctx.font = "bold 18px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${public_repos}`, 40 + 24, statsY + 48);

    // Stat 2: Followers
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("👥 PENGIKUT", 40 + statColW + 24, statsY + 24);
    ctx.fillStyle = "#3fb950";
    ctx.font = "bold 18px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${followers}`, 40 + statColW + 24, statsY + 48);

    // Stat 3: Following
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("🔀 MENGIKUTI", 40 + statColW * 2 + 24, statsY + 24);
    ctx.fillStyle = "#f0883e";
    ctx.font = "bold 18px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${following}`, 40 + statColW * 2 + 24, statsY + 48);

    // Footer Watermark
    ctx.fillStyle = "rgba(139, 148, 158, 0.4)";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText("NAURA HOSHINO V2 • GITHUB DEVELOPER SPOTLIGHT", 40, H - 16);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderGithubCard,
};

