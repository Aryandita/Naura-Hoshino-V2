// Lokasi: src/utils/CanvasUtils.js
const { createCanvas, loadImage } = require("./canvasRuntime");
const { logger } = require("../managers/logger");
const ui = require("../config/ui");
const axios = require("axios");
const leveling = require("../survival/engines/survivalLeveling");

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
// ðŸ› ï¸ HELPER DASAR (GABUNGAN)
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

  // âœ¨ FIX: Mengamankan nilai persentase agar tidak tembus (maksimal 100, minimal 0)
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

// ==========================================
// ðŸŽ® SURVIVAL RPG PROFILE CANVAS â€” V3
// Canvas: 1000 x 640px â€” Extended Layout
// ==========================================
async function generateSurvivalProfileImage(
  user,
  profile,
  survival,
  ui,
  extras = {},
) {
  const W = 1000;
  const H = 640;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const {
    activePets = [],
    marriedNPCs = [],
    botAvatar = null,
    gear = null,
    isRegistered = false,
  } = extras;

  const currentLevel = parseInt(survival.survival_level, 10) || 1;
  const currentXP = parseInt(survival.survival_xp, 10) || 0;
  const reqXP = leveling.getExpRequirement(currentLevel);
  const maxStatCap = leveling.getMaxStatCap(currentLevel);
  const maxHP = 100 + Math.min(survival.strength || 1, maxStatCap) * 10;
  const rpgState = survival.rpg_state || {};

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. BACKGROUND (location-aware)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fs = require("fs");
  const bgPath = ui.getSurvivalBackground(
    survival.currentLocation || "village",
    survival.inGameHour || 6,
  );
  const MARGIN = 16;
  const RADIUS = 18;

  // Base card fill
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, W, H, RADIUS);
  else ctx.rect(0, 0, W, H);
  ctx.fillStyle = "#17191e";
  ctx.fill();
  ctx.restore();

  // Dynamic bg image
  if (fs.existsSync(bgPath)) {
    try {
      const bgImg = await loadImage(bgPath);
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect)
        ctx.roundRect(
          MARGIN,
          MARGIN,
          W - MARGIN * 2,
          H - MARGIN * 2,
          RADIUS - 4,
        );
      else ctx.rect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
      ctx.clip();
      ctx.drawImage(bgImg, MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
      ctx.fillStyle = "rgba(10, 11, 16, 0.80)";
      ctx.fillRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
      ctx.restore();
    } catch (_) {
      drawRoundedRect(
        ctx,
        MARGIN,
        MARGIN,
        W - MARGIN * 2,
        H - MARGIN * 2,
        RADIUS - 4,
        "#1e2028",
      );
    }
  } else {
    drawRoundedRect(
      ctx,
      MARGIN,
      MARGIN,
      W - MARGIN * 2,
      H - MARGIN * 2,
      RADIUS - 4,
      "#1e2028",
    );
  }

  // Outer border glow
  ctx.save();
  ctx.strokeStyle = "rgba(255,182,193,0.25)";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(255,182,193,0.35)";
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2, RADIUS - 4);
  else ctx.rect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
  ctx.stroke();
  ctx.restore();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. AVATAR (circular, top-left)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AVA_R = 50;
  const AVA_CX = MARGIN + 22 + AVA_R;
  const AVA_CY = MARGIN + 22 + AVA_R;
  const avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
  try {
    const avaImg = await loadImage(avatarUrl);
    // Glow ring
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(255,182,193,0.65)";
    ctx.beginPath();
    ctx.arc(AVA_CX, AVA_CY, AVA_R + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,182,193,0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    // Clip & draw
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVA_CX, AVA_CY, AVA_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avaImg, AVA_CX - AVA_R, AVA_CY - AVA_R, AVA_R * 2, AVA_R * 2);
    ctx.restore();
  } catch (_) {}

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 3. IDENTITY (name, level, XP)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const INFO_X = AVA_CX + AVA_R + 18;
  const rebirthCount = rpgState.rebirth_count || 0;
  const diffText = rpgState.difficulty || "Normal";

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 26px "MontserratBold", sans-serif';
  ctx.fillText(user.displayName.toUpperCase(), INFO_X, AVA_CY - 18);

  ctx.fillStyle = "#FFD700";
  ctx.font = '14px "Inter", sans-serif';
  const subtitleParts = [`Lv.${currentLevel}  Survivor`, `Mode ${diffText}`];
  if (rebirthCount > 0) subtitleParts.push(`Rebirth x${rebirthCount}`);
  ctx.fillText(subtitleParts.join("  |  "), INFO_X, AVA_CY + 5);

  const XP_W = 240;
  ctx.fillStyle = "#8e98b0";
  ctx.font = '11px "Inter", sans-serif';
  ctx.fillText(
    `XP: ${currentXP.toLocaleString("id-ID")} / ${reqXP.toLocaleString("id-ID")}`,
    INFO_X,
    AVA_CY + 23,
  );
  drawRoundedProgressBar(
    ctx,
    INFO_X,
    AVA_CY + 29,
    XP_W,
    10,
    5,
    (currentXP / reqXP) * 100,
    ["#00D9FF", "#0055FF"],
  );

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. WALLET (top-right)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const WALLET_X = W - MARGIN - 18;
  const WALLET_Y0 = MARGIN + 18;
  const walletItems = [
    {
      label: "NAURA COIN",
      value: (profile.economy_wallet || 0).toLocaleString("id-ID"),
      color: "#FFD700",
    },
    {
      label: "STAR FRAGMENT",
      value: (survival.starFragments || 0).toLocaleString("id-ID"),
      color: "#00D9FF",
    },
    {
      label: "COUPON",
      value: (survival.coupons || 0).toLocaleString("id-ID"),
      color: "#FFB6C1",
    },
  ];
  walletItems.forEach((item, i) => {
    const yBase = WALLET_Y0 + i * 42;
    ctx.textAlign = "right";
    ctx.fillStyle = "#8e98b0";
    ctx.font = '10px "InterBold", sans-serif';
    ctx.fillText(item.label, WALLET_X, yBase);
    ctx.fillStyle = item.color;
    ctx.font = '19px "MontserratBold", sans-serif';
    ctx.fillText(item.value, WALLET_X, yBase + 20);
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. DIVIDER 1
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DIV_Y1 = AVA_CY + AVA_R + 20;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(MARGIN + 10, DIV_Y1, W - (MARGIN + 10) * 2, 1);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. THREE-COLUMN BODY
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const GAP = 14;
  const COL_W = Math.floor((W - MARGIN * 2 - GAP * 2) / 3);
  const COL_TOP = DIV_Y1 + 18;
  const COL_H = 248;
  const C1_X = MARGIN + 2;
  const C2_X = C1_X + COL_W + GAP;
  const C3_X = C2_X + COL_W + GAP;

  // Helper: glassmorphism card
  const glassCard = (x, y, w, h, accentColor = "rgba(255,255,255,0.03)") => {
    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  glassCard(C1_X, COL_TOP, COL_W, COL_H, "rgba(255,80,80,0.04)");
  glassCard(C2_X, COL_TOP, COL_W, COL_H, "rgba(147,88,235,0.04)");
  glassCard(C3_X, COL_TOP, COL_W - 4, COL_H, "rgba(255,182,193,0.04)");

  // Helper: section heading with underline accent
  const sectionHead = (text, x, y, accentColor, lineWidth = 70) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 14px "InterBold", sans-serif';
    ctx.fillText(text, x + 14, y + 20);
    ctx.fillStyle = accentColor;
    ctx.fillRect(x + 14, y + 24, lineWidth, 2);
  };

  // â”€â”€ COL 1: STATUS FISIK â”€â”€
  sectionHead("STATUS FISIK", C1_X, COL_TOP, "#FF6B6B", 72);

  const bars = [
    {
      label: `HP  ${survival.hp !== undefined ? survival.hp : maxHP}/${maxHP}`,
      pct: survival.hp !== undefined ? (survival.hp / maxHP) * 100 : 100,
      colors: ["#FF3333", "#FF7070"],
    },
    {
      label: `Lapar  ${survival.hunger || 0}/100`,
      pct: survival.hunger || 0,
      colors: ["#FF8C00", "#FFBB44"],
    },
    {
      label: `Haus  ${survival.thirst || 0}/100`,
      pct: survival.thirst || 0,
      colors: ["#00BFFF", "#87CEFA"],
    },
    {
      label: `Stamina  ${survival.stamina || 0}/100`,
      pct: survival.stamina || 0,
      colors: ["#32CD32", "#98FB98"],
    },
  ];
  const BAR_W = COL_W - 30;
  let barY = COL_TOP + 42;
  bars.forEach((b) => {
    ctx.fillStyle = "#cccccc";
    ctx.font = '11px "Inter", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(b.label, C1_X + 14, barY);
    barY += 5;
    drawRoundedProgressBar(
      ctx,
      C1_X + 14,
      barY,
      BAR_W,
      11,
      5.5,
      b.pct,
      b.colors,
    );
    barY += 25;
  });

  // Lokasi chip
  const LOCATION_NAMES_C = {
    desa: "Desa Pemula",
    village: "Desa Pemula",
    jalanan: "Pinggir Jalan",
    kota: "Kota Naura",
    city: "Kota Naura",
    hutan: "Hutan Pinus",
    laut: "Pantai Selatan",
    pantai: "Pantai Selatan",
    sawah: "Sawah Desa",
    tambang: "Tambang Kuno",
    academy: "Naura Academy",
    park: "Amusement Park",
    prison: "Penjara Kota",
  };
  const locKey = survival.currentLocation || "desa";
  const locName = LOCATION_NAMES_C[locKey] || locKey.toUpperCase();
  const locChipY = barY + 4;
  drawRoundedRect(ctx, C1_X + 14, locChipY, BAR_W, 30, 8, "rgba(0,0,0,0.35)");
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("LOKASI SAAT INI", C1_X + 20, locChipY + 12);
  ctx.fillStyle = "#00D9FF";
  ctx.font = '11px "Inter", sans-serif';
  ctx.fillText(locName, C1_X + 20, locChipY + 25);

  // â”€â”€ COL 2: STATS ATRIBUT â”€â”€
  sectionHead("STATS ATRIBUT", C2_X, COL_TOP, "#9B59B6", 82);

  const statDefs = [
    { name: "Kekuatan", key: "strength", color: "#DC143C" },
    { name: "Kelincahan", key: "agility", color: "#00FA9A" },
    { name: "Kepintaran", key: "intelligence", color: "#9370DB" },
    { name: "Keberuntungan", key: "luck", color: "#FFD700" },
  ];
  const STAT_W = COL_W - 30;
  let stY = COL_TOP + 42;
  statDefs.forEach((st) => {
    const val = survival[st.key] || 1;
    const pct = (val / maxStatCap) * 100;
    drawRoundedRect(ctx, C2_X + 14, stY, STAT_W, 36, 8, "rgba(0,0,0,0.35)");
    ctx.fillStyle = st.color;
    ctx.fillRect(C2_X + 14, stY, 4, 36);
    ctx.textAlign = "left";
    ctx.fillStyle = "#eeeeee";
    ctx.font = '12px "InterBold", sans-serif';
    ctx.fillText(st.name, C2_X + 24, stY + 13);
    drawRoundedProgressBar(ctx, C2_X + 24, stY + 20, STAT_W - 60, 7, 3.5, pct, [
      st.color,
      st.color + "AA",
    ]);
    ctx.textAlign = "right";
    ctx.fillStyle = st.color;
    ctx.font = 'bold 12px "MontserratBold", sans-serif';
    ctx.fillText(`${val}/${maxStatCap}`, C2_X + 14 + STAT_W - 2, stY + 13);
    stY += 46;
  });

  // â”€â”€ COL 3: KEAHLIAN â”€â”€
  sectionHead("KEAHLIAN", C3_X, COL_TOP, "#FFB6C1", 56);

  const className = rpgState.class || null;
  const CLASS_NAMES = {
    warrior: "Pejuang",
    mage: "Penyihir",
    rogue: "Pencuri",
    hunter: "Pemburu",
    healer: "Penyembuh",
    bard: "Penghibur",
  };
  const CLASS_SKILLS = {
    warrior: "Tebasan Badai",
    mage: "Ledakan Aura",
    rogue: "Bayangan Gelap",
    hunter: "Bidikan Tepat",
    healer: "Cahaya Suci",
    bard: "Melodi Jiwa",
  };
  const STAT_SKILL = [
    { key: "strength", skill: "Pukulan Keras", color: "#DC143C" },
    { key: "agility", skill: "Lari Kilat", color: "#00FA9A" },
    { key: "intelligence", skill: "Pikiran Tajam", color: "#9370DB" },
    { key: "luck", skill: "Hoki Murni", color: "#FFD700" },
  ];

  const dispClass = className
    ? CLASS_NAMES[className] || className
    : "Penyintas";
  const activeSkill = className
    ? CLASS_SKILLS[className] || "Kemampuan Khusus"
    : (() => {
        const best = STAT_SKILL.reduce((a, b) =>
          (survival[a.key] || 1) >= (survival[b.key] || 1) ? a : b,
        );
        return best.skill;
      })();
  const skillColor = className
    ? "#FFB6C1"
    : STAT_SKILL.find((s) => s.skill === activeSkill)?.color || "#FFB6C1";
  const SKILL_W = COL_W - 32;
  let skY = COL_TOP + 42;

  // Kelas badge
  drawRoundedRect(
    ctx,
    C3_X + 14,
    skY,
    SKILL_W,
    36,
    8,
    "rgba(255,182,193,0.10)",
  );
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("KELAS", C3_X + 20, skY + 13);
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFB6C1";
  ctx.font = 'bold 14px "MontserratBold", sans-serif';
  ctx.fillText(dispClass, C3_X + 14 + SKILL_W - 6, skY + 24);
  skY += 44;

  // Skill aktif
  drawRoundedRect(ctx, C3_X + 14, skY, SKILL_W, 36, 8, "rgba(0,0,0,0.30)");
  ctx.fillStyle = skillColor;
  ctx.fillRect(C3_X + 14, skY + 9, 3, 18);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("SKILL AKTIF", C3_X + 22, skY + 13);
  ctx.fillStyle = "#ffffff";
  ctx.font = '12px "Inter", sans-serif';
  ctx.fillText(activeSkill, C3_X + 22, skY + 27);
  skY += 44;

  // Berkah aktif
  const perks = rpgState.perks || {};
  const perkCount = Object.keys(perks).length;
  drawRoundedRect(ctx, C3_X + 14, skY, SKILL_W, 36, 8, "rgba(0,0,0,0.25)");
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("BERKAH AKTIF", C3_X + 22, skY + 13);
  ctx.fillStyle = perkCount > 0 ? "#00FA9A" : "#555";
  ctx.font = 'bold 12px "MontserratBold", sans-serif';
  ctx.fillText(
    perkCount > 0 ? `${perkCount} berkah` : "Belum ada",
    C3_X + 22,
    skY + 27,
  );
  skY += 44;

  // Pasif bonus
  const passives = [];
  if ((survival.strength || 1) > 1)
    passives.push(`HP +${(Math.min(survival.strength, maxStatCap) - 1) * 10}`);
  if ((survival.luck || 1) > 1) passives.push(`Hoki +${survival.luck - 1}`);
  if (passives.length > 0) {
    drawRoundedRect(ctx, C3_X + 14, skY, SKILL_W, 36, 8, "rgba(0,0,0,0.20)");
    ctx.textAlign = "left";
    ctx.fillStyle = "#8e98b0";
    ctx.font = '10px "InterBold", sans-serif';
    ctx.fillText("PASIF BONUS", C3_X + 22, skY + 13);
    ctx.fillStyle = "#FFD700";
    ctx.font = '11px "Inter", sans-serif';
    const passTxt = passives.join(" | ");
    ctx.fillText(
      passTxt.length > 28 ? passTxt.substring(0, 26) + "..." : passTxt,
      C3_X + 22,
      skY + 27,
    );
    skY += 44;
  }

  // Rebirth badge
  if (rebirthCount > 0) {
    drawRoundedRect(
      ctx,
      C3_X + 14,
      skY,
      SKILL_W,
      30,
      8,
      "rgba(255,215,0,0.12)",
    );
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFD700";
    ctx.font = 'bold 12px "InterBold", sans-serif';
    ctx.fillText(`REBIRTH x${rebirthCount}`, C3_X + 14 + SKILL_W / 2, skY + 19);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 7. DIVIDER 2
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DIV_Y2 = COL_TOP + COL_H + 16;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(MARGIN + 10, DIV_Y2, W - (MARGIN + 10) * 2, 1);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 8. BOTTOM ROW: Quest / Pet / NPC Spouse
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const BOT_TOP = DIV_Y2 + 16;
  const BOT_H = 98;

  glassCard(C1_X, BOT_TOP, COL_W, BOT_H, "rgba(255,215,0,0.05)");
  glassCard(C2_X, BOT_TOP, COL_W, BOT_H, "rgba(50,205,50,0.05)");
  glassCard(C3_X, BOT_TOP, COL_W - 4, BOT_H, "rgba(255,100,160,0.05)");

  // Accent top border strips per card
  ctx.fillStyle = "rgba(255,215,0,0.45)";
  ctx.fillRect(C1_X, BOT_TOP, COL_W, 2);
  ctx.fillStyle = "rgba(50,205,50,0.45)";
  ctx.fillRect(C2_X, BOT_TOP, COL_W, 2);
  ctx.fillStyle = "rgba(255,100,160,0.45)";
  ctx.fillRect(C3_X, BOT_TOP, COL_W - 4, 2);

  // Quest card
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFD700";
  ctx.font = 'bold 11px "InterBold", sans-serif';
  ctx.fillText("QUEST", C1_X + 14, BOT_TOP + 18);
  let questText = "Tidak ada quest aktif";
  let questColor = "#8e98b0";
  if (!isRegistered) {
    questText = "Daftar via /survival start";
    questColor = "#FF8C00";
  } else if (gear && !gear.axe && !gear.pickaxe) {
    questText = "Tempa alat pertamamu!";
    questColor = "#FFD700";
  }
  const questWords = questText.split(" ");
  const questLines = [];
  let questLineStr = "";
  for (const w of questWords) {
    if ((questLineStr + w).length > 34 && questLineStr.length > 0) {
      questLines.push(questLineStr.trim());
      questLineStr = "";
    }
    questLineStr += w + " ";
  }
  if (questLineStr.trim()) questLines.push(questLineStr.trim());
  ctx.fillStyle = questColor;
  ctx.font = '12px "Inter", sans-serif';
  questLines
    .slice(0, 3)
    .forEach((ql, qi) => ctx.fillText(ql, C1_X + 14, BOT_TOP + 38 + qi * 17));

  // Pet card
  ctx.textAlign = "left";
  ctx.fillStyle = "#32CD32";
  ctx.font = 'bold 11px "InterBold", sans-serif';
  ctx.fillText("PET AKTIF", C2_X + 14, BOT_TOP + 18);
  const activePet =
    Array.isArray(activePets) && activePets.length > 0 ? activePets[0] : null;
  if (activePet) {
    const petName = activePet.petName || activePet.petType || "Pet";
    const petType = (activePet.petType || "").toLowerCase();
    const PET_COLORS = { wolf: "#DC143C", cat: "#FFB6C1", dragon: "#FF6B00" };
    const PET_BONUS_TXT = {
      wolf: "+2 Strength",
      cat: "+2 Luck",
      dragon: "+3 STR / +1 LUK",
    };
    ctx.fillStyle = PET_COLORS[petType] || "#32CD32";
    ctx.font = 'bold 13px "MontserratBold", sans-serif';
    ctx.fillText(petName, C2_X + 14, BOT_TOP + 42);
    ctx.fillStyle = "#8e98b0";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText(
      PET_BONUS_TXT[petType] || "Teman setia",
      C2_X + 14,
      BOT_TOP + 58,
    );
    ctx.fillStyle = "#555";
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText("Efek bonus aktif", C2_X + 14, BOT_TOP + 73);
  } else {
    ctx.fillStyle = "#555";
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText("Belum ada teman berbulu", C2_X + 14, BOT_TOP + 46);
    ctx.fillStyle = "#444";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText("Pelihara di /survival pet", C2_X + 14, BOT_TOP + 63);
  }

  // NPC Spouse card
  ctx.textAlign = "left";
  ctx.fillStyle = "#FF64A0";
  ctx.font = 'bold 11px "InterBold", sans-serif';
  ctx.fillText("PASANGAN NPC", C3_X + 14, BOT_TOP + 18);
  const npc =
    Array.isArray(marriedNPCs) && marriedNPCs.length > 0
      ? marriedNPCs[0]
      : null;
  if (npc) {
    const npcId = npc.npcId || "NPC";
    ctx.fillStyle = "#FFB6C1";
    ctx.font = 'bold 13px "MontserratBold", sans-serif';
    ctx.fillText(npcId, C3_X + 14, BOT_TOP + 42);
    ctx.fillStyle = "#8e98b0";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText("Status: Menikah", C3_X + 14, BOT_TOP + 58);
    const npcAffection = npc.affection || npc.affectionPoints || 0;
    if (npcAffection > 0) {
      ctx.fillStyle = "#FF64A0";
      ctx.font = '11px "Inter", sans-serif';
      ctx.fillText(`Kasih sayang: ${npcAffection}`, C3_X + 14, BOT_TOP + 73);
    }
  } else {
    ctx.fillStyle = "#555";
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText("Masih sendiri~", C3_X + 14, BOT_TOP + 46);
    ctx.fillStyle = "#444";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText("Kunjungi NPC di /npc chat", C3_X + 14, BOT_TOP + 63);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 9. DIVIDER 3
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DIV_Y3 = BOT_TOP + BOT_H + 14;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(MARGIN + 10, DIV_Y3, W - (MARGIN + 10) * 2, 1);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 10. FOOTER BAR (Naura branded)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const FOOT_TOP = DIV_Y3 + 10;
  const FOOT_H = 46;
  const FOOT_MID = FOOT_TOP + FOOT_H / 2;

  // Footer glass card
  drawRoundedRect(
    ctx,
    MARGIN + 4,
    FOOT_TOP,
    W - (MARGIN + 4) * 2,
    FOOT_H,
    10,
    "rgba(255,182,193,0.05)",
  );

  // Gradient wash left -> right
  const footGrad = ctx.createLinearGradient(MARGIN + 4, 0, W - MARGIN - 4, 0);
  footGrad.addColorStop(0, "rgba(255,182,193,0.10)");
  footGrad.addColorStop(1, "rgba(255,182,193,0)");
  ctx.fillStyle = footGrad;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(MARGIN + 4, FOOT_TOP, W - (MARGIN + 4) * 2, FOOT_H, 10);
  else ctx.rect(MARGIN + 4, FOOT_TOP, W - (MARGIN + 4) * 2, FOOT_H);
  ctx.fill();

  // Naura bot avatar circle
  const BOT_AVA_R = 17;
  const BOT_AVA_CX = MARGIN + 22 + BOT_AVA_R;
  if (botAvatar) {
    try {
      const botImg = await loadImage(botAvatar);
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(255,182,193,0.5)";
      ctx.beginPath();
      ctx.arc(BOT_AVA_CX, FOOT_MID, BOT_AVA_R + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,182,193,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(BOT_AVA_CX, FOOT_MID, BOT_AVA_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        botImg,
        BOT_AVA_CX - BOT_AVA_R,
        FOOT_MID - BOT_AVA_R,
        BOT_AVA_R * 2,
        BOT_AVA_R * 2,
      );
      ctx.restore();
    } catch (_) {}
  }

  // System label
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,182,193,0.85)";
  ctx.font = 'bold 13px "MontserratBold", sans-serif';
  ctx.fillText(
    "Naura Survival System",
    BOT_AVA_CX + BOT_AVA_R + 10,
    FOOT_MID + 5,
  );

  // Right side: game time & version
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(142,152,176,0.65)";
  ctx.font = '11px "Inter", sans-serif';
  const dayNum = survival.inGameDay || 1;
  const hourNum = (survival.inGameHour || 6).toString().padStart(2, "0");
  ctx.fillText(
    `Hari ke-${dayNum}  |  ${hourNum}:00  |  v2.1.0`,
    W - MARGIN - 16,
    FOOT_MID + 5,
  );

  return canvas.toBuffer("image/png");
}

// ==========================================
// ðŸŽµ MUSIC PROFILE CANVAS â€” PREMIUM REDESIGN
// Canvas: 1100 x 680px
// ==========================================
async function generateMusicProfileImage(user, stats, clientAvatar) {
  const W = 1100;
  const H = 680;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const isVIP = Boolean(stats.isPremium);
  const accentHex = isVIP ? "#FFD700" : "#00D9FF";
  const ac2Hex = isVIP ? "#FFA500" : "#0055FF";

  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };
  const ac = hexToRgb(accentHex);

  // ─── 1. BACKGROUND (Dynamic Music Profile Banner / Gradient Fallback) ─────
  const fs = require("fs");
  const bannerPath =
    ui.getBanner?.("musicProfile") ||
    ui.getBanner?.("nowPlaying") ||
    "./assets/music/Now Playing Banner.jpeg";
  let bgImgLoaded = false;
  if (bannerPath && fs.existsSync(bannerPath)) {
    try {
      const bgImg = await loadImage(bannerPath);
      ctx.drawImage(bgImg, 0, 0, W, H);
      // Dark elegant overlay so cards and text pop out
      ctx.fillStyle = "rgba(7, 10, 18, 0.82)";
      ctx.fillRect(0, 0, W, H);
      bgImgLoaded = true;
    } catch (_) {}
  }

  if (!bgImgLoaded) {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#06080f");
    bg.addColorStop(0.5, "#0b0f1c");
    bg.addColorStop(1, "#080c14");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // Left ambient glow (accent)
  const glowL = ctx.createRadialGradient(160, 180, 20, 160, 180, 420);
  glowL.addColorStop(0, `rgba(${ac.r},${ac.g},${ac.b},0.14)`);
  glowL.addColorStop(1, "rgba(6,8,15,0)");
  ctx.fillStyle = glowL;
  ctx.fillRect(0, 0, W, H);

  // Right ambient glow (secondary)
  const glowR = ctx.createRadialGradient(
    W - 200,
    H - 150,
    10,
    W - 200,
    H - 150,
    380,
  );
  glowR.addColorStop(0, isVIP ? "rgba(255,165,0,0.1)" : "rgba(0,85,255,0.08)");
  glowR.addColorStop(1, "rgba(6,8,15,0)");
  ctx.fillStyle = glowR;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid
  ctx.fillStyle = "rgba(255,255,255,0.022)";
  for (let gx = 20; gx < W; gx += 40) {
    for (let gy = 20; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Outer canvas border
  ctx.save();
  ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.18)`;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 16;
  ctx.shadowColor = `rgba(${ac.r},${ac.g},${ac.b},0.3)`;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(10, 10, W - 20, H - 20, 22);
  else ctx.rect(10, 10, W - 20, H - 20);
  ctx.stroke();
  ctx.restore();

  // â”€â”€â”€ 2. HEADER CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const HDR_X = 24;
  const HDR_Y = 24;
  const HDR_W = W - 48;
  const HDR_H = 210;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(HDR_X, HDR_Y, HDR_W, HDR_H, 18);
  else ctx.rect(HDR_X, HDR_Y, HDR_W, HDR_H);
  ctx.fill();
  ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.22)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Accent left strip on header
  const gradStrip = ctx.createLinearGradient(
    HDR_X,
    HDR_Y,
    HDR_X,
    HDR_Y + HDR_H,
  );
  gradStrip.addColorStop(0, accentHex);
  gradStrip.addColorStop(1, ac2Hex);
  ctx.fillStyle = gradStrip;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(HDR_X, HDR_Y, 4, HDR_H, [18, 0, 0, 18]);
  else ctx.fillRect(HDR_X, HDR_Y, 4, HDR_H);
  ctx.fill();

  // â”€â”€â”€ 3. AVATAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const AVA_R = 72;
  const AVA_CX = HDR_X + 24 + AVA_R;
  const AVA_CY = HDR_Y + HDR_H / 2;

  // VIP outer glow ring
  if (isVIP) {
    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#FFD700";
    ctx.beginPath();
    ctx.arc(AVA_CX, AVA_CY, AVA_R + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,215,0,0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = `rgba(${ac.r},${ac.g},${ac.b},0.6)`;
    ctx.beginPath();
    ctx.arc(AVA_CX, AVA_CY, AVA_R + 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.65)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Avatar clip & draw
  let userAvatarImg = null;
  try {
    userAvatarImg = await loadImage(
      user.displayAvatarURL({ extension: "png", size: 256 }),
    );
  } catch (_) {
    try {
      userAvatarImg = await loadImage(clientAvatar);
    } catch (_2) {}
  }
  if (userAvatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVA_CX, AVA_CY, AVA_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      userAvatarImg,
      AVA_CX - AVA_R,
      AVA_CY - AVA_R,
      AVA_R * 2,
      AVA_R * 2,
    );
    ctx.restore();
  }

  // â”€â”€â”€ 4. IDENTITY (name, username, badge) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ID_X = AVA_CX + AVA_R + 24;

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 38px "MontserratBold", sans-serif';
  ctx.fillText(user.displayName || user.username, ID_X, AVA_CY - 26);

  ctx.fillStyle = accentHex;
  ctx.font = '19px "Inter", sans-serif';
  ctx.fillText(`@${user.username}`, ID_X, AVA_CY + 6);

  // Badge (pill drawn manually, no emoji)
  const BADGE_LABEL = isVIP ? "VIP PRESTIGE" : "MEMBER PROFILE";
  const BADGE_COLOR = isVIP ? "#FFD700" : "#8e98b0";
  ctx.font = 'bold 13px "InterBold", sans-serif';
  const badgeW = ctx.measureText(BADGE_LABEL).width + 28;
  ctx.fillStyle = isVIP ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.06)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(ID_X, AVA_CY + 18, badgeW, 26, 13);
  else ctx.rect(ID_X, AVA_CY + 18, badgeW, 26);
  ctx.fill();
  // Small square indicator
  ctx.fillStyle = BADGE_COLOR;
  ctx.fillRect(ID_X + 10, AVA_CY + 28, 6, 6);
  ctx.fillStyle = BADGE_COLOR;
  ctx.fillText(BADGE_LABEL, ID_X + 22, AVA_CY + 36);

  // â”€â”€â”€ 5. STAT BOXES (right of header) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const STAT_START_X = W - 530;
  const STAT_Y = HDR_Y + 28;
  const STAT_BOX_W = 155;
  const STAT_BOX_H = HDR_H - 56;

  const statBoxes = [
    {
      label: "TOTAL TREK",
      value: `${stats.tracksListened || 0}`,
      color: accentHex,
    },
    {
      label: "TOTAL DURASI",
      value: formatDur(stats.totalDurationMs),
      color: accentHex,
    },
    {
      label: "TERAKHIR DIPUTAR",
      value: truncateText(
        ctx,
        stats.lastListened || "Belum ada",
        STAT_BOX_W - 16,
      ),
      color: "#F9A8D4",
      big: false,
    },
  ];

  statBoxes.forEach((sb, i) => {
    const bx = STAT_START_X + i * (STAT_BOX_W + 20);
    // Box bg
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, STAT_Y, STAT_BOX_W, STAT_BOX_H, 12);
    else ctx.rect(bx, STAT_Y, STAT_BOX_W, STAT_BOX_H);
    ctx.fill();
    // Top accent line
    const acGrad = ctx.createLinearGradient(
      bx,
      STAT_Y,
      bx + STAT_BOX_W,
      STAT_Y,
    );
    acGrad.addColorStop(0, accentHex);
    acGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = acGrad;
    ctx.fillRect(bx + 12, STAT_Y, STAT_BOX_W - 24, 2);
    // Label
    ctx.textAlign = "left";
    ctx.fillStyle = "#8e98b0";
    ctx.font = '11px "InterBold", sans-serif';
    ctx.fillText(sb.label, bx + 12, STAT_Y + 24);
    // Value
    ctx.fillStyle = sb.color;
    ctx.font =
      sb.big === false
        ? '16px "MontserratBold", sans-serif'
        : 'bold 30px "MontserratBold", sans-serif';
    if (sb.big === false) {
      // Multi-line wrap for last played
      ctx.fillStyle = "#ffffff";
      ctx.font = '15px "InterBold", sans-serif';
      wrapText(ctx, sb.value, bx + 12, STAT_Y + 50, STAT_BOX_W - 16, 20, 4);
    } else {
      ctx.fillText(sb.value, bx + 12, STAT_Y + 75);
    }
  });

  // â”€â”€â”€ 6. GRADIENT DIVIDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DIV_Y = HDR_Y + HDR_H + 20;
  const divGrad = ctx.createLinearGradient(24, DIV_Y, W - 24, DIV_Y);
  divGrad.addColorStop(0, "rgba(0,0,0,0)");
  divGrad.addColorStop(0.3, `rgba(${ac.r},${ac.g},${ac.b},0.4)`);
  divGrad.addColorStop(0.7, `rgba(${ac.r},${ac.g},${ac.b},0.4)`);
  divGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(24, DIV_Y, W - 48, 1);

  // â”€â”€â”€ 7. THREE LIST CARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const CARD_Y = DIV_Y + 20;
  const CARD_H = H - CARD_Y - 50;
  const CARD_GAP = 20;
  const CARD_W = Math.floor((W - 48 - CARD_GAP * 2) / 3);

  const cardDefs = [
    {
      title: "TOP 5 TREK",
      items: stats.topTracks,
      color: accentHex,
      lineColor: accentHex,
    },
    {
      title: "TOP 5 SERVER",
      items: stats.topServers,
      color: isVIP ? "#FFA500" : "#FFD700",
      lineColor: isVIP ? "#FFA500" : "#FFD700",
    },
    {
      title: "TOP 5 RELASI",
      items: stats.topFriends,
      color: "#FF6B7A",
      lineColor: "#FF6B7A",
    },
  ];

  const rankColors = [accentHex, "#ffffff", "#8e98b0", "#6b7280", "#4b5563"];

  cardDefs.forEach((card, ci) => {
    const cx = 24 + ci * (CARD_W + CARD_GAP);

    // Card background
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx, CARD_Y, CARD_W, CARD_H, 16);
    else ctx.rect(cx, CARD_Y, CARD_W, CARD_H);
    ctx.fill();

    // Card border
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx, CARD_Y, CARD_W, CARD_H, 16);
    else ctx.rect(cx, CARD_Y, CARD_W, CARD_H);
    ctx.stroke();
    ctx.restore();

    // Colored top strip
    const stripGrad = ctx.createLinearGradient(cx, CARD_Y, cx + CARD_W, CARD_Y);
    stripGrad.addColorStop(0, card.lineColor);
    stripGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = stripGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx, CARD_Y, CARD_W, 3, [16, 16, 0, 0]);
    else ctx.fillRect(cx, CARD_Y, CARD_W, 3);
    ctx.fill();

    // Card title (NO emoji â€” icon drawn as shape)
    ctx.textAlign = "left";
    ctx.fillStyle = card.color;
    ctx.font = 'bold 16px "MontserratBold", sans-serif';
    ctx.fillText(card.title, cx + 18, CARD_Y + 36);

    // Thin separator below title
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(cx + 18, CARD_Y + 44, CARD_W - 36, 1);

    // List items
    const listY0 = CARD_Y + 66;
    const ROW_H = Math.floor((CARD_H - 80) / 5);

    if (!card.items || card.items.length === 0) {
      ctx.fillStyle = "#4b5560";
      ctx.font = 'italic 15px "Inter", sans-serif';
      ctx.fillText("Belum ada data", cx + 18, listY0 + 20);
    } else {
      card.items.slice(0, 5).forEach((item, ri) => {
        const ry = listY0 + ri * ROW_H;

        // Alternating row bg
        if (ri % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.025)";
          ctx.beginPath();
          if (ctx.roundRect)
            ctx.roundRect(cx + 8, ry - 14, CARD_W - 16, ROW_H, 6);
          else ctx.rect(cx + 8, ry - 14, CARD_W - 16, ROW_H);
          ctx.fill();
        }

        // Rank badge (circle with number)
        const rankC = hexToRgb(rankColors[ri] || "#4b5563");
        ctx.fillStyle = `rgba(${rankC.r},${rankC.g},${rankC.b},0.18)`;
        ctx.beginPath();
        ctx.arc(cx + 28, ry - 3, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = "center";
        ctx.fillStyle = rankColors[ri] || "#4b5563";
        ctx.font = 'bold 12px "MontserratBold", sans-serif';
        ctx.fillText(`${ri + 1}`, cx + 28, ry + 1);

        // Item text
        ctx.textAlign = "left";
        ctx.fillStyle = ri === 0 ? "#ffffff" : "#c9d1e0";
        ctx.font =
          ri === 0
            ? 'bold 14px "InterBold", sans-serif'
            : '13px "Inter", sans-serif';
        const itemText = truncateText(ctx, String(item), CARD_W - 68);
        ctx.fillText(itemText, cx + 48, ry + 1);
      });
    }
  });

  // â”€â”€â”€ 8. FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Naura avatar circle
  let nauraImg = null;
  try {
    nauraImg = await loadImage(clientAvatar);
  } catch (_) {}
  if (nauraImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 36, H - 26, 16, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(nauraImg, W - 52, H - 42, 32, 32);
    ctx.restore();
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.font = 'bold 13px "MontserratBold", sans-serif';
  ctx.fillText("Naura Music Intelligence", W - 60, H - 20);

  return canvas.toBuffer("image/png");
}

// ============================================================
// ðŸŽµ generateMusicPanelImage â€” Redesigned Premium Card Layout
// Canvas: 750 x 240px â€” Glassmorphism + Neon Glow + Waveform
// ============================================================
async function generateMusicPanelImage(track, currentPos, clientAvatar) {
  const W = 750;
  const H = 240;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // --- 1. Platform detection & accent color ---
  const source = (
    track?.info?.originalSource ||
    track?.info?.sourceName ||
    "youtube"
  ).toLowerCase();

  let accentHex = "#FFB6C1"; // Default: Naura Pink
  let platformLabel = "LAVALINK";
  if (source.includes("spotify")) {
    accentHex = "#1DB954";
    platformLabel = "SPOTIFY";
  } else if (source.includes("ytm")) {
    accentHex = "#FF0000";
    platformLabel = "YT MUSIC";
  } else if (source.includes("youtube")) {
    accentHex = "#FF0000";
    platformLabel = "YOUTUBE";
  } else if (source.includes("soundcloud")) {
    accentHex = "#FF5500";
    platformLabel = "SOUNDCLOUD";
  }

  // Convert hex accent to rgba components for gradients
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };
  const ac = hexToRgb(accentHex);

  // --- 2. Background: Dynamic Now Playing Banner / Fallback ---
  const fs = require("fs");
  const bannerPath =
    ui.getBanner?.("musicNowPlaying") ||
    ui.getBanner?.("nowPlaying") ||
    "./assets/music/Now Playing Banner.jpeg";
  let bgImgLoaded = false;
  if (bannerPath && fs.existsSync(bannerPath)) {
    try {
      const bgImg = await loadImage(bannerPath);
      ctx.drawImage(bgImg, 0, 0, W, H);
      // Dark overlay for high contrast and readability
      ctx.fillStyle = "rgba(9, 11, 16, 0.78)";
      ctx.fillRect(0, 0, W, H);
      bgImgLoaded = true;
    } catch (_) {}
  }

  if (!bgImgLoaded) {
    ctx.fillStyle = "#090b10";
    ctx.fillRect(0, 0, W, H);
  }

  // Ambient radial glow pulsing from the album art area (left)
  const glow = ctx.createRadialGradient(115, H / 2, 10, 115, H / 2, 280);
  glow.addColorStop(0, `rgba(${ac.r},${ac.g},${ac.b},0.18)`);
  glow.addColorStop(1, "rgba(9,11,16,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle right-side secondary glow for depth
  const glowR = ctx.createRadialGradient(W - 60, H / 2, 5, W - 60, H / 2, 200);
  glowR.addColorStop(0, `rgba(${ac.r},${ac.g},${ac.b},0.08)`);
  glowR.addColorStop(1, "rgba(9,11,16,0)");
  ctx.fillStyle = glowR;
  ctx.fillRect(0, 0, W, H);

  // --- 3. Glassmorphism card border ---
  ctx.save();
  ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.35)`;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 12;
  ctx.shadowColor = `rgba(${ac.r},${ac.g},${ac.b},0.4)`;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 8, W - 16, H - 16, 18);
  else ctx.rect(8, 8, W - 16, H - 16);
  ctx.stroke();
  ctx.restore();

  // Inner glass fill
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 8, W - 16, H - 16, 18);
  else ctx.rect(8, 8, W - 16, H - 16);
  ctx.fill();
  ctx.restore();

  // --- 4. Album Art (rounded rect, left side) ---
  const ART_X = 24;
  const ART_Y = 24;
  const ART_W = 192;
  const ART_H = 192;
  const ART_R = 14;

  // Art shadow / glow
  ctx.save();
  ctx.shadowBlur = 28;
  ctx.shadowColor = `rgba(${ac.r},${ac.g},${ac.b},0.55)`;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(ART_X, ART_Y, ART_W, ART_H, ART_R);
  else ctx.rect(ART_X, ART_Y, ART_W, ART_H);
  ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.1)`;
  ctx.fill();
  ctx.restore();

  // Load high-resolution square cover art
  const {
    resolveHighResArtwork,
    drawImageCover,
  } = require("./artworkResolver");

  const trackImageUrl = await resolveHighResArtwork(track, clientAvatar);

  let thumbImg = null;
  if (
    trackImageUrl &&
    typeof trackImageUrl === "string" &&
    trackImageUrl.startsWith("http")
  ) {
    try {
      const resp = await axios.get(trackImageUrl, {
        responseType: "arraybuffer",
        timeout: 5000,
      });
      thumbImg = await loadImage(Buffer.from(resp.data));
    } catch (_) {
      try {
        if (clientAvatar && clientAvatar.startsWith("http")) {
          const resp = await axios.get(clientAvatar, {
            responseType: "arraybuffer",
            timeout: 5000,
          });
          thumbImg = await loadImage(Buffer.from(resp.data));
        }
      } catch (_2) {}
    }
  }

  // Draw art with object-fit: cover
  if (thumbImg) {
    drawImageCover(ctx, thumbImg, ART_X, ART_Y, ART_W, ART_H, ART_R);
  } else {
    // Fallback vinyl-like placeholder
    const fbGrad = ctx.createLinearGradient(
      ART_X,
      ART_Y,
      ART_X + ART_W,
      ART_Y + ART_H,
    );
    fbGrad.addColorStop(0, "#1a0d2e");
    fbGrad.addColorStop(1, "#0b0c10");
    ctx.fillStyle = fbGrad;
    ctx.fillRect(ART_X, ART_Y, ART_W, ART_H);

    // Concentric rings
    for (let r = 30; r < 90; r += 18) {
      ctx.beginPath();
      ctx.arc(ART_X + ART_W / 2, ART_Y + ART_H / 2, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.15)`;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    // Center dot
    ctx.beginPath();
    ctx.arc(ART_X + ART_W / 2, ART_Y + ART_H / 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.5)`;
    ctx.fill();
  }
  ctx.restore();

  // Art border outline
  ctx.save();
  ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.6)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(ART_X, ART_Y, ART_W, ART_H, ART_R);
  else ctx.rect(ART_X, ART_Y, ART_W, ART_H);
  ctx.stroke();
  ctx.restore();

  // Platform badge on art (bottom-left corner)
  const BADGE_X = ART_X + 8;
  const BADGE_Y = ART_Y + ART_H - 26;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(BADGE_X, BADGE_Y, platformLabel.length * 7.5 + 14, 20, 5);
  else ctx.rect(BADGE_X, BADGE_Y, platformLabel.length * 7.5 + 14, 20);
  ctx.fill();
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 10px "MontserratBold", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(platformLabel, BADGE_X + 7, BADGE_Y + 13.5);
  ctx.restore();

  // --- 5. Info zone (right of album art) ---
  const INFO_X = ART_X + ART_W + 22;
  const INFO_W = W - INFO_X - 20;

  // "NOW PLAYING" label â€” gambar segitiga play manual (â–¶ tidak ada di font Montserrat)
  ctx.save();
  ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.9)`;
  ctx.beginPath();
  ctx.moveTo(INFO_X, 35);
  ctx.lineTo(INFO_X + 9, 40);
  ctx.lineTo(INFO_X, 45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.85)`;
  ctx.font = 'bold 11px "MontserratBold", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("NOW PLAYING", INFO_X + 14, 42);

  // Separator line under label
  ctx.save();
  ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.3)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(INFO_X, 50);
  ctx.lineTo(INFO_X + INFO_W, 50);
  ctx.stroke();
  ctx.restore();

  // Track title (max 2 lines, 22px bold)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 22px "MontserratBold", "EmojiFont", sans-serif';
  ctx.textAlign = "left";
  wrapText(ctx, track.info.title || "Unknown Track", INFO_X, 80, INFO_W, 28, 2);
  ctx.restore();

  // Artist name
  ctx.fillStyle = "#F9A8D4";
  ctx.font = '14px "Inter", "EmojiFont", sans-serif';
  ctx.textAlign = "left";
  const artist = (track.info.author || "Unknown Artist").substring(0, 40);
  ctx.fillText(artist, INFO_X, 140);

  // --- 6. Waveform / equalizer bars ---
  const BAR_CNT = 28;
  const BAR_W = 3;
  const BAR_GAP = 6;
  const WAVE_X = INFO_X;
  const WAVE_BASE_Y = 168;
  const WAVE_MAX_H = 18;

  ctx.save();
  for (let i = 0; i < BAR_CNT; i++) {
    const phase = currentPos / 900 + i * 0.55;
    const barH = Math.max(
      3,
      Math.abs(Math.sin(phase) * Math.cos(i * 0.4)) * WAVE_MAX_H + 3,
    );
    const bx = WAVE_X + i * (BAR_W + BAR_GAP);
    const by = WAVE_BASE_Y - barH;

    // Gradient fill per bar
    const barGrad = ctx.createLinearGradient(bx, by, bx, WAVE_BASE_Y);
    barGrad.addColorStop(0, `rgba(${ac.r},${ac.g},${ac.b},0.95)`);
    barGrad.addColorStop(1, `rgba(${ac.r},${ac.g},${ac.b},0.25)`);
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, BAR_W, barH, 2);
    else ctx.rect(bx, by, BAR_W, barH);
    ctx.fill();
  }
  ctx.restore();

  // --- 7. Progress bar (horizontal, full INFO_W) ---
  const PB_X = INFO_X;
  const PB_Y = 182;
  const PB_H = 6;
  const PB_W = INFO_W;

  const duration = track.info.length || 1;
  const progress = Math.max(0, Math.min(1, currentPos / duration));

  // Track (background)
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(PB_X, PB_Y, PB_W, PB_H, 3);
  else ctx.rect(PB_X, PB_Y, PB_W, PB_H);
  ctx.fill();

  // Filled portion with gradient
  if (progress > 0) {
    const pbFill = ctx.createLinearGradient(PB_X, 0, PB_X + PB_W, 0);
    pbFill.addColorStop(0, accentHex);
    pbFill.addColorStop(1, `rgba(${ac.r},${ac.g},${ac.b},0.6)`);
    ctx.fillStyle = pbFill;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `rgba(${ac.r},${ac.g},${ac.b},0.7)`;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(PB_X, PB_Y, PB_W * progress, PB_H, 3);
    else ctx.rect(PB_X, PB_Y, PB_W * progress, PB_H);
    ctx.fill();

    // Playhead dot
    const dotX = PB_X + PB_W * progress;
    ctx.beginPath();
    ctx.arc(dotX, PB_Y + PB_H / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowBlur = 8;
    ctx.shadowColor = accentHex;
    ctx.fill();
  }
  ctx.restore();

  // --- 8. Timestamps ---
  ctx.font = '12px "Inter", sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "left";
  if (track.info.isStream) {
    ctx.fillStyle = "#FF4757";
    ctx.font = 'bold 12px "InterBold", sans-serif';
    ctx.fillText("ðŸ”´ LIVE STREAM", PB_X, PB_Y + 22);
  } else {
    ctx.fillText(formatDur(currentPos), PB_X, PB_Y + 22);
    ctx.textAlign = "right";
    ctx.fillText(formatDur(duration), PB_X + PB_W, PB_Y + 22);
  }

  // --- 9. Bottom brand watermark â€” gambar bintang 4-titik manual (âœ¦ tidak ada di font) ---
  ctx.save();
  ctx.font = 'bold 10px "MontserratBold", sans-serif';
  ctx.textAlign = "right";
  const wmText = "HOSHINO FM";
  const wmW = ctx.measureText(wmText).width;
  // Cross/star shape sebelum teks
  const sx = W - 16 - wmW - 10;
  const sy = H - 17;
  ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.55)`;
  // Horizontal bar
  ctx.fillRect(sx - 4, sy - 1, 8, 2);
  // Vertical bar
  ctx.fillRect(sx - 1, sy - 4, 2, 8);
  // Diagonal dots (bintang 4 sudut)
  ctx.beginPath();
  ctx.arc(sx - 3, sy - 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 3, sy - 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx - 3, sy + 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 3, sy + 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Teks watermark
  ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.5)`;
  ctx.fillText(wmText, W - 16, H - 12);
  ctx.restore();

  return canvas.toBuffer("image/png");
}

// ==========================================
// ðŸ‘‹ GREETING / WELCOME CANVAS (REMASTERED)
// ==========================================
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
  } catch (e) {}

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
  ctx.fillText(`${tag}   â€¢   ${countText}`, subtitleX, subtitleY);

  ctx.fillStyle = customGlow;
  ctx.fillRect(subtitleX, subtitleY + 25, 150, 4);

  return canvas.toBuffer("image/png");
}

// ==========================================
// ðŸ“ˆ LEVEL UP CANVAS (FUNGSI BARU)
// ==========================================
// 📈 LEVEL UP CANVAS (CYBER-ANIME REVAMP)
// ==========================================
async function generateLevel(user, level) {
  const W = 840,
    H = 260;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Background Gradient (Cyber Midnight)
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#08090C");
  bgGrad.addColorStop(0.5, "#140e28");
  bgGrad.addColorStop(1, "#0a1120");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Ambient Radial Glow & Festive Sparkles
  const radialGlow = ctx.createRadialGradient(
    W * 0.7,
    H * 0.4,
    10,
    W * 0.7,
    H * 0.4,
    300,
  );
  radialGlow.addColorStop(0, "rgba(255, 182, 193, 0.18)");
  radialGlow.addColorStop(0.5, "rgba(192, 132, 252, 0.12)");
  radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, W, H);

  // Subtle Sparkle particles
  const stars = [
    { x: 180, y: 40, r: 2, a: 0.7 },
    { x: 420, y: 35, r: 3, a: 0.9 },
    { x: 680, y: 50, r: 2.5, a: 0.8 },
    { x: 780, y: 120, r: 2, a: 0.6 },
    { x: 740, y: 210, r: 3, a: 0.75 },
    { x: 320, y: 225, r: 2, a: 0.5 },
    { x: 540, y: 230, r: 2.5, a: 0.8 },
  ];
  ctx.save();
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 0, ${s.a})`;
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 8;
    ctx.fill();
  }
  ctx.restore();

  // 3. Frosted Glass Panel with Neon Border
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, 16, 16, W - 32, H - 32, 22, "rgba(255, 255, 255, 0.03)");
  ctx.restore();

  // Glass Border with Multi-stop Neon Gradient
  const borderGrad = ctx.createLinearGradient(16, 16, W - 16, H - 16);
  borderGrad.addColorStop(0, "rgba(255, 182, 193, 0.6)");
  borderGrad.addColorStop(0.5, "rgba(192, 132, 252, 0.4)");
  borderGrad.addColorStop(1, "rgba(6, 182, 212, 0.3)");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(16, 16, W - 32, H - 32, 22);
  else ctx.rect(16, 16, W - 32, H - 32);
  ctx.stroke();

  // 4. Avatar Section (Left)
  const avatarSize = 140;
  const avatarX = 48;
  const avatarY = 60;

  // Dual Glowing Ring around Avatar
  ctx.save();
  ctx.strokeStyle = "rgba(255, 215, 0, 0.85)";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#FFD700";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 7,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();

  // Inner ring
  ctx.strokeStyle = "rgba(255, 182, 193, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 2,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  // Avatar Image
  const avatarUrl = user.displayAvatarURL
    ? user.displayAvatarURL({ extension: "png", size: 256 })
    : user.avatarURL;
  try {
    await drawAvatar(ctx, avatarUrl, avatarX, avatarY, avatarSize, null);
  } catch (_) {
    drawRoundedRect(
      ctx,
      avatarX,
      avatarY,
      avatarSize,
      avatarSize,
      avatarSize / 2,
      "#1E2633",
    );
  }

  // 5. Text & Badges (Right Section)
  const textX = avatarX + avatarSize + 36;

  // Level Up Capsule Chip (Top)
  const chipW = 160;
  const chipH = 28;
  const chipY = 48;
  drawRoundedRect(
    ctx,
    textX,
    chipY,
    chipW,
    chipH,
    14,
    "rgba(255, 182, 193, 0.12)",
  );
  ctx.strokeStyle = "rgba(255, 182, 193, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(textX, chipY, chipW, chipH, 14);
  ctx.stroke();

  ctx.fillStyle = "#FFB6C1";
  ctx.font = 'bold 14px "MontserratBold", "InterBold", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("✦ LEVEL UP! ✦", textX + chipW / 2, chipY + 19);

  // User Display Name
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 34px "MontserratBold", "EmojiFont", sans-serif';
  const nameStr = truncateText(
    ctx,
    user.displayName || user.username || "User",
    480,
  );
  ctx.fillText(nameStr, textX, 118);

  // Milestone Badge Pill
  const pillW = 340;
  const pillH = 40;
  const pillY = 138;
  drawRoundedRect(
    ctx,
    textX,
    pillY,
    pillW,
    pillH,
    12,
    "rgba(13, 17, 23, 0.75)",
  );
  ctx.strokeStyle = "rgba(255, 215, 0, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(textX, pillY, pillW, pillH, 12);
  ctx.stroke();

  ctx.fillStyle = "#FFD700";
  ctx.font = 'bold 18px "MontserratBold", "InterBold", sans-serif';
  ctx.fillText(`🎉 Kini mencapai Level ${level}`, textX + 16, pillY + 26);

  // Subtitle / Brand Tag
  ctx.fillStyle = "#8E98B0";
  ctx.font = '13px "Inter", sans-serif';
  ctx.fillText(
    "🌸 Naura Hoshino RPG Leveling System",
    textX + 2,
    pillY + pillH + 26,
  );

  return canvas;
}

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
      `STATUS: AKTIF  â€¢  Berakhir: ${new Date(premiumUntil).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
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

async function generateRankCard(
  user,
  level = 1,
  xp = 0,
  targetXp = 100,
  rankNumber = 1,
  roleBadge = "Novice",
  isPremium = false,
  customBg = null,
  customBorder = null,
) {
  const W = 920,
    H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const accentColor = isPremium ? "#FFD700" : "#FFB6C1";
  const accentGlow = isPremium
    ? "rgba(255, 215, 0, 0.4)"
    : "rgba(255, 182, 193, 0.35)";

  // 1. Background
  let bgImg = null;
  if (customBg) {
    try {
      bgImg = await loadImage(customBg);
    } catch (_) {}
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, W, H);
    drawRoundedRect(ctx, 0, 0, W, H, 0, "rgba(8, 9, 12, 0.65)");
  } else {
    // Cyber Midnight Canvas
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#08090C");
    bgGrad.addColorStop(0.5, "#101422");
    bgGrad.addColorStop(1, "#171228");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle Cyber Grid & Ambient Glow
    ctx.save();
    const radialGlow = ctx.createRadialGradient(
      W - 100,
      60,
      10,
      W - 100,
      60,
      250,
    );
    radialGlow.addColorStop(0, accentGlow);
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, W, H);

    // Grid dots
    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    for (let gx = 30; gx < W; gx += 40) {
      for (let gy = 30; gy < H; gy += 40) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }
    ctx.restore();
  }

  // 2. Inner Glassmorphic Panel
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, 18, 18, W - 36, H - 36, 22, "rgba(255, 255, 255, 0.03)");
  ctx.restore();

  // Glass Rim with Multi-stop Neon Gradient
  const borderGrad = ctx.createLinearGradient(18, 18, W - 18, H - 18);
  borderGrad.addColorStop(
    0,
    isPremium ? "rgba(255, 215, 0, 0.6)" : "rgba(255, 182, 193, 0.55)",
  );
  borderGrad.addColorStop(0.5, "rgba(192, 132, 252, 0.35)");
  borderGrad.addColorStop(
    1,
    isPremium ? "rgba(255, 140, 0, 0.3)" : "rgba(6, 182, 212, 0.25)",
  );
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(18, 18, W - 36, H - 36, 22);
  else ctx.rect(18, 18, W - 36, H - 36);
  ctx.stroke();

  // 3. Avatar + Multi-layer Neon Ring
  const avatarSize = 150;
  const avatarX = 48,
    avatarY = 65;

  // Outer Glowing Halo
  ctx.save();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 7,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();

  // Inner subtle ring
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 2,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  try {
    const avatarUrl = user.displayAvatarURL
      ? user.displayAvatarURL({ extension: "png", size: 256 })
      : user.avatarURL;
    await drawAvatar(ctx, avatarUrl, avatarX, avatarY, avatarSize, null);
  } catch (_) {
    drawRoundedRect(
      ctx,
      avatarX,
      avatarY,
      avatarSize,
      avatarSize,
      avatarSize / 2,
      "#1E2633",
    );
  }

  // Custom Border asset if equipped
  if (customBorder) {
    try {
      const borderImg = await loadImage(customBorder);
      if (borderImg) {
        ctx.drawImage(
          borderImg,
          avatarX - 10,
          avatarY - 10,
          avatarSize + 20,
          avatarSize + 20,
        );
      }
    } catch (_) {}
  }

  // 4. Metrics (Top Right): Clean Rank & Level Badge
  const cleanRank = String(rankNumber).replace(/^#+/, "");
  ctx.textAlign = "right";

  // Rank text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 26px "MontserratBold", "InterBold", sans-serif';
  ctx.fillText(`RANK #${cleanRank}`, W - 45, 62);

  // Level Pill Badge (Top Right)
  const levelPillW = 120;
  const levelPillH = 30;
  const levelPillX = W - 45 - levelPillW;
  const levelPillY = 76;

  drawRoundedRect(
    ctx,
    levelPillX,
    levelPillY,
    levelPillW,
    levelPillH,
    10,
    "rgba(13, 17, 23, 0.8)",
  );
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(levelPillX, levelPillY, levelPillW, levelPillH, 10);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 15px "MontserratBold", "InterBold", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(
    `LEVEL ${level}`,
    levelPillX + levelPillW / 2,
    levelPillY + levelPillH / 2 + 5,
  );

  // 5. User Info (Left next to avatar)
  ctx.textAlign = "left";
  const textX = avatarX + avatarSize + 32;

  // Display Name
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 30px "MontserratBold", "EmojiFont", sans-serif';
  const displayName = truncateText(
    ctx,
    (user.displayName || user.username || "User").toUpperCase(),
    360,
  );
  ctx.fillText(displayName, textX, 86);

  // Role Pill Badge
  const badgeText = roleBadge ? String(roleBadge) : "Pendatang Baru";
  ctx.font = 'bold 14px "InterBold", "EmojiFont", sans-serif';
  const badgeWidth = Math.min(220, ctx.measureText(badgeText).width + 24);
  const badgeHeight = 26;
  const badgeY = 100;

  drawRoundedRect(
    ctx,
    textX,
    badgeY,
    badgeWidth,
    badgeHeight,
    8,
    "rgba(255, 255, 255, 0.06)",
  );
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(textX, badgeY, badgeWidth, badgeHeight, 8);
  ctx.stroke();

  ctx.fillStyle = "#A0AEC0";
  ctx.fillText(badgeText, textX + 12, badgeY + 18);

  // 6. XP Progress Bar (Cyber Recessed Glass Track)
  const barX = textX;
  const barY = 160;
  const barW = W - textX - 45;
  const barH = 22;
  const pct =
    targetXp > 0 ? Math.min(100, Math.max(0, (xp / targetXp) * 100)) : 0;

  // Recessed background track
  drawRoundedRect(ctx, barX, barY, barW, barH, 11, "rgba(0, 0, 0, 0.6)");
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 11);
  ctx.stroke();

  // Progress Fill with Neon Gradient
  const progressWidth = Math.max(11 * 2, (Math.min(pct, 100) / 100) * barW);
  if (pct > 0) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, barY, progressWidth, barH, 11);
    else ctx.rect(barX, barY, progressWidth, barH);
    ctx.clip();

    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    if (isPremium) {
      barGrad.addColorStop(0, "#FF8C00");
      barGrad.addColorStop(0.6, "#FFA500");
      barGrad.addColorStop(1, "#FFD700");
    } else {
      barGrad.addColorStop(0, "#F43F5E");
      barGrad.addColorStop(0.5, "#EC4899");
      barGrad.addColorStop(1, "#FFB6C1");
    }
    ctx.fillStyle = barGrad;
    ctx.fill();
    ctx.restore();

    // Glowing tip highlight
    if (pct > 5 && pct < 98) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(barX + progressWidth - 6, barY + barH / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }
  }

  // 7. XP Text & Percentage
  ctx.fillStyle = "#8E98B0";
  ctx.font = '15px "Inter", "EmojiFont", sans-serif';
  ctx.fillText(
    `${Number(xp).toLocaleString("id-ID")} / ${Number(targetXp).toLocaleString("id-ID")} XP`,
    barX,
    215,
  );

  ctx.textAlign = "right";
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 16px "MontserratBold", "InterBold", sans-serif';
  ctx.fillText(`${Math.floor(pct)}%`, barX + barW, 215);

  return canvas;
}

const { generateInventoryBackpackImage } = require("./inventoryCanvas");

function getPlatformIcon(sourceName = "") {
  const s = String(sourceName || "").toLowerCase();
  if (s.includes("spotify")) return ui.getEmoji("spotify") || "🟢";
  if (s.includes("youtube") || s.includes("yt")) return ui.getEmoji("youtube") || "🔴";
  if (s.includes("soundcloud")) return ui.getEmoji("soundcloud") || "🟠";
  return ui.getEmoji("normal") || "🎵";
}

const CanvasUtils = {
  drawRoundedRect,
  drawRoundedProgressBar,
  drawAvatar,
  drawCircularImage,
  drawArcProgressBar,
  wrapText,
  truncateText,
  formatDur,
  getPlatformIcon,
  generateSurvivalProfileImage,
  generateInventoryBackpackImage,
  generateMusicProfileImage,
  generateMusicPanelImage,
  generateWelcomeImage,
  generateLevel,
  generatePremiumTierCard,
  generatePremiumInfoCard,
  generateRankCard,
};

module.exports = {
  drawRoundedRect,
  drawRoundedProgressBar,
  drawAvatar,
  drawCircularImage,
  drawArcProgressBar,
  wrapText,
  truncateText,
  formatDur,
  getPlatformIcon,
  generateSurvivalProfileImage,
  generateInventoryBackpackImage,
  generateMusicProfileImage,
  generateMusicPanelImage,
  generateWelcomeImage,
  generateLevel,
  generatePremiumTierCard,
  generatePremiumInfoCard,
  generateRankCard,
  CanvasUtils,
};
