"use strict";

const { createCanvas } = require("./canvasRuntime");
const { drawRoundedRect, truncateText } = require("./CanvasUtils");

const CHART_CONFIG = {
  width: 1000,
  height: 620,
  paddingX: 55,
  paddingY: 40,
};

const OPTION_GRADIENTS = [
  { start: "#00D9FF", end: "#0284C7", glow: "rgba(0, 217, 255, 0.45)" }, // Cyan -> Blue
  { start: "#10B981", end: "#059669", glow: "rgba(16, 185, 129, 0.45)" }, // Emerald -> Green
  { start: "#F59E0B", end: "#D97706", glow: "rgba(245, 158, 11, 0.45)" }, // Amber -> Orange
  { start: "#F43F5E", end: "#8B5CF6", glow: "rgba(244, 63, 94, 0.45)" }, // Rose -> Violet
  { start: "#A855F7", end: "#6366F1", glow: "rgba(168, 85, 247, 0.45)" }, // Violet -> Indigo
  { start: "#EC4899", end: "#F43F5E", glow: "rgba(236, 72, 153, 0.45)" }, // Pink -> Rose
];

/**
 * Normalisasi data polling dari berbagai format input
 * @param {Object} payload
 * @returns {{question: string, options: Array<string>, counts: Array<number>, total: number, maxVotes: number, authorName: string}}
 */
function normalizePollData(payload = {}) {
  const question = String(payload.question || "Hasil Pemungutan Suara").trim();
  let rawOptions = Array.isArray(payload.options) ? [...payload.options] : [];
  if (rawOptions.length === 0) {
    rawOptions = ["Pilihan A", "Pilihan B"];
  }

  const optionTexts = [];
  const counts = new Array(rawOptions.length).fill(0);

  // Periksa apakah opsi bertipe objek { text, count } atau string murni
  for (let i = 0; i < rawOptions.length; i++) {
    const item = rawOptions[i];
    if (typeof item === "object" && item !== null) {
      optionTexts.push(item.label || item.text || item.name || `Pilihan ${i + 1}`);
      if (typeof item.count === "number") counts[i] = item.count;
    } else {
      optionTexts.push(String(item || `Pilihan ${i + 1}`));
    }
  }

  // Jika counts diberikan langsung sebagai array
  if (Array.isArray(payload.counts) && payload.counts.length > 0) {
    for (let i = 0; i < counts.length; i++) {
      if (typeof payload.counts[i] === "number") {
        counts[i] = payload.counts[i];
      }
    }
  } else if (payload.votes) {
    // Jika votes diberikan sebagai objek atau Map (userId -> [optIndex])
    const voteValues =
      payload.votes instanceof Map
        ? Array.from(payload.votes.values())
        : Object.values(payload.votes);

    for (const uVotes of voteValues) {
      if (Array.isArray(uVotes)) {
        for (const idx of uVotes) {
          const numIdx = Number(idx);
          if (numIdx >= 0 && numIdx < counts.length) {
            counts[numIdx]++;
          }
        }
      } else if (typeof uVotes === "number") {
        if (uVotes >= 0 && uVotes < counts.length) {
          counts[uVotes]++;
        }
      }
    }
  }

  const computedTotal = counts.reduce((acc, val) => acc + val, 0);
  const total = Number.isFinite(payload.totalVotes) ? payload.totalVotes : computedTotal;
  const maxVotes = Math.max(0, ...counts);

  const authorName =
    (payload.author && (payload.author.username || payload.author.name)) ||
    payload.initiator ||
    "Komunitas Naura";

  return {
    question,
    options: optionTexts,
    counts,
    total,
    maxVotes,
    authorName,
  };
}

/**
 * Render diagram batang horizontal resolusi tinggi 1000x620 untuk polling
 * @param {Object} payload
 * @returns {Promise<Buffer>}
 */
async function renderPollChart(payload = {}) {
  const { question, options, counts, total, maxVotes, authorName } =
    normalizePollData(payload);

  const width = CHART_CONFIG.width;
  const height = CHART_CONFIG.height;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Background Kanvas (Nuansa Dark Cyberpunk)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#080C14");
  bgGrad.addColorStop(0.5, "#0D1322");
  bgGrad.addColorStop(1, "#070A10");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Efek grid dot background halus
  ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
  for (let gx = 30; gx < width; gx += 40) {
    for (let gy = 30; gy < height; gy += 40) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Outer Card Border & Glow
  const cardX = 25;
  const cardY = 25;
  const cardWidth = width - 50;
  const cardHeight = height - 50;
  const cardRadius = 18;

  ctx.save();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(0, 217, 255, 0.2)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  } else {
    ctx.rect(cardX, cardY, cardWidth, cardHeight);
  }
  ctx.stroke();
  ctx.restore();

  // 3. Header Section
  const contentX = 55;
  const headerTop = 50;

  // Badge kategori atas
  const badgeText = "POLL RESULTS";
  ctx.font = 'bold 11px "InterBold", "Inter", sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 20;
  const badgeHeight = 22;
  drawRoundedRect(
    ctx,
    contentX,
    headerTop,
    badgeWidth,
    badgeHeight,
    6,
    "rgba(0, 217, 255, 0.12)",
    "rgba(0, 217, 255, 0.3)",
  );

  ctx.fillStyle = "#38BDF8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, contentX + badgeWidth / 2, headerTop + badgeHeight / 2);

  // Pertanyaan Polling
  const questionY = headerTop + 48;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#F8FAFC";
  ctx.font = 'bold 24px "MontserratBold", "InterBold", sans-serif';
  const cleanQuestion = truncateText(ctx, question, cardWidth - 180);
  ctx.fillText(cleanQuestion, contentX, questionY);

  // Subtitle / Total Suara & Info Inisiator
  const subY = questionY + 24;
  ctx.font = '14px "Inter", sans-serif';
  ctx.fillStyle = "#94A3B8";
  ctx.fillText(
    `Total Partisipasi: ${total} Suara • Inisiator: ${authorName}`,
    contentX,
    subY,
  );

  // Garis pemisah header
  const dividerY = subY + 16;
  const divGrad = ctx.createLinearGradient(contentX, dividerY, contentX + cardWidth - 60, dividerY);
  divGrad.addColorStop(0, "rgba(56, 189, 248, 0.4)");
  divGrad.addColorStop(0.5, "rgba(148, 163, 184, 0.15)");
  divGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, dividerY);
  ctx.lineTo(contentX + cardWidth - 60, dividerY);
  ctx.stroke();

  // 4. Section Diagram Batang Horizontal
  const chartAreaTop = dividerY + 24;
  const chartAreaBottom = height - 90;
  const availableHeight = chartAreaBottom - chartAreaTop;
  const numOptions = options.length;
  const slotHeight = Math.min(78, availableHeight / numOptions);
  const barHeight = Math.max(22, Math.min(28, slotHeight - 34));
  const maxBarWidth = cardWidth - 60; // Lebar maksimal batang

  for (let i = 0; i < numOptions; i++) {
    const optText = options[i];
    const count = counts[i];
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    const isWinner = maxVotes > 0 && count === maxVotes;
    const gradTheme = OPTION_GRADIENTS[i % OPTION_GRADIENTS.length];

    const slotY = chartAreaTop + i * slotHeight;
    const labelY = slotY + 12;
    const barY = slotY + 26;

    // Label Opsi & Mahkota Juara
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 16px "InterBold", "Inter", sans-serif';
    ctx.fillStyle = isWinner ? "#FDE047" : "#F1F5F9";

    const optIndexPrefix = `${i + 1}. `;
    const winnerPrefix = isWinner ? "👑 " : "";
    const fullLabel = `${winnerPrefix}${optIndexPrefix}${optText}`;
    const truncatedLabel = truncateText(ctx, fullLabel, maxBarWidth - 210);
    ctx.fillText(truncatedLabel, contentX, labelY);

    // Label Angka Suara & Persentase di Sisi Kanan Baris
    ctx.textAlign = "right";
    ctx.font = 'bold 15px "InterBold", "Inter", sans-serif';
    ctx.fillStyle = isWinner ? "#FDE047" : "#CBD5E1";
    ctx.fillText(`${count} suara (${percentage}%)`, contentX + maxBarWidth, labelY);

    // Track Latar Belakang Batang (Abu-abu gelap transparan)
    ctx.save();
    drawRoundedRect(
      ctx,
      contentX,
      barY,
      maxBarWidth,
      barHeight,
      barHeight / 2,
      "rgba(30, 41, 59, 0.65)",
    );

    // Batang Progres Berwarna Gradien
    if (percentage > 0) {
      const currentBarWidth = Math.max(
        barHeight,
        Math.round((percentage / 100) * maxBarWidth),
      );

      // Glow pada pemenang
      if (isWinner) {
        ctx.shadowColor = gradTheme.glow;
        ctx.shadowBlur = 14;
      }

      const barGrad = ctx.createLinearGradient(
        contentX,
        barY,
        contentX + currentBarWidth,
        barY,
      );
      barGrad.addColorStop(0, gradTheme.start);
      barGrad.addColorStop(1, gradTheme.end);

      drawRoundedRect(
        ctx,
        contentX,
        barY,
        currentBarWidth,
        barHeight,
        barHeight / 2,
        barGrad,
      );
    }
    ctx.restore();
  }

  // 5. Penggaris Persentase di Bagian Bawah Chart
  const rulerY = chartAreaBottom + 12;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, rulerY);
  ctx.lineTo(contentX + maxBarWidth, rulerY);
  ctx.stroke();

  // Ticks: 0%, 25%, 50%, 75%, 100%
  const ticks = [0, 25, 50, 75, 100];
  ctx.font = '11px "Inter", sans-serif';
  ctx.fillStyle = "#64748B";

  ticks.forEach((tick) => {
    const tickX = contentX + (tick / 100) * maxBarWidth;
    ctx.beginPath();
    ctx.moveTo(tickX, rulerY);
    ctx.lineTo(tickX, rulerY + 5);
    ctx.stroke();

    ctx.textAlign = tick === 0 ? "left" : tick === 100 ? "right" : "center";
    ctx.fillText(`${tick}%`, tickX, rulerY + 16);
  });

  // 6. Watermark Footer
  const footerY = height - 36;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '12px "Inter", sans-serif';
  ctx.fillStyle = "#475569";
  ctx.fillText("Naura Hoshino V2 • Smart Visual Poll Engine", width / 2, footerY);

  return canvas.toBuffer("image/png");
}

module.exports = {
  renderPollChart,
  normalizePollData,
};
