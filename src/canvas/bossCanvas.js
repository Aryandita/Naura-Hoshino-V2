"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual kartu World Boss 2.0 dengan HP Bar multi-segmen dan indikator fase
 */
async function drawBossCard(bossData) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const elementColors = {
      DARK: { primary: "#C084FC", secondary: "#581C87", text: "#E9D5FF" },
      FIRE: { primary: "#F87171", secondary: "#7F1D1D", text: "#FEE2E2" },
      WATER: { primary: "#38BDF8", secondary: "#0C4A6E", text: "#E0F2FE" },
      HOLY: { primary: "#FDE047", secondary: "#713F12", text: "#FEF9C3" },
      LIGHTNING: { primary: "#A855F7", secondary: "#3B0764", text: "#F3E8FF" },
    };

    const elem = elementColors[bossData.element] || elementColors.DARK;
    const currentHp = Math.max(0, Number(bossData.currentHp || 0));
    const maxHp = Math.max(1, Number(bossData.maxHp || 1));
    const hpPercent = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));
    const phase = bossData.phase || 1;
    const shieldHp = Number(bossData.shieldHp || 0);
    const maxShieldHp = Number(bossData.maxShieldHp || maxHp * 0.25);
    const shieldPercent =
      maxShieldHp > 0
        ? Math.min(100, Math.max(0, (shieldHp / maxShieldHp) * 100))
        : 0;

    // 1. Background Panel (Cyber Dark Glassmorphism)
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, elem.secondary);
    bgGrad.addColorStop(0.5, "#0D0E15");
    bgGrad.addColorStop(1, "#050508");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Cyber Border
    ctx.save();
    ctx.strokeStyle = phase === 3 ? "#EF4444" : elem.primary;
    ctx.lineWidth = phase === 3 ? 3 : 2;
    ctx.shadowColor = phase === 3 ? "#EF4444" : elem.primary;
    ctx.shadowBlur = phase === 3 ? 20 : 12;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header: Boss Title & Element Badge
    ctx.font = '14px "Orbitron", "EmojiFont"';
    ctx.fillStyle = elem.text;
    ctx.textAlign = "left";
    ctx.fillText((bossData.title || "ANCIENT CALAMITY").toUpperCase(), 40, 50);

    // Badges (Top Right)
    const phaseBadge =
      phase === 3 ? "⚡ ENRAGED" : phase === 2 ? "🛡️ SHIELDED" : "⚔️ NORMAL";
    const phaseColor =
      phase === 3 ? "#EF4444" : phase === 2 ? "#38BDF8" : "#22C55E";

    ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
    ctx.fillStyle = phaseColor;
    ctx.textAlign = "right";
    ctx.fillText(
      `${phaseBadge}  |  ELEMENT: ${bossData.element || "DARK"}`,
      width - 40,
      50,
    );

    // Boss Name
    ctx.font = 'bold 30px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.fillText(bossData.name || "Abyssal Leviathan", 40, 90);

    // 4. Health Bar Container
    const barX = 40;
    const barY = 120;
    const barW = width - 80;
    const barH = 26;

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();

    // HP Fill Gradient
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    if (phase === 3) {
      fillGrad.addColorStop(0, "#EF4444");
      fillGrad.addColorStop(1, "#DC2626");
    } else {
      fillGrad.addColorStop(0, "#22C55E");
      fillGrad.addColorStop(1, elem.primary);
    }

    const currentFillW = Math.max(12, (barW * hpPercent) / 100);
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, currentFillW, barH, 8);
    ctx.fill();

    // HP Text Overlay
    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(
      `HP: ${currentHp.toLocaleString("id-ID")} / ${maxHp.toLocaleString("id-ID")} (${hpPercent.toFixed(1)}%)`,
      barX + barW / 2,
      barY + 18,
    );

    // 4.5 Shield Bar (If Phase 2 or Shield HP > 0)
    if (shieldHp > 0) {
      const sBarY = barY + 34;
      const sBarH = 14;

      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.beginPath();
      ctx.roundRect(barX, sBarY, barW, sBarH, 6);
      ctx.fill();

      const shieldFillW = Math.max(8, (barW * shieldPercent) / 100);
      ctx.fillStyle = "#38BDF8";
      ctx.beginPath();
      ctx.roundRect(barX, sBarY, shieldFillW, sBarH, 6);
      ctx.fill();

      ctx.font = '10px "Orbitron", "EmojiFont"';
      ctx.fillStyle = "#E0F2FE";
      ctx.textAlign = "left";
      ctx.fillText(
        `CYBER SHIELD: ${shieldHp.toLocaleString("id-ID")} / ${maxShieldHp.toLocaleString("id-ID")}`,
        barX + 5,
        sBarY + 11,
      );
    }

    // 5. Leaderboard / Raid Overview Split Cards (Bottom Area)
    const cardY = 200;
    const cardH = 210;
    const cardW = (width - 100) / 2;

    // Card Left: Role Synergy & Hadiah Pool
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(40, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.font = 'bold 14px "Orbitron", "EmojiFont"';
    ctx.fillStyle = elem.primary;
    ctx.textAlign = "left";
    ctx.fillText("⚔️ ROLE SQUAD SYNERGY", 55, cardY + 30);

    const roles = bossData.roleContributions || {};
    const tanksCount = Object.keys(roles.tanks || {}).length;
    const healersCount = Object.keys(roles.healers || {}).length;
    const dpsCount = Object.keys(roles.dps || {}).length;
    const buffersCount = Object.keys(roles.buffers || {}).length;

    ctx.font = '13px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#E2E8F0";
    ctx.fillText(`🛡️ Tanks: ${tanksCount} petualang`, 55, cardY + 65);
    ctx.fillText(`💖 Healers: ${healersCount} petualang`, 55, cardY + 95);
    ctx.fillText(`⚔️ DPS Strike: ${dpsCount} petualang`, 55, cardY + 125);
    ctx.fillText(`🔮 Buffers: ${buffersCount} petualang`, 55, cardY + 155);

    const pool = bossData.rewardsPool || { starFragments: 5000, coupons: 30 };
    ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#FFD700";
    ctx.fillText(
      `💎 Pool: ${Number(pool.starFragments || 5000).toLocaleString("id-ID")} ⭐ | ${pool.coupons || 30} 🎟️`,
      55,
      cardY + 190,
    );

    // Card Right: Top 3 MVP Raid Damage Contributors
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(40 + cardW + 20, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.font = 'bold 14px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#FFD700";
    ctx.fillText("🏆 TOP RAID CONTRIBUTORS", 40 + cardW + 35, cardY + 30);

    const leaderboard = Object.values(bossData.damageLeaderboard || {}).sort(
      (a, b) => b.totalDamage - a.totalDamage,
    );
    const top3 = leaderboard.slice(0, 3);

    if (top3.length === 0) {
      ctx.font = '13px "Outfit", "EmojiFont"';
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText(
        "Belum ada petualang yang menyerang!",
        40 + cardW + 35,
        cardY + 80,
      );
    } else {
      top3.forEach((p, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
        const entryY = cardY + 70 + idx * 40;
        ctx.font = '13px "Outfit", "EmojiFont"';
        ctx.fillStyle = idx === 0 ? "#FFD700" : "#FFFFFF";
        const nameText = `${medal} ${(p.username || "Pemain").substring(0, 14)}`;
        ctx.fillText(nameText, 40 + cardW + 35, entryY);

        ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
        ctx.fillStyle = "#93C5FD";
        ctx.textAlign = "right";
        ctx.fillText(
          `${Number(p.totalDamage).toLocaleString("id-ID")} DMG`,
          width - 55,
          entryY,
        );
        ctx.textAlign = "left";
      });
    }

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawBossCard,
  renderBossCard: drawBossCard,
};
