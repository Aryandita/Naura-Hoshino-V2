"use strict";

const { createCanvas, loadImage, logger, drawRoundedRect, drawCircularImage, truncateText } = require("./helpers/canvasPrimitives");


async function generateWelcomeImage(
  member,
  type = "welcome",
  ui,
  bgUrl = null,
  config = null,
) {
  const canvas = createCanvas(1000, 330);
  const ctx = canvas.getContext("2d");

  const isWelcome = type === "welcome";
  const themeColor = isWelcome
    ? ui?.colors?.welcome || "#00FFFF"
    : ui?.colors?.leave || "#ff4757";
  const customGlow = config && config.glowColor ? config.glowColor : themeColor;

  const finalBgUrl =
    bgUrl ||
    (ui && typeof ui.getBackground === "function"
      ? ui.getBackground(type)
      : null);
  if (finalBgUrl) {
    try {
      const bgImg = await loadImage(finalBgUrl);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      logger.info("[CANVAS] Gagal memuat background, menggunakan warna dasar.");
      drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 0, "#0a0d14");
    }
  } else {
    drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 0, "#0a0d14");
  }

  // Draw premium glassmorphic border card with neon glow
  drawRoundedRect(ctx, 20, 20, 960, 290, 20, "rgba(0, 0, 0, 0.65)", customGlow);

  let userAvatarImg;
  const avatarUrl = member.user.displayAvatarURL({
    extension: "png",
    size: 512,
  });
  try {
    userAvatarImg = await loadImage(avatarUrl);
  } catch (e) {
    logger.warn("[CanvasUtils:generateWelcomeImage] Render visual canvas atau pemuatan aset gagal: " + (e?.message || e));
  }

  // Destructure custom layout parameters with failsafe defaults
  const avatarX = config && config.avatarX !== undefined ? config.avatarX : 180;
  const avatarY = config && config.avatarY !== undefined ? config.avatarY : 165;
  const avatarRadius =
    config && config.avatarSize !== undefined ? config.avatarSize : 110;

  const titleX = config && config.titleX !== undefined ? config.titleX : 370;
  const titleY = config && config.titleY !== undefined ? config.titleY : 105;
  const titleSize =
    config && config.titleSize !== undefined ? config.titleSize : 26;
  const titleVal =
    config && config.titleText
      ? config.titleText
      : isWelcome
        ? "WELCOME TO SERVER"
        : "WE WILL MISS YOU";

  const nameX = config && config.nameX !== undefined ? config.nameX : 370;
  const nameY = config && config.nameY !== undefined ? config.nameY : 170;
  const nameSize =
    config && config.nameSize !== undefined ? config.nameSize : 55;

  const subtitleX =
    config && config.subtitleX !== undefined ? config.subtitleX : 370;
  const subtitleY =
    config && config.subtitleY !== undefined ? config.subtitleY : 220;
  const subtitleSize =
    config && config.subtitleSize !== undefined ? config.subtitleSize : 22;

  if (userAvatarImg) {
    drawCircularImage(
      ctx,
      userAvatarImg,
      avatarX,
      avatarY,
      avatarRadius,
      customGlow,
    );
  }

  ctx.fillStyle = customGlow;
  ctx.font = `bold ${titleSize}px "MontserratBold", "EmojiFont", sans-serif`;
  const spacedTitle = titleVal.split("").join(" ");
  ctx.fillText(spacedTitle, titleX, titleY);

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${nameSize}px "MontserratBold", "EmojiFont", sans-serif`;
  const displayName = truncateText(ctx, member.user.displayName, 550);
  ctx.fillText(displayName, nameX, nameY);

  ctx.fillStyle = "#d1d5db";
  ctx.font = `${subtitleSize}px "Inter", "EmojiFont", sans-serif`;
  const tag = `@${member.user.username}`;
  const countText = isWelcome
    ? `Anggota #${member.guild.memberCount}`
    : `Sisa #${member.guild.memberCount}`;
  ctx.fillText(`${tag}   •   ${countText}`, subtitleX, subtitleY);

  ctx.fillStyle = customGlow;
  ctx.fillRect(subtitleX, subtitleY + 25, 150, 4);

  return canvas.toBuffer("image/png");
}

// ==========================================
// 📈 LEVEL UP CANVAS (FUNGSI BARU)
// ==========================================
// 📈 LEVEL UP CANVAS (CYBER-ANIME REVAMP)
// ==========================================
module.exports = { generateWelcomeImage };
