// Lokasi: plugin/canvas/canvasRuntime.js
const fs = require("fs");
const path = require("path");
const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");

// Lazy-loaded properties
let canvasAPI = null;
let isFontsRegistered = false;
let isContextPatched = false;

// Memory cache for loadImage to prevent repeated downloads
const imageCache = new Map();

// Semaphore for concurrency limiting
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.current--;
    }
  }
}

// Batasi konkurensi render hingga 3 bersamaan
const renderSemaphore = new Semaphore(3);

function patchContextPrototype(canvasApi) {
  if (isContextPatched) return;
  try {
    const dummy = canvasApi.createCanvas(1, 1);
    const ctx = dummy.getContext("2d");
    const proto = Object.getPrototypeOf(ctx);
    const origDesc = Object.getOwnPropertyDescriptor(proto, "font");
    if (origDesc && origDesc.set) {
      Object.defineProperty(proto, "font", {
        get: function () {
          return origDesc.get.call(this);
        },
        set: function (val) {
          if (typeof val === "string") {
            let enriched = val;
            if (!enriched.includes("EmojiFont")) {
              if (enriched.includes("sans-serif")) {
                enriched = enriched.replace(
                  "sans-serif",
                  '"EmojiFont", "SymbolFont", sans-serif',
                );
              } else {
                enriched = enriched + ', "EmojiFont", "SymbolFont"';
              }
            } else if (!enriched.includes("SymbolFont")) {
              enriched = enriched.replace(
                "EmojiFont",
                'EmojiFont", "SymbolFont',
              );
            }
            return origDesc.set.call(this, enriched);
          }
          return origDesc.set.call(this, val);
        },
        enumerable: true,
        configurable: true,
      });
    }
    isContextPatched = true;
  } catch (err) {
    logger.warn(
      "[CanvasRuntime] Gagal memasang font fallback patch pada context",
      err,
    );
  }
}

function loadCanvas() {
  if (!canvasAPI) {
    try {
      canvasAPI = require("@napi-rs/canvas");
      patchContextPrototype(canvasAPI);
    } catch (e) {
      logger.error("[CanvasRuntime] Gagal memuat @napi-rs/canvas", e);
      throw e;
    }
  }
  return canvasAPI;
}

function registerFontsOnce() {
  const { GlobalFonts } = loadCanvas();
  if (isFontsRegistered) return;
  try {
    const fontsDir = path.join(__dirname, "../../assets/fonts");
    GlobalFonts.registerFromPath(
      path.join(fontsDir, "Montserrat/Montserrat-Bold.ttf"),
      "MontserratBold",
    );
    GlobalFonts.registerFromPath(
      path.join(fontsDir, "Inter/Inter-Regular.ttf"),
      "Inter",
    );
    GlobalFonts.registerFromPath(
      path.join(fontsDir, "Inter/Inter-Bold.ttf"),
      "InterBold",
    );
    GlobalFonts.registerFromPath(
      path.join(fontsDir, "emoji/NotoColorEmoji.ttf"),
      "EmojiFont",
    );
    GlobalFonts.registerFromPath(
      path.join(fontsDir, "symbols/NotoSansSymbols2-Regular.ttf"),
      "SymbolFont",
    );

    // Registrasi fallback sistem jika tersedia (Windows / Linux)
    const systemFallbacks = [
      { path: "C:/Windows/Fonts/seguiemj.ttf", name: "SystemEmoji" },
      { path: "C:/Windows/Fonts/seguisym.ttf", name: "SystemSymbol" },
      {
        path: "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
        name: "SystemEmojiLinux",
      },
      {
        path: "/usr/share/fonts/noto/NotoColorEmoji.ttf",
        name: "SystemEmojiLinux2",
      },
      {
        path: "/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf",
        name: "SystemEmojiLinux3",
      },
    ];
    for (const sf of systemFallbacks) {
      if (fs.existsSync(sf.path)) {
        try {
          GlobalFonts.registerFromPath(sf.path, sf.name);
        } catch (_) {}
      }
    }

    isFontsRegistered = true;
    logger.info("[CanvasRuntime] Font berhasil diregistrasi.");
  } catch (e) {
    logger.error("[CanvasRuntime] Gagal meregistrasi font lokal", e);
  }
}

/**
 * Custom loadImage function with memory caching.
 * @param {string|Buffer} source - The image source (URL or Buffer).
 * @param {string} cacheKey - Optional custom key for caching.
 * @returns {Promise<Image>}
 */
async function loadCachedImage(source, cacheKey = null) {
  const { loadImage } = loadCanvas();

  // Generate key
  let key = cacheKey;
  if (!key && typeof source === "string") {
    key = source;
  }

  // Check in-memory cache
  if (key && imageCache.has(key)) {
    return imageCache.get(key);
  }

  try {
    const image = await loadImage(source);

    // Cache the loaded image
    if (key) {
      imageCache.set(key, image);
      // Optional: limit cache size to prevent OOM
      if (imageCache.size > 100) {
        const firstKey = imageCache.keys().next().value;
        imageCache.delete(firstKey);
      }
    }
    return image;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  createCanvas: function (...args) {
    registerFontsOnce();
    return loadCanvas().createCanvas(...args);
  },

  GlobalFonts: new Proxy(
    {},
    {
      get: function (target, prop) {
        registerFontsOnce();
        return loadCanvas().GlobalFonts[prop];
      },
    },
  ),

  loadImage: loadCachedImage,

  /**
   * Jalankan task berat Canvas dengan mematuhi batas konkurensi (2-3).
   * @param {Function} task - Fungsi async yang memuat operasi Canvas
   */
  runWithLimit: async function (task) {
    registerFontsOnce();
    await renderSemaphore.acquire();
    try {
      return await task();
    } finally {
      renderSemaphore.release();
    }
  },

  /**
   * Cache hasil render berupa base64 ke Redis
   * @param {string} key - Redis key, misal: "canvas:profile:123"
   * @param {Buffer} buffer - Buffer PNG gambar
   * @param {number} ttl - TTL dalam detik (default 300)
   */
  cacheToRedis: async function (key, buffer, ttl = 300) {
    if (!redisManager.client || !redisManager.client.isReady) return;
    try {
      const base64 = buffer.toString("base64");
      await redisManager.setCache(key, base64, ttl);
    } catch (e) {
      logger.error(`[CanvasRuntime] Gagal cache ke Redis untuk key: ${key}`, e);
    }
  },

  /**
   * Ambil buffer dari cache Redis
   * @param {string} key - Redis key
   * @returns {Promise<Buffer|null>}
   */
  getFromRedis: async function (key) {
    if (!redisManager.client || !redisManager.client.isReady) return null;
    try {
      const base64 = await redisManager.getCache(key);
      if (base64) return Buffer.from(base64, "base64");
      return null;
    } catch (e) {
      logger.error(
        `[CanvasRuntime] Gagal get cache dari Redis untuk key: ${key}`,
        e,
      );
      return null;
    }
  },

  /**
   * Hapus seluruh cache canvas untuk seorang user secara cerdas
   * @param {string} userId - Discord User ID
   */
  smartInvalidateUserCanvas: async function (userId) {
    if (!redisManager.client || !redisManager.client.isReady || !userId) return;
    try {
      const keys = [
        `canvas:profile:${userId}`,
        `canvas:rank:${userId}`,
        `canvas:inventory:${userId}`,
        `canvas:card:${userId}`,
      ];
      await Promise.all(
        keys.map((k) => redisManager.deleteCache(k).catch(() => {})),
      );
      logger.debug(
        `[CanvasRuntime] Smart invalidated canvas cache for user: ${userId}`,
      );
    } catch (e) {
      logger.error(
        `[CanvasRuntime] Gagal invalidate canvas cache untuk user: ${userId}`,
        e,
      );
    }
  },

  /**
   * Eksekusi render di worker thread terpisah
   * @param {string} task
   * @param {any} payload
   * @returns {Promise<any>}
   */
  renderInWorker: async function (task, payload) {
    try {
      const workerPool = require("./canvasWorkerPool");
      return await workerPool.runTask(task, payload);
    } catch (err) {
      logger.warn(
        `[CanvasRuntime] Worker rendering fallback to main thread for task ${task}: ${err.message}`,
      );
      // Fallback to main thread execution if worker failed
      switch (task) {
        case "renderProfile":
          return await require("./profileCanvas").generateProfileCard(payload);
        case "renderBattle":
          return await require("./battleCanvas").renderBattle(payload);
        case "renderNowPlaying":
          return await require("./nowplayingCanvas").renderNowPlayingCard(
            payload,
          );
        case "renderCard":
          return await require("./cardCanvas").renderCard(payload);
        default:
          throw err;
      }
    }
  },
};
