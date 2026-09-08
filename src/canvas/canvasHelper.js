// Lokasi: src/utils/canvasHelper.js
const fs = require("fs");
const canvasRuntime = require("./canvasRuntime");
const axios = require("axios");
const ui = require("../config/ui");

const formatDur = (ms) => {
  if (!ms || isNaN(ms) || ms === 0) return "0 Menit";
  if (ms > 3600000000) return "Radio / Live Stream";

  const totalSeconds = Number(ms) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours} J ${minutes} M`;
  return `${minutes} Menit`;
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

// Fitur truncate satu baris (memotong teks dengan ...)
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
// 🎵 MUSIC PROFILE CANVAS, PREMIUM REDESIGN
// Canvas: 1100 x 680px
// ==========================================
async function generateMusicProfileImage(user, stats, clientAvatar) {
  const W = 1100;
  const H = 680;
  const canvas = canvasRuntime.createCanvas(W, H);
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
  const bannerPath =
    ui.getBanner?.("musicProfile") ||
    ui.getBanner?.("nowPlaying") ||
    "./assets/music/Now Playing Banner.jpeg";
  let bgImgLoaded = false;
  if (bannerPath && fs.existsSync(bannerPath)) {
    try {
      const bgImg = await canvasRuntime.loadImage(bannerPath);
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

  // ─── 2. HEADER CARD ──────────────────────────────────────
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

  // ─── 3. AVATAR ───────────────────────────────────────────
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
    userAvatarImg = await canvasRuntime.loadImage(
      user.displayAvatarURL({ extension: "png", size: 256 }),
    );
  } catch (_) {
    try {
      userAvatarImg = await canvasRuntime.loadImage(clientAvatar);
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

  // ─── 4. IDENTITY (name, username, badge) ─────────────────
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

  // ─── 5. STAT BOXES (right of header) ─────────────────────
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

  // ─── 6. GRADIENT DIVIDER ─────────────────────────────────
  const DIV_Y = HDR_Y + HDR_H + 20;
  const divGrad = ctx.createLinearGradient(24, DIV_Y, W - 24, DIV_Y);
  divGrad.addColorStop(0, "rgba(0,0,0,0)");
  divGrad.addColorStop(0.3, `rgba(${ac.r},${ac.g},${ac.b},0.4)`);
  divGrad.addColorStop(0.7, `rgba(${ac.r},${ac.g},${ac.b},0.4)`);
  divGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(24, DIV_Y, W - 48, 1);

  // ─── 7. THREE LIST CARDS ─────────────────────────────────
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

    // Card title (NO emoji, icon drawn as shape)
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

  // ─── 8. FOOTER ───────────────────────────────────────────
  // Naura avatar circle
  let nauraImg = null;
  try {
    nauraImg = await canvasRuntime.loadImage(clientAvatar);
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
// 🎵 generateMusicPanelImage, Redesigned Premium Card Layout
// Canvas: 750 x 240px, Glassmorphism + Neon Glow + Waveform
// ============================================================
async function generateMusicPanelImage(track, currentPos, clientAvatar) {
  const W = 750;
  const H = 240;
  const canvas = canvasRuntime.createCanvas(W, H);
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
  const bannerPath =
    ui.getBanner?.("musicNowPlaying") ||
    ui.getBanner?.("nowPlaying") ||
    "./assets/music/Now Playing Banner.jpeg";
  let bgImgLoaded = false;
  if (bannerPath && fs.existsSync(bannerPath)) {
    try {
      const bgImg = await canvasRuntime.loadImage(bannerPath);
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

  // Load thumbnail
  let trackImageUrl = track?.info?.image;
  if (!trackImageUrl && source.includes("youtube")) {
    trackImageUrl = `https://img.youtube.com/vi/${track.info.identifier}/mqdefault.jpg`;
  }
  if (
    !trackImageUrl ||
    typeof trackImageUrl !== "string" ||
    !trackImageUrl.startsWith("http")
  ) {
    trackImageUrl = clientAvatar;
  }

  let thumbImg = null;
  try {
    const resp = await axios.get(trackImageUrl, {
      responseType: "arraybuffer",
      timeout: 5000,
    });
    thumbImg = await canvasRuntime.loadImage(Buffer.from(resp.data));
  } catch (_) {
    try {
      if (clientAvatar && clientAvatar.startsWith("http")) {
        const resp = await axios.get(clientAvatar, {
          responseType: "arraybuffer",
          timeout: 5000,
        });
        thumbImg = await canvasRuntime.loadImage(Buffer.from(resp.data));
      }
    } catch (_2) {}
  }

  // Draw art with clip
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(ART_X, ART_Y, ART_W, ART_H, ART_R);
  else ctx.rect(ART_X, ART_Y, ART_W, ART_H);
  ctx.clip();

  if (thumbImg) {
    ctx.drawImage(thumbImg, ART_X, ART_Y, ART_W, ART_H);
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

  // "NOW PLAYING" label, gambar segitiga play manual (▶ tidak ada di font Montserrat)
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
    ctx.fillText("🔴 LIVE STREAM", PB_X, PB_Y + 22);
  } else {
    ctx.fillText(formatDur(currentPos), PB_X, PB_Y + 22);
    ctx.textAlign = "right";
    ctx.fillText(formatDur(duration), PB_X + PB_W, PB_Y + 22);
  }

  // --- 9. Bottom brand watermark, gambar bintang 4-titik manual (✦ tidak ada di font) ---
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

module.exports = { generateMusicProfileImage, generateMusicPanelImage };
