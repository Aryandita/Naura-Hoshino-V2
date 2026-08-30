"use strict";

const {
  createCanvas,
  loadImage,
  runWithLimit,
  getFromRedis,
  cacheToRedis,
} = require("./canvasRuntime");

function drawRoundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius,
  fillStyle,
  strokeStyle,
  lineWidth = 1,
) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Tentukan title / persona musik berdasarkan kebiasaan dengar
 */
function getMusicPersona(totalTracks, totalDurationMs) {
  const hours = totalDurationMs / (1000 * 60 * 60);
  if (hours > 100) return "🌟 Galactic Sound Master";
  if (hours > 50) return "🎧 Cyberpunk Audiophile";
  if (hours > 20) return "🌙 Cosmic Lo-Fi Explorer";
  if (totalTracks > 50) return "⚡ Neon Beat Seeker";
  return "🎵 Melodic Wanderer";
}

/**
 * Render Kartu Naura Music Wrapped
 * @param {Object} user - Discord User object
 * @param {Object} stats - Statistik musik user { tracksListened, totalDurationMs, topTracks, topServers, topFriends }
 * @returns {Promise<Buffer>}
 */
async function generateWrappedCard(user, stats = {}) {
  const cacheKey = `canvas:wrapped:${user.id}`;
  const cachedBuffer = await getFromRedis(cacheKey);
  if (cachedBuffer) return cachedBuffer;

  return await runWithLimit(async () => {
    const W = 1000;
    const H = 580;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const displayName = user.displayName || user.username || "Audiophile";
    const totalTracks = Number(stats.tracksListened) || 0;
    const totalDurationMs = Number(stats.totalDurationMs) || 0;
    const totalMinutes = Math.floor(totalDurationMs / 60000);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const topTracks = Array.isArray(stats.topTracks) ? stats.topTracks : [];
    const topServers = Array.isArray(stats.topServers) ? stats.topServers : [];
    const persona = getMusicPersona(totalTracks, totalDurationMs);

    // 1. Background Gradient Kosmik
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#080B14");
    bgGrad.addColorStop(0.4, "#0F172A");
    bgGrad.addColorStop(1, "#1A0B2E");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Ambient Glowing Orbs
    ctx.save();
    const orb1 = ctx.createRadialGradient(180, 120, 20, 180, 120, 320);
    orb1.addColorStop(0, "rgba(255, 182, 193, 0.25)");
    orb1.addColorStop(0.7, "rgba(244, 63, 94, 0.05)");
    orb1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, W, H);

    const orb2 = ctx.createRadialGradient(820, 460, 30, 820, 460, 360);
    orb2.addColorStop(0, "rgba(168, 85, 247, 0.25)");
    orb2.addColorStop(0.7, "rgba(59, 130, 246, 0.05)");
    orb2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 3. Decorative Waves / Lines
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 100 + i * 80);
      ctx.bezierCurveTo(300, 50 + i * 80, 700, 180 + i * 80, W, 100 + i * 80);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Header Bar
    drawRoundedRect(
      ctx,
      30,
      25,
      W - 60,
      80,
      18,
      "rgba(15, 23, 42, 0.75)",
      "rgba(255, 182, 193, 0.2)",
      1,
    );

    // Avatar User
    const avSize = 56;
    try {
      const avatarUrl = user.displayAvatarURL
        ? user.displayAvatarURL({ extension: "png", size: 128 })
        : user.avatarURL;
      if (avatarUrl) {
        const img = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(42 + avSize / 2, 37 + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 42, 37, avSize, avSize);
        ctx.restore();
      }
    } catch (_) {
      drawRoundedRect(ctx, 42, 37, avSize, avSize, avSize / 2, "#334155");
    }

    // User Titles & Badge
    ctx.textAlign = "left";
    ctx.font = 'bold 20px "Orbitron", sans-serif';
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`${displayName}'s Music Wrapped`, 116, 58);

    ctx.font = '13px "Outfit", sans-serif';
    ctx.fillStyle = "#FFB6C1";
    ctx.fillText(`${persona} · Edisi Komunitas Naura Hoshino`, 116, 82);

    // Badge Wrapped di Kanan
    drawRoundedRect(
      ctx,
      W - 210,
      40,
      160,
      48,
      12,
      "rgba(244, 63, 94, 0.2)",
      "#F43F5E",
      1.5,
    );
    ctx.textAlign = "center";
    ctx.font = 'bold 13px "Orbitron", sans-serif';
    ctx.fillStyle = "#FDE047";
    ctx.fillText("NAURA WRAPPED", W - 130, 68);

    // 5. Left Panel: Stat Metrik Utama
    const leftW = 380;
    drawRoundedRect(
      ctx,
      30,
      120,
      leftW,
      430,
      20,
      "rgba(15, 23, 42, 0.65)",
      "rgba(255, 255, 255, 0.08)",
      1,
    );

    // Metric 1: Total Durasi
    drawRoundedRect(
      ctx,
      50,
      140,
      leftW - 40,
      120,
      16,
      "rgba(30, 41, 59, 0.7)",
      "rgba(255, 182, 193, 0.15)",
      1,
    );
    ctx.textAlign = "left";
    ctx.font = '12px "Outfit", sans-serif';
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("TOTAL WAKTU MENDENGARKAN", 70, 170);

    ctx.font = 'bold 36px "Orbitron", sans-serif';
    ctx.fillStyle = "#F472B6";
    ctx.fillText(`${totalHours} Jam`, 70, 215);

    ctx.font = '12px "Outfit", sans-serif';
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText(`≈ ${totalMinutes.toLocaleString("id-ID")} Menit Audio Lossless`, 70, 242);

    // Metric 2: Total Lagu
    drawRoundedRect(
      ctx,
      50,
      275,
      leftW - 40,
      115,
      16,
      "rgba(30, 41, 59, 0.7)",
      "rgba(168, 85, 247, 0.15)",
      1,
    );
    ctx.font = '12px "Outfit", sans-serif';
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("TOTAL TREK DIPUTAR", 70, 305);

    ctx.font = 'bold 32px "Orbitron", sans-serif';
    ctx.fillStyle = "#C084FC";
    ctx.fillText(`${totalTracks.toLocaleString("id-ID")}`, 70, 348);

    ctx.font = '12px "Outfit", sans-serif';
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText("Lagu menemani aktivitas harianmu ✨", 70, 372);

    // Metric 3: Top Server Favorit
    drawRoundedRect(
      ctx,
      50,
      405,
      leftW - 40,
      125,
      16,
      "rgba(30, 41, 59, 0.7)",
      "rgba(56, 189, 248, 0.15)",
      1,
    );
    ctx.font = '12px "Outfit", sans-serif';
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("SERVER TEMPAT MENDENGAR TERBANYAK", 70, 432);

    const mainServer = topServers[0] || "Server Komunitas Naura";
    ctx.font = 'bold 15px "Outfit", sans-serif';
    ctx.fillStyle = "#38BDF8";
    const cleanServ = mainServer.length > 28 ? mainServer.slice(0, 26) + "..." : mainServer;
    ctx.fillText(`🏰 ${cleanServ}`, 70, 465);

    ctx.font = '11px "Outfit", sans-serif';
    ctx.fillStyle = "#64748B";
    ctx.fillText(topServers[1] ? `Runner up: ${topServers[1].slice(0, 26)}` : "Tetap setia mendengarkan musik di sini~", 70, 495);

    // 6. Right Panel: Top 5 Lagu Teratas
    const rightX = 430;
    const rightW = W - rightX - 30;
    drawRoundedRect(
      ctx,
      rightX,
      120,
      rightW,
      430,
      20,
      "rgba(15, 23, 42, 0.65)",
      "rgba(255, 255, 255, 0.08)",
      1,
    );

    ctx.textAlign = "left";
    ctx.font = 'bold 16px "Orbitron", sans-serif';
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText("🔥 TOP 5 LAGU TERFAVORIT", rightX + 25, 155);

    const trackItems =
      topTracks.length > 0
        ? topTracks.slice(0, 5)
        : [
            "Belum ada riwayat musik yang terekam",
            "Putar lagu favoritmu dengan /music play!",
            "Naura siap memutarkan audio kualitas tinggi",
            "Nikmati fitur radio, lirik & listening party",
            "Statistik akan terupdate otomatis saat memutar musik",
          ];

    const colors = ["#F43F5E", "#FB923C", "#FBBF24", "#34D399", "#60A5FA"];

    trackItems.forEach((track, idx) => {
      const itemY = 175 + idx * 70;
      drawRoundedRect(
        ctx,
        rightX + 20,
        itemY,
        rightW - 40,
        58,
        14,
        "rgba(30, 41, 59, 0.6)",
        idx === 0 ? "rgba(244, 63, 94, 0.4)" : "rgba(255, 255, 255, 0.05)",
        1,
      );

      // Rank Badge
      drawRoundedRect(
        ctx,
        rightX + 30,
        itemY + 12,
        34,
        34,
        8,
        colors[idx] ? `${colors[idx]}22` : "rgba(255,255,255,0.1)",
        colors[idx] || "#FFFFFF",
        1,
      );

      ctx.textAlign = "center";
      ctx.font = 'bold 15px "Orbitron", sans-serif';
      ctx.fillStyle = colors[idx] || "#FFFFFF";
      ctx.fillText(`#${idx + 1}`, rightX + 47, itemY + 35);

      // Track Title
      ctx.textAlign = "left";
      ctx.font = 'bold 13px "Outfit", sans-serif';
      ctx.fillStyle = idx === 0 ? "#FFF" : "#E2E8F0";
      const cleanTitle =
        track.length > 44 ? track.substring(0, 42) + "..." : track;
      ctx.fillText(cleanTitle, rightX + 76, itemY + 34);
    });

    // 7. Outer Glass Frame
    drawRoundedRect(
      ctx,
      12,
      12,
      W - 24,
      H - 24,
      24,
      null,
      "rgba(255, 255, 255, 0.12)",
      1.5,
    );

    const buffer = canvas.toBuffer("image/png");
    await cacheToRedis(cacheKey, buffer, 3600); // 1 Jam Cache
    return buffer;
  });
}

module.exports = {
  generateWrappedCard,
};
