"use strict";

const { logger } = require("../managers/logger");
const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");
const axios = require("axios");

/**
 * Helper menggambar rounded rect dengan stroke & shadow
 */
function drawCardRect(ctx, x, y, w, h, r, fillColor, strokeColor = null, lineWidth = 1) {
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
 * Helper membungkus teks panjang
 */
function wrapLines(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Render Kartu Radar Server Minecraft (/minecraft ping)
 * Menampilkan status latensi, populasi pemain, versi engine, favicon, dan MOTD
 */
async function renderMinecraftPing(payload) {
  return runWithLimit("minecraftPing", async () => {
    const {
      ip = "127.0.0.1",
      port = 25565,
      ping = 0,
      players = { online: 0, max: 20 },
      version = { name: "Java Edition" },
      motd = { clean: "A Minecraft Server" },
      favicon = null,
    } = payload;

    const W = 900;
    const H = 480;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // 1. Dark Netherite Obsidian Background
    const bgGradient = ctx.createLinearGradient(0, 0, W, H);
    bgGradient.addColorStop(0, "#080c14");
    bgGradient.addColorStop(0.5, "#0d1527");
    bgGradient.addColorStop(1, "#162544");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, W, H);

    // Subtle Grid Lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Emerald Glow for Online Server
    const radialGlow = ctx.createRadialGradient(160, 140, 20, 160, 140, 300);
    radialGlow.addColorStop(0, "rgba(34, 197, 94, 0.18)");
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, W, H);

    // 2. Header Container
    drawCardRect(ctx, 30, 24, W - 60, 60, 16, "rgba(15, 23, 42, 0.75)", "rgba(56, 189, 248, 0.2)", 1);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText("NAURA MINECRAFT RADAR NETWORK • SERVER TELEMETRY", 50, 48);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${ip}:${port}`, 50, 72);

    // Online Status Badge
    drawCardRect(ctx, W - 180, 36, 130, 36, 10, "rgba(34, 197, 94, 0.2)", "#22c55e", 1.5);
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText("● SERVER ONLINE", W - 168, 59);

    // 3. Favicon & Server Identity Box
    drawCardRect(ctx, 30, 100, 300, 340, 20, "rgba(15, 23, 42, 0.65)", "rgba(255, 255, 255, 0.08)", 1.2);

    let faviconLoaded = false;
    if (favicon && typeof favicon === "string" && favicon.startsWith("data:image/png;base64,")) {
      try {
        const base64Data = favicon.replace(/^data:image\/png;base64,/, "");
        const favImg = await loadImage(Buffer.from(base64Data, "base64"));
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(85, 125, 190, 190, 24);
        else ctx.rect(85, 125, 190, 190);
        ctx.clip();
        ctx.drawImage(favImg, 85, 125, 190, 190);
        ctx.restore();
        faviconLoaded = true;
      } catch (err) {
        logger.warn("[minecraftCanvas:renderMinecraftPing] Favicon render fallback: " + (err?.message || err));
      }
    }

    if (!faviconLoaded) {
      // Default Stylized Grass Block Favicon
      drawCardRect(ctx, 85, 125, 190, 190, 24, "#1e293b", "#334155", 2);
      ctx.font = "72px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🟩", 180, 240);
      ctx.textAlign = "left";
    }

    // Ping Latency Chip
    const pingColor = ping < 80 ? "#22c55e" : ping < 180 ? "#f59e0b" : "#ef4444";
    drawCardRect(ctx, 55, 335, 250, 40, 12, "rgba(0, 0, 0, 0.5)", pingColor, 1.2);
    ctx.fillStyle = pingColor;
    ctx.font = "bold 15px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`⚡ Latensi: ${ping}ms`, 80, 360);

    // Engine Version Chip
    drawCardRect(ctx, 55, 385, 250, 36, 10, "rgba(0, 0, 0, 0.4)", "rgba(255, 255, 255, 0.1)", 1);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px InterBold, sans-serif";
    const cleanVer = String(version.name || "Java Edition").substring(0, 28);
    ctx.fillText(`⚙️ ${cleanVer}`, 75, 408);

    // 4. Right Side: Player Statistics & MOTD Box
    const rightX = 350;
    const rightW = W - 380;

    // Player Count Card
    drawCardRect(ctx, rightX, 100, rightW, 140, 18, "rgba(15, 23, 42, 0.65)", "rgba(255, 255, 255, 0.08)", 1.2);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText("👥 POPULASI PEMAIN ONLINE", rightX + 24, 130);

    const online = Number(players.online ?? 0);
    const max = Number(players.max ?? 1);
    const percent = Math.min(Math.max((online / (max || 1)) * 100, 0), 100);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${online} / ${max}`, rightX + 24, 178);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(`(${percent.toFixed(1)}% kapasitas server)`, rightX + 220, 175);

    // Player Bar Background
    drawCardRect(ctx, rightX + 24, 195, rightW - 48, 16, 8, "rgba(0, 0, 0, 0.6)");
    // Player Bar Progress
    const fillW = Math.max(((rightW - 48) * percent) / 100, percent > 0 ? 12 : 0);
    const barGrad = ctx.createLinearGradient(rightX + 24, 0, rightX + 24 + fillW, 0);
    barGrad.addColorStop(0, "#06b6d4");
    barGrad.addColorStop(1, "#3b82f6");
    drawCardRect(ctx, rightX + 24, 195, fillW, 16, 8, barGrad);

    // MOTD Message Box
    drawCardRect(ctx, rightX, 256, rightW, 184, 18, "rgba(15, 23, 42, 0.65)", "rgba(255, 255, 255, 0.08)", 1.2);

    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText("📜 PESAN HARI INI (MOTD)", rightX + 24, 286);

    const cleanMotd = (motd.clean || "Server Minecraft Aktif").trim();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "15px Inter, monospace, sans-serif";

    const motdLines = wrapLines(ctx, cleanMotd, rightW - 48);
    motdLines.slice(0, 4).forEach((line, idx) => {
      ctx.fillText(line, rightX + 24, 320 + idx * 24);
    });

    // Subtitle Footer
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("VERMILION SATELLITE RADAR • ZERO-LAG HIGH ACCURACY PING", 34, 465);

    return canvas.toBuffer("image/png");
  });
}

/**
 * Render Kartu Skin & Identitas Pemain Minecraft (/minecraft player)
 */
async function renderMinecraftPlayer(payload) {
  return runWithLimit("minecraftPlayer", async () => {
    const { uuid, realName } = payload;
    const W = 880;
    const H = 520;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Background Gradient Netherite / Dark Cyber
    const bgGradient = ctx.createLinearGradient(0, 0, W, H);
    bgGradient.addColorStop(0, "#0a0e17");
    bgGradient.addColorStop(0.5, "#111a2e");
    bgGradient.addColorStop(1, "#1a2c4e");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, W, H);

    // Subtle Radial Glow
    const glow = ctx.createRadialGradient(240, 240, 30, 240, 240, 350);
    glow.addColorStop(0, "rgba(56, 189, 248, 0.15)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Left Panel: Identity & Stats
    drawCardRect(ctx, 35, 30, 460, 460, 22, "rgba(15, 23, 42, 0.7)", "rgba(56, 189, 248, 0.2)", 1.2);

    // Tag Pill
    drawCardRect(ctx, 60, 56, 170, 32, 10, "rgba(56, 189, 248, 0.15)", "#38bdf8", 1);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText("✦ MOJANG PREMIUM", 76, 77);

    // Player Username
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px MontserratBold, InterBold, sans-serif";
    ctx.fillText(realName, 60, 140);

    // UUID Pill
    drawCardRect(ctx, 60, 160, 410, 38, 10, "rgba(0, 0, 0, 0.5)", "rgba(255, 255, 255, 0.1)", 1);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace, Inter, sans-serif";
    ctx.fillText(`UUID: ${uuid}`, 74, 184);

    // Head Avatar Box
    drawCardRect(ctx, 60, 220, 150, 150, 16, "rgba(0, 0, 0, 0.5)", "#38bdf8", 2);
    try {
      const headRes = await axios.get(
        `https://crafatar.com/renders/head/${uuid}?overlay=true&scale=10`,
        { responseType: "arraybuffer", timeout: 4000 },
      );
      const headImg = await loadImage(Buffer.from(headRes.data));
      ctx.drawImage(headImg, 65, 225, 140, 140);
    } catch (e) {
      logger.warn("[minecraftCanvas:renderMinecraftPlayer] Head render fallback: " + (e?.message || e));
    }

    // Info details next to head
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px InterBold, sans-serif";
    ctx.fillText("Model 3D Resmi", 230, 255);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText("• Kulit Definisi Tinggi", 230, 285);
    ctx.fillText("• Overlay Lapisan Aktif", 230, 310);
    ctx.fillText("• Terhubung ke Jaringan", 230, 335);

    // Bottom Badge
    drawCardRect(ctx, 60, 400, 410, 56, 14, "rgba(34, 197, 94, 0.12)", "#22c55e", 1);
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 14px InterBold, sans-serif";
    ctx.fillText("✓ Terverifikasi Asli oleh Mojang Studios", 80, 434);

    // Right Panel: 3D Full Body Skin Model
    drawCardRect(ctx, 520, 30, 325, 460, 22, "rgba(15, 23, 42, 0.7)", "rgba(56, 189, 248, 0.2)", 1.2);

    try {
      const bodyRes = await axios.get(
        `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`,
        { responseType: "arraybuffer", timeout: 4000 },
      );
      const bodyImg = await loadImage(Buffer.from(bodyRes.data));
      ctx.drawImage(bodyImg, 570, 50, 225, 420);
    } catch (e) {
      logger.warn("[minecraftCanvas:renderMinecraftPlayer] Body render fallback: " + (e?.message || e));
    }

    return canvas.toBuffer("image/png");
  });
}

/**
 * Render Kartu Statistik Waktu Bermain & Hadiah Realm (/minecraft stats)
 */
async function renderMinecraftStats(payload) {
  return runWithLimit("minecraftStats", async () => {
    const { username, playDays = 0, playHours = 0, playMinutes = 0, uuid } = payload;
    const W = 880;
    const H = 480;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Dark Obsidian Theme
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#090d16");
    bg.addColorStop(0.5, "#101828");
    bg.addColorStop(1, "#18243c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid Effect
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, H);
      ctx.stroke();
    }

    // Left Section: Stats certificate
    drawCardRect(ctx, 35, 30, 530, 420, 20, "rgba(15, 23, 42, 0.75)", "rgba(52, 211, 153, 0.25)", 1.5);

    // Brand Tag
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText("VERMILION REALM NETWORK • PLAYTIME CERTIFICATE", 60, 68);

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px MontserratBold, InterBold, sans-serif";
    ctx.fillText(String(username).toUpperCase(), 60, 126);

    // Playtime Card
    drawCardRect(ctx, 60, 150, 480, 110, 16, "rgba(0, 0, 0, 0.5)", "rgba(251, 191, 36, 0.3)", 1);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px InterBold, sans-serif";
    ctx.fillText("⏱️ TOTAL WAKTU BERMAIN (PLAYTIME)", 84, 182);

    const timeStr = `${playDays} Hari ${playHours % 24} Jam ${playMinutes % 60} Menit`;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px MontserratBold, InterBold, sans-serif";
    ctx.fillText(timeStr, 84, 226);

    // Economy Sync Details
    const fragmentsEarned = playMinutes * 2;
    const couponsEarned = Math.floor(playMinutes / 60);

    drawCardRect(ctx, 60, 275, 230, 80, 14, "rgba(0, 0, 0, 0.45)", "rgba(255, 255, 255, 0.08)", 1);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText("🌟 TOTAL STAR FRAGMENTS", 78, 302);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 22px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`+${fragmentsEarned} NSF`, 78, 335);

    drawCardRect(ctx, 310, 275, 230, 80, 14, "rgba(0, 0, 0, 0.45)", "rgba(255, 255, 255, 0.08)", 1);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText("🎟️ NAURA COUPONS", 328, 302);
    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 22px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`+${couponsEarned} Kupon`, 328, 335);

    // Info footer text
    ctx.fillStyle = "#64748b";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("Klaim hadiah bermainmu secara berkala dengan /minecraft sync", 60, 420);

    // Right Section: 3D Body Canvas Card
    drawCardRect(ctx, 585, 30, 260, 420, 20, "rgba(15, 23, 42, 0.75)", "rgba(52, 211, 153, 0.25)", 1.5);

    if (uuid) {
      try {
        const bodyRes = await axios.get(
          `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`,
          { responseType: "arraybuffer", timeout: 4000 },
        );
        const bodyImg = await loadImage(Buffer.from(bodyRes.data));
        ctx.drawImage(bodyImg, 620, 50, 190, 380);
      } catch (e) {
        logger.warn("[minecraftCanvas:renderMinecraftStats] Body render fallback: " + (e?.message || e));
      }
    }

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderMinecraftPing,
  renderMinecraftPlayer,
  renderMinecraftStats,
};
