"use strict";

const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");

const RARITY_PALETTE = {
  Biasa: { border: "#9CA3AF", glow: "rgba(156, 163, 175, 0.4)", badge: "#374151", text: "#F3F4F6" },
  "Tidak Biasa": { border: "#34D399", glow: "rgba(52, 211, 153, 0.4)", badge: "#065F46", text: "#A7F3D0" },
  Langka: { border: "#38BDF8", glow: "rgba(56, 189, 248, 0.4)", badge: "#075985", text: "#BAE6FD" },
  Legendaris: { border: "#F59E0B", glow: "rgba(245, 158, 11, 0.5)", badge: "#78350F", text: "#FDE68A" },
};

/**
 * Render kartu tangkapan ikan Dermaga Mang Ujang (Slice of Life: Sukamaju)
 * @param {Object} payload
 * @param {string} payload.username
 * @param {Object} payload.fish
 * @param {string} payload.locationName
 * @param {boolean} [payload.isRecord=false]
 * @returns {Promise<Buffer>}
 */
async function renderFishCatch(payload) {
  return await runWithLimit(async () => {
    const width = 850;
    const height = 480;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const fish = payload.fish || {
      name: "Ikan Salmon Segar",
      rarity: "Langka",
      weight: 3.45,
      length: 42,
      value: 150,
      emoji: "🐟",
    };
    const username = payload.username || "Murid Sukamaju";
    const locationName = payload.locationName || "Pangkalan Perahu & Dermaga Mang Ujang";
    const isRecord = Boolean(payload.isRecord);
    const rarityStyle = RARITY_PALETTE[fish.rarity] || RARITY_PALETTE.Biasa;

    // 1. Background Image atau Gradient
    const bgPath = path.join(
      process.cwd(),
      "assets",
      "survival",
      "background",
      "dermaga_mang_ujang.jpg",
    );

    let bgLoaded = false;
    if (fs.existsSync(bgPath)) {
      try {
        const bgImg = await loadImage(bgPath);
        ctx.drawImage(bgImg, 0, 0, width, height);
        bgLoaded = true;
      } catch {
        bgLoaded = false;
      }
    }

    if (!bgLoaded) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#1E1B4B");
      grad.addColorStop(0.5, "#312E81");
      grad.addColorStop(1, "#0F172A");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Warm Twilight Overlay (Frosted Glassmorphism)
    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, "rgba(15, 23, 42, 0.75)");
    overlay.addColorStop(1, "rgba(15, 23, 42, 0.92)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);

    // 3. Card Frame Glass Container
    ctx.save();
    ctx.strokeStyle = rarityStyle.border;
    ctx.lineWidth = 3;
    ctx.shadowColor = rarityStyle.glow;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(24, 24, width - 48, height - 48, 20);
    ctx.stroke();
    ctx.restore();

    // 4. Header Bar
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(40, 40, width - 80, 60, 12);
    ctx.fill();

    ctx.font = "bold 20px 'Orbitron', sans-serif";
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText("🎣 TANGKAPAN IKAN SEGAR", 60, 77);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.textAlign = "right";
    const displayLoc = locationName.length > 38 ? locationName.slice(0, 35) + "..." : locationName;
    ctx.fillText("📍 " + displayLoc, width - 60, 77);
    ctx.textAlign = "left";

    // 5. Fish Display Box (Center-Left)
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(50, 120, 320, 290, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Record Badge jika rekor terberat (Di pojok atas dalam fish display box, jauh dari nama ikan)
    if (isRecord) {
      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.roundRect(65, 132, 130, 28, 14);
      ctx.fill();

      ctx.strokeStyle = "#FCA5A5";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText("🏆 REKOR BARU", 130, 150);
      ctx.textAlign = "left";
    }

    // Fish Icon / Emoji Center
    ctx.font = "80px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(fish.emoji || "🐟", 210, 260);
    ctx.textAlign = "left";

    // Rarity Badge below fish
    ctx.fillStyle = rarityStyle.badge;
    ctx.beginPath();
    ctx.roundRect(95, 330, 230, 40, 20);
    ctx.fill();

    ctx.strokeStyle = rarityStyle.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = rarityStyle.text;
    ctx.textAlign = "center";
    ctx.fillText("★ " + (fish.rarity || "Biasa").toUpperCase() + " ★", 210, 356);
    ctx.textAlign = "left";

    // 6. Fish Statistics & Catch Details (Right Side)
    // Nama Ikan (bebas rintangan dengan lebar penuh)
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(fish.name || "Ikan Segar", 400, 160);

    // Pemancing
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText("Pemancing:", 400, 200);
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#38BDF8";
    ctx.fillText(username, 490, 200);

    // Detail Ukuran & Berat
    const statsY = 240;
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(400, statsY, 390, 90, 12);
    ctx.fill();

    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("Berat Tangkapan:", 420, statsY + 35);
    ctx.fillText("Panjang Estimasi:", 420, statsY + 68);

    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#F59E0B";
    const weightNum = Number(fish.weight);
    const safeWeight = Number.isFinite(weightNum) ? weightNum : 1.5;
    ctx.fillText(safeWeight.toFixed(2) + " kg", 570, statsY + 35);

    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#34D399";
    ctx.fillText((fish.length || 30) + " cm", 570, statsY + 68);

    // Nilai / Harga Jual
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText("Nilai Pasar:", 400, 370);

    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#FBBF24";
    const safeValue = (fish.value !== undefined && fish.value !== null && Number.isFinite(Number(fish.value))) ? Number(fish.value) : 50;
    ctx.fillText("+" + safeValue + " Sukamaju Koin (SC)", 500, 370);

    // 7. Footer Stempel Naura Days
    ctx.font = "italic 13px sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("Tangkapan Segar Resmi Pesisir Sukamaju · Disertifikasi oleh Mang Ujang", 400, 410);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderFishCatch,
};
