"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual kartu duel 3v3 Galactic Coliseum
 */
async function drawColiseumMatch(matchData) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#4C1D95");
    bgGrad.addColorStop(0.5, "#0F172A");
    bgGrad.addColorStop(1, "#030712");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Border
    ctx.save();
    ctx.strokeStyle = "#A855F7";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#A855F7";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header
    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#C084FC";
    ctx.fillText("⚔️ GALACTIC COLISEUM, 3v3 ASYNC ARENA", 40, 50);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`DIVISI: ${matchData.division || "BRONZE"} (${matchData.elo || 1200} ELO)`, width - 40, 50);
    ctx.textAlign = "left";

    // 4. VS Cards Showcase
    const cardW = 320;
    const cardH = 220;

    // Attacker Card
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.beginPath();
    ctx.roundRect(50, 100, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = "#3B82F6";
    ctx.stroke();

    ctx.font = 'bold 18px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#93C5FD";
    ctx.fillText(matchData.attackerName || "Challenger", 70, 135);

    ctx.font = '13px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText("Formation: 3 Fighters Vanguard", 70, 165);
    ctx.fillText("Squad Power: Balanced Tri-Core", 70, 190);

    // Center VS text
    ctx.font = 'bold 36px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#EF4444";
    ctx.textAlign = "center";
    ctx.fillText("VS", width / 2, 220);
    ctx.textAlign = "left";

    // Defender Card
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.beginPath();
    ctx.roundRect(width - 50 - cardW, 100, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = "#EF4444";
    ctx.stroke();

    ctx.font = 'bold 18px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FCA5A5";
    ctx.fillText(matchData.opponentName || "Defender AI", width - 30 - cardW, 135);

    ctx.font = '13px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText(`Rating: ${matchData.opponentElo || 1200} ELO`, width - 30 - cardW, 165);
    ctx.fillText("Formation: Tactical Defense", width - 30 - cardW, 190);

    // 5. Result Banner
    const isVic = matchData.isVictory;
    ctx.fillStyle = isVic ? "rgba(134, 239, 172, 0.1)" : "rgba(248, 113, 113, 0.1)";
    ctx.beginPath();
    ctx.roundRect(50, 340, width - 100, 60, 10);
    ctx.fill();
    ctx.strokeStyle = isVic ? "#86EFAC" : "#F87171";
    ctx.stroke();

    ctx.font = 'bold 16px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = isVic ? "#86EFAC" : "#F87171";
    ctx.textAlign = "center";
    ctx.fillText(isVic ? `🏆 KEMENANGAN TELAK (${matchData.score})! +${matchData.eloChange} ELO` : `☠️ KEKALAHAN (${matchData.score})! ${matchData.eloChange} ELO`, width / 2, 375);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawColiseumMatch,
  renderColiseumMatch: drawColiseumMatch,
};
