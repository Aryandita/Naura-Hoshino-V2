"use strict";

const { createCanvas, drawAvatar, drawRoundedProgressBar, drawRoundedRect } = require("./helpers/canvasPrimitives");


async function generatePremiumTierCard(
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

  const tierColorMap = {
    voter: {
      primary: "#F43F5E",
      glow: "rgba(244,63,94,0.4)",
      from: "#2b0a14",
      to: "#1c060d",
      badge: "VOTER",
    },
    starter: {
      primary: "#38bdf8",
      glow: "rgba(56,189,248,0.4)",
      from: "#0c1b2f",
      to: "#071324",
      badge: "STARTER",
    },
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

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, tc.from);
  bgGrad.addColorStop(1, tc.to);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const radial = ctx.createRadialGradient(160, 140, 20, 160, 140, 400);
  radial.addColorStop(0, tc.glow);
  radial.addColorStop(1, "transparent");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);

  if (tier === "vip") {
    const seed = user.id ? parseInt(user.id.slice(-4), 10) : 1234;
    ctx.fillStyle = "#FFD700";
    for (let i = 0; i < 40; i++) {
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

  drawRoundedRect(ctx, 20, 20, W - 40, H - 40, 20, "rgba(255,255,255,0.04)");

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

  const avatarSize = 160;
  const avatarX = 55,
    avatarY = 60;

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

  ctx.textAlign = "left";
  const textX = avatarX + avatarSize + 30;

  ctx.fillStyle = "#ffffff";
  ctx.font = '36px "MontserratBold", "EmojiFont"';
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;
  ctx.fillText(user.username.toUpperCase(), textX, 100);
  ctx.shadowBlur = 0;

  ctx.fillStyle = tc.primary;
  ctx.font = '20px "MontserratBold", "EmojiFont"';
  const tierLabel = isPremium
    ? tierData.name || "V.I.P PREMIUM MEMBER"
    : "REGULAR MEMBER";
  ctx.fillText(tierLabel, textX, 128);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(textX, 140, W - textX - 40, 1.5);

  ctx.fillStyle = "#8e98b0";
  ctx.font = '16px "Inter", "EmojiFont"';
  if (isPremium && premiumUntil) {
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

  if (isPremium && daysLeft > 0) {
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

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.font = '13px "Inter", "EmojiFont"';
  ctx.fillText("NAURA V.I.P SUBSCRIPTION", W - 28, H - 22);

  return canvas;
}

async function generatePremiumInfoCard(user, isPremium, daysLeft) {
  const tierData = isPremium
    ? {
        name: "V.I.P PREMIUM MEMBER",
        tier: daysLeft > 90 ? "vip" : daysLeft > 30 ? "friends" : "supporter",
      }
    : { name: "Regular Member", tier: "none" };
  return generatePremiumTierCard(user, tierData, isPremium, daysLeft, null);
}

module.exports = { generatePremiumTierCard, generatePremiumInfoCard };
