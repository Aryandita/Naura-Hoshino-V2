// Lokasi: plugin/canvas/canvasRuntime.js
const path = require('path');
const redisManager = require('../../src/managers/redisManager');
const { logger } = require('../../src/managers/logger');

// Lazy-loaded properties
let canvasAPI = null;
let isFontsRegistered = false;

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
        return new Promise(resolve => this.queue.push(resolve));
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

function loadCanvas() {
    if (!canvasAPI) {
        try {
            canvasAPI = require('@napi-rs/canvas');
        } catch (e) {
            logger.error('[CanvasRuntime] Gagal memuat @napi-rs/canvas', e);
            throw e;
        }
    }
    return canvasAPI;
}

function registerFontsOnce() {
    const { GlobalFonts } = loadCanvas();
    if (isFontsRegistered) return;
    try {
        const fontsDir = path.join(__dirname, '../../assets/fonts');
        GlobalFonts.registerFromPath(path.join(fontsDir, 'Montserrat/Montserrat-Bold.ttf'), 'MontserratBold');
        GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter/Inter-Regular.ttf'), 'Inter');
        GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter/Inter-Bold.ttf'), 'InterBold');
        GlobalFonts.registerFromPath(path.join(fontsDir, 'emoji/NotoColorEmoji.ttf'), 'EmojiFont');
        isFontsRegistered = true;
        logger.info('[CanvasRuntime] Font berhasil diregistrasi.');
    } catch (e) {
        logger.error('[CanvasRuntime] Gagal meregistrasi font lokal', e);
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
    if (!key && typeof source === 'string') {
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
    get createCanvas() {
        registerFontsOnce();
        return loadCanvas().createCanvas;
    },
    
    get GlobalFonts() {
        registerFontsOnce();
        return loadCanvas().GlobalFonts;
    },

    loadImage: loadCachedImage,

    /**
     * Jalankan task berat Canvas dengan mematuhi batas konkurensi (2-3).
     * @param {Function} task - Fungsi async yang memuat operasi Canvas
     */
    runWithLimit: async function(task) {
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
    cacheToRedis: async function(key, buffer, ttl = 300) {
        if (!redisManager.client || !redisManager.client.isReady) return;
        try {
            const base64 = buffer.toString('base64');
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
    getFromRedis: async function(key) {
        if (!redisManager.client || !redisManager.client.isReady) return null;
        try {
            const base64 = await redisManager.getCache(key);
            if (base64) return Buffer.from(base64, 'base64');
            return null;
        } catch (e) {
            logger.error(`[CanvasRuntime] Gagal get cache dari Redis untuk key: ${key}`, e);
            return null;
        }
    }
};
