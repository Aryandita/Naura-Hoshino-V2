const {
  createCanvas,
  loadImage,
  runWithLimit,
  getFromRedis,
  cacheToRedis,
} = require("./canvasRuntime");
const path = require("path");

/**
 * Generate a dynamic profile card using canvas
 * Mendukung pemanggilan model legacy (user, userProfile, userLeveling, rankNumber)
 * maupun pemanggilan worker payload tunggal (payload).
 */
async function generateProfileCard(arg1, arg2, arg3, arg4) {
  // Normalisasi parameter (single payload vs multi arguments)
  let user;
  let userProfile;
  let userLeveling;
  let rankNumber;

  if (arg1 && typeof arg1 === "object" && !arg2 && (arg1.username || arg1.wallet !== undefined)) {
    // Mode payload objek tunggal
    user = {
      id: arg1.userId || arg1.id || "unknown",
      username: arg1.username || "Petualang",
      avatarUrl: arg1.avatarUrl || null,
      displayAvatarURL: () => arg1.avatarUrl || null,
    };
    userProfile = {
      isPremium: Boolean(arg1.isPremium),
      premium_tier: arg1.premiumTier || "none",
      activeBanners: arg1.activeBanners,
      economy_wallet: arg1.wallet || 0,
      economy_bank: arg1.bank || 0,
      starFragments: arg1.starFragments || 0,
      custom_title: arg1.title || "Adventurer",
      reputation: arg1.reputation || 0,
      clan: arg1.clan || null,
      partner: arg1.partner || null,
    };
    userLeveling = {
      level: arg1.level || 1,
      xp: arg1.xp || 0,
      mannersPoint: arg1.mannersPoint ?? 100,
    };
    rankNumber = arg1.rank || 1;
  } else {
    // Mode argument terpisah
    user = arg1 || {};
    userProfile = arg2 || {};
    userLeveling = arg3 || {};
    rankNumber = arg4 || 1;
  }

  const userId = user.id || user.userId || "anonymous";
  const cacheKey = `canvas:profile:${userId}`;
  const cachedBuffer = await getFromRedis(cacheKey);
  if (cachedBuffer) return cachedBuffer;

  return await runWithLimit(async () => {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext("2d");

    // 1. Latar Belakang (Banner Kustom atau Cyberpunk Gradient)
    let bannerId = null;
    try {
      if (userProfile.activeBanners) {
        const activeBanners =
          typeof userProfile.activeBanners === "string"
            ? JSON.parse(userProfile.activeBanners)
            : userProfile.activeBanners;
        if (activeBanners && activeBanners.profile) bannerId = activeBanners.profile;
      }
    } catch (e) {}

    let bannerLoaded = false;
    if (bannerId) {
      try {
        const bannerPath = path.join(
          __dirname,
          "assets",
          "banners",
          bannerId + ".png",
        );
        const bg = await loadImage(bannerPath);
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        // Overlay gelap agar teks tetap kontras terbaca
        ctx.fillStyle = "rgba(10, 10, 18, 0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        bannerLoaded = true;
      } catch (e) {
        bannerLoaded = false;
      }
    }

    if (!bannerLoaded) {
      const gradient = ctx.createLinearGradient(0, 0, 800, 300);
      gradient.addColorStop(0, "#0b0a16");
      gradient.addColorStop(0.5, "#1e1838");
      gradient.addColorStop(1, "#0c1222");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Efek Glassmorphism dengan Tinted Soft Shadow & Neon Glow
    const { getUserPremiumTier } = require("../premium/premiumHelper");
    const tier = getUserPremiumTier(userProfile);

    let glowColor = "rgba(255, 182, 193, 0.25)";
    let borderColor = "rgba(255, 182, 193, 0.3)";
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
    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    ctx.beginPath();
    ctx.roundRect(20, 20, 760, 260, 18);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = tier !== "none" ? 2.0 : 1.5;
    ctx.beginPath();
    ctx.roundRect(20, 20, 760, 260, 18);
    ctx.stroke();

    // 3. Avatar Pengguna
    const avatarSize = 140;
    const avatarX = 45;
    const avatarY = 65;

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
      let avatarUrl = null;
      if (typeof user.displayAvatarURL === "function") {
        avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
      } else if (user.avatarUrl) {
        avatarUrl = user.avatarUrl;
      }

      if (avatarUrl) {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      } else {
        ctx.fillStyle = "#1e1e24";
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      }
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

    // Icon Mahkota jika Pengguna Premium
    if (userProfile.isPremium) {
      ctx.font = '26px "EmojiFont"';
      ctx.fillText("👑", avatarX + avatarSize - 22, avatarY + 22);
    }

    // 4. Header Identitas Pengguna (Username + Clan Badge + Partner Badge)
    const contentStartX = 215;

    // Username
    const rawUsername = user.username || "Petualang";
    const displayName =
      rawUsername.length > 14 ? rawUsername.substring(0, 12) + "..." : rawUsername;

    ctx.font = 'bold 26px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(255, 255, 255, 0.25)";
    ctx.shadowBlur = 6;
    ctx.fillText(displayName, contentStartX, 78);
    ctx.shadowBlur = 0; // Reset shadow

    // Badge Clan dan Partner di baris username jika tersedia
    let badgeCursorX = contentStartX + ctx.measureText(displayName).width + 14;

    const clanTag = userProfile.clan || null;
    if (clanTag) {
      ctx.font = 'bold 11px "MontserratBold", "EmojiFont"';
      const clanText = `CLAN: ${clanTag.toUpperCase()}`;
      const clanWidth = ctx.measureText(clanText).width + 14;

      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeCursorX, 60, clanWidth, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38BDF8";
      ctx.fillText(clanText, badgeCursorX + 7, 75);
      badgeCursorX += clanWidth + 8;
    }

    const partnerName = userProfile.partner || null;
    if (partnerName) {
      ctx.font = 'bold 11px "MontserratBold", "EmojiFont"';
      const partnerText = `💍 ${partnerName}`;
      const partnerWidth = ctx.measureText(partnerText).width + 14;

      ctx.fillStyle = "rgba(244, 114, 182, 0.15)";
      ctx.strokeStyle = "#F472B6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeCursorX, 60, partnerWidth, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#F472B6";
      ctx.fillText(partnerText, badgeCursorX + 7, 75);
    }

    // 5. Level & Rank
    ctx.font = 'bold 18px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFD700"; // Emas
    const rankText = `RANK #${rankNumber}`;
    ctx.fillText(rankText, contentStartX, 112);

    const rankWidth = ctx.measureText(rankText).width;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("  |  ", contentStartX + rankWidth, 112);

    const dividerWidth = ctx.measureText("  |  ").width;
    ctx.fillStyle = "#38BDF8"; // Sky Blue
    ctx.fillText(`LEVEL ${userLeveling.level || 1}`, contentStartX + rankWidth + dividerWidth, 112);

    // 6. Baris Status Tata Krama
    ctx.font = '15px "Inter", "EmojiFont"';
    const manners = userLeveling.mannersPoint ?? 100;
    let mannersColor = "#86EFAC";
    if (manners <= 50) mannersColor = "#FFA500";
    if (manners <= 20) mannersColor = "#FF6B6B";

    ctx.fillStyle = mannersColor;
    ctx.fillText(`Tata Krama: ${manners}/100`, contentStartX, 144);

    // 7. Saldo Ganda Closed-Loop (NC & NSF, tanpa format "Rp")
    const wallet = userProfile.economy_wallet || 0;
    const starFragments = userProfile.starFragments || 0;

    ctx.font = 'bold 15px "MontserratBold", "EmojiFont"';
    // Naura Coins (NC)
    ctx.fillStyle = "#FBBF24";
    const ncText = `🪙 ${wallet.toLocaleString("id-ID")} NC`;
    ctx.fillText(ncText, contentStartX, 178);

    const ncWidth = ctx.measureText(ncText).width;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillText("   •   ", contentStartX + ncWidth, 178);

    const dotWidth = ctx.measureText("   •   ").width;
    // Naura Star Fragments (NSF)
    ctx.fillStyle = "#F472B6";
    const nsfText = `✨ ${starFragments.toLocaleString("id-ID")} NSF`;
    ctx.fillText(nsfText, contentStartX + ncWidth + dotWidth, 178);

    // 8. Progress Bar XP
    const xpCurrent = userLeveling.xp || 0;
    const xpNeeded = Math.max(1, (userLeveling.level || 1) * 100);

    const barX = contentStartX;
    const barY = 212;
    const barWidth = 530;
    const barHeight = 22;

    // Latar Belakang Bar XP
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 11);
    ctx.fill();

    // Isi Progress Bar XP
    let progress = Math.min(xpCurrent / xpNeeded, 1);
    if (isNaN(progress) || progress < 0) progress = 0;

    const progressWidth = Math.max(barWidth * progress, 14);

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

    // Teks XP di dalam Bar
    ctx.font = 'bold 12px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    const xpLabel = `${xpCurrent.toLocaleString("id-ID")} / ${xpNeeded.toLocaleString("id-ID")} XP (${Math.round(progress * 100)}%)`;
    ctx.fillText(xpLabel, barX + barWidth / 2, barY + 16);
    ctx.textAlign = "left"; // Reset alignment

    const buffer = canvas.toBuffer("image/png");
    await cacheToRedis(cacheKey, buffer, 300);
    return buffer;
  });
}

/**
 * Generate a dynamic business card using canvas (VIP/Owner)
 */
async function generateBusinessCard(payload) {
  return runWithLimit("businessCard", async () => {
    const { user, profile, topFriend, streak, palette, currencySymbol } = payload;
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext("2d");

    // Background (Glassmorphism / Neon glow)
    const gradient = ctx.createLinearGradient(0, 0, 800, 400);
    gradient.addColorStop(0, palette.bg1);
    gradient.addColorStop(1, palette.bg2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 400);

    // Add some "glow" elements
    ctx.beginPath();
    ctx.arc(100, 100, 150, 0, Math.PI * 2);
    ctx.fillStyle = palette.glow1;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(700, 300, 200, 0, Math.PI * 2);
    ctx.fillStyle = palette.glow2;
    ctx.fill();

    // Glass panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, 40, 720, 320, 20);
    ctx.fill();
    ctx.stroke();

    // Avatar
    try {
      const avatarUrl = user.displayAvatarURL || user.avatarUrl;
      if (avatarUrl) {
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(140, 140, 60, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 80, 80, 120, 120);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(140, 140, 60, 0, Math.PI * 2);
        ctx.strokeStyle = "#e94560";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    } catch (e) {}

    // Username & Info
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(user.username, 230, 130);

    ctx.fillStyle = "#e94560";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(profile.isPremium ? "🌟 VIP Member" : "👑 Bot Owner", 230, 170);

    ctx.fillStyle = "#b2bec3";
    ctx.font = "20px sans-serif";
    ctx.fillText(
      `Saldo: ${(profile.economy_wallet || 0).toLocaleString("id-ID")} ${currencySymbol || "NC"}`,
      230,
      210,
    );

    ctx.fillStyle = "#f39c12"; // gold/star color
    ctx.fillText(`Reputasi: ⭐ ${profile.reputation || 0}`, 230, 240);

    // Social Media Pills
    let yPos = 270;
    let xPos = 80;

    const drawPill = (text, color) => {
      if (!text) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(xPos, yPos, 180, 40, 20);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      // Center text in pill (roughly)
      const textWidth = ctx.measureText(text).width;
      ctx.fillText(text, xPos + (180 - textWidth) / 2, yPos + 26);
      xPos += 200;
      if (xPos > 500) {
        xPos = 80;
        yPos += 50;
      }
    };

    if (profile.social_youtube) drawPill(profile.social_youtube, "#FF0000");
    if (profile.social_instagram) drawPill(profile.social_instagram, "#E1306C");
    if (profile.social_x) drawPill(profile.social_x, "#1DA1F2");
    if (profile.social_facebook) drawPill(profile.social_facebook, "#4267B2");

    // Top Friend Section (Right side)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(500, 80, 240, 150, 15);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("Top Streak", 520, 110);

    if (topFriend) {
      ctx.font = "16px sans-serif";
      ctx.fillText(topFriend.username, 520, 150);
      ctx.fillStyle = "#e94560";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(`🔥 ${streak} Days`, 520, 190);
    } else {
      ctx.fillStyle = "#b2bec3";
      ctx.font = "14px sans-serif";
      ctx.fillText("No friends yet", 520, 150);
    }

    return canvas.toBuffer("image/png");
  });
}

module.exports = { generateProfileCard, generateBusinessCard };
