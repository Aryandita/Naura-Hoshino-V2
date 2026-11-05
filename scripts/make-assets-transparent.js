"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

/**
 * Memproses gambar PNG untuk menghapus background putih/polosan
 * menggunakan perimeter BFS flood-fill dengan anti-aliasing edge.
 *
 * @param {string} filePath - Path berkas gambar
 * @returns {Promise<{ file: string, removedPct: number, modified: boolean }>}
 */
async function removePlainBackground(filePath) {
  const img = await loadImage(filePath);
  const w = img.width;
  const h = img.height;

  if (w < 16 || h < 16) {
    return { file: filePath, removedPct: 0, modified: false, reason: "too_small" };
  }

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Cek apakah gambar sudah memiliki transparansi signifikan
  let existingTransparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 30) existingTransparent++;
  }
  const existingPct = (existingTransparent / (w * h)) * 100;
  if (existingPct > 15) {
    return { file: filePath, removedPct: existingPct, modified: false, reason: "already_transparent" };
  }

  // Cek warna sudut perimeter (setidaknya 2 sudut harus putih/near-white atau salah satu sisi atas putih)
  const cornerIdxs = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  let whiteCorners = 0;
  for (const idx of cornerIdxs) {
    if (data[idx] >= 225 && data[idx + 1] >= 225 && data[idx + 2] >= 225) {
      whiteCorners++;
    }
  }

  // Jika kurang dari 2 sudut putih, cek apakah baris atas mayoritas putih
  let isWhiteBgCandidate = whiteCorners >= 2;
  if (!isWhiteBgCandidate) {
    let topWhite = 0;
    for (let x = 0; x < w; x++) {
      const idx = x * 4;
      if (data[idx] >= 225 && data[idx + 1] >= 225 && data[idx + 2] >= 225) {
        topWhite++;
      }
    }
    if (topWhite / w >= 0.5) {
      isWhiteBgCandidate = true;
    }
  }

  if (!isWhiteBgCandidate) {
    return { file: filePath, removedPct: 0, modified: false, reason: "not_plain_white" };
  }

  function isBgPixel(idx) {
    const a = data[idx + 3];
    if (a < 10) return true;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= 228 && (maxC - minC) <= 28;
  }

  const isBg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  function add(x, y) {
    const idx = y * w + x;
    if (isBg[idx]) return;
    if (isBgPixel(idx * 4)) {
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  }

  // Seed BFS dari seluruh 4 sisi luar kanvas (perimeter)
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    add(0, y);
    add(w - 1, y);
  }

  // Flood fill ke seluruh background luar yang terhubung
  while (head < tail) {
    const curr = queue[head++];
    const x = curr % w;
    const y = Math.floor(curr / w);

    if (x > 0) add(x - 1, y);
    if (x < w - 1) add(x + 1, y);
    if (y > 0) add(x, y - 1);
    if (y < h - 1) add(x, y + 1);
  }

  // 1. Jadikan transparan piksel background
  let removedCount = 0;
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) {
      data[i * 4 + 3] = 0;
      removedCount++;
    }
  }

  const removedPct = (removedCount / (w * h)) * 100;
  if (removedPct < 2) {
    // Kurang dari 2% background yang teridentifikasi, lewati
    return { file: filePath, removedPct, modified: false, reason: "insufficient_bg" };
  }

  // 2. Haluskan tepian (anti-aliasing) untuk menghilangkan pinggiran putih kasar
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (!isBg[idx]) {
        const isBorder = isBg[idx - 1] || isBg[idx + 1] || isBg[idx - w] || isBg[idx + w];
        if (isBorder) {
          const pIdx = idx * 4;
          const r = data[pIdx];
          const g = data[pIdx + 1];
          const b = data[pIdx + 2];
          const brightness = (r + g + b) / 3;
          if (brightness > 210) {
            const factor = Math.max(0, (255 - brightness) / 45);
            data[pIdx + 3] = Math.round(data[pIdx + 3] * factor);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const outBuf = canvas.toBuffer("image/png");
  fs.writeFileSync(filePath, outBuf);

  return { file: filePath, removedPct, modified: true };
}

function findPngFiles(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list = list.concat(findPngFiles(full));
    } else if (e.name.toLowerCase().endsWith(".png")) {
      list.push(full);
    }
  }
  return list;
}

async function main() {
  const targetDirs = [
    path.join(__dirname, "..", "assets", "survival", "roam", "npcs"),
    path.join(__dirname, "..", "assets", "survival", "roam", "items"),
  ];

  const singleFiles = [
    path.join(__dirname, "..", "assets", "survival", "characters", "naura.png"),
  ];

  let filesToProcess = [];
  for (const d of targetDirs) {
    if (fs.existsSync(d)) {
      filesToProcess = filesToProcess.concat(findPngFiles(d));
    }
  }
  for (const f of singleFiles) {
    if (fs.existsSync(f)) {
      filesToProcess.push(f);
    }
  }

  console.log(`Menemukan ${filesToProcess.length} berkas PNG target.`);

  let modifiedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const f = filesToProcess[i];
    try {
      const res = await removePlainBackground(f);
      if (res.modified) {
        modifiedCount++;
        console.log(`[${i + 1}/${filesToProcess.length}] [OK] ${path.relative(process.cwd(), f)} (${res.removedPct.toFixed(1)}% bg)`);
      } else {
        skippedCount++;
        console.log(`[${i + 1}/${filesToProcess.length}] [SKIP] ${path.relative(process.cwd(), f)} (${res.reason})`);
      }
    } catch (err) {
      console.error(`[${i + 1}/${filesToProcess.length}] [ERR] ${path.relative(process.cwd(), f)}: ${err.message}`);
    }
  }

  console.log("\n=== SELESAI ===");
  console.log(`Total diproses: ${filesToProcess.length}`);
  console.log(`Berhasil diubah transparan: ${modifiedCount}`);
  console.log(`Dilewati (sudah transparan / bukan polosan): ${skippedCount}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Gagal mengeksekusi penghapusan background:", err);
    process.exit(1);
  });
}

module.exports = { removePlainBackground };

