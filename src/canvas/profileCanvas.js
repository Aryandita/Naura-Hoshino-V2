const {
  createCanvas,
  loadImage,
  GlobalFonts,
  runWithLimit,
  getFromRedis,
  cacheToRedis,
} = require("./canvasRuntime");
const path = require("path");

/**
 * Generate a dynamic profile card using canvas
 */
async function generateProfileCard(
  user,
  userProfile,
  userLeveling,
  rankNumber,
) {
  const cacheKey = `canvas:profile:${user.id}`;
  const cachedBuffer = await getFromRedis(cacheKey);
  if (cachedBuffer) return cachedBuffer;

  return await runWithLimit(async () => {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext("2d");

    // Latar Belakang (Banner Custom atau Gradient Modern)
    let bannerId = null;
    try {
      if (userProfile.activeBanners) {
        const activeBanners = typeof userProfile.activeBanners === "string" ? JSON.parse(userProfile.activeBanners) : userProfile.activeBanners;
        if (activeBanners.profile) bannerId = activeBanners.profile;
      }
    } catch(e) {}

    if (bannerId) {
      try {
        const bannerPath = path.join(__dirname, 'assets', 'banners', bannerId + '.png');
        const bg = await loadImage(bannerPath);
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        // Tambahkan overlay gelap sedikit agar teks tetap terbaca
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } catch (e) {
        // Fallback jika gambar gagal dimuat
        const gradient = ctx.createLinearGradient(0, 0, 800, 300);
        gradient.addColorStop(0, "#0f0c29");
        gradient.addColorStop(0.5, "#302b63");
        gradient.addColorStop(1, "#24243e");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 800, 300);
      gradient.addColorStop(0, "#0f0c29");
      gradient.addColorStop(0.5, "#302b63");
      gradient.addColorStop(1, "#24243e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Efek Glassmorphism dengan Tinted Soft Shadow & Neon Glow
    const { getUserPremiumTier } = require("../premium/premiumHelper");
    const tier = getUserPremiumTier(userProfile);

    let glowColor = "rgba(255, 182, 193, 0.25)";
    let borderColor = "rgba(255, 182, 193, 0.25)";
    let shadowBlur = 14;

    if (tier === "vip") {
      glowColor = "rgba(255, 215, 0, 0.8)";
      borderColor = "rgba(255, 215, 0, 0.75)";
      shadowBlur = 24;
    } else if (tier === "friends") {
      glowColor = "rgba(168, 85, 247, 0.75)";
      borderColor = "rgba(168, 85, 247, 0.7)";
      shadowBlur = 20;
    } else if (tier === "supporter") {
      glowColor = "rgba(192, 192, 192, 0.65)";
      borderColor = "rgba(192, 192, 192, 0.6)";
      shadowBlur = 16;
    } else if (tier === "starter") {
      glowColor = "rgba(56, 189, 248, 0.65)";
      borderColor = "rgba(56, 189, 248, 0.6)";
      shadowBlur = 16;
    } else if (tier === "voter") {
      glowColor = "rgba(244, 63, 94, 0.65)";
      borderColor = "rgba(244, 63, 94, 0.6)";
      shadowBlur = 16;
    }

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(20, 20, 760, 260, 18);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = tier !== "none" ? 2.0 : 1.5;
    ctx.beginPath();
    ctx.roundRect(20, 20, 760, 260, 18);
    ctx.stroke();

    // Gambar Avatar User
    const avatarSize = 150;
    const avatarX = 50;
    const avatarY = 75;

    ctx.save();
    ctx.beginPath();
    ctx.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2,
      true,
    );
    ctx.closePath();
    ctx.clip();

    try {
      // Fallback untuk PNG
      const avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
      const avatar = await loadImage(avatarUrl);
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    } catch (e) {
      ctx.fillStyle = "#1e1e24";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
    ctx.restore();

    // Bingkai Avatar dengan Neon Glow
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.beginPath();
    ctx.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2,
      true,
    );
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = tier !== "none" ? 3.0 : 2.0;
    ctx.stroke();
    ctx.restore();

    // Jika premium, tambahkan icon crown
    if (userProfile.isPremium) {
      ctx.font = '28px "EmojiFont"';
      ctx.fillText("👑", avatarX + 110, avatarY + 30);
    }

    // Teks Username (Outfit / MontserratBold)
    ctx.font = 'bold 34px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(
      user.username.length > 15
        ? user.username.substring(0, 15) + "..."
        : user.username,
      230,
      95,
    );

    // Teks Level & Rank (MontserratBold angka inti)
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFD700"; // Gold Color
    ctx.fillText(
      `RANK #${rankNumber}   |   LEVEL ${userLeveling.level}`,
      230,
      138,
    );

    // Teks Manners Point (Tata Krama)
    ctx.font = '18px "Inter", "EmojiFont"';
    let mannersColor = "#86EFAC";
    if (userLeveling.mannersPoint <= 50) mannersColor = "#FFA500";
    if (userLeveling.mannersPoint <= 20) mannersColor = "#FF6B6B";

    ctx.fillStyle = mannersColor;
    ctx.fillText(`Tata Krama: ${userLeveling.mannersPoint}/100`, 230, 172);

    // Saldo Economy
    ctx.fillStyle = "#F9A8D4"; // Light Pink
    const wallet = userProfile.economy_wallet || 0;
    ctx.font = '18px "Inter", "EmojiFont"';
    ctx.fillText(
      `💳 Saldo Wallet: Rp ${wallet.toLocaleString("id-ID")}`,
      230,
      205,
    );

    // Progress Bar XP
    // Asumsi rumus level: next_level_xp = level * 100
    const xpCurrent = userLeveling.xp || 0;
    const xpNeeded = userLeveling.level * 100;

    const barX = 230;
    const barY = 230;
    const barWidth = 500;
    const barHeight = 22;

    // Latar belakang bar
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 11);
    ctx.fill();

    // Isi Progress
    let progress = Math.min(xpCurrent / xpNeeded, 1);
    if (isNaN(progress) || progress < 0) progress = 0;

    const progressWidth = Math.max(barWidth * progress, 14); // Minimal 14px agar rounded corner terlihat bagus

    if (progressWidth > 0) {
      const progressGradient = ctx.createLinearGradient(
        barX,
        0,
        barX + barWidth,
        0,
      );
      progressGradient.addColorStop(0, "#38BDF8");
      progressGradient.addColorStop(1, "#F472B6");

      ctx.fillStyle = progressGradient;
      ctx.beginPath();
      ctx.roundRect(barX, barY, progressWidth, barHeight, 11);
      ctx.fill();
    }

    // Teks XP di dalam Bar (MontserratBold)
    ctx.font = 'bold 13px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(
      `${xpCurrent.toLocaleString("id-ID")} / ${xpNeeded.toLocaleString("id-ID")} XP`,
      barX + barWidth / 2,
      barY + 16,
    );

    const buffer = canvas.toBuffer("image/png");
    await cacheToRedis(cacheKey, buffer, 300);
    return buffer;
  });
}

module.exports = { generateProfileCard };
