/**
 * @namespace: src/utils/Canvas.js
 * @type: Utility
 * @copyright © 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.0.3 (Premium Font Upgrade)
 */

const {
  createCanvas,
  loadImage,
  GlobalFonts,
  runWithLimit,
} = require("./canvasRuntime");
const { logger } = require("../../src/managers/logger");
const axios = require("axios");
const ui = require("../../src/config/ui");
const path = require("path");

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
  drawRoundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    "rgba(255, 255, 255, 0.05)",
  );
  if (percentage > 0) {
    const progressWidth = (width * percentage) / 100;
    if (progressWidth < radius * 2 && progressWidth > 0) return;

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, progressWidth, height, radius);
    else ctx.rect(x, y, progressWidth, height);

    const barGradient = ctx.createLinearGradient(x, y, x + progressWidth, y);
    barGradient.addColorStop(0, gradientColors[0]);
    barGradient.addColorStop(1, gradientColors[1]);

    ctx.fillStyle = barGradient;
    ctx.shadowColor = gradientColors[1];
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

async function drawAvatar(ctx, url, x, y, size, glowColor) {
  try {
    let avatarImg;
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      avatarImg = await loadImage(Buffer.from(response.data));
    } catch {
      avatarImg = await loadImage(url);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, x, y, size, size);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2, true);
    ctx.stroke();
    ctx.restore();
  } catch (e) {
    drawRoundedRect(ctx, x, y, size, size, size / 2, "#333");
  }
}

class CanvasUtils {
  // ==========================================
  // 🌟 FUNGSI 1: KARTU NAIK LEVEL
  // ==========================================
  static async generateLevel(user, level) {
    const canvas = createCanvas(1024, 400);
    const ctx = canvas.getContext("2d");

    try {
      const levelUpBanner = ui.getBanner("levelUp");
      if (levelUpBanner) {
        const background = await loadImage(levelUpBanner);
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
      } else {
        const bgGradient = ctx.createLinearGradient(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        bgGradient.addColorStop(0, "#0f0c29");
        bgGradient.addColorStop(0.5, "#302b63");
        bgGradient.addColorStop(1, "#24243e");
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } catch (e) {
      ctx.fillStyle = "#1a1c23";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.save();
    ctx.fillStyle = "rgba(20, 20, 30, 0.6)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(50, 50, 924, 300, 25);
    else ctx.rect(50, 50, 924, 300);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(50, 50, 924, 300, 25);
    else ctx.rect(50, 50, 924, 300);
    ctx.stroke();

    ctx.save();
    const glowGradient = ctx.createRadialGradient(200, 200, 10, 200, 200, 400);
    glowGradient.addColorStop(0, "rgba(0, 217, 255, 0.25)");
    glowGradient.addColorStop(1, "transparent");
    ctx.fillStyle = glowGradient;
    ctx.fillRect(50, 50, 924, 300);
    ctx.restore();

    await drawAvatar(
      ctx,
      user.displayAvatarURL({ extension: "png", size: 512 }),
      100,
      100,
      200,
      "#00d9ff",
    );

    ctx.fillStyle = "#00d9ff";
    ctx.font = '35px "MontserratBold", "EmojiFont"';
    ctx.textAlign = "left";
    ctx.shadowColor = "#00d9ff";
    ctx.shadowBlur = 15;
    ctx.fillText("N E W   A C H I E V E M E N T", 350, 140);
    ctx.shadowBlur = 0;

    const textGradient = ctx.createLinearGradient(350, 150, 350, 250);
    textGradient.addColorStop(0, "#ffffff");
    textGradient.addColorStop(1, "#a1c4fd");
    ctx.fillStyle = textGradient;
    ctx.font = '110px "MontserratBold", "EmojiFont"';
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.fillText(`LEVEL ${level}`, 345, 240);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = '30px "Inter", "EmojiFont"';
    ctx.fillText(`Congratulations, ${user.username}!`, 350, 295);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(850, 80);
    ctx.lineTo(910, 80);
    ctx.lineTo(880, 110);
    ctx.lineTo(820, 110);
    ctx.fillStyle = "rgba(0, 217, 255, 0.4)";
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.moveTo(800, 120);
    ctx.lineTo(880, 120);
    ctx.lineTo(850, 150);
    ctx.lineTo(770, 150);
    ctx.fillStyle = "rgba(0, 217, 255, 0.2)";
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    return canvas;
  }

  // ==========================================
  // 🏆 FUNGSI 2: KARTU PROFIL RANK
  // ==========================================
  static async generateRankCard(
    user,
    level,
    currentXp,
    requiredXp,
    rank,
    roleBadge,
    isPremium = false,
    customBgUrl = null,
    customBorderUrl = null,
  ) {
    const canvas = createCanvas(934, 282);
    const ctx = canvas.getContext("2d");

    const primaryGlow = isPremium ? "#FFD700" : "#00d9ff";
    const progressColors = isPremium
      ? ["#FF8C00", "#FFD700"]
      : ["#0088ff", "#00d9ff"];

    // BACKGROUND
    let hasCustomBg = false;
    if (customBgUrl) {
      try {
        const bgImage = await loadImage(customBgUrl);
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        // Tambahkan sedikit overlay gelap agar teks tetap terbaca
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasCustomBg = true;
      } catch (err) {
        logger.error("[CANVAS] Gagal meload custom background:", err);
      }
    }

    // DEFAULT BACKGROUND
    if (!hasCustomBg) {
      const isOwner = ["843232230689931284", "OWNER_ID_DISINI"].includes(
        user.id,
      );
      const isVip = isPremium && !isOwner;

      if (isOwner) {
        const bgGradient = ctx.createLinearGradient(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        bgGradient.addColorStop(0, "#0f2027");
        bgGradient.addColorStop(0.5, "#203a43");
        bgGradient.addColorStop(1, "#2c5364");
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        const radial = ctx.createRadialGradient(
          canvas.width,
          0,
          10,
          canvas.width,
          0,
          600,
        );
        radial.addColorStop(0, "rgba(0, 255, 255, 0.3)");
        radial.addColorStop(1, "transparent");
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw crown shape manually
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 20, 15);
        ctx.lineTo(canvas.width / 2 - 10, 35);
        ctx.lineTo(canvas.width / 2, 10);
        ctx.lineTo(canvas.width / 2 + 10, 35);
        ctx.lineTo(canvas.width / 2 + 20, 15);
        ctx.lineTo(canvas.width / 2 + 15, 40);
        ctx.lineTo(canvas.width / 2 - 15, 40);
        ctx.closePath();
        ctx.fillStyle = "#00ffff";
        ctx.fill();
        ctx.restore();
      } else if (isVip) {
        const bgGradient = ctx.createLinearGradient(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        bgGradient.addColorStop(0, "#2c1e00");
        bgGradient.addColorStop(1, "#0a0800");
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        const radial = ctx.createRadialGradient(
          canvas.width,
          0,
          10,
          canvas.width,
          0,
          600,
        );
        radial.addColorStop(0, "rgba(255, 215, 0, 0.4)");
        radial.addColorStop(1, "transparent");
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw tiny stars
        ctx.fillStyle = "#FFD700";
        for (let i = 0; i < 30; i++) {
          const sx = Math.random() * canvas.width;
          const sy = Math.random() * canvas.height;
          const sr = Math.random() * 2;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        const bgGradient = ctx.createLinearGradient(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        bgGradient.addColorStop(0, "#0c0c14");
        bgGradient.addColorStop(1, "#1b1b2f");
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        const radial = ctx.createRadialGradient(
          canvas.width,
          0,
          10,
          canvas.width,
          0,
          600,
        );
        radial.addColorStop(0, "rgba(0, 217, 255, 0.2)");
        radial.addColorStop(1, "transparent");
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw decorative shapes based on level
        const decoCount = Math.min(Math.floor(level / 10), 10);
        if (decoCount > 0) {
          ctx.strokeStyle = "rgba(0, 217, 255, 0.1)";
          ctx.lineWidth = 2;
          for (let i = 0; i < decoCount; i++) {
            const sx = Math.random() * canvas.width;
            const sy = Math.random() * canvas.height;
            const size = 10 + Math.random() * 40;
            if (Math.random() > 0.5) {
              ctx.strokeRect(sx, sy, size, size);
            } else {
              ctx.beginPath();
              ctx.arc(sx, sy, size, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }
    }

    drawRoundedRect(ctx, 20, 20, 894, 242, 20, "rgba(255, 255, 255, 0.03)");
    await drawAvatar(
      ctx,
      user.displayAvatarURL({ extension: "png", size: 256 }),
      50,
      60,
      150,
      primaryGlow,
    );

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.font = '40px "MontserratBold", "EmojiFont"';
    ctx.shadowColor = "black";
    ctx.shadowBlur = 8;
    ctx.fillText(user.username.toUpperCase(), 230, 100);
    ctx.shadowBlur = 0;

    ctx.fillStyle = primaryGlow;
    ctx.font = '22px "Inter", "EmojiFont"';
    ctx.fillText(roleBadge || "Member", 230, 135);

    ctx.textAlign = "right";
    ctx.fillStyle = "#8e98b0";
    ctx.font = '22px "InterBold", "EmojiFont"';
    ctx.fillText("RANK", canvas.width - 60, 60);
    ctx.fillStyle = primaryGlow;
    ctx.font = '55px "MontserratBold", "EmojiFont"';
    ctx.fillText(`${rank}`, canvas.width - 60, 110);

    ctx.textAlign = "left";
    ctx.fillStyle = "#8e98b0";
    ctx.font = '22px "InterBold", "EmojiFont"';
    ctx.fillText("LEVEL", canvas.width - 240, 60);
    ctx.fillStyle = "#ffffff";
    ctx.font = '55px "MontserratBold", "EmojiFont"';
    ctx.fillText(`${level}`, canvas.width - 240, 110);

    ctx.textAlign = "left";
    const percentage = Math.min(
      100,
      Math.max(0, (currentXp / requiredXp) * 100),
    );
    drawRoundedProgressBar(
      ctx,
      230,
      175,
      640,
      30,
      15,
      percentage,
      progressColors,
    );

    ctx.fillStyle = "#8e98b0";
    ctx.font = '18px "Inter", "EmojiFont"';
    ctx.fillText(
      `${Math.floor(currentXp).toLocaleString()} / ${Math.floor(requiredXp).toLocaleString()} XP`,
      230,
      230,
    );

    ctx.textAlign = "right";
    ctx.fillStyle = primaryGlow;
    ctx.font = '18px "InterBold", "EmojiFont"';
    ctx.fillText(`${Math.floor(percentage)}%`, 870, 230);

    return canvas;
  }

  // ==========================================
  // 💎 FUNGSI 3: KARTU PREMIUM TIER (Upgrade)
  // ==========================================

  /**
   * Generates a premium tier card canvas with neon badge, avatar frame,
   * progress bar, and tier-specific visual effects.
   * @param {User} user - Discord User object
   * @param {object} tierData - { name, tier } object from PREMIUM_TIERS
   * @param {boolean} isPremium - Apakah user aktif premium
   * @param {number} daysLeft - Sisa hari premium (0 jika tidak premium)
   * @param {Date|null} premiumUntil - Tanggal berakhir premium
   */
  static async generatePremiumTierCard(
    user,
    tierData = {},
    isPremium = false,
    daysLeft = 0,
    premiumUntil = null,
  ) {
    const W = 820,
      H = 280;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Tentukan warna berdasarkan tier
    const tierColorMap = {
      supporter: {
        primary: "#C0C0C0",
        glow: "rgba(192,192,192,0.4)",
        from: "#1a1a1a",
        to: "#2a2a2a",
        badge: "SUPPORTER",
      },
      friends: {
        primary: "#A855F7",
        glow: "rgba(168,85,247,0.4)",
        from: "#160a2e",
        to: "#1e0b3c",
        badge: "FRIENDS",
      },
      vip: {
        primary: "#FFD700",
        glow: "rgba(255,215,0,0.4)",
        from: "#1c1500",
        to: "#2a1e00",
        badge: "V.I.P",
      },
      none: {
        primary: "#8e98b0",
        glow: "rgba(142,152,176,0.2)",
        from: "#0c0c14",
        to: "#1b1b2f",
        badge: "REGULAR",
      },
    };
    const tier = tierData.tier || "none";
    const tc = tierColorMap[tier] || tierColorMap.none;

    // ── BACKGROUND ──────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, tc.from);
    bgGrad.addColorStop(1, tc.to);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Radial glow dari kiri atas (avatar)
    const radial = ctx.createRadialGradient(160, 140, 20, 160, 140, 400);
    radial.addColorStop(0, tc.glow);
    radial.addColorStop(1, "transparent");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // ── GLITTER PARTICLES (hanya untuk tier VIP) ─────────────
    if (tier === "vip") {
      const seed = user.id ? parseInt(user.id.slice(-4), 10) : 1234;
      ctx.fillStyle = "#FFD700";
      for (let i = 0; i < 40; i++) {
        // pseudo-random berdasarkan seed agar tidak berubah tiap render
        const px = (seed * (i + 7) * 131) % W;
        const py = (seed * (i + 3) * 97) % H;
        const pr = 0.5 + ((seed * i * 17) % 10) / 10;
        ctx.globalAlpha = 0.15 + ((seed * i * 23) % 50) / 100;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── GLASS PANEL ─────────────────────────────────────────
    drawRoundedRect(ctx, 20, 20, W - 40, H - 40, 20, "rgba(255,255,255,0.04)");

    // Border glow tipis sesuai tier
    ctx.save();
    ctx.strokeStyle = tc.primary;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, 20, W - 40, H - 40, 20);
    else ctx.rect(20, 20, W - 40, H - 40);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── AVATAR + FRAME ───────────────────────────────────────
    const avatarSize = 160;
    const avatarX = 55,
      avatarY = 60;

    // Extra ring luar (glow aura)
    ctx.save();
    ctx.strokeStyle = tc.primary;
    ctx.lineWidth = 6;
    ctx.shadowColor = tc.primary;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2 + 8,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();

    try {
      await drawAvatar(
        ctx,
        user.displayAvatarURL({ extension: "png", size: 256 }),
        avatarX,
        avatarY,
        avatarSize,
        tc.primary,
      );
    } catch (_) {
      drawRoundedRect(
        ctx,
        avatarX,
        avatarY,
        avatarSize,
        avatarSize,
        avatarSize / 2,
        "#333",
      );
    }

    // ── NEON BADGE (pojok kanan atas kartu) ──────────────────
    const badgeText = tc.badge;
    const badgeW = 130,
      badgeH = 32,
      badgeX = W - badgeW - 28,
      badgeY = 30;
    ctx.save();
    ctx.shadowColor = tc.primary;
    ctx.shadowBlur = 20;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8, tc.primary + "33");
    ctx.strokeStyle = tc.primary;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    else ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.stroke();
    ctx.fillStyle = tc.primary;
    ctx.font = '13px "MontserratBold", "EmojiFont"';
    ctx.textAlign = "center";
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 21);
    ctx.restore();

    // ── INFO TEXT ────────────────────────────────────────────
    ctx.textAlign = "left";
    const textX = avatarX + avatarSize + 30;

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = '36px "MontserratBold", "EmojiFont"';
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillText(user.username.toUpperCase(), textX, 100);
    ctx.shadowBlur = 0;

    // Tier label
    ctx.fillStyle = tc.primary;
    ctx.font = '20px "MontserratBold", "EmojiFont"';
    const tierLabel = isPremium
      ? tierData.name || "V.I.P PREMIUM MEMBER"
      : "REGULAR MEMBER";
    ctx.fillText(tierLabel, textX, 128);

    // Divider
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(textX, 140, W - textX - 40, 1.5);

    // Status baris
    ctx.fillStyle = "#8e98b0";
    ctx.font = '16px "Inter", "EmojiFont"';
    if (isPremium && premiumUntil) {
      const expTs = Math.floor(premiumUntil.getTime() / 1000);
      ctx.fillText(
        `STATUS: AKTIF  •  Berakhir: ${new Date(premiumUntil).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
        textX,
        165,
      );
    } else {
      ctx.fillText(
        "STATUS: TIDAK AKTIF, Beli VIP untuk unlock fitur eksklusif!",
        textX,
        165,
      );
    }

    // ── PROGRESS BAR SISA HARI ──────────────────────────────
    if (isPremium && daysLeft > 0) {
      // Hitung berapa total hari (asumsi: ambil dari tier info, default 365)
      const totalDays = tier === "vip" ? 365 : tier === "friends" ? 90 : 30;
      const pct = Math.min(100, Math.max(0, (daysLeft / totalDays) * 100));

      const barX = textX,
        barY = 185,
        barW = W - textX - 45,
        barH = 18;
      drawRoundedProgressBar(ctx, barX, barY, barW, barH, 9, pct, [
        tier === "vip" ? "#FF8C00" : tier === "friends" ? "#7C3AED" : "#737373",
        tc.primary,
      ]);

      ctx.fillStyle = "#8e98b0";
      ctx.font = '14px "Inter", "EmojiFont"';
      ctx.textAlign = "left";
      ctx.fillText(`${daysLeft} hari tersisa`, barX, 220);

      ctx.textAlign = "right";
      ctx.fillStyle = tc.primary;
      ctx.font = '14px "InterBold", "EmojiFont"';
      ctx.fillText(`${Math.floor(pct)}%`, barX + barW, 220);
    } else if (!isPremium) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(textX, 185, W - textX - 45, 18, 9);
      else ctx.rect(textX, 185, W - textX - 45, 18);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.fillStyle = "#8e98b0";
      ctx.font = '13px "Inter", "EmojiFont"';
      ctx.fillText(
        "Langganan untuk mengaktifkan bar ini",
        textX + (W - textX - 45) / 2,
        199,
      );
    }

    // ── WATERMARK ────────────────────────────────────────────
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = '13px "Inter", "EmojiFont"';
    ctx.fillText("NAURA V.I.P SUBSCRIPTION", W - 28, H - 22);

    return canvas;
  }

  /**
   * @deprecated Gunakan generatePremiumTierCard() sebagai gantinya.
   * Legacy alias untuk kompatibilitas mundur dari premium.js lama.
   */
  static async generatePremiumInfoCard(user, isPremium, daysLeft) {
    const tierData = isPremium
      ? {
          name: "V.I.P PREMIUM MEMBER",
          tier: daysLeft > 90 ? "vip" : daysLeft > 30 ? "friends" : "supporter",
        }
      : { name: "Regular Member", tier: "none" };
    return CanvasUtils.generatePremiumTierCard(
      user,
      tierData,
      isPremium,
      daysLeft,
      null,
    );
  }
}

module.exports = { CanvasUtils };
