"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadCanvas } = require("../src/canvas/canvasRuntime");
const { createCanvas } = loadCanvas();

const outputDir = path.join(__dirname, "../assets/images/canvas");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Abstract Blue Banner (800 x 250)
function generateAbstractBlue() {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  // Base gradient
  const grad = ctx.createLinearGradient(0, 0, 800, 250);
  grad.addColorStop(0, "#090d16");
  grad.addColorStop(0.5, "#1e3a8a");
  grad.addColorStop(1, "#0284c7");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 250);

  // Cyber geometric lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
  ctx.lineWidth = 1.5;
  for (let x = 0; x < 800; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 100, 250);
    ctx.stroke();
  }

  // Glowing orb
  const orb = ctx.createRadialGradient(680, 80, 10, 680, 80, 140);
  orb.addColorStop(0, "rgba(56, 189, 248, 0.6)");
  orb.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(680, 80, 140, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

// 2. Neon Cyberpunk Banner (800 x 250)
function generateNeonCyberpunk() {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  // Deep dark purple/magenta background
  const grad = ctx.createLinearGradient(0, 0, 800, 250);
  grad.addColorStop(0, "#0b0014");
  grad.addColorStop(0.5, "#2e0854");
  grad.addColorStop(1, "#4c1d95");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 250);

  // Neon grid lines
  ctx.strokeStyle = "rgba(236, 72, 153, 0.35)";
  ctx.lineWidth = 1.5;
  for (let y = 0; y < 250; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
  }

  // Cyan vertical accent lines
  ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
  for (let x = 0; x < 800; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 250);
    ctx.stroke();
  }

  // Neon pink glow
  const pinkGlow = ctx.createRadialGradient(150, 125, 20, 150, 125, 120);
  pinkGlow.addColorStop(0, "rgba(236, 72, 153, 0.5)");
  pinkGlow.addColorStop(1, "rgba(236, 72, 153, 0)");
  ctx.fillStyle = pinkGlow;
  ctx.beginPath();
  ctx.arc(150, 125, 120, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

// 3. Gold VIP Banner (800 x 250)
function generateGoldVip() {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  // Dark obsidian gold luxury background
  const grad = ctx.createLinearGradient(0, 0, 800, 250);
  grad.addColorStop(0, "#120e06");
  grad.addColorStop(0.5, "#2a1e06");
  grad.addColorStop(1, "#45320c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 250);

  // Gold radiant streaks
  ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
  ctx.lineWidth = 2;
  for (let x = 0; x < 800; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 250);
    ctx.lineTo(x + 150, 0);
    ctx.stroke();
  }

  // Gold central shimmer
  const goldShimmer = ctx.createRadialGradient(400, 125, 10, 400, 125, 180);
  goldShimmer.addColorStop(0, "rgba(250, 204, 21, 0.45)");
  goldShimmer.addColorStop(1, "rgba(250, 204, 21, 0)");
  ctx.fillStyle = goldShimmer;
  ctx.beginPath();
  ctx.arc(400, 125, 180, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

// 4. Silver Frame (800 x 250) - Transparent center with metallic border
function generateSilverFrame() {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 800, 250);

  // Metallic border
  const borderGrad = ctx.createLinearGradient(0, 0, 800, 250);
  borderGrad.addColorStop(0, "#94a3b8");
  borderGrad.addColorStop(0.25, "#f1f5f9");
  borderGrad.addColorStop(0.5, "#64748b");
  borderGrad.addColorStop(0.75, "#e2e8f0");
  borderGrad.addColorStop(1, "#94a3b8");

  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 790, 240);

  // Corner highlights
  ctx.fillStyle = "#ffffff";
  const cornerSize = 12;
  ctx.fillRect(2, 2, cornerSize, cornerSize);
  ctx.fillRect(798 - cornerSize, 2, cornerSize, cornerSize);
  ctx.fillRect(2, 248 - cornerSize, cornerSize, cornerSize);
  ctx.fillRect(798 - cornerSize, 248 - cornerSize, cornerSize, cornerSize);

  return canvas.toBuffer("image/png");
}

console.log("Generating canvas asset files...");
fs.writeFileSync(path.join(outputDir, "abstract_blue.png"), generateAbstractBlue());
fs.writeFileSync(path.join(outputDir, "neon_cyberpunk.png"), generateNeonCyberpunk());
fs.writeFileSync(path.join(outputDir, "gold_vip.png"), generateGoldVip());
fs.writeFileSync(path.join(outputDir, "silver_frame.png"), generateSilverFrame());
console.log("Successfully generated all 4 default canvas assets in assets/images/canvas!");
