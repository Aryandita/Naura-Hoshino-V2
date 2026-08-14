"use strict";

// ==========================================
// INTI DOWNLOADER
// ==========================================
// Berisi hal-hal yang dipakai semua provider: konstanta, pembersih berkas
// sementara, cache hasil, deteksi platform, header unduhan, dan validasi
// content-type. Validasi inilah yang mencegah banner situs pihak ketiga
// terkirim sebagai hasil unduhan.

const https = require("https");
const fs = require("fs");
const axios = require("axios");
const { logger } = require("../managers/logger");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_ATTACHMENTS = 10;
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const NULL_DEVICE = process.platform === "win32" ? "NUL" : "/dev/null";

const QUALITY_CHOICES = [
  { name: "Otomatis (Kualitas Tertinggi)", value: "auto" },
  { name: "1080p (Full HD)", value: "1080" },
  { name: "720p (HD)", value: "720" },
  { name: "480p (SD)", value: "480" },
  { name: "360p", value: "360" },
  { name: "240p (Terkecil)", value: "240" },
];

const RESOLUTION_OPTIONS = [
  {
    label: "720p (HD)",
    description: "Kualitas tinggi, ukuran lebih besar",
    value: "720",
    emoji: "\uD83C\uDFAC",
  },
  {
    label: "480p (SD)",
    description: "Kualitas seimbang",
    value: "480",
    emoji: "\uD83D\uDCFA",
  },
  {
    label: "360p",
    description: "Ukuran lebih kecil, cocok buat video panjang",
    value: "360",
    emoji: "\uD83D\uDCF1",
  },
  {
    label: "240p (Terkecil)",
    description: "Paling kecil, kualitas paling rendah",
    value: "240",
    emoji: "\uD83D\uDDDC\uFE0F",
  },
];

// ==========================================
// PEMBERSIH BERKAS SEMENTARA
// ==========================================

class CleanupManager {
  constructor() {
    /** @type {Set<string>} */
    this.files = new Set();
  }

  track(filePath) {
    if (filePath) this.files.add(filePath);
  }

  trackAll(filePaths) {
    if (Array.isArray(filePaths)) filePaths.forEach((f) => this.track(f));
  }

  async cleanup() {
    for (const f of this.files) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (e) {
        logger.error(
          `[CleanupManager] Gagal hapus berkas sementara: ${f} - ${e.message}`,
        );
      }
    }
    this.files.clear();
  }

  cleanupPasslog(passlogPrefix) {
    for (const ext of [".log", ".log.mbtree"]) {
      const logFile = `${passlogPrefix}${ext}`;
      try {
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
      } catch {
        /* abaikan */
      }
    }
  }
}

// ==========================================
// CACHE HASIL
// ==========================================
// Hasil hanya disimpan setelah lolos validasi. Menyimpan hasil cacat berarti
// mengulang kesalahan yang sama selama lima menit penuh.

const urlCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of urlCache.entries()) {
      if (now - val.timestamp >= CACHE_TTL) urlCache.delete(key);
    }
  },
  10 * 60 * 1000,
);

const getCachedResult = (url) => {
  const cached = urlCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info(`[Downloader] Cache HIT: ${url.substring(0, 60)}...`);
    return cached.data;
  }
  if (cached) urlCache.delete(url);
  return null;
};

const setCachedResult = (url, data) => {
  urlCache.set(url, { data, timestamp: Date.now() });
  if (urlCache.size > MAX_CACHE_ENTRIES) {
    const oldest = urlCache.keys().next().value;
    urlCache.delete(oldest);
  }
};

const dropCachedResult = (url) => urlCache.delete(url);

// ==========================================
// DETEKSI PLATFORM
// ==========================================

const detectPlatform = (url) => {
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("facebook.com") || url.includes("fb.watch"))
    return "facebook";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("pinterest.com") || url.includes("pin.it"))
    return "pinterest";
  if (url.includes("reddit.com") || url.includes("redd.it")) return "reddit";
  if (url.includes("threads.net") || url.includes("threads.com"))
    return "threads";
  if (url.includes("linkedin.com")) return "linkedin";
  if (
    url.includes("vk.com") ||
    url.includes("vk.ru") ||
    url.includes("vkvideo.ru")
  )
    return "vk";
  if (url.includes("douyin.com") || url.includes("iesdouyin.com"))
    return "douyin";
  if (url.includes("bilibili.com") || url.includes("b23.tv")) return "bilibili";
  return "other";
};

const mimeToExt = (mimeType = "") => {
  const map = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/x-matroska": "mkv",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/heic": "heic",
  };
  const base = String(mimeType).split(";")[0].trim().toLowerCase();
  return map[base] || null;
};

const getMediaDownloadHeaders = (platform) => {
  const refererMap = {
    tiktok: "https://www.tiktok.com/",
    instagram: "https://www.instagram.com/",
    twitter: "https://twitter.com/",
    facebook: "https://www.facebook.com/",
    pinterest: "https://www.pinterest.com/",
    reddit: "https://www.reddit.com/",
    threads: "https://www.threads.net/",
    linkedin: "https://www.linkedin.com/",
    vk: "https://vk.com/",
    douyin: "https://www.douyin.com/",
    bilibili: "https://www.bilibili.com/",
  };
  const headers = { "User-Agent": UA };
  if (refererMap[platform]) headers["Referer"] = refererMap[platform];
  return headers;
};

const resolveShortUrl = async (url) => {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 5,
      httpsAgent,
      headers: { "User-Agent": UA },
    });
    return res.request?.res?.responseUrl || url;
  } catch (e) {
    logger.info(
      `[Downloader] Gagal resolve short URL, pakai URL asli: ${e.message}`,
    );
    return url;
  }
};

// ==========================================
// VALIDASI CONTENT-TYPE
// ==========================================
// Situs downloader pihak ketiga sering menyelipkan logo dan banner miliknya
// sendiri di halaman hasil. Semua tautan wajib melewati pemeriksaan ini.

const BRANDING_HOST_PATTERN =
  /(snapsave|savefrom|ssstik|sfrom|snapinsta|publer|agatz|igram|fastdl|downloader)/i;
const MEDIA_TYPE_PATTERN = /^(video|image|audio|application\/octet-stream)/i;

/** Tautan dari host milik situs downloader tidak pernah dianggap media asli. */
const isBrandingHost = (link) => {
  try {
    return BRANDING_HOST_PATTERN.test(new URL(link).hostname);
  } catch {
    return true;
  }
};

/**
 * Periksa satu tautan lewat HEAD, lalu Range 0-0 bila HEAD ditolak.
 * @returns {Promise<{ ok: boolean, contentType: string, sizeBytes: number }>}
 */
const probeUrl = async (link, platform) => {
  const headers = getMediaDownloadHeaders(platform);
  const readFrom = (res, isRange) => {
    const contentType = res.headers["content-type"] || "";
    let sizeBytes = 0;
    if (isRange) {
      const total = String(res.headers["content-range"] || "").match(/\/(\d+)/);
      if (total) sizeBytes = parseInt(total[1], 10);
    } else if (res.headers["content-length"]) {
      sizeBytes = parseInt(res.headers["content-length"], 10);
    }
    return { ok: MEDIA_TYPE_PATTERN.test(contentType), contentType, sizeBytes };
  };

  try {
    const res = await axios.head(link, { timeout: 8000, httpsAgent, headers });
    return readFrom(res, false);
  } catch {
    try {
      const res = await axios.get(link, {
        timeout: 6000,
        httpsAgent,
        headers: { ...headers, Range: "bytes=0-0" },
        validateStatus: () => true,
      });
      return readFrom(res, true);
    } catch {
      return { ok: false, contentType: "", sizeBytes: 0 };
    }
  }
};

module.exports = {
  UA,
  MAX_ATTACHMENTS,
  httpsAgent,
  NULL_DEVICE,
  QUALITY_CHOICES,
  RESOLUTION_OPTIONS,
  CleanupManager,
  getCachedResult,
  setCachedResult,
  dropCachedResult,
  detectPlatform,
  mimeToExt,
  getMediaDownloadHeaders,
  resolveShortUrl,
  isBrandingHost,
  probeUrl,
  MEDIA_TYPE_PATTERN,
};
