// src/utils/captchaHelper.js
const { createCanvas } = require("../canvas/canvasRuntime");

/**
 * Membangun buffer gambar Captcha 5 karakter acak menggunakan Canvas.
 * @returns {{ code: string, buffer: Buffer }}
 */
function generateCaptchaCard() {
  const width = 300;
  const height = 100;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background kegelapan futuristik
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, width, height);

  // Grid noise/garis acak untuk keamanan captcha
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // Karakter acak yang mudah dibaca manusia (huruf kapital & angka, tanpa 0/O/1/I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let captchaCode = "";
  for (let i = 0; i < 5; i++) {
    captchaCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Gambar teks captcha dengan rotasi dan warna dinamis
  ctx.font = "bold 36px sans-serif";
  ctx.textBaseline = "middle";

  const colors = ["#FFB6C1", "#00FFFF", "#FFD700", "#C084FC", "#86EFAC"];

  for (let i = 0; i < captchaCode.length; i++) {
    const char = captchaCode[i];
    ctx.save();

    const x = 35 + i * 50;
    const y = 50 + (Math.random() * 10 - 5);
    const angle = Math.random() * 0.4 - 0.2; // Rotasi -11 hingga +11 derajat

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillText(char, 0, 0);

    ctx.restore();
  }

  const buffer = canvas.toBuffer("image/png");
  return { code: captchaCode, buffer };
}

module.exports = { generateCaptchaCard };
