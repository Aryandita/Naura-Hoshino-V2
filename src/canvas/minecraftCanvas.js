const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");
const axios = require("axios");

async function renderMinecraftPlayer(payload) {
  return runWithLimit("minecraftPlayer", async () => {
    const { uuid, realName } = payload;
    const canvas = createCanvas(800, 500);
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(400, 250, 50, 400, 250, 600);
    gradient.addColorStop(0, "#1e293b");
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px sans-serif";
    ctx.fillText(realName, 50, 100);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px sans-serif";
    ctx.fillText(`UUID: ${uuid}`, 50, 140);

    try {
      const headRes = await axios.get(
        `https://crafatar.com/renders/head/${uuid}?overlay=true&scale=10`,
        { responseType: "arraybuffer" },
      );
      const headImg = await loadImage(Buffer.from(headRes.data));
      ctx.drawImage(headImg, 50, 180, 150, 150);
    } catch (e) {}

    try {
      const bodyRes = await axios.get(
        `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`,
        { responseType: "arraybuffer" },
      );
      const bodyImg = await loadImage(Buffer.from(bodyRes.data));
      ctx.drawImage(bodyImg, 500, 50, 200, 420);
    } catch (e) {}

    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("✦ 3D Skin & Head Rendered ✦", 50, 420);
    ctx.fillStyle = "#64748b";
    ctx.font = "16px sans-serif";
    ctx.fillText("Powered by Crafatar & Naura", 50, 450);

    return canvas.toBuffer("image/png");
  });
}

async function renderMinecraftStats(payload) {
  return runWithLimit("minecraftStats", async () => {
    const { username, playDays, playHours, playMinutes, uuid } = payload;
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    for (let i = 0; i < 800; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 400);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(800, i);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.roundRect(40, 40, 450, 320, 15);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fill();

    ctx.fillStyle = "#34d399";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("VERMILION NETWORK - MICROSOFT LINK", 60, 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 45px sans-serif";
    ctx.fillText(username.toUpperCase(), 60, 140);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "22px sans-serif";
    ctx.fillText("Total Waktu Bermain:", 60, 200);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 35px sans-serif";
    ctx.fillText(
      `${playDays}H ${playHours % 24}J ${playMinutes % 60}M`,
      60,
      240,
    );

    ctx.fillStyle = "#6b7280";
    ctx.font = "16px sans-serif";
    ctx.fillText("*Waktu dihitung dari sinkronisasi Discord.", 60, 330);

    try {
      const bodyRes = await axios.get(
        `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`,
        { responseType: "arraybuffer" },
      );
      const bodyImg = await loadImage(Buffer.from(bodyRes.data));
      ctx.drawImage(bodyImg, 530, 20, 180, 360);
    } catch (e) {}

    return canvas.toBuffer("image/png");
  });
}

module.exports = { renderMinecraftPlayer, renderMinecraftStats };
