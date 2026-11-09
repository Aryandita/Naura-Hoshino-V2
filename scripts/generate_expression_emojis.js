#!/usr/bin/env node
// Lokasi: scripts/generate_expression_emojis.js
// Pipeline Pembuatan 17 Core Expression Emojis (PNG) & 8 Animated GIFs Naura Hoshino V2
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  createCanvas,
  loadImage,
  GifEncoder,
  GifDisposal,
} = require("../src/canvas/canvasRuntime");

const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT_DIR, "assets/Naura_Expression");
const OUTPUT_DIR = path.join(ROOT_DIR, "assets/emojis/naura_custom");

const CANVAS_SIZE = 128;
const SAFE_BOUND = 108; // 10px safe margin (10..118)
const GIF_BOUND = 102; // safe bound for animated frames with bobbing & particles
const MAX_FILE_SIZE = 256 * 1024; // 256 KB Discord limit
const TOTAL_FRAMES = 12;
const FRAME_DELAY_MS = 80; // 80ms => 12.5 FPS

const EXPRESSIONS = [
  { key: "naura_happy", file: "Happy.png", animated: true },
  { key: "naura_thinking", file: "Thinking.png", animated: true },
  { key: "naura_cry", file: "Cry.png", animated: true },
  { key: "naura_angry", file: "Angry.png", animated: true },
  { key: "naura_shy", file: "Shy.png", animated: false },
  { key: "naura_sleepy", file: "Sleepy.png", animated: true },
  { key: "naura_shocked", file: "Shocked.png", animated: false },
  { key: "naura_eat", file: "Eat.png", animated: false },
  { key: "naura_cheers", file: "Cheers.png", animated: true },
  { key: "naura_chirping", file: "Chirping.png", animated: true },
  { key: "naura_annoy", file: "Annoy.png", animated: false },
  { key: "naura_blow_kiss", file: "Blow kiss.png", animated: true },
  { key: "naura_akward", file: "Akward.png", animated: false },
  { key: "naura_confused", file: "Confused.png", animated: false },
  { key: "naura_hmph", file: "Hmph.png", animated: false },
  { key: "naura_impressed", file: "Impressed.png", animated: false },
  { key: "naura_read", file: "Read.png", animated: false },
];

/**
 * Helper menggambar bintang 4 titik gaya anime
 */
function drawStar(ctx, x, y, size, color, coreColor = "#FFFFFF") {
  if (size <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.15, -size * 0.15, size, 0);
  ctx.quadraticCurveTo(size * 0.15, size * 0.15, 0, size);
  ctx.quadraticCurveTo(-size * 0.15, size * 0.15, -size, 0);
  ctx.quadraticCurveTo(-size * 0.15, -size * 0.15, 0, -size);
  ctx.fill();
  if (coreColor) {
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, size * 0.25), 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Helper menggambar hati pink
 */
function drawHeart(ctx, x, y, size, color) {
  if (size <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  const d = size;
  ctx.moveTo(0, d * 0.3);
  ctx.bezierCurveTo(-d * 0.5, -d * 0.4, -d, d * 0.1, 0, d);
  ctx.bezierCurveTo(d, d * 0.1, d * 0.5, -d * 0.4, 0, d * 0.3);
  ctx.fill();
  // Shine spot
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(-d * 0.3, -d * 0.05, Math.max(0.5, d * 0.12), 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

/**
 * Helper menggambar lambang marah 4 lengkung
 */
function drawAngerVein(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.2);
  ctx.lineCap = "round";
  const s = size * 0.5;
  ctx.beginPath();
  ctx.arc(-s, -s, s, 0, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s, -s, s, Math.PI / 2, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s, s, s, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-s, s, s, Math.PI * 1.5, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper menggambar tetesan air mata anime
 */
function drawTearDrop(ctx, x, y, w, h, color) {
  if (w <= 0.5 || h <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.5);
  ctx.bezierCurveTo(w * 0.5, -h * 0.1, w * 0.5, h * 0.5, 0, h * 0.5);
  ctx.bezierCurveTo(-w * 0.5, h * 0.5, -w * 0.5, -h * 0.1, 0, -h * 0.5);
  ctx.fill();
  // Specular shine
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.arc(0, -h * 0.15, Math.max(0.6, w * 0.2), 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

/**
 * Helper menggambar huruf Z mengambang untuk tidur
 */
function drawZ(ctx, x, y, size, color, alpha = 1) {
  if (size <= 0.5 || alpha <= 0.05) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = size * 0.45;
  ctx.beginPath();
  ctx.moveTo(-s, -s);
  ctx.lineTo(s, -s);
  ctx.lineTo(-s, s);
  ctx.lineTo(s, s);
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper menggambar not balok musik
 */
function drawMusicNote(ctx, x, y, size, isDouble, color) {
  if (size <= 1) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.15);
  ctx.lineCap = "round";
  if (!isDouble) {
    ctx.beginPath();
    ctx.ellipse(0, size * 0.35, size * 0.28, size * 0.2, -0.4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.35);
    ctx.lineTo(size * 0.2, -size * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.2, -size * 0.4);
    ctx.quadraticCurveTo(size * 0.6, -size * 0.2, size * 0.5, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, size * 0.35, size * 0.24, size * 0.18, -0.4, 0, 2 * Math.PI);
    ctx.ellipse(size * 0.3, size * 0.25, size * 0.24, size * 0.18, -0.4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.12, size * 0.35);
    ctx.lineTo(-size * 0.12, -size * 0.35);
    ctx.lineTo(size * 0.48, -size * 0.45);
    ctx.lineTo(size * 0.48, size * 0.25);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, size * 0.25);
    ctx.beginPath();
    ctx.moveTo(-size * 0.12, -size * 0.35);
    ctx.lineTo(size * 0.48, -size * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Helper menggambar tanda tanya cyber futuristik
 */
function drawQuestionMark(ctx, x, y, size, color, glowColor = "#00FFFF") {
  if (size <= 1) return;
  ctx.save();
  ctx.translate(x, y);
  // Outer glow
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = Math.max(2, size * 0.25);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -size * 0.35, size * 0.35, Math.PI, 0, false);
  ctx.bezierCurveTo(size * 0.35, -size * 0.05, 0, 0, 0, size * 0.2);
  ctx.stroke();
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.arc(0, size * 0.45, Math.max(1.5, size * 0.12), 0, 2 * Math.PI);
  ctx.fill();

  // Inner core
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.15);
  ctx.beginPath();
  ctx.arc(0, -size * 0.35, size * 0.35, Math.PI, 0, false);
  ctx.bezierCurveTo(size * 0.35, -size * 0.05, 0, 0, 0, size * 0.2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, size * 0.45, Math.max(1, size * 0.08), 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

/**
 * Mendapatkan bounding box dari piksel non-transparan (alpha > 10)
 */
function getBoundingBox(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const idata = ctx.getImageData(0, 0, img.width, img.height).data;

  let minX = img.width;
  let maxX = 0;
  let minY = img.height;
  let maxY = 0;

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const alpha = idata[(y * img.width + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    minX,
    minY,
    boundW: maxX - minX + 1,
    boundH: maxY - minY + 1,
  };
}

/**
 * Menghitung parameter penskalaan dan pemusatan optik ke dalam kanvas 128x128
 */
function calculateLayout(bound, maxBound = SAFE_BOUND) {
  const scale = Math.min(maxBound / bound.boundW, maxBound / bound.boundH);
  const scaledW = Math.round(bound.boundW * scale);
  const scaledH = Math.round(bound.boundH * scale);

  const destX = Math.floor((CANVAS_SIZE - scaledW) / 2);
  const destY = Math.floor((CANVAS_SIZE - scaledH) / 2);

  return {
    scale,
    scaledW,
    scaledH,
    destX,
    destY,
  };
}

/**
 * Render static 128x128 PNG dengan safe zone 10px dan optical centering
 */
async function generateStaticEmoji(img, bound, layout, outputPath) {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.drawImage(
    img,
    bound.minX,
    bound.minY,
    bound.boundW,
    bound.boundH,
    layout.destX,
    layout.destY,
    layout.scaledW,
    layout.scaledH
  );

  const buffer = await canvas.encode("png");
  fs.writeFileSync(outputPath, buffer);
  return buffer;
}

/**
 * Render animated GIF dengan loop mulus dan transparansi penuh
 */
async function generateAnimatedEmoji(key, img, bound, outputPath) {
  const layout = calculateLayout(bound, GIF_BOUND);
  const encoder = new GifEncoder(CANVAS_SIZE, CANVAS_SIZE);

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const progress = f / TOTAL_FRAMES;
    const twoPi = 2 * Math.PI;

    if (key === "naura_happy") {
      // Joyful head bobbing + sparkling star eyes & hair
      const bobY = Math.round(Math.sin(progress * twoPi) * 2);
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX,
        layout.destY + bobY,
        layout.scaledW,
        layout.scaledH
      );

      // 3 sparkling stars
      const s1 = 4.5 + 2.5 * Math.sin(progress * twoPi);
      drawStar(ctx, 22, 28 + bobY, s1, "#FDE047");
      const s2 = 4.5 + 2.5 * Math.sin(progress * twoPi + Math.PI);
      drawStar(ctx, 106, 30 + bobY, s2, "#FDE047");
      const s3 = 3.5 + 2 * Math.sin(progress * twoPi + Math.PI * 0.5);
      drawStar(ctx, 20, 68 + bobY, s3, "#FEF08A");
    } else if (key === "naura_thinking") {
      // Gentle head tilt + floating question mark & neural sparks
      const angle = Math.sin(progress * twoPi) * 0.025;
      ctx.save();
      ctx.translate(64, 114);
      ctx.rotate(angle);
      ctx.translate(-64, -114);
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX,
        layout.destY,
        layout.scaledW,
        layout.scaledH
      );
      ctx.restore();

      const floatY = Math.sin(progress * twoPi) * 2.5;
      const qScale = 1.0 + 0.18 * Math.sin(progress * twoPi);
      drawQuestionMark(ctx, 98, 26 + floatY, 13 * qScale, "#FFFFFF", "#00FFFF");

      // Orbiting spark dots
      const d1x = 98 + Math.cos(progress * twoPi) * 11;
      const d1y = 26 + floatY + Math.sin(progress * twoPi) * 5;
      drawStar(ctx, d1x, d1y, 2.5, "#FFB6C1");
      const d2x = 98 + Math.cos(progress * twoPi + Math.PI) * 9;
      const d2y = 26 + floatY + Math.sin(progress * twoPi + Math.PI) * 4;
      drawStar(ctx, d2x, d2y, 2, "#38BDF8");
    } else if (key === "naura_cry") {
      // Flowing anime tears + gentle trembling
      const trembleX = (f % 2 === 0 ? 0.6 : -0.6) * Math.sin(progress * twoPi);
      const trembleY = Math.sin(progress * twoPi) * 0.8;
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX + trembleX,
        layout.destY + trembleY,
        layout.scaledW,
        layout.scaledH
      );

      // Tear streams from eyes
      for (const side of [-1, 1]) {
        const startX = side === -1 ? 48 : 78;
        const endX = side === -1 ? 45 : 81;
        const startY = 64 + trembleY;
        const endY = 92 + trembleY;

        for (let dropIdx = 0; dropIdx < 2; dropIdx++) {
          const t = (progress + dropIdx * 0.5) % 1;
          const dx = startX + t * (endX - startX);
          const dy = startY + t * (endY - startY);
          const dw = 2.8 + t * 1.8;
          const dh = 4.5 + t * 3.5;
          drawTearDrop(ctx, dx, dy, dw, dh, "#38BDF8");

          // Splash droplet near bottom
          if (t > 0.8) {
            const splashT = (t - 0.8) / 0.2;
            const sx = endX + side * splashT * 6;
            const sy = endY - Math.sin(splashT * Math.PI) * 3;
            drawTearDrop(ctx, sx, sy, 1.8, 2.5, "#7DD3FC");
          }
        }
      }
    } else if (key === "naura_angry") {
      // Irritated twitch + popping anger vein + steam puff
      const twitchX = Math.sin(progress * 4 * Math.PI) * 0.8;
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX + twitchX,
        layout.destY,
        layout.scaledW,
        layout.scaledH
      );

      // Popping red temple vein
      const pulse = 1.0 + 0.3 * Math.sin(progress * twoPi);
      drawAngerVein(ctx, 96, 38, 13 * pulse, "#EF4444");

      // Rising steam puffs on upper left
      for (let p = 0; p < 3; p++) {
        const pt = (progress + p * 0.33) % 1;
        const px = 30 - pt * 7 + Math.sin(pt * Math.PI) * 2;
        const py = 26 - pt * 12;
        const pr = 1.8 + pt * 3;
        const alpha = Math.sin(pt * Math.PI) * 0.65;
        if (alpha > 0.05) {
          ctx.save();
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();
        }
      }
    } else if (key === "naura_sleepy") {
      // Gentle breathing bob + drifting Zzz
      const bobY = Math.round(Math.sin(progress * twoPi) * 1.5);
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX,
        layout.destY + bobY,
        layout.scaledW,
        layout.scaledH
      );

      const zDefs = [
        { sx: 76, sy: 66 + bobY, phase: 0.0, size: 6.5 },
        { sx: 84, sy: 54 + bobY, phase: 0.33, size: 8.5 },
        { sx: 94, sy: 42 + bobY, phase: 0.67, size: 11.5 },
      ];
      for (const zd of zDefs) {
        const zt = (progress + zd.phase) % 1;
        const zx = zd.sx + zt * 16 + Math.sin(zt * twoPi) * 2.5;
        const zy = zd.sy - zt * 22;
        const alpha = Math.sin(zt * Math.PI);
        drawZ(ctx, zx, zy, zd.size, "#C084FC", alpha);
      }
    } else if (key === "naura_cheers") {
      // Energetic banzai jump/bounce + celebratory sparks
      const jumpY = -Math.round(Math.abs(Math.sin(progress * twoPi)) * 3.5);
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX,
        layout.destY + jumpY,
        layout.scaledW,
        layout.scaledH
      );

      // Star sparkles around raised hands
      const spark1 = 5.5 + 2.5 * Math.sin(progress * twoPi);
      drawStar(ctx, 22, 22 + jumpY, spark1, "#FDE047");
      const spark2 = 5.5 + 2.5 * Math.cos(progress * twoPi);
      drawStar(ctx, 106, 22 + jumpY, spark2, "#38BDF8");

      // Confetti dots
      const confetti = [
        { x: 18, y: 38 + jumpY + Math.sin(progress * twoPi) * 2, col: "#F472B6" },
        { x: 110, y: 38 + jumpY + Math.cos(progress * twoPi) * 2, col: "#4ADE80" },
        { x: 64, y: 14 + jumpY, col: "#FDE047" },
      ];
      for (const cf of confetti) {
        ctx.save();
        ctx.fillStyle = cf.col;
        ctx.beginPath();
        ctx.arc(cf.x, cf.y, 1.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
    } else if (key === "naura_chirping") {
      // Rhythmic head sway + drifting musical notes
      const angle = Math.sin(progress * twoPi) * 0.035;
      ctx.save();
      ctx.translate(64, 114);
      ctx.rotate(angle);
      ctx.translate(-64, -114);
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX,
        layout.destY,
        layout.scaledW,
        layout.scaledH
      );
      ctx.restore();

      // Note 1 (eighth note) on left
      const t1 = progress % 1;
      const n1x = 26 - t1 * 6 + Math.sin(t1 * twoPi) * 2;
      const n1y = 52 - t1 * 28;
      drawMusicNote(ctx, n1x, n1y, 9.5, false, "#C084FC");

      // Note 2 (beamed note) on right
      const t2 = (progress + 0.5) % 1;
      const n2x = 98 + t2 * 6 + Math.sin(t2 * twoPi) * 2;
      const n2y = 52 - t2 * 30;
      drawMusicNote(ctx, n2x, n2y, 10.5, true, "#FFB6C1");
    } else if (key === "naura_blow_kiss") {
      // Gentle forward pulse + floating pink heart trail
      const leanY = Math.round(Math.sin(progress * twoPi) * 1.5);
      ctx.drawImage(
        img,
        bound.minX,
        bound.minY,
        bound.boundW,
        bound.boundH,
        layout.destX,
        layout.destY + leanY,
        layout.scaledW,
        layout.scaledH
      );

      // Main heart floating out from palm
      const t = progress % 1;
      const hx = 88 + t * 20 + Math.sin(t * Math.PI) * 3;
      const hy = (62 + leanY) - t * 38;
      const hScale = 0.8 + 0.35 * Math.sin(t * Math.PI);
      drawHeart(ctx, hx, hy, 9.5 * hScale, "#F43F5E");

      // Trailing sparkle / mini heart
      if (t > 0.25) {
        const tr1 = t - 0.2;
        const tx1 = 88 + tr1 * 20 - 4;
        const ty1 = (62 + leanY) - tr1 * 38 + 5;
        drawStar(ctx, tx1, ty1, 3, "#FDE047");
      }
      if (t > 0.45) {
        const tr2 = t - 0.4;
        const tx2 = 88 + tr2 * 20 - 7;
        const ty2 = (62 + leanY) - tr2 * 38 + 10;
        drawHeart(ctx, tx2, ty2, 4.5, "#FFB6C1");
      }
    }

    const frameData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const u8 = new Uint8Array(
      frameData.data.buffer,
      frameData.data.byteOffset,
      frameData.data.byteLength
    );
    encoder.addFrame(u8, CANVAS_SIZE, CANVAS_SIZE, {
      delay: FRAME_DELAY_MS,
      disposal: GifDisposal.Background,
    });
  }

  const gifBuffer = encoder.finish();
  fs.writeFileSync(outputPath, gifBuffer);
  return gifBuffer;
}

/**
 * Validasi aset biner
 */
function validateAsset(filePath, isGif = false) {
  const buf = fs.readFileSync(filePath);
  const sizeBytes = buf.length;
  const sizeKB = (sizeBytes / 1024).toFixed(2);

  if (sizeBytes >= MAX_FILE_SIZE) {
    throw new Error(`Ukuran file melebihi 256 KB: ${sizeKB} KB (${filePath})`);
  }

  if (!isGif) {
    // Validasi PNG header
    const sig = buf.subarray(0, 8);
    const expectedSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!sig.equals(expectedSig)) {
      throw new Error(`Invalid PNG signature: ${filePath}`);
    }
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const bitDepth = buf.readUInt8(24);
    const colorType = buf.readUInt8(25);

    if (width !== 128 || height !== 128) {
      throw new Error(`Invalid PNG dimensions: ${width}x${height} (${filePath})`);
    }
    if (colorType !== 6) {
      throw new Error(`PNG must have RGBA alpha channel (colorType 6): got ${colorType}`);
    }
    return { width, height, bitDepth, colorType, sizeKB, valid: true };
  } else {
    // Validasi GIF header
    const sig = buf.subarray(0, 6).toString("ascii");
    if (sig !== "GIF89a" && sig !== "GIF87a") {
      throw new Error(`Invalid GIF signature: ${sig} (${filePath})`);
    }
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt1LE ? buf.readUInt16LE(8) : buf.readUInt16LE(8);
    if (width !== 128 || height !== 128) {
      throw new Error(`Invalid GIF dimensions: ${width}x${height} (${filePath})`);
    }
    return { width, height, sig, sizeKB, valid: true };
  }
}

async function main() {
  const startTime = Date.now();
  console.log("==========================================================");
  console.log("NAURA HOSHINO V2 - 17 CORE EXPRESSION EMOJIS GENERATOR");
  console.log("Visual SSOT: assets/Naura_Expression/");
  console.log("Destination: assets/emojis/naura_custom/");
  console.log("==========================================================");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log("[Setup] Output directory created.");
  }

  const staticResults = [];
  const animatedResults = [];

  console.log("\n[1/2] Generating 17 Static PNG Emojis (128x128 RGBA)...");
  for (let i = 0; i < EXPRESSIONS.length; i++) {
    const item = EXPRESSIONS[i];
    const srcPath = path.join(SOURCE_DIR, item.file);
    const outPngPath = path.join(OUTPUT_DIR, `${item.key}.png`);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source expression file not found: ${srcPath}`);
    }

    const img = await loadImage(srcPath);
    const bound = getBoundingBox(img);
    const layout = calculateLayout(bound, SAFE_BOUND);

    await generateStaticEmoji(img, bound, layout, outPngPath);
    const meta = validateAsset(outPngPath, false);

    staticResults.push({
      key: item.key,
      file: `${item.key}.png`,
      source: item.file,
      dims: `${meta.width}x${meta.height}`,
      size: `${meta.sizeKB} KB`,
      status: "PASS",
    });
    console.log(`  [${i + 1}/17] Generated: ${item.key}.png (${meta.sizeKB} KB)`);
  }

  console.log("\n[2/2] Generating 8 Expressive Animated GIFs (128x128 Transparent)...");
  const animatedList = EXPRESSIONS.filter((e) => e.animated);
  for (let i = 0; i < animatedList.length; i++) {
    const item = animatedList[i];
    const srcPath = path.join(SOURCE_DIR, item.file);
    const outGifPath = path.join(OUTPUT_DIR, `${item.key}.gif`);

    const img = await loadImage(srcPath);
    const bound = getBoundingBox(img);

    await generateAnimatedEmoji(item.key, img, bound, outGifPath);
    const meta = validateAsset(outGifPath, true);

    animatedResults.push({
      key: item.key,
      file: `${item.key}.gif`,
      source: item.file,
      dims: `${meta.width}x${meta.height}`,
      size: `${meta.sizeKB} KB`,
      status: "PASS",
    });
    console.log(`  [${i + 1}/${animatedList.length}] Generated: ${item.key}.gif (${meta.sizeKB} KB)`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n==========================================================");
  console.log("PIPELINE EXECUTION COMPLETE");
  console.log(`Duration: ${durationSec}s`);
  console.log(`Total Static PNGs Generated: ${staticResults.length}/17`);
  console.log(`Total Animated GIFs Generated: ${animatedResults.length}/8`);
  console.log("==========================================================");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal Generation Error:", err);
    process.exit(1);
  });
}

module.exports = {
  EXPRESSIONS,
  generateStaticEmoji,
  generateAnimatedEmoji,
  validateAsset,
  getBoundingBox,
  calculateLayout,
};
