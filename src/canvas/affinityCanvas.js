"use strict";

/**
 * affinityCanvas.js - Kartu Social Affinity & Compatibility Resolver
 *
 * Merender kartu Canvas resolusi tinggi (960x540) untuk mengukur kecocokan
 * sosial dua pengguna Discord dengan visual avatar ganda, persentase resonansi,
 * lencana harmoni, dan kutipan interaktif Naura.
 *
 * Mematuhi prinsip antislop-ui dan bebas karakter em-dash (\u2014).
 */

const { createCanvas, loadImage } = require("./canvasRuntime");

const AFFINITY_TITLES = [
  { min: 95, title: "Ikatan Takdir Kosmik", color: "#F43F5E", quote: "Wah, kalian berdua ditakdirkan saling melengkapi! Frekuensi jiwanya selaras sempurna." },
  { min: 80, title: "Resonansi Jiwa", color: "#EC4899", quote: "Kecocokan kalian tinggi banget! Obrolan mengalir santai tanpa rasa canggung." },
  { min: 65, title: "Harmoni Hangat", color: "#8B5CF6", quote: "Chemistry yang sangat baik. Selalu ada topik seru tiap kali kalian ngobrol bareng." },
  { min: 45, title: "Rekan Seirama", color: "#3B82F6", quote: "Hubungan yang seimbang dan saling menghargai. Rekan mabar dan curhat yang solid!" },
  { min: 25, title: "Kenalan Canggung", color: "#10B981", quote: "Masih butuh sedikit waktu untuk saling memahami, tapi potensi akrabnya tetap ada kok!" },
  { min: 0, title: "Polar Berlawanan", color: "#F59E0B", quote: "Perbedaan sudut pandang justru bikin obrolan kalian berwarna, jangan sungkan menyapa!" },
];

/**
 * Menghitung persentase kecocokan deterministik berbasis dua User ID
 * agar hasilnya konsisten sepanjang hari yang sama.
 */
function calculateAffinityScore(id1, id2) {
  const dayHash = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const combined = [id1, id2].sort().join(":") + `:${dayHash}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 101); // 0 - 100%
}

function getAffinityTier(score) {
  for (const tier of AFFINITY_TITLES) {
    if (score >= tier.min) return tier;
  }
  return AFFINITY_TITLES[AFFINITY_TITLES.length - 1];
}

/**
 * Render kartu affinity beresolusi tinggi
 * @param {object} payload - { user1: { username, displayName, avatarUrl }, user2: { username, displayName, avatarUrl } }
 * @returns {Promise<Buffer>}
 */
async function renderAffinityCard(payload) {
  const width = 960;
  const height = 540;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const u1 = payload.user1 || { displayName: "User 1", username: "user1", avatarUrl: "" };
  const u2 = payload.user2 || { displayName: "User 2", username: "user2", avatarUrl: "" };
  const score = typeof payload.score === "number" ? payload.score : calculateAffinityScore(u1.id || u1.username, u2.id || u2.username);
  const tier = getAffinityTier(score);

  // 1. Background Gradient Kosmik
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0B0C16");
  bgGrad.addColorStop(0.5, "#15182E");
  bgGrad.addColorStop(1, "#0A0B14");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Background Nebula Glow di tengah
  const centerGlow = ctx.createRadialGradient(width / 2, height / 2 - 20, 10, width / 2, height / 2 - 20, 320);
  centerGlow.addColorStop(0, `${tier.color}33`);
  centerGlow.addColorStop(0.6, `${tier.color}0D`);
  centerGlow.addColorStop(1, "transparent");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, width, height);

  // Grid Aksen Halus
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 40; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 2. Header Box & Judul
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("NAURA SOCIAL AFFINITY MATRIX", width / 2, 45);

  ctx.fillStyle = tier.color;
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(tier.title.toUpperCase(), width / 2, 80);

  // 3. Avatar Lingkaran User 1 & User 2
  const avatarRadius = 68;
  const avatarY = 220;
  const avatar1X = 220;
  const avatar2X = width - 220;

  // Helper render circular avatar
  async function drawAvatar(url, x, y, borderColor) {
    ctx.save();
    // Lingkaran luar bercahaya
    ctx.beginPath();
    ctx.arc(x, y, avatarRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = `${borderColor}40`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, avatarRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = borderColor;
    ctx.fill();

    // Clip lingkaran gambar
    ctx.beginPath();
    ctx.arc(x, y, avatarRadius, 0, Math.PI * 2);
    ctx.clip();

    try {
      if (url) {
        const img = await loadImage(url);
        ctx.drawImage(img, x - avatarRadius, y - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      } else {
        ctx.fillStyle = "#374151";
        ctx.fillRect(x - avatarRadius, y - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      }
    } catch {
      ctx.fillStyle = "#374151";
      ctx.fillRect(x - avatarRadius, y - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    }
    ctx.restore();
  }

  await drawAvatar(u1.avatarUrl, avatar1X, avatarY, "#38BDF8");
  await drawAvatar(u2.avatarUrl, avatar2X, avatarY, "#EC4899");

  // Nama User 1 & 2 di bawah avatar
  ctx.textAlign = "center";
  ctx.fillStyle = "#F3F4F6";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(u1.displayName.substring(0, 16), avatar1X, avatarY + avatarRadius + 32);
  ctx.fillText(u2.displayName.substring(0, 16), avatar2X, avatarY + avatarRadius + 32);

  ctx.fillStyle = "#9CA3AF";
  ctx.font = "14px sans-serif";
  ctx.fillText(`@${u1.username.substring(0, 18)}`, avatar1X, avatarY + avatarRadius + 54);
  ctx.fillText(`@${u2.username.substring(0, 18)}`, avatar2X, avatarY + avatarRadius + 54);

  // 4. Lingkaran Indikator Skor di Tengah
  const centerX = width / 2;
  const centerY = avatarY;
  const meterRadius = 82;

  // Background track arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, meterRadius, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.stroke();

  // Progress arc
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2 * (score / 100));

  ctx.beginPath();
  ctx.arc(centerX, centerY, meterRadius, startAngle, endAngle, false);
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.strokeStyle = tier.color;
  ctx.stroke();

  // Angka Persentase di Tengah
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText(`${score}%`, centerX, centerY - 6);

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("RESONANSI", centerX, centerY + 28);

  // Garis sambung antara avatar dan meter tengah
  ctx.beginPath();
  ctx.moveTo(avatar1X + avatarRadius + 14, avatarY);
  ctx.lineTo(centerX - meterRadius - 14, avatarY);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX + meterRadius + 14, avatarY);
  ctx.lineTo(avatar2X - avatarRadius - 14, avatarY);
  ctx.strokeStyle = "rgba(236, 72, 153, 0.35)";
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // 5. Kotak Kutipan & Komentar Naura di Bawah
  const quoteBoxX = 140;
  const quoteBoxY = 410;
  const quoteBoxW = width - 280;
  const quoteBoxH = 80;

  // Rounded background box
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.beginPath();
  ctx.roundRect(quoteBoxX, quoteBoxY, quoteBoxW, quoteBoxH, 16);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Kutipan Naura
  ctx.fillStyle = "#E0E7FF";
  ctx.font = "italic 16px sans-serif";
  ctx.fillText(`"${tier.quote}"`, centerX, quoteBoxY + 36);

  ctx.fillStyle = "#818CF8";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("- Naura Hoshino • Kompatibilitas Sosial Harian", centerX, quoteBoxY + 60);

  return canvas.toBuffer("image/png");
}

module.exports = {
  calculateAffinityScore,
  getAffinityTier,
  renderAffinityCard,
};
