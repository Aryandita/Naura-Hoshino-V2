// Lokasi: scripts/generate_category_emojis.js
// Generator untuk 50 Emoji Kategori Chibi Naura Hoshino V2 (PNG & GIF)
"use strict";

const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("../src/canvas/canvasRuntime");
// GifEncoder dan GifDisposal adalah utilitas native level-rendah yang belum dibungkus oleh canvasRuntime
// eslint-disable-next-line no-restricted-syntax
const { GifEncoder, GifDisposal } = require("@napi-rs/canvas");

const CANVAS_SIZE = 128;
const OUTPUT_DIR = path.resolve(__dirname, "../assets/emojis/naura_custom");
const EXPRESSION_DIR = path.resolve(__dirname, "../assets/Naura_Expression");

// Brand Palette Tokens
const PALETTE = {
  pink: "#FFB6C1",
  softRose: "#FFA0B0",
  magenta: "#FF69B4",
  deepMagenta: "#DB2777",
  cyan: "#00FFFF",
  skyCyan: "#38BDF8",
  deepBlue: "#1D4ED8",
  midnight: "#0F172A",
  slate: "#1E293B",
  gold: "#FFD700",
  amber: "#F59E0B",
  emerald: "#10B981",
  crimson: "#EF4444",
  purple: "#C084FC",
  white: "#FFFFFF",
};

// Cache gambar ekspresi
const expressionCache = new Map();

async function getExpressionImage(name) {
  if (expressionCache.has(name)) {
    return expressionCache.get(name);
  }
  const filePath = path.join(EXPRESSION_DIR, `${name}.png`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expression file not found: ${filePath}`);
  }
  const img = await loadImage(filePath);
  expressionCache.set(name, img);
  return img;
}

// Helper menggambar bintang 4-sudut (anime sparkle)
function drawSparkle(ctx, cx, cy, radius, color = PALETTE.cyan, rot = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  if (rot !== 0) ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  const inner = radius * 0.22;
  ctx.moveTo(0, -radius);
  ctx.quadraticCurveTo(inner, -inner, radius, 0);
  ctx.quadraticCurveTo(inner, inner, 0, radius);
  ctx.quadraticCurveTo(-inner, inner, -radius, 0);
  ctx.quadraticCurveTo(-inner, -inner, 0, -radius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Helper menggambar Chibi Naura base
function drawChibiNaura(ctx, img, x = 14, y = 14, w = 96, h = 98) {
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.4)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

// ==========================================
// DEFINISI 50 EMOJI KATEGORI
// ==========================================
const CATEGORY_EMOJIS = [
  // ----------------------------------------------------
  // KATEGORI A: CORE & SYSTEM (8 items)
  // ----------------------------------------------------
  {
    key: "naura_core",
    category: "core",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 18, 14, 92, 98);
      // Glowing central cyber core orb
      const ox = 64;
      const oy = 88;
      const r = 22;
      const pulse = opt.pulse || 0;

      const grad = ctx.createRadialGradient(ox - 5, oy - 5, 2, ox, oy, r + pulse);
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(0.3, PALETTE.cyan);
      grad.addColorStop(0.7, "#3B82F6");
      grad.addColorStop(1, PALETTE.purple);

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 10;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ox, oy, r + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Orbital rings
      ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(ox, oy, r + 7, r - 7, -Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();

      // Mini node dots
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(ox + 16, oy - 12, 3, 0, Math.PI * 2);
      ctx.arc(ox - 18, oy + 8, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Sparkles
      drawSparkle(ctx, 30, 32, 6, PALETTE.cyan, 0.2);
      drawSparkle(ctx, 98, 76, 5, PALETTE.gold, -0.3);
      ctx.restore();
    },
  },
  {
    key: "naura_ping",
    category: "core",
    baseExpression: "Thinking",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 12, 18, 88, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Antenna headband on Naura's head
      ctx.save();
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(46, 28);
      ctx.lineTo(46, 14);
      ctx.stroke();

      // Pulsing antenna tip LED
      const ledGlow = ctx.createRadialGradient(46, 12, 1, 46, 12, 7);
      ledGlow.addColorStop(0, "#FFFFFF");
      ledGlow.addColorStop(0.5, PALETTE.cyan);
      ledGlow.addColorStop(1, "rgba(0, 255, 255, 0)");
      ctx.fillStyle = ledGlow;
      ctx.beginPath();
      ctx.arc(46, 12, 7, 0, Math.PI * 2);
      ctx.fill();

      // Concentric antenna pulse waves
      if (opt.isGif) {
        const waveR = 8 + (t * 16);
        const waveAlpha = Math.max(0, 1 - t);
        ctx.strokeStyle = `rgba(0, 255, 255, ${waveAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(46, 12, waveR, -Math.PI * 0.75, -Math.PI * 0.25);
        ctx.stroke();
      }

      // Radar stopwatch device in hand
      const rx = 88;
      const ry = 78;
      const r = 18;

      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#052E16";
      ctx.beginPath();
      ctx.arc(rx, ry, r - 3, 0, Math.PI * 2);
      ctx.fill();

      // Concentric radar rings
      ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rx, ry, (r - 3) * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      // Sweeping scan line
      const sweepAngle = opt.isGif ? (t * Math.PI * 2) : (Math.PI * 0.25);
      ctx.strokeStyle = PALETTE.emerald;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(sweepAngle) * (r - 3), ry + Math.sin(sweepAngle) * (r - 3));
      ctx.stroke();

      // Ping blip
      ctx.fillStyle = PALETTE.emerald;
      ctx.beginPath();
      ctx.arc(rx + 6, ry - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
  },
  {
    key: "naura_uptime",
    category: "core",
    baseExpression: "Read",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);

      // Glass cyber hourglass
      const hx = 90;
      const hy = 74;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 6;

      // Frame
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy - 18);
      ctx.lineTo(hx + 12, hy - 18);
      ctx.moveTo(hx - 12, hy + 18);
      ctx.lineTo(hx + 12, hy + 18);
      ctx.stroke();

      // Glass contours
      ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
      ctx.beginPath();
      ctx.moveTo(hx - 10, hy - 17);
      ctx.quadraticCurveTo(hx - 8, hy - 2, hx, hy);
      ctx.quadraticCurveTo(hx - 8, hy + 2, hx - 10, hy + 17);
      ctx.lineTo(hx + 10, hy + 17);
      ctx.quadraticCurveTo(hx + 8, hy + 2, hx, hy);
      ctx.quadraticCurveTo(hx + 8, hy - 2, hx + 10, hy - 17);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing sand
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.moveTo(hx - 7, hy - 16);
      ctx.lineTo(hx + 7, hy - 16);
      ctx.lineTo(hx, hy - 4);
      ctx.closePath();
      ctx.fill();

      // Trickle
      ctx.fillRect(hx - 0.5, hy - 4, 1, 12);

      // Bottom accumulated sand
      ctx.beginPath();
      ctx.arc(hx, hy + 15, 6, Math.PI, 0);
      ctx.fill();

      // Digital 99.9% badge
      ctx.fillStyle = PALETTE.midnight;
      ctx.fillRect(hx - 18, hy + 22, 36, 12);
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 1;
      ctx.strokeRect(hx - 18, hy + 22, 36, 12);

      ctx.fillStyle = PALETTE.cyan;
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("99.9%", hx, hy + 31);

      ctx.restore();
    },
  },
  {
    key: "naura_cpu",
    category: "core",
    baseExpression: "Impressed",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 14, 14, 90, 96);

      // Cyber processor chip in hands
      const cx = 64;
      const cy = 84;
      const size = 32;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 8;

      // Gold pins around perimeter
      ctx.fillStyle = PALETTE.gold;
      for (let i = -14; i <= 14; i += 7) {
        ctx.fillRect(cx + i - 1.5, cy - (size / 2) - 4, 3, 4); // top
        ctx.fillRect(cx + i - 1.5, cy + (size / 2), 3, 4); // bottom
        ctx.fillRect(cx - (size / 2) - 4, cy + i - 1.5, 4, 3); // left
        ctx.fillRect(cx + (size / 2), cy + i - 1.5, 4, 3); // right
      }

      // Silicon substrate
      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.roundRect(cx - (size / 2), cy - (size / 2), size, size, 4);
      ctx.fill();
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center die
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(cx - 10, cy - 10, 20, 20);

      // Glowing circuit lines
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 4);
      ctx.lineTo(cx - 4, cy - 4);
      ctx.lineTo(cx - 4, cy - 10);
      ctx.moveTo(cx + 10, cy + 4);
      ctx.lineTo(cx + 4, cy + 4);
      ctx.lineTo(cx + 4, cy + 10);
      ctx.stroke();

      // Label NH
      ctx.fillStyle = PALETTE.white;
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NH", cx, cy + 3);

      drawSparkle(ctx, 32, 34, 5, PALETTE.cyan);
      ctx.restore();
    },
  },
  {
    key: "naura_ram",
    category: "core",
    baseExpression: "Cheers",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 16, 90, 96);

      // Carrying dual high-speed DDR5 RAM modules
      const drawStick = (sx, sy, angle) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 4;

        // PCB base
        ctx.fillStyle = PALETTE.slate;
        ctx.fillRect(-6, -26, 12, 52);

        // Heatsink fins
        ctx.fillStyle = PALETTE.midnight;
        ctx.fillRect(-5, -24, 10, 42);

        // Gold contact pins
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(-6, 20, 12, 6);

        // Top RGB neon bar
        const rgbGrad = ctx.createLinearGradient(0, -26, 0, -18);
        rgbGrad.addColorStop(0, PALETTE.cyan);
        rgbGrad.addColorStop(0.5, PALETTE.purple);
        rgbGrad.addColorStop(1, PALETTE.magenta);
        ctx.fillStyle = rgbGrad;
        ctx.fillRect(-6, -26, 12, 5);

        ctx.restore();
      };

      drawStick(32, 68, -0.35);
      drawStick(94, 68, 0.35);
      drawSparkle(ctx, 32, 34, 5, PALETTE.cyan);
      drawSparkle(ctx, 96, 34, 5, PALETTE.magenta);
    },
  },
  {
    key: "naura_shard",
    category: "core",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 18, 90, 96);

      // Juggling 3 floating crystal cluster shards
      const drawCrystal = (cx, cy, color, scale = 1) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(8, -4);
        ctx.lineTo(6, 12);
        ctx.lineTo(0, 16);
        ctx.lineTo(-6, 12);
        ctx.lineTo(-8, -4);
        ctx.closePath();
        ctx.fill();

        // Facet reflection
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(8, -4);
        ctx.lineTo(0, 16);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      };

      drawCrystal(30, 52, PALETTE.cyan, 0.85);
      drawCrystal(64, 30, PALETTE.purple, 1.05);
      drawCrystal(98, 52, PALETTE.magenta, 0.85);

      drawSparkle(ctx, 64, 18, 5, PALETTE.white);
    },
  },
  {
    key: "naura_lang",
    category: "core",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 20, 90, 96);

      // Dual dialogue speech bubbles ID & EN
      const drawBubble = (bx, by, label, badgeColor) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 5;

        // Bubble body
        ctx.fillStyle = PALETTE.midnight;
        ctx.beginPath();
        ctx.roundRect(bx - 18, by - 14, 36, 26, 8);
        ctx.fill();
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Flag dot / badge
        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.arc(bx - 8, by - 1, 4, 0, Math.PI * 2);
        ctx.fill();

        // Text
        ctx.fillStyle = PALETTE.white;
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(label, bx - 1, by + 2);

        ctx.restore();
      };

      drawBubble(32, 44, "ID", PALETTE.crimson);
      drawBubble(96, 44, "EN", PALETTE.skyCyan);

      // Glowing exchange arrows
      ctx.save();
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(64, 34, 10, -Math.PI * 0.7, -Math.PI * 0.1);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    key: "naura_donate",
    category: "core",
    baseExpression: "Cheers",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Saweria coffee cup in hand
      const cx = 86;
      const cy = 78;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 5;

      // Cup body
      ctx.fillStyle = "#FFFBEB";
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 12);
      ctx.lineTo(cx + 14, cy - 12);
      ctx.lineTo(cx + 10, cy + 12);
      ctx.lineTo(cx - 10, cy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PALETTE.amber;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cup handle
      ctx.strokeStyle = "#FFFBEB";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx + 13, cy, 6, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Heart emblem on cup
      ctx.fillStyle = PALETTE.magenta;
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 2, 3, Math.PI, 0);
      ctx.arc(cx + 3, cy - 2, 3, Math.PI, 0);
      ctx.lineTo(cx, cy + 4);
      ctx.closePath();
      ctx.fill();

      // Steam curls
      const steamY = opt.isGif ? (t * 8) : 4;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 14 - steamY);
      ctx.quadraticCurveTo(cx - 8, cy - 20 - steamY, cx - 4, cy - 26 - steamY);
      ctx.moveTo(cx + 4, cy - 14 - steamY);
      ctx.quadraticCurveTo(cx + 8, cy - 20 - steamY, cx + 4, cy - 26 - steamY);
      ctx.stroke();

      // Golden coin hovering
      const coinRot = opt.isGif ? (t * Math.PI * 2) : 0;
      ctx.translate(cx + 6, cy - 28);
      ctx.rotate(coinRot);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.amber;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#B45309";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("$", 0, 3);

      drawSparkle(ctx, 12, -6, 5, PALETTE.gold);
      ctx.restore();
    },
  },

  // ----------------------------------------------------
  // KATEGORI B: AI COMPANION & MACHINE LEARNING (6 items)
  // ----------------------------------------------------
  {
    key: "ai_sparkle",
    category: "ai",
    baseExpression: "Impressed",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Orbiting neural star sparkles
      const sparkles = [
        { angle: t * Math.PI * 2, rx: 32, ry: 16, cx: 40, cy: 76, color: PALETTE.cyan, size: 7 },
        { angle: (t * Math.PI * 2) + Math.PI, rx: 28, ry: 14, cx: 88, cy: 76, color: PALETTE.gold, size: 6.5 },
        { angle: (t * Math.PI * 2) + (Math.PI * 0.5), rx: 36, ry: 18, cx: 64, cy: 40, color: PALETTE.purple, size: 8 },
        { angle: (t * Math.PI * 2) + (Math.PI * 1.5), rx: 24, ry: 12, cx: 64, cy: 92, color: PALETTE.magenta, size: 6 },
      ];

      ctx.save();
      sparkles.forEach((s) => {
        const x = s.cx + (Math.cos(s.angle) * s.rx);
        const y = s.cy + (Math.sin(s.angle) * s.ry);
        drawSparkle(ctx, x, y, s.size, s.color, s.angle);
      });
      ctx.restore();
    },
  },
  {
    key: "ai_thinking",
    category: "ai",
    baseExpression: "Thinking",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);

      // Floating holographic neural network
      const nx = 88;
      const ny = 50;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 8;

      // Neural nodes
      const layers = [
        [{ x: nx - 12, y: ny - 14 }, { x: nx - 12, y: ny + 14 }], // Input
        [{ x: nx, y: ny - 18 }, { x: nx, y: ny }, { x: nx, y: ny + 18 }], // Hidden
        [{ x: nx + 12, y: ny - 10 }, { x: nx + 12, y: ny + 10 }], // Output
      ];

      // Draw connections
      ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      layers[0].forEach((n1) => {
        layers[1].forEach((n2) => {
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();
        });
      });
      layers[1].forEach((n2) => {
        layers[2].forEach((n3) => {
          ctx.beginPath();
          ctx.moveTo(n2.x, n2.y);
          ctx.lineTo(n3.x, n3.y);
          ctx.stroke();
        });
      });

      // Draw node dots
      layers.forEach((layer, li) => {
        const col = li === 0 ? PALETTE.cyan : li === 1 ? PALETTE.purple : PALETTE.gold;
        ctx.fillStyle = col;
        layer.forEach((n) => {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Math symbol f(x)
      ctx.fillStyle = PALETTE.cyan;
      ctx.font = "italic bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("f(x)", nx, ny + 32);

      drawSparkle(ctx, 30, 32, 5, PALETTE.cyan);
      ctx.restore();
    },
  },
  {
    key: "ai_vision",
    category: "ai",
    baseExpression: "Read",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 14, 92, 98);

      // Sci-fi holographic ocular visor over eye
      const vx = 68;
      const vy = 54;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 8;

      // Visor lens
      ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.roundRect(vx - 14, vy - 10, 28, 20, 4);
      ctx.fill();
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Targeting reticle
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(vx, vy, 6, 0, Math.PI * 2);
      ctx.moveTo(vx - 9, vy);
      ctx.lineTo(vx + 9, vy);
      ctx.moveTo(vx, vy - 9);
      ctx.lineTo(vx, vy + 9);
      ctx.stroke();

      // Scanner scan line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.beginPath();
      ctx.moveTo(vx - 12, vy - 3);
      ctx.lineTo(vx + 12, vy - 3);
      ctx.stroke();

      // Visor frame arm
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(vx + 14, vy - 4);
      ctx.lineTo(vx + 26, vy - 2);
      ctx.stroke();

      ctx.restore();
    },
  },
  {
    key: "ai_voice",
    category: "ai",
    baseExpression: "Chirping",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);

      // Floating cyber studio microphone
      const mx = 88;
      const my = 70;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Mic arm
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx, my + 14);
      ctx.lineTo(mx, my + 30);
      ctx.stroke();

      // Mic body
      ctx.fillStyle = PALETTE.midnight;
      ctx.beginPath();
      ctx.roundRect(mx - 8, my - 6, 16, 20, 4);
      ctx.fill();

      // Mesh grill
      ctx.fillStyle = "#94A3B8";
      ctx.beginPath();
      ctx.arc(mx, my - 6, 8, Math.PI, 0);
      ctx.fill();

      // Concentric soundwaves
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx + 6, my - 4, 12, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.magenta;
      ctx.beginPath();
      ctx.arc(mx + 6, my - 4, 18, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();

      // Musical note
      ctx.fillStyle = PALETTE.cyan;
      ctx.font = "14px sans-serif";
      ctx.fillText("♪", mx - 18, my - 12);

      ctx.restore();
    },
  },
  {
    key: "ai_openrouter",
    category: "ai",
    baseExpression: "Thinking",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 18, 90, 96);

      // Multi-model router switchboard
      const rx = 64;
      const ry = 86;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 6;

      // Central routing hub
      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.arc(rx, ry, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Routing arrows / nodes
      const nodes = [
        { x: rx - 24, y: ry - 14, color: "#3B82F6", label: "LL" }, // LLaMA
        { x: rx + 24, y: ry - 14, color: "#06B6D4", label: "GE" }, // Gemini
        { x: rx - 24, y: ry + 14, color: "#1D4ED8", label: "DS" }, // DeepSeek
        { x: rx + 24, y: ry + 14, color: "#F59E0B", label: "QW" }, // Qwen
      ];

      nodes.forEach((n) => {
        // Connector
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();

        // Node circle
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PALETTE.white;
        ctx.font = "bold 6px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + 2);
      });

      // Hub icon
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
  },
  {
    key: "ai_vip_fast",
    category: "ai",
    baseExpression: "Cheers",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      ctx.save();

      // Speed racing goggles perched on head
      const gx = 64;
      const gy = 36;
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 6;

      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.roundRect(gx - 26, gy - 6, 52, 12, 6);
      ctx.fill();

      // Twin reflective amber lenses
      ctx.fillStyle = PALETTE.amber;
      ctx.beginPath();
      ctx.roundRect(gx - 22, gy - 4, 18, 8, 3);
      ctx.roundRect(gx + 4, gy - 4, 18, 8, 3);
      ctx.fill();

      // Golden lightning crown aura
      const boltY = opt.isGif ? Math.sin(t * Math.PI * 2) * 2 : 0;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(gx - 4, gy - 12 + boltY);
      ctx.lineTo(gx + 6, gy - 12 + boltY);
      ctx.lineTo(gx, gy - 24 + boltY);
      ctx.lineTo(gx + 8, gy - 24 + boltY);
      ctx.lineTo(gx - 6, gy - 36 + boltY);
      ctx.lineTo(gx - 2, gy - 20 + boltY);
      ctx.lineTo(gx - 8, gy - 20 + boltY);
      ctx.closePath();
      ctx.fill();

      // Speed streaks
      ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
      ctx.lineWidth = 1.5;
      const streakOffset = opt.isGif ? (t * 20) : 0;
      ctx.beginPath();
      ctx.moveTo(10, 50);
      ctx.lineTo(24 + (streakOffset % 12), 50);
      ctx.moveTo(6, 70);
      ctx.lineTo(20 + (streakOffset % 10), 70);
      ctx.stroke();

      drawSparkle(ctx, gx + 24, gy - 16, 6, PALETTE.gold);
      ctx.restore();
    },
  },

  // ----------------------------------------------------
  // KATEGORI C: ARCADE & EDUCATION (9 items)
  // ----------------------------------------------------
  {
    key: "arcade_hub",
    category: "arcade",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);

      // Mini retro arcade cabinet
      const ax = 88;
      const ay = 74;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;

      // Cabinet chassis
      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.roundRect(ax - 18, ay - 24, 36, 48, 4);
      ctx.fill();

      // Glowing marquee
      ctx.fillStyle = PALETTE.magenta;
      ctx.fillRect(ax - 16, ay - 22, 32, 8);
      ctx.fillStyle = PALETTE.white;
      ctx.font = "bold 6px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ARCADE", ax, ay - 16);

      // Screen
      ctx.fillStyle = "#052E16";
      ctx.fillRect(ax - 14, ay - 11, 28, 18);
      ctx.strokeStyle = PALETTE.emerald;
      ctx.lineWidth = 1;
      ctx.strokeRect(ax - 14, ay - 11, 28, 18);

      // Pixel invader on screen
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillRect(ax - 4, ay - 5, 8, 4);
      ctx.fillRect(ax - 6, ay - 1, 12, 2);

      // Control panel with joystick and buttons
      ctx.fillStyle = "#1E1B4B";
      ctx.fillRect(ax - 16, ay + 9, 32, 10);

      // Joystick (red ball)
      ctx.strokeStyle = "#94A3B8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax - 8, ay + 17);
      ctx.lineTo(ax - 8, ay + 11);
      ctx.stroke();
      ctx.fillStyle = PALETTE.crimson;
      ctx.beginPath();
      ctx.arc(ax - 8, ay + 11, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Buttons
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(ax + 2, ay + 14, 2, 0, Math.PI * 2);
      ctx.arc(ax + 8, ay + 14, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
  },
  {
    key: "arcade_dice",
    category: "arcade",
    baseExpression: "Cheers",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 12, 18, 88, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Twin 3D tumbling dice
      const drawDie = (dx, dy, rot, pipCount, isCyan = false) => {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(rot);
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 5;

        // Cube face
        ctx.fillStyle = "#F8FAFC";
        ctx.beginPath();
        ctx.roundRect(-10, -10, 20, 20, 4);
        ctx.fill();
        ctx.strokeStyle = isCyan ? PALETTE.cyan : PALETTE.crimson;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pips
        ctx.fillStyle = isCyan ? PALETTE.cyan : PALETTE.crimson;
        if (pipCount === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (pipCount === 5) {
          ctx.beginPath();
          ctx.arc(-4, -4, 2, 0, Math.PI * 2);
          ctx.arc(4, -4, 2, 0, Math.PI * 2);
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.arc(-4, 4, 2, 0, Math.PI * 2);
          ctx.arc(4, 4, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(-4, -4, 2, 0, Math.PI * 2);
          ctx.arc(4, 4, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      };

      const rot1 = opt.isGif ? (t * Math.PI * 2) : 0.3;
      const rot2 = opt.isGif ? (-t * Math.PI * 2) : -0.25;

      drawDie(76, 52, rot1, 1, false);
      drawDie(98, 74, rot2, 5, true);

      drawSparkle(ctx, 90, 40, 5, PALETTE.gold);
    },
  },
  {
    key: "arcade_card",
    category: "arcade",
    baseExpression: "Annoy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Fan of 3 playing cards
      const cx = 86;
      const cy = 76;

      const drawCard = (ox, oy, angle, suit, rank, isRed) => {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(angle);
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 4;

        // Card body
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(-10, -16, 20, 32, 3);
        ctx.fill();
        ctx.strokeStyle = "#CBD5E1";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Card text
        ctx.fillStyle = isRed ? PALETTE.crimson : PALETTE.midnight;
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(rank, 0, -4);
        ctx.fillText(suit, 0, 8);

        ctx.restore();
      };

      drawCard(cx - 10, cy, -0.3, "♠", "A", false);
      drawCard(cx, cy - 4, 0, "♥", "K", true);
      drawCard(cx + 10, cy, 0.3, "♦", "Q", true);

      drawSparkle(ctx, cx + 18, cy - 18, 5, PALETTE.gold);
    },
  },
  {
    key: "arcade_duel",
    category: "arcade",
    baseExpression: "Angry",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);

      // Red martial arts warrior headband on Naura
      ctx.save();
      ctx.fillStyle = PALETTE.crimson;
      ctx.fillRect(40, 38, 48, 6);
      // Headband fluttering knot
      ctx.beginPath();
      ctx.moveTo(88, 40);
      ctx.lineTo(104, 34);
      ctx.lineTo(100, 44);
      ctx.lineTo(106, 50);
      ctx.closePath();
      ctx.fill();

      // Twin crossed wooden bokken swords
      const drawBokken = (angle) => {
        ctx.save();
        ctx.translate(64, 82);
        ctx.rotate(angle);
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 4;

        // Blade
        ctx.fillStyle = "#D97706";
        ctx.beginPath();
        ctx.roundRect(-3, -34, 6, 44, 2);
        ctx.fill();

        // Tsuba guard
        ctx.fillStyle = PALETTE.slate;
        ctx.fillRect(-7, 10, 14, 3);

        // Handle
        ctx.fillStyle = "#78350F";
        ctx.fillRect(-2.5, 13, 5, 14);

        ctx.restore();
      };

      drawBokken(-0.7);
      drawBokken(0.7);

      // Clash spark at intersection
      drawSparkle(ctx, 64, 82, 8, PALETTE.gold);
      ctx.restore();
    },
  },
  {
    key: "arcade_target",
    category: "arcade",
    baseExpression: "Thinking",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);

      // Colorful archery bullseye target
      const tx = 88;
      const ty = 70;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;

      const rings = [
        { r: 22, color: PALETTE.skyCyan },
        { r: 17, color: PALETTE.white },
        { r: 12, color: PALETTE.crimson },
        { r: 7, color: PALETTE.gold },
      ];

      rings.forEach((ring) => {
        ctx.fillStyle = ring.color;
        ctx.beginPath();
        ctx.arc(tx, ty, ring.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Dart sticking dead-center
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 16, ty - 16);
      ctx.stroke();

      // Dart flight feathers
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.moveTo(tx + 16, ty - 16);
      ctx.lineTo(tx + 22, ty - 14);
      ctx.lineTo(tx + 18, ty - 22);
      ctx.closePath();
      ctx.fill();

      drawSparkle(ctx, tx, ty, 6, PALETTE.white);
      ctx.restore();
    },
  },
  {
    key: "edu_math",
    category: "arcade",
    baseExpression: "Read",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);

      // Dark chalkboard with math formulas
      const bx = 84;
      const by = 74;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Wooden frame
      ctx.fillStyle = "#78350F";
      ctx.beginPath();
      ctx.roundRect(bx - 20, by - 16, 40, 32, 4);
      ctx.fill();

      // Slate board
      ctx.fillStyle = "#064E3B";
      ctx.fillRect(bx - 17, by - 13, 34, 26);

      // Chalk equations
      ctx.fillStyle = PALETTE.white;
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("1+1=2", bx, by - 2);

      ctx.fillStyle = PALETTE.gold;
      ctx.font = "italic bold 7px sans-serif";
      ctx.fillText("π ≈ 3.14", bx, by + 8);

      ctx.restore();
    },
  },
  {
    key: "edu_map",
    category: "arcade",
    baseExpression: "Thinking",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);

      // Explorer scroll map and compass
      const mx = 82;
      const my = 76;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Parchment map
      ctx.fillStyle = "#FEF3C7";
      ctx.beginPath();
      ctx.roundRect(mx - 18, my - 16, 36, 32, 4);
      ctx.fill();
      ctx.strokeStyle = "#D97706";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Map contour lines
      ctx.strokeStyle = "#92400E";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx - 6, my - 4, 6, 0, Math.PI * 1.5);
      ctx.stroke();

      // Red X marks spot
      ctx.strokeStyle = PALETTE.crimson;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx + 6, my - 6);
      ctx.lineTo(mx + 12, my);
      ctx.moveTo(mx + 12, my - 6);
      ctx.lineTo(mx + 6, my);
      ctx.stroke();

      // Brass pocket compass
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(mx + 10, my + 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#B45309";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Compass needle (red North, blue South)
      ctx.fillStyle = PALETTE.crimson;
      ctx.beginPath();
      ctx.moveTo(mx + 10, my + 14);
      ctx.lineTo(mx + 8, my + 9);
      ctx.lineTo(mx + 10, my + 7);
      ctx.lineTo(mx + 12, my + 9);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    },
  },
  {
    key: "edu_flag",
    category: "arcade",
    baseExpression: "Cheers",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);

      // Waving country flags (Indonesian Merah Putih & Checkered)
      const drawFlag = (fx, fy, angle, isCheckered = false) => {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(angle);
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 4;

        // Flagpole
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(0, 20);
        ctx.stroke();

        if (!isCheckered) {
          // Indonesian Merah Putih
          ctx.fillStyle = PALETTE.crimson;
          ctx.fillRect(0, -22, 22, 10);
          ctx.fillStyle = PALETTE.white;
          ctx.fillRect(0, -12, 22, 10);
          ctx.strokeStyle = "#CBD5E1";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(0, -22, 22, 20);
        } else {
          // Checkered Flag
          ctx.fillStyle = PALETTE.midnight;
          ctx.fillRect(0, -22, 22, 20);
          ctx.fillStyle = PALETTE.white;
          ctx.fillRect(0, -22, 11, 10);
          ctx.fillRect(11, -12, 11, 10);
        }

        ctx.restore();
      };

      drawFlag(28, 48, -0.3, false);
      drawFlag(98, 48, 0.3, true);
    },
  },
  {
    key: "edu_word",
    category: "arcade",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);

      // 3 Colorful wooden alphabet toy blocks
      const drawBlock = (bx, by, letter, color) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 4;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(bx - 10, by - 10, 20, 20, 3);
        ctx.fill();

        ctx.fillStyle = PALETTE.white;
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(letter, bx, by + 4);

        ctx.restore();
      };

      drawBlock(40, 88, "A", PALETTE.crimson);
      drawBlock(64, 82, "B", PALETTE.skyCyan);
      drawBlock(88, 88, "C", PALETTE.gold);
    },
  },

  // ----------------------------------------------------
  // KATEGORI D: EKONOMI, KAS & BISNIS (6 items)
  // ----------------------------------------------------
  {
    key: "eco_cash",
    category: "economy",
    baseExpression: "Cheers",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Spinning golden Naura Coin (NC)
      const cx = 86;
      const cy = 68;
      const scaleX = opt.isGif ? Math.cos(t * Math.PI * 2) : 1;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, 1);
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 8;

      // Outer coin edge
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();

      // Inner ridge
      ctx.strokeStyle = PALETTE.amber;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Monogram NC
      if (Math.abs(scaleX) > 0.3) {
        ctx.fillStyle = "#78350F";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("NC", 0, 4);
      }

      ctx.restore();
      drawSparkle(ctx, cx + 18, cy - 16, 6, PALETTE.gold);
    },
  },
  {
    key: "eco_bank",
    category: "economy",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Heavy round steel bank vault door
      const vx = 88;
      const vy = 70;
      const vr = 22;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;

      // Vault frame
      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.arc(vx, vy, vr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer bolts
      ctx.fillStyle = "#94A3B8";
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.arc(vx + Math.cos(a) * (vr - 4), vy + Math.sin(a) * (vr - 4), 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center turn wheel handle
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(vx, vy, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Spokes
      ctx.beginPath();
      ctx.moveTo(vx - 8, vy);
      ctx.lineTo(vx + 8, vy);
      ctx.moveTo(vx, vy - 8);
      ctx.lineTo(vx, vy + 8);
      ctx.stroke();

      // Green security LED
      ctx.fillStyle = PALETTE.emerald;
      ctx.beginPath();
      ctx.arc(vx - 14, vy - 14, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
  },
  {
    key: "eco_shop",
    category: "economy",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 18, 92, 98);

      // Striped market canopy awning overhead
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 5;

      const ax = 64;
      const ay = 18;
      const stripeW = 14;

      // 6 Scalloped stripes (crimson & white)
      for (let i = 0; i < 6; i++) {
        const sx = ax - 42 + (i * stripeW);
        ctx.fillStyle = i % 2 === 0 ? PALETTE.crimson : PALETTE.white;
        ctx.beginPath();
        ctx.moveTo(sx, ay);
        ctx.lineTo(sx + stripeW, ay);
        ctx.lineTo(sx + stripeW - 2, ay + 14);
        ctx.quadraticCurveTo(sx + (stripeW / 2), ay + 18, sx + 2, ay + 14);
        ctx.closePath();
        ctx.fill();
      }

      // Wooden store counter below
      ctx.fillStyle = "#78350F";
      ctx.fillRect(30, 96, 68, 14);
      ctx.fillStyle = "#B45309";
      ctx.fillRect(32, 98, 64, 4);

      ctx.restore();
    },
  },
  {
    key: "eco_work",
    category: "economy",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Yellow construction safety hardhat on Naura's head
      ctx.save();
      const hx = 56;
      const hy = 24;

      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 5;

      // Hardhat dome
      ctx.fillStyle = PALETTE.amber;
      ctx.beginPath();
      ctx.arc(hx, hy, 18, Math.PI, 0);
      ctx.fill();

      // Peak brim
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.roundRect(hx - 22, hy, 44, 5, 2);
      ctx.fill();

      // Silver reflective safety strip
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(hx - 12, hy - 8, 24, 3);

      // Clipboard with work checklist
      const cx = 86;
      const cy = 76;
      ctx.fillStyle = "#78350F";
      ctx.beginPath();
      ctx.roundRect(cx - 14, cy - 18, 28, 36, 3);
      ctx.fill();

      // Paper
      ctx.fillStyle = "#FEF3C7";
      ctx.fillRect(cx - 11, cy - 14, 22, 28);

      // Silver clip
      ctx.fillStyle = "#94A3B8";
      ctx.fillRect(cx - 6, cy - 18, 12, 4);

      // Checkmarks
      ctx.fillStyle = PALETTE.emerald;
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("✓", cx - 7, cy - 6);
      ctx.fillText("✓", cx - 7, cy + 4);

      ctx.restore();
    },
  },
  {
    key: "eco_heist",
    category: "economy",
    baseExpression: "Annoy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Stealth cat-ear domino mask over Naura's eyes
      ctx.save();
      ctx.fillStyle = PALETTE.midnight;
      ctx.beginPath();
      ctx.roundRect(38, 52, 44, 12, 4);
      ctx.fill();

      // Cat ear peaks
      ctx.beginPath();
      ctx.moveTo(38, 52);
      ctx.lineTo(34, 44);
      ctx.lineTo(44, 52);
      ctx.moveTo(82, 52);
      ctx.lineTo(88, 44);
      ctx.lineTo(76, 52);
      ctx.fill();

      // Bulging burlap coin sack slung over shoulder
      const sx = 86;
      const sy = 70;
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      ctx.fillStyle = "#D97706";
      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fill();

      // Sack neck and rope
      ctx.fillStyle = "#B45309";
      ctx.fillRect(sx - 4, sy - 20, 8, 8);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy - 14);
      ctx.lineTo(sx + 6, sy - 14);
      ctx.stroke();

      // Golden $ on sack
      ctx.fillStyle = PALETTE.gold;
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("$", sx, sy + 5);

      ctx.restore();
    },
  },
  {
    key: "eco_trade",
    category: "economy",
    baseExpression: "Cheers",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 18, 90, 96);

      // Wrapped gift present box with golden bow
      const gx = 64;
      const gy = 82;
      const size = 26;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 6;

      // Box body
      ctx.fillStyle = "#06B6D4";
      ctx.fillRect(gx - (size / 2), gy - (size / 2), size, size);

      // Satin golden ribbon
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(gx - 3, gy - (size / 2), 6, size);
      ctx.fillRect(gx - (size / 2), gy - 3, size, 6);

      // Fluffy ribbon bow on top
      ctx.beginPath();
      ctx.arc(gx - 5, gy - (size / 2) - 3, 5, 0, Math.PI * 2);
      ctx.arc(gx + 5, gy - (size / 2) - 3, 5, 0, Math.PI * 2);
      ctx.fill();

      // Circular exchange arrows
      ctx.strokeStyle = PALETTE.emerald;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, 20, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gx, gy, 20, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();

      drawSparkle(ctx, gx + 18, gy - 16, 5, PALETTE.gold);
      ctx.restore();
    },
  },

  // ----------------------------------------------------
  // KATEGORI E: MODERASI, ADMIN & SERVER (7 items)
  // ----------------------------------------------------
  {
    key: "mod_shield",
    category: "moderation",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Sturdy guardian shield
      const sx = 84;
      const sy = 72;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 8;

      // Shield body
      ctx.fillStyle = PALETTE.midnight;
      ctx.beginPath();
      ctx.moveTo(sx - 18, sy - 18);
      ctx.lineTo(sx + 18, sy - 18);
      ctx.lineTo(sx + 18, sy);
      ctx.quadraticCurveTo(sx + 18, sy + 22, sx, sy + 28);
      ctx.quadraticCurveTo(sx - 18, sy + 22, sx - 18, sy);
      ctx.closePath();
      ctx.fill();

      // Shield metallic rim
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Cyan glowing cross crest
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillRect(sx - 3, sy - 12, 6, 24);
      ctx.fillRect(sx - 11, sy - 4, 22, 6);

      // Protection barrier aura
      ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawSparkle(ctx, sx + 14, sy - 14, 5, PALETTE.cyan);
      ctx.restore();
    },
  },
  {
    key: "mod_warn",
    category: "moderation",
    baseExpression: "Annoy",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Bright yellow hazard warning triangle
      const wx = 84;
      const wy = 72;
      const pulse = opt.isGif ? (Math.sin(t * Math.PI * 2) * 3) : 0;

      ctx.save();
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 8 + pulse;

      // Yellow triangle
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(wx, wy - 22);
      ctx.lineTo(wx + 22, wy + 16);
      ctx.lineTo(wx - 22, wy + 16);
      ctx.closePath();
      ctx.fill();

      // Black inner border
      ctx.strokeStyle = PALETTE.midnight;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bold exclamation mark
      ctx.fillStyle = PALETTE.midnight;
      ctx.fillRect(wx - 2, wy - 10, 4, 12);
      ctx.beginPath();
      ctx.arc(wx, wy + 8, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
  },
  {
    key: "mod_mute",
    category: "moderation",
    baseExpression: "Shy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 14, 14, 90, 96);

      // Index finger to lips
      ctx.save();
      ctx.fillStyle = "#FFE4E1";
      ctx.beginPath();
      ctx.roundRect(56, 64, 6, 14, 3);
      ctx.fill();

      // Solid brass mute padlock beside her
      const px = 88;
      const py = 72;
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Padlock shackle
      ctx.strokeStyle = "#94A3B8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py - 8, 7, Math.PI, 0);
      ctx.stroke();

      // Padlock body
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 6, 20, 18, 3);
      ctx.fill();

      // Muted speaker slash
      ctx.strokeStyle = PALETTE.crimson;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 6, py + 8);
      ctx.lineTo(px + 6, py - 2);
      ctx.stroke();

      ctx.restore();
    },
  },
  {
    key: "mod_kick",
    category: "moderation",
    baseExpression: "Angry",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 14, 92, 98);

      // Dynamic high kick with impact burst
      ctx.save();
      const kx = 94;
      const ky = 54;

      // Kick speed lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(kx - 10, ky + 10, 24, -Math.PI * 0.4, 0);
      ctx.stroke();

      // Winged boot impact starburst
      drawSparkle(ctx, kx, ky, 10, PALETTE.gold);

      // Kick boot
      ctx.fillStyle = PALETTE.midnight;
      ctx.beginPath();
      ctx.roundRect(kx - 8, ky - 4, 16, 10, 3);
      ctx.fill();
      ctx.fillStyle = PALETTE.crimson;
      ctx.fillRect(kx - 8, ky + 4, 16, 3);

      ctx.restore();
    },
  },
  {
    key: "mod_ban",
    category: "moderation",
    baseExpression: "Angry",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 10, 16, 86, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Heavy mythical ban hammer
      const hx = 84;
      const hy = 62;

      ctx.save();
      const auraPulse = opt.isGif ? (Math.sin(t * Math.PI * 2) * 4) : 0;
      ctx.shadowColor = PALETTE.crimson;
      ctx.shadowBlur = 10 + auraPulse;

      // Leather haft
      ctx.strokeStyle = "#78350F";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hx - 22, hy + 26);
      ctx.lineTo(hx + 12, hy - 14);
      ctx.stroke();

      // Sledge hammer head
      ctx.fillStyle = PALETTE.slate;
      ctx.save();
      ctx.translate(hx + 12, hy - 14);
      ctx.rotate(0.6);
      ctx.fillRect(-12, -10, 24, 20);

      // Glowing crimson runes on hammerhead
      ctx.fillStyle = PALETTE.crimson;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BAN", 0, 4);
      ctx.restore();

      // Cosmic electric discharge sparks
      const sparkCount = opt.isGif ? 4 : 2;
      for (let s = 0; s < sparkCount; s++) {
        const sx = hx + 10 + (Math.cos((t + s) * Math.PI * 2) * 14);
        const sy = hy - 14 + (Math.sin((t + s) * Math.PI * 2) * 14);
        drawSparkle(ctx, sx, sy, 4, PALETTE.gold);
      }

      ctx.restore();
    },
  },
  {
    key: "mod_lock",
    category: "moderation",
    baseExpression: "Hmph",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Ornate golden antique key & heavy closed padlock
      const kx = 76;
      const ky = 66;

      ctx.save();
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 6;

      // Golden key
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2.5;
      // Key bow
      ctx.beginPath();
      ctx.arc(kx - 6, ky - 8, 6, 0, Math.PI * 2);
      ctx.stroke();
      // Key shaft & teeth
      ctx.beginPath();
      ctx.moveTo(kx, ky - 8);
      ctx.lineTo(kx + 14, ky + 6);
      ctx.lineTo(kx + 18, ky + 2);
      ctx.stroke();

      // Closed padlock
      const px = 96;
      const py = 76;
      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 6, 20, 18, 3);
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Shackle
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py - 8, 6, Math.PI, 0);
      ctx.stroke();

      ctx.restore();
    },
  },
  {
    key: "mod_ticket",
    category: "moderation",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Support headset with boom mic
      ctx.save();
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(46, 52, 16, -Math.PI * 0.7, 0);
      ctx.stroke();
      // Boom mic
      ctx.beginPath();
      ctx.moveTo(60, 56);
      ctx.lineTo(66, 68);
      ctx.stroke();
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.arc(66, 68, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // VIP support ticket / envelope
      const tx = 84;
      const ty = 76;
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Envelope body
      ctx.fillStyle = "#FFFBEB";
      ctx.beginPath();
      ctx.roundRect(tx - 16, ty - 12, 32, 24, 3);
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blue verified checkmark seal
      ctx.fillStyle = PALETTE.skyCyan;
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.white;
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓", tx, ty + 3);

      ctx.restore();
    },
  },

  // ----------------------------------------------------
  // KATEGORI F: MUSIK & MEDIA (6 items)
  // ----------------------------------------------------
  {
    key: "music_play",
    category: "music",
    baseExpression: "Happy",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      ctx.save();

      // DJ studio headphones over ears
      const hx = 64;
      const hy = 50;
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, hy - 14, 28, Math.PI * 0.85, Math.PI * 0.15);
      ctx.stroke();

      // Earcups
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.roundRect(hx - 32, hy - 4, 8, 18, 4);
      ctx.roundRect(hx + 24, hy - 4, 8, 18, 4);
      ctx.fill();

      // Glowing neon emerald play triangle
      const px = 64;
      const py = 88;
      const pulse = opt.isGif ? (Math.sin(t * Math.PI * 2) * 3) : 0;

      ctx.shadowColor = PALETTE.emerald;
      ctx.shadowBlur = 10 + pulse;

      // Play triangle
      ctx.fillStyle = PALETTE.emerald;
      ctx.beginPath();
      ctx.moveTo(px - 10, py - 14);
      ctx.lineTo(px + 14, py);
      ctx.lineTo(px - 10, py + 14);
      ctx.closePath();
      ctx.fill();

      // Soundwave pulse ripples
      if (opt.isGif) {
        const ringR = 14 + (t * 16);
        const ringAlpha = Math.max(0, 1 - t);
        ctx.strokeStyle = `rgba(16, 185, 129, ${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    },
  },
  {
    key: "music_pause",
    category: "music",
    baseExpression: "Thinking",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);

      // Twin glowing cyan vertical pause bars
      const px = 64;
      const py = 84;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 8;

      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 14, 7, 28, 3);
      ctx.roundRect(px + 3, py - 14, 7, 28, 3);
      ctx.fill();

      // Acoustic stave curves in background
      ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, 84);
      ctx.quadraticCurveTo(44, 74, 52, 84);
      ctx.moveTo(76, 84);
      ctx.quadraticCurveTo(84, 94, 104, 84);
      ctx.stroke();

      ctx.restore();
    },
  },
  {
    key: "music_skip",
    category: "music",
    baseExpression: "Cheers",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Fast-forward skip track double chevrons
      const sx = 84;
      const sy = 72;

      ctx.save();
      ctx.shadowColor = PALETTE.purple;
      ctx.shadowBlur = 8;

      ctx.fillStyle = PALETTE.purple;
      // Chevron 1
      ctx.beginPath();
      ctx.moveTo(sx - 12, sy - 12);
      ctx.lineTo(sx - 2, sy);
      ctx.lineTo(sx - 12, sy + 12);
      ctx.closePath();
      ctx.fill();

      // Chevron 2
      ctx.beginPath();
      ctx.moveTo(sx - 2, sy - 12);
      ctx.lineTo(sx + 8, sy);
      ctx.lineTo(sx - 2, sy + 12);
      ctx.closePath();
      ctx.fill();

      // Stop bar
      ctx.fillRect(sx + 10, sy - 12, 4, 24);

      // Speed lines
      ctx.strokeStyle = "rgba(192, 132, 252, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - 22, sy - 6);
      ctx.lineTo(sx - 14, sy - 6);
      ctx.moveTo(sx - 26, sy + 6);
      ctx.lineTo(sx - 16, sy + 6);
      ctx.stroke();

      ctx.restore();
    },
  },
  {
    key: "music_queue",
    category: "music",
    baseExpression: "Read",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Organized music playlist sheet
      const qx = 84;
      const qy = 74;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Clipboard
      ctx.fillStyle = "#FFFBEB";
      ctx.beginPath();
      ctx.roundRect(qx - 14, qy - 18, 28, 36, 3);
      ctx.fill();
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tracklines & musical notes
      ctx.fillStyle = PALETTE.deepBlue;
      ctx.font = "8px sans-serif";
      ctx.fillText("♪ Track 1", qx - 10, qy - 8);
      ctx.fillText("♫ Track 2", qx - 10, qy + 2);
      ctx.fillText("♪ Track 3", qx - 10, qy + 12);

      drawSparkle(ctx, qx + 16, qy - 18, 5, PALETTE.cyan);
      ctx.restore();
    },
  },
  {
    key: "music_bass",
    category: "music",
    baseExpression: "Chirping",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 16, 12, 90, 96);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Thumping subwoofer speaker cabinet
      const sx = 64;
      const sy = 86;
      const bounce = opt.isGif ? (Math.sin(t * Math.PI * 2) * 2.5) : 0;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 6;

      // Cabinet
      ctx.fillStyle = PALETTE.slate;
      ctx.beginPath();
      ctx.roundRect(sx - 34, sy - 18, 68, 36, 4);
      ctx.fill();

      // Speaker cone
      const coneR = 14 + bounce;
      ctx.fillStyle = PALETTE.midnight;
      ctx.beginPath();
      ctx.arc(sx, sy, coneR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dust cap
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();

      // Bass shockwave rings
      if (opt.isGif) {
        const waveR = 18 + (t * 20);
        const waveAlpha = Math.max(0, 1 - t);
        ctx.strokeStyle = `rgba(0, 255, 255, ${waveAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, waveR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    },
  },
  {
    key: "music_disc",
    category: "music",
    baseExpression: "Happy",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 12, 14, 88, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // DJ Turntable vinyl record
      const dx = 84;
      const dy = 76;
      const rot = opt.isGif ? (t * Math.PI * 2) : 0.4;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 6;

      // Silver turntable deck
      ctx.fillStyle = "#94A3B8";
      ctx.fillRect(dx - 22, dy - 20, 44, 40);

      // Vinyl disc
      ctx.save();
      ctx.translate(dx - 2, dy);
      ctx.rotate(rot);

      ctx.fillStyle = "#0F172A";
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // Grooves
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Center label
      ctx.fillStyle = PALETTE.magenta;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Tonearm
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx + 16, dy - 14);
      ctx.lineTo(dx + 6, dy + 6);
      ctx.stroke();

      ctx.restore();
    },
  },

  // ----------------------------------------------------
  // KATEGORI G: UTILITY & PIHAK KETIGA (8 items)
  // ----------------------------------------------------
  {
    key: "mc_pickaxe",
    category: "utility",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Iconic Minecraft pixelated diamond pickaxe
      const px = 82;
      const py = 60;

      ctx.save();
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 6;

      // Pixel art grid (scale = 3px per pixel block)
      const u = 3;
      ctx.translate(px, py);
      ctx.rotate(-0.4);

      // Wooden pixel handle
      ctx.fillStyle = "#8D6E63";
      for (let i = -4; i <= 6; i++) {
        ctx.fillRect(i * u, i * u, u, u);
      }

      // Diamond pickaxe head
      ctx.fillStyle = "#00E5FF";
      ctx.fillRect(-6 * u, -4 * u, 4 * u, 2 * u);
      ctx.fillRect(-8 * u, -6 * u, 3 * u, 3 * u);
      ctx.fillRect(-4 * u, -6 * u, 2 * u, 4 * u);
      ctx.fillRect(-2 * u, -8 * u, 3 * u, 3 * u);

      // Diamond specular glint
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(-7 * u, -5 * u, u, u);
      ctx.fillRect(-3 * u, -7 * u, u, u);

      drawSparkle(ctx, 16, -14, 5, PALETTE.cyan);
      ctx.restore();
    },
  },
  {
    key: "mc_steve",
    category: "utility",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 10, 16, 84, 92);

      // Blocky cubic Steve head companion
      const sx = 88;
      const sy = 70;
      const size = 26;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Face skin
      ctx.fillStyle = "#C68642";
      ctx.fillRect(sx - (size / 2), sy - (size / 2), size, size);

      // Hair
      ctx.fillStyle = "#4A2E18";
      ctx.fillRect(sx - (size / 2), sy - (size / 2), size, 8);
      ctx.fillRect(sx - (size / 2), sy - (size / 2) + 8, 4, 6);
      ctx.fillRect(sx + (size / 2) - 4, sy - (size / 2) + 8, 4, 6);

      // Eyes
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(sx - 10, sy, 6, 4);
      ctx.fillRect(sx + 4, sy, 6, 4);
      ctx.fillStyle = "#2563EB";
      ctx.fillRect(sx - 7, sy, 3, 4);
      ctx.fillRect(sx + 4, sy, 3, 4);

      // Beard / Mouth
      ctx.fillStyle = "#6B4423";
      ctx.fillRect(sx - 5, sy + 6, 10, 3);

      // Heart pixels between them
      ctx.fillStyle = PALETTE.crimson;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("♥", sx - 20, sy - 8);

      ctx.restore();
    },
  },
  {
    key: "mc_ping",
    category: "utility",
    baseExpression: "Thinking",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Minecraft redstone repeater & ping signal HUD
      const rx = 84;
      const ry = 76;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Stone slab
      ctx.fillStyle = "#78716C";
      ctx.fillRect(rx - 16, ry + 4, 32, 10);

      // Redstone torch
      ctx.fillStyle = "#78350F";
      ctx.fillRect(rx - 8, ry - 6, 3, 10);
      ctx.fillStyle = PALETTE.crimson;
      ctx.shadowColor = PALETTE.crimson;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(rx - 6.5, ry - 6, 3, 0, Math.PI * 2);
      ctx.fill();

      // Green signal strength bars (5 full bars)
      const bars = [
        { h: 4, x: rx + 2 },
        { h: 7, x: rx + 6 },
        { h: 10, x: rx + 10 },
        { h: 13, x: rx + 14 },
      ];
      ctx.fillStyle = PALETTE.emerald;
      ctx.shadowColor = PALETTE.emerald;
      ctx.shadowBlur = 4;
      bars.forEach((b) => {
        ctx.fillRect(b.x, ry + 2 - b.h, 3, b.h);
      });

      ctx.restore();
    },
  },
  {
    key: "weather_sun",
    category: "utility",
    baseExpression: "Cheers",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);

      ctx.save();
      // Straw sunhat on Naura's head
      const hx = 64;
      const hy = 26;
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 5;

      // Hat crown
      ctx.fillStyle = "#FDE68A";
      ctx.beginPath();
      ctx.arc(hx, hy, 16, Math.PI, 0);
      ctx.fill();

      // Hat wide brim
      ctx.beginPath();
      ctx.ellipse(hx, hy + 2, 28, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pink ribbon around hat
      ctx.fillStyle = PALETTE.magenta;
      ctx.fillRect(hx - 16, hy - 4, 32, 4);

      // Cool dark sunglasses
      ctx.fillStyle = PALETTE.midnight;
      ctx.beginPath();
      ctx.roundRect(hx - 20, hy + 22, 16, 10, 3);
      ctx.roundRect(hx + 4, hy + 22, 16, 10, 3);
      ctx.fill();
      ctx.strokeStyle = PALETTE.slate;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Beaming golden cartoon sun behind
      const sx = 26;
      const sy = 28;
      ctx.fillStyle = PALETTE.gold;
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fill();

      // Sun rays
      ctx.strokeStyle = PALETTE.amber;
      ctx.lineWidth = 2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 14, sy + Math.sin(a) * 14);
        ctx.lineTo(sx + Math.cos(a) * 19, sy + Math.sin(a) * 19);
        ctx.stroke();
      }

      ctx.restore();
    },
  },
  {
    key: "weather_rain",
    category: "utility",
    baseExpression: "Akward",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      ctx.save();

      // Domed cyan umbrella held overhead
      const ux = 64;
      const uy = 24;
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;

      // Umbrella canopy
      ctx.fillStyle = "#06B6D4";
      ctx.beginPath();
      ctx.arc(ux, uy, 32, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      // Scalloped bottom edge
      ctx.strokeStyle = PALETTE.white;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Umbrella handle
      ctx.strokeStyle = "#78350F";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(ux, uy + 26);
      ctx.stroke();

      // Falling rain droplets
      ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
      ctx.lineWidth = 1.5;
      const rainOffset = opt.isGif ? (t * 24) : 8;

      const drops = [
        { x: 18, y: (16 + rainOffset) % 118 },
        { x: 28, y: (42 + rainOffset) % 118 },
        { x: 104, y: (24 + rainOffset) % 118 },
        { x: 114, y: (56 + rainOffset) % 118 },
      ];

      drops.forEach((d) => {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 3, d.y + 10);
        ctx.stroke();
      });

      ctx.restore();
    },
  },
  {
    key: "media_anime",
    category: "utility",
    baseExpression: "Impressed",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 16, 16, 92, 98);

      // Overflowing striped movie popcorn bucket
      const px = 64;
      const py = 82;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 6;

      // Bucket body (striped red and white)
      ctx.fillStyle = PALETTE.crimson;
      ctx.beginPath();
      ctx.moveTo(px - 18, py - 6);
      ctx.lineTo(px + 18, py - 6);
      ctx.lineTo(px + 14, py + 22);
      ctx.lineTo(px - 14, py + 22);
      ctx.closePath();
      ctx.fill();

      // White vertical stripes
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(px - 10, py - 6, 5, 26);
      ctx.fillRect(px + 5, py - 6, 5, 26);

      // Golden fluffy popcorn kernels heaped high
      ctx.fillStyle = "#FDE047";
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 4;
      const kernels = [
        { x: px - 12, y: py - 8 },
        { x: px - 6, y: py - 12 },
        { x: px, y: py - 14 },
        { x: px + 6, y: py - 12 },
        { x: px + 12, y: py - 8 },
        { x: px - 2, y: py - 8 },
      ];
      kernels.forEach((k) => {
        ctx.beginPath();
        ctx.arc(k.x, k.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      drawSparkle(ctx, 28, 36, 6, PALETTE.gold);
      drawSparkle(ctx, 100, 36, 6, PALETTE.cyan);
      ctx.restore();
    },
  },
  {
    key: "media_movie",
    category: "utility",
    baseExpression: "Happy",
    animated: false,
    render(ctx, img) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);

      // Cinema director's clapperboard
      const cx = 82;
      const cy = 74;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 5;

      // Clapperboard body
      ctx.fillStyle = PALETTE.midnight;
      ctx.beginPath();
      ctx.roundRect(cx - 18, cy - 12, 36, 26, 3);
      ctx.fill();

      // Top hinged clapper with black and white stripes
      ctx.save();
      ctx.translate(cx - 18, cy - 12);
      ctx.rotate(-0.15);
      ctx.fillStyle = PALETTE.midnight;
      ctx.fillRect(0, -8, 36, 8);
      ctx.fillStyle = PALETTE.white;
      // Slanted white stripes
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(12, 0);
      ctx.lineTo(8, -8);
      ctx.lineTo(2, -8);
      ctx.moveTo(18, 0);
      ctx.lineTo(24, 0);
      ctx.lineTo(20, -8);
      ctx.lineTo(14, -8);
      ctx.moveTo(30, 0);
      ctx.lineTo(36, 0);
      ctx.lineTo(32, -8);
      ctx.lineTo(26, -8);
      ctx.fill();
      ctx.restore();

      // Chalk info
      ctx.fillStyle = PALETTE.white;
      ctx.font = "bold 6px sans-serif";
      ctx.fillText("SCENE 1", cx - 14, cy);
      ctx.fillText("TAKE 1", cx - 14, cy + 8);

      ctx.restore();
    },
  },
  {
    key: "dl_cobalt",
    category: "utility",
    baseExpression: "Cheers",
    animated: true,
    render(ctx, img, opt = {}) {
      drawChibiNaura(ctx, img, 12, 16, 88, 94);
      const frame = opt.frame || 0;
      const total = opt.totalFrames || 12;
      const t = frame / total;

      // Futuristic neon cobalt blue download arrow
      const ax = 84;
      const ay = 70;
      const arrowPulse = opt.isGif ? (Math.sin(t * Math.PI * 2) * 3) : 0;

      ctx.save();
      ctx.shadowColor = "#2563EB";
      ctx.shadowBlur = 8;

      // Downward arrow
      ctx.fillStyle = "#2563EB";
      ctx.beginPath();
      ctx.moveTo(ax - 5, ay - 18 + arrowPulse);
      ctx.lineTo(ax + 5, ay - 18 + arrowPulse);
      ctx.lineTo(ax + 5, ay - 2 + arrowPulse);
      ctx.lineTo(ax + 12, ay - 2 + arrowPulse);
      ctx.lineTo(ax, ay + 14 + arrowPulse);
      ctx.lineTo(ax - 12, ay - 2 + arrowPulse);
      ctx.lineTo(ax - 5, ay - 2 + arrowPulse);
      ctx.closePath();
      ctx.fill();

      // Neon cyan core
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Data streaming lines
      ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      const streamY = opt.isGif ? (t * 16) : 4;
      ctx.beginPath();
      ctx.moveTo(ax - 16, ay - 10 + streamY);
      ctx.lineTo(ax - 16, ay + 8 + streamY);
      ctx.moveTo(ax + 16, ay - 14 + streamY);
      ctx.lineTo(ax + 16, ay + 4 + streamY);
      ctx.stroke();

      ctx.restore();
    },
  },
];

// ==========================================
// PROSES GENERASI UTAMA
// ==========================================
async function main() {
  console.log("=== MEMULAI GENERASI 50 EMOJI KATEGORI NAURA HOSHINO V2 ===");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Dibuat direktori output: ${OUTPUT_DIR}`);
  }

  let staticCount = 0;
  let animatedCount = 0;
  const results = [];

  for (const item of CATEGORY_EMOJIS) {
    const baseImg = await getExpressionImage(item.baseExpression);

    // 1. Generate Static PNG
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    item.render(ctx, baseImg, { isGif: false });

    const pngBuffer = await canvas.encode("png");
    const pngPath = path.join(OUTPUT_DIR, `${item.key}.png`);
    fs.writeFileSync(pngPath, pngBuffer);
    staticCount++;

    const pngSizeKb = (pngBuffer.length / 1024).toFixed(2);
    results.push({
      key: item.key,
      format: "PNG",
      sizeKb: pngSizeKb,
      status: pngBuffer.length < 262144 ? "OK" : "OVERSIZED",
    });

    // 2. Generate Animated GIF jika slot animasi
    if (item.animated) {
      const frameCount = 12;
      const encoder = new GifEncoder(CANVAS_SIZE, CANVAS_SIZE, { repeat: 0 });

      for (let f = 0; f < frameCount; f++) {
        const fCanvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
        const fCtx = fCanvas.getContext("2d");
        fCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        item.render(fCtx, baseImg, { isGif: true, frame: f, totalFrames: frameCount });

        const frameData = fCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const uint8 = new Uint8Array(
          frameData.data.buffer,
          frameData.data.byteOffset,
          frameData.data.byteLength
        );
        encoder.addFrame(uint8, CANVAS_SIZE, CANVAS_SIZE, {
          delay: 80,
          disposal: GifDisposal.Background,
        });
      }

      const gifBuffer = encoder.finish();
      const gifPath = path.join(OUTPUT_DIR, `${item.key}.gif`);
      fs.writeFileSync(gifPath, gifBuffer);
      animatedCount++;

      const gifSizeKb = (gifBuffer.length / 1024).toFixed(2);
      results.push({
        key: item.key,
        format: "GIF",
        sizeKb: gifSizeKb,
        status: gifBuffer.length < 262144 ? "OK" : "OVERSIZED",
      });
    }
  }

  console.log("\n--- RINGKASAN GENERASI ---");
  console.log(`Total Emoji Kategori Static PNG: ${staticCount} / 50`);
  console.log(`Total Emoji Action Animated GIF: ${animatedCount} / 13`);
  console.log(`Semua file tersimpan di: ${OUTPUT_DIR}`);

  // Cek apakah ada yang melebihi batas 256 KB
  const oversized = results.filter((r) => r.status === "OVERSIZED");
  if (oversized.length > 0) {
    console.error("PERINGATAN: Ditemukan file melebihi 256 KB:", oversized);
    process.exit(1);
  } else {
    console.log("SEMUA FILE LOLOS VERIFIKASI UKURAN (< 256 KB).");
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("FATAL ERROR pada generasi emoji:", err);
    process.exit(1);
  });
}

module.exports = {
  CATEGORY_EMOJIS,
  PALETTE,
  CANVAS_SIZE,
  main,
};
