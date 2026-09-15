"use strict";

const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual kartu ucapan ulang tahun kosmik Naura Wilds (800x450)
 * @param {object} data - { username, avatarUrl, age, year }
 * @returns {Promise<Buffer>}
 */
async function renderBirthdayCard(data) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const username = data.username || "Petualang";
    const age = data.age || null;

    // 1. Deep Celestial Nebula Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#080614");
    bgGrad.addColorStop(0.4, "#160f2e");
    bgGrad.addColorStop(0.8, "#241242");
    bgGrad.addColorStop(1, "#0d091a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Cosmic Nebula Clouds
    const nebulaGrad1 = ctx.createRadialGradient(200, 150, 20, 200, 150, 350);
    nebulaGrad1.addColorStop(0, "rgba(244, 63, 94, 0.2)");
    nebulaGrad1.addColorStop(0.6, "rgba(168, 85, 247, 0.12)");
    nebulaGrad1.addColorStop(1, "transparent");
    ctx.fillStyle = nebulaGrad1;
    ctx.fillRect(0, 0, width, height);

    const nebulaGrad2 = ctx.createRadialGradient(650, 300, 30, 650, 300, 380);
    nebulaGrad2.addColorStop(0, "rgba(251, 191, 36, 0.18)");
    nebulaGrad2.addColorStop(0.5, "rgba(236, 72, 153, 0.12)");
    nebulaGrad2.addColorStop(1, "transparent");
    ctx.fillStyle = nebulaGrad2;
    ctx.fillRect(0, 0, width, height);

    // 3. Shimmering Starlight Particles
    ctx.fillStyle = "#FFFFFF";
    const stars = [
      { x: 60, y: 70, r: 1.5, a: 0.8 },
      { x: 140, y: 120, r: 2.2, a: 0.9 },
      { x: 280, y: 50, r: 1.2, a: 0.6 },
      { x: 420, y: 80, r: 2.5, a: 0.95 },
      { x: 520, y: 40, r: 1.8, a: 0.7 },
      { x: 700, y: 90, r: 2.0, a: 0.85 },
      { x: 740, y: 160, r: 1.4, a: 0.6 },
      { x: 100, y: 360, r: 2.0, a: 0.8 },
      { x: 180, y: 400, r: 1.5, a: 0.75 },
      { x: 600, y: 390, r: 2.2, a: 0.9 },
      { x: 720, y: 350, r: 1.6, a: 0.7 },
      { x: 350, y: 410, r: 1.3, a: 0.5 },
    ];
    for (const s of stars) {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Golden Outer Frame with Rounded Corners
    ctx.save();
    const frameGrad = ctx.createLinearGradient(0, 0, width, height);
    frameGrad.addColorStop(0, "#FCD34D");
    frameGrad.addColorStop(0.3, "#F43F5E");
    frameGrad.addColorStop(0.7, "#A855F7");
    frameGrad.addColorStop(1, "#38BDF8");
    ctx.strokeStyle = frameGrad;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#FCD34D";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(18, 18, width - 36, height - 36, 20);
    ctx.stroke();
    ctx.restore();

    // 5. Left Column: Avatar & User Card (Circle avatar)
    const avatarCenterX = 135;
    const avatarCenterY = 175;
    const avatarRadius = 65;

    // Outer Glowing Halo for Avatar
    ctx.save();
    ctx.shadowColor = "#FCD34D";
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "#FCD34D";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Avatar Image Clipping
    let avatarDrawn = false;
    if (data.avatarUrl) {
      try {
        const avatarImg = await loadImage(data.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
          avatarImg,
          avatarCenterX - avatarRadius,
          avatarCenterY - avatarRadius,
          avatarRadius * 2,
          avatarRadius * 2,
        );
        ctx.restore();
        avatarDrawn = true;
      } catch (err) {}
    }

    if (!avatarDrawn) {
      // Fallback avatar icon
      ctx.fillStyle = "#332255";
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 42px sans-serif";
      ctx.fillStyle = "#FCD34D";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(username.charAt(0).toUpperCase(), avatarCenterX, avatarCenterY);
    }

    // Birthday Crown Icon on top of Avatar
    ctx.font = "36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👑", avatarCenterX, avatarCenterY - avatarRadius - 12);

    // User Tag Under Avatar
    ctx.font = "bold 18px 'Montserrat', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const displayUser = username.length > 14 ? username.substring(0, 13) + "..." : username;
    ctx.fillText(displayUser, avatarCenterX, avatarCenterY + avatarRadius + 14);

    // Special Day Pill Badge
    ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
    ctx.beginPath();
    ctx.roundRect(avatarCenterX - 65, avatarCenterY + avatarRadius + 44, 130, 26, 13);
    ctx.fill();

    ctx.strokeStyle = "#F43F5E";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(avatarCenterX - 65, avatarCenterY + avatarRadius + 44, 130, 26, 13);
    ctx.stroke();

    ctx.font = "bold 11px 'Montserrat', sans-serif";
    ctx.fillStyle = "#FDA4AF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("HARI SPESIAL", avatarCenterX, avatarCenterY + avatarRadius + 57);

    // 6. Right Column: Birthday Greetings & Gifts
    const contentX = 250;
    let currY = 55;

    // Small Top Subtitle
    ctx.font = "bold 13px 'Montserrat', sans-serif";
    ctx.fillStyle = "#FCD34D";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("✨ NAURA WILDS CELEBRATION", contentX, currY);

    // Main Header: SELAMAT ULANG TAHUN!
    currY += 24;
    const textGrad = ctx.createLinearGradient(contentX, currY, contentX + 350, currY);
    textGrad.addColorStop(0, "#FCD34D");
    textGrad.addColorStop(0.5, "#F472B6");
    textGrad.addColorStop(1, "#60A5FA");
    ctx.fillStyle = textGrad;
    ctx.font = "bold 34px 'Montserrat', sans-serif";
    ctx.fillText("HAPPY BIRTHDAY!", contentX, currY);

    // Age / Milestone Text
    currY += 46;
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "15px 'Montserrat', sans-serif";
    if (age) {
      ctx.fillText(`Selamat merayakan ulang tahun yang ke-${age}! 🎂`, contentX, currY);
    } else {
      ctx.fillText("Semoga hari ini penuh kebahagiaan dan berkah! 🎂", contentX, currY);
    }

    currY += 24;
    ctx.fillStyle = "#94A3B8";
    ctx.font = "13px 'Montserrat', sans-serif";
    ctx.fillText("Bintang-bintang di semesta Naura Wilds bersinar terang untukmu.", contentX, currY);

    // 7. Special Gift Box Container
    currY += 36;
    ctx.fillStyle = "rgba(24, 18, 48, 0.75)";
    ctx.beginPath();
    ctx.roundRect(contentX, currY, width - contentX - 44, 96, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(252, 211, 77, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(contentX, currY, width - contentX - 44, 96, 12);
    ctx.stroke();

    // Gift Header
    ctx.font = "bold 12px 'Montserrat', sans-serif";
    ctx.fillStyle = "#FCD34D";
    ctx.fillText("🎁 KADO SPESIAL DARI NAURA HOSHINO:", contentX + 16, currY + 14);

    // Three Reward Badges
    const rewardPills = [
      { icon: "✨", text: "1.000 Star Fragments", color: "#38BDF8" },
      { icon: "🎟️", text: "3 Naura Coupons", color: "#FCD34D" },
      { icon: "🎂", text: "1 Kue Tart Kafe", color: "#F472B6" },
    ];

    let pillX = contentX + 16;
    const pillY = currY + 40;
    for (const r of rewardPills) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, 150, 38, 8);
      ctx.fill();

      ctx.font = "16px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(r.icon, pillX + 8, pillY + 19);

      ctx.font = "bold 11px 'Montserrat', sans-serif";
      ctx.fillStyle = r.color;
      ctx.fillText(r.text, pillX + 30, pillY + 19);

      pillX += 160;
    }

    // 8. Footer Motto from Naura
    const footerY = height - 48;
    ctx.font = "italic 12px 'Montserrat', sans-serif";
    ctx.fillStyle = "#CBD5E1";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      '"Semoga setiap langkah petualanganmu diberkati keberuntungan kosmik!" - Naura',
      contentX,
      footerY,
    );

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderBirthdayCard,
};
