// Lokasi: plugin/canvas/nowplayingCanvas.js
const { createCanvas, loadImage } = require("./canvasRuntime");
const path = require("path");

async function drawNowPlayingCard(trackInfo, playbackInfo) {
  const canvas = createCanvas(800, 300);
  const ctx = canvas.getContext("2d");

  const isVIP = Boolean(
    playbackInfo && (playbackInfo.isVIP || playbackInfo.isPremium),
  );

  // 1. Background (Futuristic Dark Cyberpunk Gradient or Equipped Banner)
  if (playbackInfo && playbackInfo.equippedBanner) {
    try {
      const bannerPath = path.join(
        __dirname,
        "assets",
        "banners",
        playbackInfo.equippedBanner + ".png",
      );
      const bannerBg = await loadImage(bannerPath);
      ctx.drawImage(bannerBg, 0, 0, 800, 300);
      // Tambahkan overlay agar info lagu terbaca
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, 800, 300);
    } catch (e) {
      // Fallback
      const bgGrad = ctx.createRadialGradient(400, 150, 50, 400, 150, 450);
      bgGrad.addColorStop(0, isVIP ? "#2b1e05" : "#1a0d2e");
      bgGrad.addColorStop(1, "#0b0c10");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 800, 300);
    }
  } else {
    const bgGrad = ctx.createRadialGradient(400, 150, 50, 400, 150, 450);
    bgGrad.addColorStop(0, isVIP ? "#2b1e05" : "#1a0d2e");
    bgGrad.addColorStop(1, "#0b0c10");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 300);
  }

  // Neon Glow Line at the bottom
  ctx.strokeStyle = isVIP
    ? "rgba(255, 215, 0, 0.8)"
    : "rgba(255, 182, 193, 0.4)";
  ctx.lineWidth = 4;
  ctx.shadowBlur = 10;
  ctx.shadowColor = isVIP ? "#ffd700" : "#ffb6c1";
  ctx.beginPath();
  ctx.moveTo(30, 290);
  ctx.lineTo(770, 290);
  ctx.stroke();
  ctx.shadowBlur = 0; // Reset shadow

  // Glassmorphism Main Board with Tinted Soft Shadow
  ctx.save();
  ctx.shadowColor = "rgba(11, 12, 16, 0.85)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  ctx.beginPath();
  ctx.roundRect(20, 20, 760, 250, 20);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = isVIP
    ? "rgba(255, 215, 0, 0.6)"
    : "rgba(255, 182, 193, 0.2)";
  ctx.lineWidth = isVIP ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect(20, 20, 760, 250, 20);
  ctx.stroke();

  // 2. Load and draw Thumbnail (Album Art)
  const {
    resolveHighResArtwork,
    drawImageCover,
  } = require("./artworkResolver");

  let albumArt = null;
  let artLoaded = false;
  const targetTrack = {
    info: {
      title: trackInfo.title,
      author: trackInfo.author,
      image: trackInfo.image || trackInfo.thumbnail,
      identifier: trackInfo.identifier,
      originalSource: trackInfo.originalSource || trackInfo.sourceName,
      sourceName: trackInfo.sourceName,
    },
  };

  const thumbnailUri = await resolveHighResArtwork(targetTrack, null);

  if (thumbnailUri) {
    try {
      albumArt = await loadImage(thumbnailUri);
      artLoaded = true;
    } catch (e) {
      console.error(
        "\x1b[41m\x1b[37m 💥 nowplayingCanvas \x1b[0m \x1b[31mGagal memuat thumbnail:",
        e.message,
        "\x1b[0m",
      );
    }
  }

  // Draw Thumbnail Box with Tinted Shadow & Glow
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = isVIP
    ? "rgba(255, 215, 0, 0.4)"
    : "rgba(255, 182, 193, 0.35)";

  if (artLoaded && albumArt) {
    drawImageCover(ctx, albumArt, 40, 45, 200, 200, 16);
  } else {
    // Round clipping for Fallback Album Art
    ctx.beginPath();
    ctx.roundRect(40, 45, 200, 200, 16);
    ctx.clip();
    // Fallback: CD/Vinyl visualizer
    ctx.fillStyle = "#1e1e24";
    ctx.fillRect(40, 45, 200, 200);

    // Draw vinyl lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 5;
    for (let r = 20; r < 90; r += 15) {
      ctx.beginPath();
      ctx.arc(140, 145, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center vinyl label
    ctx.fillStyle = "#ffb6c1";
    ctx.beginPath();
    ctx.arc(140, 145, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0b0c10";
    ctx.beginPath();
    ctx.arc(140, 145, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Track Details (Title & Author)
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";

  // Title (MontserratBold / sans-serif)
  ctx.font = 'bold 26px "MontserratBold", "EmojiFont"';
  const rawTitle = trackInfo.title || "Unknown Track";
  const titleText =
    rawTitle.length > 30 ? rawTitle.substring(0, 27) + "..." : rawTitle;

  ctx.shadowBlur = 8;
  ctx.shadowColor = "#ffffff";
  ctx.fillText(titleText, 270, 85);
  ctx.shadowBlur = 0; // Reset

  // Artist (Inter / Light sans-serif)
  ctx.fillStyle = "#ffb6c1";
  ctx.font = '20px "Inter", "EmojiFont"';
  const rawAuthor = trackInfo.author || "Unknown Artist";
  const authorText =
    rawAuthor.length > 35 ? rawAuthor.substring(0, 32) + "..." : rawAuthor;
  ctx.fillText(authorText, 270, 125);

  // Platform Badge / Text
  ctx.fillStyle = isVIP ? "#FFD700" : "rgba(255, 255, 255, 0.4)";
  ctx.font = '12px "InterBold", "EmojiFont"';
  const platform = (
    trackInfo.originalSource ||
    trackInfo.sourceName ||
    "Lavalink"
  ).toUpperCase();
  const vipTag = isVIP ? " | 💎 VIP HIGH-FIDELITY" : "";
  ctx.fillText(`TRANSMITTING VIA: ${platform}${vipTag}`, 270, 155);

  // 4. Playback Progress & Dynamic Waveform
  const position = playbackInfo.position || 0;
  const duration = trackInfo.length || 1;
  const progressPercent = Math.max(0, Math.min(1, position / duration));

  // Waveform Visualizer Bars
  const barsCount = 36;
  const barWidth = 3;
  const barGap = 13;
  const waveStartX = 270;
  const waveBaseY = 175;

  ctx.fillStyle = isVIP ? "rgba(255, 215, 0, 0.6)" : "rgba(255, 182, 193, 0.5)";
  for (let i = 0; i < barsCount; i++) {
    const wavePhase = position / 1000 + i * 0.4;
    const barHeight = Math.max(
      3,
      Math.abs(Math.sin(wavePhase) * Math.cos(i * 0.3)) * 20 + 4,
    );
    ctx.fillRect(
      waveStartX + i * barGap,
      waveBaseY - barHeight,
      barWidth,
      barHeight,
    );
  }

  // Progress Bar Background
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(270, 185, 480, 10, 5);
  ctx.fill();

  // Progress Bar Filled
  ctx.fillStyle = "#ffb6c1"; // Naura Core Pink
  ctx.beginPath();
  ctx.roundRect(270, 185, 480 * progressPercent, 10, 5);
  ctx.fill();

  // Timer Text (MontserratBold / sans-serif)
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 14px "MontserratBold", "EmojiFont"';

  const formatDuration = (ms) => {
    if (!ms || isNaN(ms)) return "0:00";
    if (ms >= 8640000000) return "🔴 LIVE";
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  ctx.fillText(formatDuration(position), 270, 225);

  ctx.textAlign = "right";
  ctx.fillText(formatDuration(duration), 750, 225);

  return canvas.toBuffer("image/png");
}

module.exports = { drawNowPlayingCard };
