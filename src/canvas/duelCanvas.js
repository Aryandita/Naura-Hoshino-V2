"use strict";

// Arena PvP. Dipanggil lewat plugin/survival/subcommands/duel.js secara lazy,
// jadi kegagalan menggambar tidak boleh sampai menghentikan duelnya.

const { createCanvas, loadImage } = require("./canvasRuntime");
const fs = require("fs");

const W = 900;
const H = 520;

// Warna aura per kelas supaya panel kedua pemain terasa berbeda karakter.
const CLASS_THEME = {
  warrior: { glow: "#f97316", label: "#fdba74" },
  mage: { glow: "#60a5fa", label: "#bfdbfe" },
  assassin: { glow: "#a855f7", label: "#e9d5ff" },
  ranger: { glow: "#22c55e", label: "#bbf7d0" },
  default: { glow: "#f472b6", label: "#fbcfe8" },
};

function themeOf(className) {
  return (
    CLASS_THEME[String(className || "").toLowerCase()] || CLASS_THEME.default
  );
}

function hexToRgba(hex, alpha) {
  const value = String(hex).replace("#", "");
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Latar arena. Bila berkas gambar tidak ada, dipakai gradien gelap. */
async function drawBackdrop(ctx) {
  let drawn = false;
  try {
    const ui = require("../config/ui");
    const bgPath = ui.getDungeonBackground ? ui.getDungeonBackground() : null;
    if (bgPath && fs.existsSync(bgPath)) {
      const image = await loadImage(bgPath);
      ctx.drawImage(image, 0, 0, W, H);
      drawn = true;
    }
  } catch (error) {
    drawn = false;
  }

  if (!drawn) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0b1026");
    grad.addColorStop(0.55, "#231038");
    grad.addColorStop(1, "#0a0a18");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Peredup dan vignette agar teks selalu terbaca di atas latar apa pun.
  ctx.fillStyle = "rgba(6, 6, 18, 0.55)";
  ctx.fillRect(0, 0, W, H);

  const vignette = ctx.createRadialGradient(
    W / 2,
    H / 2,
    140,
    W / 2,
    H / 2,
    620,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.75)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Lantai arena berupa elips tipis, memberi kesan panggung.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(W / 2, 300, 330, 58, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, ratio, color, text) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));

  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  roundedPath(ctx, x, y, w, h, h / 2);
  ctx.fill();

  if (clamped > 0) {
    ctx.fillStyle = color;
    roundedPath(ctx, x, y, Math.max(h, w * clamped), h, h / 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  roundedPath(ctx, x, y, w, h, h / 2);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(h * 0.58)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(text, x + w / 2, y + h * 0.72);
  ctx.textAlign = "left";
}

async function drawFighter(ctx, player, x, mirrored) {
  const theme = themeOf(player.class);
  const w = 360;
  const h = 250;
  const y = 34;

  ctx.save();
  ctx.shadowBlur = 26;
  ctx.shadowColor = hexToRgba(theme.glow, 0.85);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  roundedPath(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hexToRgba(theme.glow, 0.55);
  ctx.lineWidth = 3;
  roundedPath(ctx, x, y, w, h, 22);
  ctx.stroke();

  // Pita sisi sebagai penanda pemain kiri atau kanan.
  ctx.fillStyle = hexToRgba(theme.glow, 0.9);
  roundedPath(ctx, mirrored ? x + w - 10 : x + 4, y + 18, 6, h - 36, 3);
  ctx.fill();

  const avatarX = mirrored ? x + w - 74 : x + 74;
  const avatarY = y + 72;
  const radius = 44;

  let avatar = null;
  try {
    if (player.avatarUrl) avatar = await loadImage(player.avatarUrl);
  } catch (error) {
    avatar = null;
  }

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = hexToRgba(theme.glow, 0.9);
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(theme.glow, 0.35);
  ctx.fill();
  ctx.restore();

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      avatar,
      avatarX - radius,
      avatarY - radius,
      radius * 2,
      radius * 2,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
  ctx.stroke();

  const textX = mirrored ? x + 24 : x + 132;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 21px sans-serif";
  ctx.fillText(
    String(player.username || "Petarung").substring(0, 16),
    textX,
    avatarY - 10,
  );

  ctx.fillStyle = theme.label;
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(
    String(player.class || "Tanpa Kelas").toUpperCase(),
    textX,
    avatarY + 12,
  );

  if (player.level) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Level ${player.level}`, textX, avatarY + 32);
  }

  const maxHp = Number(player.maxHp) || 100;
  const hp = Math.max(0, Number(player.hp) || 0);
  const hpRatio = hp / maxHp;
  const hpColor =
    hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.2 ? "#facc15" : "#ef4444";

  drawBar(
    ctx,
    x + 22,
    y + 140,
    w - 44,
    24,
    hpRatio,
    hpColor,
    `HP ${hp} / ${maxHp}`,
  );
  drawBar(
    ctx,
    x + 22,
    y + 174,
    w - 44,
    18,
    (Number(player.stamina) || 0) / 100,
    "#38bdf8",
    `STAMINA ${Number(player.stamina) || 0}`,
  );

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `STR ${player.strength || 0}   AGI ${player.agility || 0}   INT ${player.intelligence || 0}   LCK ${player.luck || 0}`,
    x + w / 2,
    y + 222,
  );
  ctx.textAlign = "left";
}

function drawVersus(ctx, round) {
  ctx.save();
  ctx.translate(W / 2, 150);

  ctx.shadowBlur = 30;
  ctx.shadowColor = "rgba(251, 191, 36, 0.9)";
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(12, 10, 24, 0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VS", 0, 11);

  if (round) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`RONDE ${round}`, 0, 62);
  }

  ctx.restore();
  ctx.textAlign = "left";
}

function drawLog(ctx, roundLog) {
  const x = 34;
  const y = 330;
  const w = W - 68;
  const h = 158;

  ctx.fillStyle = "rgba(8, 8, 20, 0.72)";
  roundedPath(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  roundedPath(ctx, x, y, w, h, 16);
  ctx.stroke();

  ctx.fillStyle = "#fbcfe8";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("CATATAN PERTARUNGAN", x + 20, y + 26);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 36);
  ctx.lineTo(x + w - 20, y + 36);
  ctx.stroke();

  const lines = String(roundLog || "Pertarungan baru saja dimulai...")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  ctx.font = "15px sans-serif";
  let cursor = y + 64;
  for (const line of lines) {
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("\u25B8", x + 22, cursor);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(line.substring(0, 86), x + 40, cursor);
    cursor += 26;
  }
}

/**
 * @param {Object} p1 pemain penantang: username, avatarUrl, class, level, hp, maxHp, stamina, stat dasar
 * @param {Object} p2 pemain lawan dengan bentuk data yang sama
 * @param {string} roundLog narasi ronde, boleh berisi beberapa baris
 * @returns {Promise<Buffer>} gambar PNG arena
 */
async function drawDuel(p1, p2, roundLog, round) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  await drawBackdrop(ctx);
  await drawFighter(ctx, p1 || {}, 30, false);
  await drawFighter(ctx, p2 || {}, W - 390, true);
  drawVersus(ctx, round);
  drawLog(ctx, roundLog);

  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Naura Duel Arena", W - 34, H - 12);

  return canvas.toBuffer("image/png");
}

module.exports = { drawDuel, CLASS_THEME };
