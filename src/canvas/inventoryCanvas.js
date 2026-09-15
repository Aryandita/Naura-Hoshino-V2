// Lokasi: src/canvas/inventoryCanvas.js
// Renderer Canvas Ransel Petualang Terbuka (Adventurer's Open Backpack)
// Menampilkan inventaris pemain dengan adaptive grid scaling dan overflow handling

"use strict";

const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, runWithLimit } = require("./canvasRuntime");
const { CATALOG_BY_ID } = require("../survival/data/items_catalog");

// Direktori aset item
const ASSETS_ITEMS_DIR = path.join(__dirname, "../../assets/items");

/**
 * Menghitung tata letak grid secara adaptif berdasarkan jumlah item
 * @param {number} itemCount Jumlah jenis item unik
 * @returns {object} Konfigurasi grid { cols, rows, maxVisible, slotW, slotH, gapX, gapY, iconSize, nameFontSize, qtyFontSize, mode }
 */
function computeGridLayout(itemCount) {
  if (itemCount <= 6) {
    return {
      cols: 3,
      rows: 2,
      maxVisible: 6,
      slotW: 180,
      slotH: 150,
      gapX: 24,
      gapY: 20,
      iconSize: 76,
      nameFontSize: 13,
      qtyFontSize: 16,
      mode: "large",
    };
  }

  if (itemCount <= 12) {
    return {
      cols: 4,
      rows: 3,
      maxVisible: 12,
      slotW: 136,
      slotH: 104,
      gapX: 18,
      gapY: 14,
      iconSize: 52,
      nameFontSize: 11,
      qtyFontSize: 13,
      mode: "medium",
    };
  }

  // Banyak item (13+ item, maks 15 visual slot pada grid 5x3)
  return {
    cols: 5,
    rows: 3,
    maxVisible: 15,
    slotW: 112,
    slotH: 100,
    gapX: 12,
    gapY: 12,
    iconSize: 44,
    nameFontSize: 10,
    qtyFontSize: 12,
    mode: "compact",
  };
}

/**
 * Helper untuk menggambar rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Memotong teks jika melebihi lebar maksimum
 */
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (
    truncated.length > 1 &&
    ctx.measureText(truncated + "..").width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "..";
}

/**
 * Merender visual kanvas Ransel Petualang
 * @param {object} user Objek User Discord
 * @param {Array} inventory Raw / parsed inventory user
 * @param {object} profile UserProfile dari database
 * @param {object} [options] Opsi tambahan
 * @returns {Promise<Buffer>} Buffer PNG
 */
async function generateInventoryBackpackImage(
  user,
  inventory,
  profile,
  options = {},
) {
  return await runWithLimit(async () => {
    const is2K = options.resolution === "2k" || options.highFidelity || false;
    const scale = is2K ? 2 : 1;
    const canvasWidth = 900;
    const canvasHeight = 580;
    const canvas = createCanvas(canvasWidth * scale, canvasHeight * scale);
    const ctx = canvas.getContext("2d");
    if (scale !== 1) {
      ctx.scale(scale, scale);
    }

    // ============================================================
    // 1. LATAR BELAKANG MEJA KEMAH PETUALANG DENGAN AMBIENT WARMTH
    // ============================================================
    const tableGrad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    tableGrad.addColorStop(0, "#1c1410");
    tableGrad.addColorStop(0.5, "#261a14");
    tableGrad.addColorStop(1, "#150e0b");
    ctx.fillStyle = tableGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Tekstur serat kayu meja kemah petualang
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    for (let y = 15; y < canvasHeight; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y + Math.sin(y * 0.1) * 4);
      ctx.stroke();
    }

    // Pendaran hangat lentera malam di sudut atas kiri
    const lanternGrad = ctx.createRadialGradient(80, 60, 10, 80, 60, 320);
    lanternGrad.addColorStop(0, "rgba(255, 183, 77, 0.18)");
    lanternGrad.addColorStop(0.6, "rgba(255, 140, 0, 0.05)");
    lanternGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lanternGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // ============================================================
    // 2. BENTUK FISIK RANSEL PETUALANG TERBUKA (ADVENTURER'S BACKPACK)
    // ============================================================
    const bpX = 40;
    const bpY = 30;
    const bpW = canvasWidth - 80; // 820
    const bpH = canvasHeight - 60; // 520

    // Bayangan ransel di atas meja
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    roundRect(ctx, bpX, bpY, bpW, bpH, 26);
    ctx.fillStyle = "#1a110c";
    ctx.fill();
    ctx.restore();

    // Badan luar ransel kulit (Rugged Leather Texture)
    const leatherGrad = ctx.createLinearGradient(
      bpX,
      bpY,
      bpX + bpW,
      bpY + bpH,
    );
    leatherGrad.addColorStop(0, "#4a2c1b");
    leatherGrad.addColorStop(0.3, "#3d2315");
    leatherGrad.addColorStop(0.7, "#331c11");
    leatherGrad.addColorStop(1, "#26140b");
    roundRect(ctx, bpX, bpY, bpW, bpH, 26);
    ctx.fillStyle = leatherGrad;
    ctx.fill();

    // Garis jahitan tepi kulit (Golden Saddle Stitching)
    ctx.save();
    ctx.strokeStyle = "rgba(212, 175, 55, 0.45)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    roundRect(ctx, bpX + 7, bpY + 7, bpW - 14, bpH - 14, 20);
    ctx.stroke();
    ctx.restore();

    // Gesper & Tali Kulit Ransel di Sisi Kiri & Kanan (Straps & Buckles)
    const strapColor = "#2c170d";
    const brassColor = "#d4af37";

    // Tali kiri
    roundRect(ctx, bpX + 28, bpY - 6, 26, 40, 4);
    ctx.fillStyle = strapColor;
    ctx.fill();
    roundRect(ctx, bpX + 26, bpY + 12, 30, 10, 2);
    ctx.fillStyle = brassColor;
    ctx.fill();

    // Tali kanan
    roundRect(ctx, bpX + bpW - 54, bpY - 6, 26, 40, 4);
    ctx.fillStyle = strapColor;
    ctx.fill();
    roundRect(ctx, bpX + bpW - 56, bpY + 12, 30, 10, 2);
    ctx.fillStyle = brassColor;
    ctx.fill();

    // ============================================================
    // 3. HEADER RANSEL: LENCANA LOGAM & STATUS PETUALANG
    // ============================================================
    const headerX = bpX + 50;
    const headerY = bpY + 16;
    const headerW = bpW - 100;
    const headerH = 52;

    // Pelat Lencana Logam Kuningan
    const badgeGrad = ctx.createLinearGradient(
      headerX,
      headerY,
      headerX,
      headerY + headerH,
    );
    badgeGrad.addColorStop(0, "#2a1c12");
    badgeGrad.addColorStop(0.5, "#1b110a");
    badgeGrad.addColorStop(1, "#140b06");
    roundRect(ctx, headerX, headerY, headerW, headerH, 12);
    ctx.fillStyle = badgeGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(212, 175, 55, 0.75)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Baut kuningan di empat sudut pelat
    const screwCoords = [
      [headerX + 12, headerY + 12],
      [headerX + headerW - 12, headerY + 12],
      [headerX + 12, headerY + headerH - 12],
      [headerX + headerW - 12, headerY + headerH - 12],
    ];
    ctx.fillStyle = brassColor;
    for (const [sx, sy] of screwCoords) {
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vektor Mini Icon Ransel di Kiri Header
    const bagIconX = headerX + 22;
    const bagIconY = headerY + 15;
    roundRect(ctx, bagIconX, bagIconY + 4, 22, 18, 4);
    ctx.fillStyle = "#8a5833";
    ctx.fill();
    ctx.strokeStyle = brassColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Tutup ransel mini
    roundRect(ctx, bagIconX + 2, bagIconY + 1, 18, 8, 3);
    ctx.fillStyle = "#5a3821";
    ctx.fill();
    ctx.stroke();

    // Judul & Nama Pemilik Ransel (Tanpa emoji mentah yang berisiko kotak hilang)
    const displayName = user.displayName || user.username || "Petualang";
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 16px MontserratBold, sans-serif";
    ctx.fillText(
      `RANSEL PETUALANG: ${displayName.toUpperCase()}`,
      headerX + 54,
      headerY + 24,
    );

    // Koin & Fragmen
    const coins = (profile?.coins || profile?.balance || 0).toLocaleString(
      "id-ID",
    );
    const coupons = (
      profile?.coupons ||
      profile?.userSurvival?.coupons ||
      0
    ).toLocaleString("id-ID");
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(
      `COINS: ${coins}  •  COUPONS: ${coupons}  •  NAURA WILDS ADVENTURE BAG`,
      headerX + 54,
      headerY + 42,
    );

    // ============================================================
    // 4. KOMPARTEMEN INTERIOR RANSEL (POCKET INTERIOR)
    // ============================================================
    const innerX = bpX + 24;
    const innerY = bpY + 80;
    const innerW = bpW - 48; // 772
    const innerH = bpH - 104; // 416

    // Lapisan dalam kain beludru gelap (Soft Canvas Inner Lining)
    const innerGrad = ctx.createLinearGradient(
      innerX,
      innerY,
      innerX,
      innerY + innerH,
    );
    innerGrad.addColorStop(0, "#19100a");
    innerGrad.addColorStop(0.5, "#140c07");
    innerGrad.addColorStop(1, "#0d0704");
    roundRect(ctx, innerX, innerY, innerW, innerH, 18);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // Bayangan kedalaman rongga tas
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Jahitan halus interior
    ctx.save();
    ctx.strokeStyle = "rgba(255, 182, 193, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    roundRect(ctx, innerX + 4, innerY + 4, innerW - 8, innerH - 8, 14);
    ctx.stroke();
    ctx.restore();

    // ============================================================
    // 5. NORMALISASI & AGREGASI INVENTARIS PEMAIN
    // ============================================================
    const rawList = Array.isArray(inventory) ? inventory : [];
    const aggregatedMap = new Map();

    for (const item of rawList) {
      if (!item) continue;
      const id = item.id || (typeof item === "string" ? item : "unknown_item");
      const amount = Number(item.amount) || 1;

      if (aggregatedMap.has(id)) {
        const existing = aggregatedMap.get(id);
        existing.amount += amount;
      } else {
        const catalogData = CATALOG_BY_ID.get(id);
        aggregatedMap.set(id, {
          id,
          name: item.name || (catalogData ? catalogData.name : id),
          amount,
          tier: catalogData ? catalogData.tier : 1,
          tierColor: catalogData ? catalogData.tierColor : "#9CA3AF",
          emoji: item.emoji || (catalogData ? catalogData.emoji : "📦"),
          category: catalogData ? catalogData.category : "item",
        });
      }
    }

    const itemsList = Array.from(aggregatedMap.values());
    const totalUnique = itemsList.length;

    // Jika inventaris kosong
    if (totalUnique === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = "italic 16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Ranselmu masih kosong melompong...",
        innerX + innerW / 2,
        innerY + innerH / 2 - 15,
      );
      ctx.font = "13px Inter, sans-serif";
      ctx.fillStyle = "rgba(255, 182, 193, 0.75)";
      ctx.fillText(
        "Kumpulkan sumber daya lewat /survival gather collect atau tebang pohon!",
        innerX + innerW / 2,
        innerY + innerH / 2 + 15,
      );
      ctx.textAlign = "left";
      return canvas.toBuffer("image/png");
    }

    // ============================================================
    // 6. ADAPTIVE GRID CALCULATION & RENDERING
    // ============================================================
    const layout = computeGridLayout(totalUnique);
    const hasOverflow = totalUnique > layout.maxVisible;
    const displayCount = hasOverflow ? layout.maxVisible : totalUnique;
    const overflowCount = totalUnique - (layout.maxVisible - 1); // Jumlah sisa item jika ada overflow

    // Hitung offset agar grid selalu berada persis di tengah kompartemen ransel
    const totalGridW =
      layout.cols * layout.slotW + (layout.cols - 1) * layout.gapX;
    const totalGridH =
      layout.rows * layout.slotH + (layout.rows - 1) * layout.gapY;
    const startX = innerX + Math.floor((innerW - totalGridW) / 2);
    const startY = innerY + Math.floor((innerH - totalGridH) / 2);

    for (let i = 0; i < displayCount; i++) {
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const slotX = startX + col * (layout.slotW + layout.gapX);
      const slotY = startY + row * (layout.slotH + layout.gapY);

      // KASUS A: KOTAK TERAKHIR (OVERFLOW DOTS "... X MORE")
      if (hasOverflow && i === layout.maxVisible - 1) {
        // Latar slot khusus overflow
        roundRect(ctx, slotX, slotY, layout.slotW, layout.slotH, 12);
        ctx.fillStyle = "rgba(249, 168, 212, 0.08)";
        ctx.fill();

        ctx.save();
        ctx.strokeStyle = "#F9A8D4";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();

        // Titik tiga horizontal (...)
        ctx.textAlign = "center";
        ctx.fillStyle = "#F9A8D4";
        ctx.font = `bold ${Math.round(layout.iconSize * 0.55)}px MontserratBold, sans-serif`;
        ctx.fillText(
          "•••",
          slotX + layout.slotW / 2,
          slotY + layout.slotH / 2 - 4,
        );

        // Teks `+X more`
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${layout.nameFontSize + 2}px MontserratBold, sans-serif`;
        ctx.fillText(
          `+${overflowCount} more`,
          slotX + layout.slotW / 2,
          slotY + layout.slotH / 2 + 20,
        );
        ctx.textAlign = "left";
        continue;
      }

      // KASUS B: SLOT ITEM NORMAL
      const item = itemsList[i];
      const tierColor = item.tierColor || "#9CA3AF";

      // Latar belakang kotak slot (Pouch Pocket Style)
      roundRect(ctx, slotX, slotY, layout.slotW, layout.slotH, 12);
      ctx.fillStyle = "rgba(38, 24, 16, 0.88)";
      ctx.fill();

      // Border pendar warna tier
      ctx.save();
      ctx.strokeStyle = tierColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = tierColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();

      // Memuat gambar item
      let itemImage = null;
      const svgPath = path.join(ASSETS_ITEMS_DIR, `${item.id}.svg`);
      const jpgPath = path.join(ASSETS_ITEMS_DIR, `${item.id}.jpg`);

      try {
        if (fs.existsSync(svgPath)) {
          itemImage = await loadImage(svgPath);
        } else if (fs.existsSync(jpgPath)) {
          itemImage = await loadImage(jpgPath);
        }
      } catch (err) {
        itemImage = null;
      }

      // Render Icon Gambar Item di tengah slot dengan rounded clipping
      const iconX = slotX + Math.floor((layout.slotW - layout.iconSize) / 2);
      const iconY = slotY + (layout.mode === "large" ? 18 : 8);

      if (itemImage) {
        ctx.save();
        roundRect(ctx, iconX, iconY, layout.iconSize, layout.iconSize, 8);
        ctx.clip();
        ctx.drawImage(
          itemImage,
          iconX,
          iconY,
          layout.iconSize,
          layout.iconSize,
        );
        ctx.restore();
      } else {
        // Fallback visual vektor elegan jika file gambar tidak ditemukan
        ctx.save();
        const centerX = slotX + layout.slotW / 2;
        const centerY = iconY + layout.iconSize / 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        roundRect(ctx, iconX, iconY, layout.iconSize, layout.iconSize, 8);
        ctx.fill();
        ctx.strokeStyle = tierColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Gambar simbol kotak pundi vektor
        ctx.fillStyle = tierColor;
        roundRect(ctx, centerX - 10, centerY - 8, 20, 16, 3);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(centerX - 8, centerY - 2, 16, 3);
        ctx.restore();
      }

      // Render Teks Nama Item di bagian bawah slot
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${layout.nameFontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      const maxTextW = layout.slotW - 12;
      const nameText = truncateText(ctx, item.name, maxTextW);
      const nameY = slotY + layout.slotH - (layout.mode === "large" ? 18 : 10);
      ctx.fillText(nameText, slotX + layout.slotW / 2, nameY);
      ctx.restore();

      // Pill Kuantitas Jumlah Barang (contoh: "x2", "x64")
      const qtyText = `x${item.amount}`;
      ctx.save();
      ctx.font = `bold ${layout.qtyFontSize}px MontserratBold, sans-serif`;
      const qtyMetrics = ctx.measureText(qtyText);
      const pillW = qtyMetrics.width + 10;
      const pillH = layout.qtyFontSize + 6;
      const pillX = slotX + layout.slotW - pillW - 6;
      const pillY = slotY + 6;

      // Kotak pill gelap
      roundRect(ctx, pillX, pillY, pillW, pillH, 5);
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.fill();
      ctx.strokeStyle = tierColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Teks kuantitas
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(qtyText, pillX + pillW / 2, pillY + pillH - 4);
      ctx.restore();
    }

    const mimeType = options.format === "webp" ? "image/webp" : "image/png";
    return canvas.toBuffer(mimeType);
  });
}

module.exports = {
  computeGridLayout,
  generateInventoryBackpackImage,
};
