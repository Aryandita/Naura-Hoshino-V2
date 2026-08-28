"use strict";

const { createCanvas, loadImage } = require("./canvasRuntime");

/**
 * Render visual pertempuran kartu anime 900x500
 */
async function drawCardBattleArena({
  p1,
  p2,
  p1User,
  p2User,
  turnLog,
  roundNumber = 1,
}) {
  const canvas = createCanvas(900, 500);
  const ctx = canvas.getContext("2d");

  // Background Cyber Arena
  const bgGrad = ctx.createLinearGradient(0, 0, 900, 500);
  bgGrad.addColorStop(0, "#0B0C10");
  bgGrad.addColorStop(0.5, "#1F2833");
  bgGrad.addColorStop(1, "#0B0C10");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 900, 500);

  // Neon Grid lines
  ctx.strokeStyle = "rgba(255, 182, 193, 0.15)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 900; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 500);
    ctx.stroke();
  }
  for (let y = 0; y < 500; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(900, y);
    ctx.stroke();
  }

  // Header Title
  ctx.fillStyle = "#FFB6C1";
  ctx.font = "bold 24px 'Orbitron', 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`⚔️ ANIME CARD CLASH ARENA ⚔️ - RONDE ${roundNumber}`, 450, 45);

  // Player 1 Card Panel (Left)
  ctx.fillStyle = "rgba(31, 40, 51, 0.8)";
  ctx.strokeStyle = "#F9A8D4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(50, 80, 360, 280, 16);
  ctx.fill();
  ctx.stroke();

  // Player 1 Name & Element
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 18px 'Outfit', sans-serif";
  ctx.fillText(
    `${p1User.username || "Challenger"} (${p1.characterName})`,
    70,
    115,
  );
  ctx.fillStyle = "#F9A8D4";
  ctx.font = "14px 'Outfit', sans-serif";
  ctx.fillText(
    `${p1.elementEmoji} Elemen: ${p1.element} | 🌟 ${p1.quality} #${p1.printNumber}`,
    70,
    140,
  );

  // P1 HP Bar
  const p1HpRatio = Math.max(0, p1.currentHp / p1.maxHp);
  ctx.fillStyle = "#333333";
  ctx.beginPath();
  ctx.roundRect(70, 160, 320, 20, 10);
  ctx.fill();
  const p1HpGrad = ctx.createLinearGradient(70, 160, 390, 180);
  p1HpGrad.addColorStop(0, "#86EFAC");
  p1HpGrad.addColorStop(1, "#22C55E");
  ctx.fillStyle = p1HpGrad;
  ctx.beginPath();
  ctx.roundRect(70, 160, Math.max(12, 320 * p1HpRatio), 20, 10);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 12px 'Orbitron', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`HP: ${p1.currentHp} / ${p1.maxHp}`, 230, 175);

  // P1 Energy Bar
  ctx.textAlign = "left";
  ctx.fillStyle = "#93C5FD";
  ctx.font = "bold 14px 'Outfit', sans-serif";
  ctx.fillText(
    `⚡ Energy: ${"🔷".repeat(p1.energy)}${"▫️".repeat(p1.maxEnergy - p1.energy)} (${p1.energy}/${p1.maxEnergy})`,
    70,
    215,
  );

  // P1 Stats & Ultimate
  ctx.fillStyle = "#E0E0E0";
  ctx.font = "14px 'Outfit', sans-serif";
  ctx.fillText(
    `⚔️ ATK: ${p1.atk} | 🛡️ DEF: ${p1.def} | 💨 SPD: ${p1.spd}`,
    70,
    245,
  );
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 14px 'Outfit', sans-serif";
  ctx.fillText(
    `✨ Ultimate: ${p1.skill.name} (${p1.skill.energyCost} Energy)`,
    70,
    275,
  );
  ctx.fillStyle = "#A0A0A0";
  ctx.font = "12px 'Outfit', sans-serif";
  ctx.fillText(p1.skill.desc.substring(0, 48) + "...", 70, 300);

  // VS Badge (Center)
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 32px 'Orbitron', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VS", 450, 220);

  // Player 2 / Boss Card Panel (Right)
  ctx.fillStyle = "rgba(31, 40, 51, 0.8)";
  ctx.strokeStyle = "#C084FC";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(490, 80, 360, 280, 16);
  ctx.fill();
  ctx.stroke();

  // Player 2 Name & Element
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 18px 'Outfit', sans-serif";
  ctx.fillText(
    `${p2User.username || "Opponent"} (${p2.characterName})`,
    510,
    115,
  );
  ctx.fillStyle = "#C084FC";
  ctx.font = "14px 'Outfit', sans-serif";
  ctx.fillText(
    `${p2.elementEmoji} Elemen: ${p2.element} | 🌟 ${p2.quality} #${p2.printNumber}`,
    510,
    140,
  );

  // P2 HP Bar
  const p2HpRatio = Math.max(0, p2.currentHp / p2.maxHp);
  ctx.fillStyle = "#333333";
  ctx.beginPath();
  ctx.roundRect(510, 160, 320, 20, 10);
  ctx.fill();
  const p2HpGrad = ctx.createLinearGradient(510, 160, 830, 180);
  p2HpGrad.addColorStop(0, "#F87171");
  p2HpGrad.addColorStop(1, "#EF4444");
  ctx.fillStyle = p2HpGrad;
  ctx.beginPath();
  ctx.roundRect(510, 160, Math.max(12, 320 * p2HpRatio), 20, 10);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 12px 'Orbitron', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`HP: ${p2.currentHp} / ${p2.maxHp}`, 670, 175);

  // P2 Energy Bar
  ctx.textAlign = "left";
  ctx.fillStyle = "#93C5FD";
  ctx.font = "bold 14px 'Outfit', sans-serif";
  ctx.fillText(
    `⚡ Energy: ${"🔷".repeat(p2.energy)}${"▫️".repeat(p2.maxEnergy - p2.energy)} (${p2.energy}/${p2.maxEnergy})`,
    510,
    215,
  );

  // P2 Stats & Ultimate
  ctx.fillStyle = "#E0E0E0";
  ctx.font = "14px 'Outfit', sans-serif";
  ctx.fillText(
    `⚔️ ATK: ${p2.atk} | 🛡️ DEF: ${p2.def} | 💨 SPD: ${p2.spd}`,
    510,
    245,
  );
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 14px 'Outfit', sans-serif";
  ctx.fillText(
    `✨ Ultimate: ${p2.skill.name} (${p2.skill.energyCost} Energy)`,
    510,
    275,
  );
  ctx.fillStyle = "#A0A0A0";
  ctx.font = "12px 'Outfit', sans-serif";
  ctx.fillText(p2.skill.desc.substring(0, 48) + "...", 510, 300);

  // Bottom Battle Log Banner
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(50, 380, 800, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#FFB6C1";
  ctx.font = "bold 14px 'Outfit', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("📜 Action Log:", 70, 408);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "14px 'Outfit', sans-serif";
  ctx.fillText(turnLog || "Menunggu aksi pemain...", 70, 440);

  return canvas.toBuffer("image/png");
}

module.exports = {
  drawCardBattleArena,
};
