"use strict";

/**
 * artworkResolver.js - Modul Resolusi Cover Art Musik & Rendering Cover Presisi
 *
 * Mengoptimalkan resolusi foto musik agar memenuhi frame 1:1 secara rapi,
 * mencari artwork resolusi tinggi 600x600 via iTunes Search API untuk trek
 * YouTube/Lavalink, serta memotong proporsional (object-fit: cover) tanpa distorsi.
 */

const axios = require("axios");

// In-memory cache untuk menampung artwork yang sudah di-resolve (maks 500 entri)
const artworkCache = new Map();
const MAX_CACHE_ENTRIES = 500;

/**
 * Membersihkan judul lagu dari metadata video YouTube agar pencarian album art akurat.
 * @param {string} rawTitle - Judul mentah dari Lavalink/YouTube
 * @returns {string} Judul lagu bersih
 */
function cleanSongTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== "string") return "";

  let title = rawTitle
    .replace(/\(.*?\)/g, "") // Hapus teks dalam tanda kurung (Official Video, MV, dll)
    .replace(/\[.*?\]/g, "") // Hapus teks dalam tanda kurung siku [HD, 4K, dll]
    .replace(/\|.*/g, "") // Hapus pemisah pipa dan teks setelahnya
    .replace(/official\s*(music\s*)?video/gi, "")
    .replace(/official\s*audio/gi, "")
    .replace(/official\s*lyric\s*video/gi, "")
    .replace(/lyric\s*video/gi, "")
    .replace(/audio\s*visualizer/gi, "")
    .replace(/full\s*album/gi, "")
    .replace(/remaster(ed)?/gi, "")
    .replace(/ft\..*$/gi, "")
    .replace(/feat\..*$/gi, "")
    .trim();

  // Jika formatnya "Artis - Judul", ambil bagian judul lagunya
  if (title.includes(" - ")) {
    const parts = title.split(" - ");
    if (parts.length >= 2 && parts[1].trim()) {
      title = parts[1].trim();
    }
  }

  return title.trim();
}

/**
 * Mencari URL cover art beresolusi tinggi (600x600) berformat 1:1 resmi.
 * @param {Object} track - Objek track dari Poru/Lavalink
 * @param {string} [clientAvatar=null] - Avatar bot fallback
 * @returns {Promise<string|null>} URL cover art terbaik
 */
async function resolveHighResArtwork(track, clientAvatar = null) {
  if (!track || !track.info) return clientAvatar;

  const title = track.info.title || "";
  const author = track.info.author || "";
  const source = String(
    track.info.originalSource || track.info.sourceName || "youtube",
  ).toLowerCase();

  // 1. Jika track berasal dari Spotify/Apple Music yang sudah membawa cover 1:1 asli
  const directImage = track.info.image || track.info.thumbnail;
  if (
    directImage &&
    (source.includes("spotify") || source.includes("apple")) &&
    !directImage.includes("ytimg.com")
  ) {
    return directImage;
  }

  // Cek cache
  const cacheKey = `${author}:::${title}`;
  if (artworkCache.has(cacheKey)) {
    return artworkCache.get(cacheKey);
  }

  // 2. Coba cari artwork resmi via iTunes Search API
  const cleanTitle = cleanSongTitle(title);
  const cleanAuthor = author
    .replace(/ - Topic$/i, "")
    .replace(/VEVO$/i, "")
    .trim();

  const searchQuery = `${cleanAuthor} ${cleanTitle}`.trim();
  if (searchQuery.length >= 2) {
    try {
      const resp = await axios.get("https://itunes.apple.com/search", {
        params: {
          term: searchQuery,
          entity: "song",
          limit: 1,
        },
        timeout: 2200,
      });

      if (resp.data && Array.isArray(resp.data.results) && resp.data.results.length > 0) {
        const item = resp.data.results[0];
        if (item.artworkUrl100) {
          // Ganti resolusi dari 100x100 menjadi 600x600 HD 1:1
          const hiResArt = item.artworkUrl100.replace("100x100bb", "600x600bb");
          if (artworkCache.size >= MAX_CACHE_ENTRIES) {
            const firstKey = artworkCache.keys().next().value;
            artworkCache.delete(firstKey);
          }
          artworkCache.set(cacheKey, hiResArt);
          return hiResArt;
        }
      }
    } catch (_) {
      // Abaikan kegagalan jaringan iTunes dan lanjut ke fallback
    }
  }

  // 3. Fallback YouTube maxres / hqdefault
  const ytId = track.info.identifier;
  if (ytId && source.includes("youtube")) {
    const maxResUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    try {
      const headCheck = await axios.head(maxResUrl, { timeout: 1500 });
      if (headCheck.status === 200) {
        artworkCache.set(cacheKey, maxResUrl);
        return maxResUrl;
      }
    } catch (_) {
      // maxres tidak tersedia, gunakan direct image atau hqdefault
    }
  }

  const fallbackUrl =
    directImage ||
    (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : clientAvatar);

  if (fallbackUrl) {
    artworkCache.set(cacheKey, fallbackUrl);
  }

  return fallbackUrl || clientAvatar;
}

/**
 * Menggambar gambar pada canvas dengan mode object-fit: cover
 * Memastikan foto musik memenuhi frame 100% tanpa distorsi (aspect-ratio terjaga).
 *
 * @param {CanvasRenderingContext2D} ctx - Konteks canvas 2D
 * @param {Image} img - Objek gambar yang sudah dimuat (Image/Canvas)
 * @param {number} dx - Koordinat X sudut kiri atas frame
 * @param {number} dy - Koordinat Y sudut kiri atas frame
 * @param {number} dw - Lebar frame tujuan
 * @param {number} dh - Tinggi frame tujuan
 * @param {number} [radius=0] - Sudut lengkung (border radius)
 */
function drawImageCover(ctx, img, dx, dy, dw, dh, radius = 0) {
  if (!ctx || !img) return;

  const imgW = img.naturalWidth || img.width || dw;
  const imgH = img.naturalHeight || img.height || dh;

  // Hitung skala berdasarkan sisi yang membutuhkan perbesaran terbesar
  const scale = Math.max(dw / imgW, dh / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;

  // Posisikan gambar di tengah (center-crop)
  const offsetX = dx + (dw - renderW) / 2;
  const offsetY = dy + (dh - renderH) / 2;

  ctx.save();
  ctx.beginPath();
  if (radius > 0) {
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(dx, dy, dw, dh, radius);
    } else {
      // Manual rounded rectangle fallback
      ctx.moveTo(dx + radius, dy);
      ctx.lineTo(dx + dw - radius, dy);
      ctx.quadraticCurveTo(dx + dw, dy, dx + dw, dy + radius);
      ctx.lineTo(dx + dw, dy + dh - radius);
      ctx.quadraticCurveTo(dx + dw, dy + dh, dx + dw - radius, dy + dh);
      ctx.lineTo(dx + radius, dy + dh);
      ctx.quadraticCurveTo(dx, dy + dh, dx, dy + dh - radius);
      ctx.lineTo(dx, dy + radius);
      ctx.quadraticCurveTo(dx, dy, dx + radius, dy);
      ctx.closePath();
    }
  } else {
    ctx.rect(dx, dy, dw, dh);
  }
  ctx.clip();

  ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  ctx.restore();
}

module.exports = {
  cleanSongTitle,
  resolveHighResArtwork,
  drawImageCover,
};
