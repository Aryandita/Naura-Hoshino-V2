"use strict";

const { createCanvas } = require("./canvasRuntime");

/**
 * Render visual koran harian server "THE HOSHINO TIMES" (800x1000)
 */
async function drawChronicleNewspaper(data) {
  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext("2d");

  // Background Paper / Cyber Texture
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 1000);
  bgGrad.addColorStop(0, "#0B0C10");
  bgGrad.addColorStop(0.5, "#161B22");
  bgGrad.addColorStop(1, "#0B0C10");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 1000);

  // Outer Neon Border
  ctx.strokeStyle = "#FFB6C1";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 760, 960);

  ctx.strokeStyle = "rgba(255, 182, 193, 0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, 744, 944);

  // Masthead Banner
  ctx.fillStyle = "#FFB6C1";
  ctx.font = "bold 38px 'Orbitron', 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🌸 THE HOSHINO TIMES 🌸", 400, 85);

  ctx.fillStyle = "#93C5FD";
  ctx.font = "14px 'Outfit', sans-serif";
  ctx.fillText(
    `EDISI RESMI SERVER: ${data.guildName.toUpperCase()} | 📅 ${data.date}`,
    400,
    115,
  );

  // Divider Line
  ctx.strokeStyle = "#FFB6C1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 130);
  ctx.lineTo(760, 130);
  ctx.stroke();

  // Headline Section
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 24px 'Outfit', sans-serif";
  ctx.fillText(`⚡ HEADLINE: ${data.headline}`, 400, 175);

  // Left Column: Member of the Day Spotlight
  ctx.fillStyle = "rgba(31, 40, 51, 0.7)";
  ctx.strokeStyle = "#F9A8D4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(50, 210, 330, 360, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#F9A8D4";
  ctx.font = "bold 18px 'Orbitron', sans-serif";
  ctx.fillText("👑 MEMBER OF THE DAY", 215, 245);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px 'Outfit', sans-serif";
  ctx.fillText(data.topUser.username || "Warga Teladan", 215, 360);

  ctx.fillStyle = "#86EFAC";
  ctx.font = "15px 'Outfit', sans-serif";
  ctx.fillText(`💬 ${data.topUser.count} Pesan Terkirim Hari Ini!`, 215, 395);

  ctx.fillStyle = "#A0AEC0";
  ctx.font = "13px 'Outfit', sans-serif";
  ctx.fillText("Dianugerahi lencana keaktifan Naura!", 215, 430);

  // Right Column: Server Horoscope & Gossip
  ctx.fillStyle = "rgba(31, 40, 51, 0.7)";
  ctx.strokeStyle = "#C084FC";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(420, 210, 330, 360, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#C084FC";
  ctx.font = "bold 18px 'Orbitron', sans-serif";
  ctx.fillText("🔮 RAMALAN & GOSSIP", 585, 245);

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "14px 'Outfit', sans-serif";
  wrapText(ctx, data.gossip, 440, 290, 290, 22);

  // Bottom Section 1: Highlight Quote of the Day
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.strokeStyle = "#93C5FD";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(50, 600, 700, 130, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#93C5FD";
  ctx.font = "bold 16px 'Outfit', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("💬 KUTIPAN TERBAIK HARI INI:", 75, 635);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "italic 16px 'Outfit', sans-serif";
  wrapText(ctx, data.quoteHighlight, 75, 670, 650, 24);

  // Bottom Section 2: Server Telemetry Stats Bar
  ctx.fillStyle = "rgba(31, 40, 51, 0.9)";
  ctx.strokeStyle = "rgba(255, 182, 193, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(50, 760, 700, 140, 14);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFB6C1";
  ctx.font = "bold 16px 'Orbitron', sans-serif";
  ctx.fillText("📊 TELEMETRI GUILD & EKOSISTEM NAURA", 400, 795);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "16px 'Outfit', sans-serif";
  ctx.fillText(
    `👥 Total Warga: ${data.memberCount} | 📨 Total Obrolan: ${data.totalMessages}`,
    400,
    835,
  );
  ctx.fillStyle = "#86EFAC";
  ctx.fillText("🌸 Status Server: Sangat Aktif & Penuh Keberkahan", 400, 870);

  // Footer Tagline
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "12px 'Outfit', sans-serif";
  ctx.fillText(
    "Diterbitkan secara otonom oleh Naura Hoshino AI Engine • Terus ramaikan server!",
    400,
    945,
  );

  return canvas.toBuffer("image/png");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || "").split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

module.exports = {
  drawChronicleNewspaper,
};
