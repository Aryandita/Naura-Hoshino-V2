const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    AttachmentBuilder, StringSelectMenuBuilder, ComponentType
} = require('discord.js');
const { logger } = require('../../src/managers/logger');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ui = require('../../src/config/ui');
const RateLimiter = require('../../src/utils/rateLimiter');
const { buildContainerV2, buildErrorContainerV2, buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { resolveInstagram, isInstagramCdn } = require('./downloaderInstagram');

// ==========================================
// 🎬 YT-DLP & FFMPEG IMPORTS
// ==========================================
const YTDlpWrap = require('yt-dlp-wrap').default;
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

/**
 * Resolves the path to the FFmpeg binary dynamically across local and hosting environments.
 * Checks process.env.FFMPEG_PATH -> ffmpeg-static (with chmod +x) -> system paths -> 'ffmpeg' CLI.
 * @returns {string} Resolved executable path.
 */
function resolveFfmpegPath() {
    // 1. Check custom environment variable
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
        return process.env.FFMPEG_PATH;
    }

    // 2. Check npm ffmpeg-static binary
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        // Ensure executable permissions on Linux/Pterodactyl container
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(ffmpegStatic, 0o755);
            } catch (e) {
                // Ignore permission error if file is already executable or read-only
            }
        }
        return ffmpegStatic;
    }

    // 3. Check common Linux/Unix system binary paths
    const systemPaths = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/snap/bin/ffmpeg',
        'C:\\ffmpeg\\bin\\ffmpeg.exe'
    ];
    for (const sysPath of systemPaths) {
        if (fs.existsSync(sysPath)) {
            return sysPath;
        }
    }

    // 4. Default fallback to system CLI executable
    return 'ffmpeg';
}

const activeFfmpegPath = resolveFfmpegPath();
if (activeFfmpegPath) {
    try {
        ffmpeg.setFfmpegPath(activeFfmpegPath);
    } catch (e) {}
}

// ==========================================
// 📦 KONFIGURASI & KONSTANTA
// ==========================================

const MAX_ATTACHMENTS = 10;
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Null device platform-aware untuk FFmpeg pass 1
const NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null';

// Opsi resolusi untuk kompresi manual / pilih kualitas sebelum download
const QUALITY_CHOICES = [
    { name: '🔍 Otomatis (Kualitas Tertinggi)', value: 'auto' },
    { name: '🎬 1080p (Full HD)', value: '1080' },
    { name: '📹 720p (HD)', value: '720' },
    { name: '📺 480p (SD)', value: '480' },
    { name: '📱 360p', value: '360' },
    { name: '🗜️ 240p (Terkecil)', value: '240' },
];

const RESOLUTION_OPTIONS = [
    { label: '720p (HD)', description: 'Kualitas tinggi, ukuran lebih besar', value: '720', emoji: '🎬' },
    { label: '480p (SD)', description: 'Kualitas seimbang', value: '480', emoji: '📺' },
    { label: '360p', description: 'Ukuran lebih kecil, cocok buat video panjang', value: '360', emoji: '📱' },
    { label: '240p (Terkecil)', description: 'Paling kecil, kualitas paling rendah', value: '240', emoji: '🗜️' },
];

// ==========================================
// 🛡️ SANITASI HASIL PROVIDER
// ==========================================
// Bug lama: untuk tautan reel Instagram, scraper SnapSave memungut SEMUA
// tautan gambar pada halaman hasilnya — termasuk logo & tombol milik situs
// itu sendiri. Akibatnya bot mengirim dua gambar branding ("SnapSave.App")
// alih-alih video yang diminta.
//
// Lapisan sanitasi di bawah ini berlaku untuk SEMUA provider:
//   1. Host media wajib lolos allowlist CDN platform (jika platform dikenal).
//   2. Host situs downloader pihak ketiga selalu ditolak.
//   3. Nama berkas yang berbau aset situs (logo/banner/icon/dll) ditolak.
//   4. Jika tautan jelas berupa video (reel, tv, shorts, dsb) maka hasil
//      yang hanya berisi foto dianggap GAGAL, sehingga rantai provider
//      lanjut ke kandidat berikutnya.

const PLATFORM_MEDIA_HOST_PATTERNS = {
    instagram: /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i,
    tiktok: /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|tiktokv\.com|tiktokvcdn\.com|muscdn\.com|byteicdn\.com|ibyteimg\.com|tikwm\.com|tikcdn\.io|akamaized\.net)$/i,
    twitter: /(^|\.)(twimg\.com|twitter\.com|x\.com)$/i,
    facebook: /(^|\.)(fbcdn\.net|facebook\.com|fbsbx\.com)$/i,
    douyin: /(^|\.)(douyinpic\.com|douyinvod\.com|byteicdn\.com|iesdouyin\.com|tiktokcdn\.com|tikwm\.com|akamaized\.net)$/i,
};

// Host situs downloader pihak ketiga: hanya berisi aset halaman, bukan media.
const BRANDING_ASSET_HOST_PATTERN = /(^|\.)(snapsave\.app|snapsave\.io|snapinsta\.app|snapinsta\.io|savefrom\.net|sf-tools\.com|ssstik\.io|igram\.io|y2mate\.com|9convert\.com|twitsave\.com|downloadgram\.org|fbdownloader\.app)$/i;

// Nama berkas yang jelas merupakan aset situs, bukan media unduhan.
const BRANDING_ASSET_NAME_PATTERN = /(logo|favicon|sprite|banner|placeholder|watermark|brand|btn[-_]|button|download[-_]?icon|icon[-_])/i;

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'svg'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm3u8'];

/**
 * Ambil ekstensi dari path sebuah URL (tanpa query string).
 * @param {string} link
 * @returns {string}
 */
const getUrlExtension = (link) => {
    try {
        return path.extname(new URL(link).pathname).replace('.', '').toLowerCase();
    } catch {
        return '';
    }
};

/**
 * Deteksi apakah tautan yang dikirim user memang mengarah ke VIDEO.
 * Dipakai untuk menolak hasil provider yang cuma memberi foto/thumbnail.
 * @param {string} url
 * @returns {boolean}
 */
const isVideoExpected = (url) => {
    const lower = String(url).toLowerCase();
    if (/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|tv)\//.test(lower)) return true;
    if (lower.includes('tiktok.com') && !lower.includes('/photo/')) return true;
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return true;
    if (lower.includes('fb.watch') || lower.includes('/videos/') || lower.includes('/reel/')) return true;
    if (lower.includes('douyin.com') || lower.includes('bilibili.com') || lower.includes('b23.tv')) return true;
    if (lower.includes('vkvideo.ru') || lower.includes('/video-') || lower.includes('/video/')) return true;
    if (lower.includes('/shorts/')) return true;
    return false;
};

/**
 * Validasi satu tautan media hasil provider.
 * @param {string} link
 * @param {string} platform
 * @returns {boolean}
 */
const isAcceptableMediaUrl = (link, platform) => {
    if (typeof link !== 'string' || !link.startsWith('http')) return false;

    let hostname = '';
    try {
        hostname = new URL(link).hostname;
    } catch {
        return false;
    }

    // Tolak aset milik situs downloader pihak ketiga
    if (BRANDING_ASSET_HOST_PATTERN.test(hostname)) return false;

    // Tolak nama berkas yang jelas aset halaman (logo, ikon, banner, dll)
    const ext = getUrlExtension(link);
    if (ext === 'svg') return false;
    if (BRANDING_ASSET_NAME_PATTERN.test(link.split('?')[0])) return false;

    // Allowlist host CDN untuk platform yang sudah dikenal
    if (platform === 'instagram') return isInstagramCdn(link);

    const allowPattern = PLATFORM_MEDIA_HOST_PATTERNS[platform];
    if (allowPattern) return allowPattern.test(hostname);

    return true;
};

/**
 * Lengkapi tipe media (video/photo) berdasarkan ekstensi URL bila provider
 * tidak menyertakannya.
 * @param {{url: string, type?: string}} item
 * @returns {string}
 */
const inferMediaType = (item) => {
    if (item.type === 'video' || item.type === 'gif') return 'video';
    if (item.type === 'photo' || item.type === 'image') return 'photo';
    const ext = getUrlExtension(item.url);
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'photo';
    return 'unknown';
};

/**
 * Saring hasil provider sebelum dipakai/di-cache.
 * Mengembalikan null bila hasilnya tidak layak, agar rantai provider lanjut.
 *
 * @param {object|null} result - Hasil mentah provider
 * @param {string} platform - Platform hasil deteksi
 * @param {boolean} expectVideo - Apakah tautan user berupa video
 * @param {string} providerName - Nama provider (untuk log)
 * @returns {object|null}
 */
const sanitizeProviderResult = (result, platform, expectVideo, providerName = 'provider') => {
    if (!result) return null;

    // Berkas lokal hasil yt-dlp sudah pasti media asli
    if (result.isLocalFile) return result;

    if (result.status === 'picker' && Array.isArray(result.picker)) {
        let items = result.picker
            .filter(item => item && isAcceptableMediaUrl(item.url, platform))
            .map(item => ({ url: item.url, type: inferMediaType(item) }));

        if (items.length === 0) {
            logger.info(`[Downloader] 🛡️ Hasil ${providerName} ditolak: tidak ada media sah (kemungkinan aset situs downloader).`);
            return null;
        }

        if (expectVideo) {
            const videoItems = items.filter(item => item.type === 'video');
            if (videoItems.length > 0) {
                items = videoItems;
            } else if (items.every(item => item.type === 'photo')) {
                logger.info(`[Downloader] 🛡️ Hasil ${providerName} ditolak: tautan berupa video tapi provider hanya memberi foto.`);
                return null;
            }
        }

        return items.length === 1
            ? { status: 'stream', url: items[0].url }
            : { status: 'picker', picker: items.slice(0, MAX_ATTACHMENTS) };
    }

    if (result.url) {
        if (!isAcceptableMediaUrl(result.url, platform)) {
            logger.info(`[Downloader] 🛡️ Hasil ${providerName} ditolak: host media tidak sah (${result.url.substring(0, 80)}).`);
            return null;
        }

        if (expectVideo && IMAGE_EXTENSIONS.includes(getUrlExtension(result.url))) {
            logger.info(`[Downloader] 🛡️ Hasil ${providerName} ditolak: tautan video tapi yang didapat berkas gambar.`);
            return null;
        }

        return result;
    }

    return null;
};

// ==========================================
// 🧹 CLEANUP MANAGER
// ==========================================
// Mengelola seluruh file sementara yang dibuat selama proses download/kompresi.
// Menjamin semua file dibersihkan bahkan saat terjadi error di tengah proses.

class CleanupManager {
    constructor() {
        /** @type {Set<string>} */
        this.files = new Set();
    }

    /**
     * Daftarkan file ke cleanup manager
     * @param {string} filePath
     */
    track(filePath) {
        if (filePath) this.files.add(filePath);
    }

    /**
     * Daftarkan banyak file sekaligus
     * @param {string[]} filePaths
     */
    trackAll(filePaths) {
        if (Array.isArray(filePaths)) filePaths.forEach(f => this.track(f));
    }

    /**
     * Hapus semua file yang sudah terdaftar
     */
    async cleanup() {
        for (const f of this.files) {
            try {
                if (fs.existsSync(f)) fs.unlinkSync(f);
            } catch (e) {
                logger.error(`[CleanupManager] Gagal hapus file sementara: ${f} — ${e.message}`);
            }
        }
        this.files.clear();
    }

    /**
     * Hapus file passlog FFmpeg (*.log + *.log.mbtree) dengan prefix tertentu
     * @param {string} passlogPrefix
     */
    cleanupPasslog(passlogPrefix) {
        for (const ext of ['.log', '.log.mbtree']) {
            const logFile = `${passlogPrefix}${ext}`;
            try {
                if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
            } catch { /* abaikan */ }
        }
    }
}

// ==========================================
// 💾 IN-MEMORY CACHE
// ==========================================
// Cache hasil download URL selama 5 menit agar URL yang sama
// tidak perlu dipanggil ulang — mengurangi rate limit secara drastis.
// CATATAN: hanya hasil yang sudah lolos sanitasi yang boleh masuk cache.

const urlCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 menit
const MAX_CACHE_ENTRIES = 100;

// Bersihkan entry cache yang expired setiap 10 menit (memory safety)
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of urlCache.entries()) {
        if (now - val.timestamp >= CACHE_TTL) urlCache.delete(key);
    }
}, 10 * 60 * 1000);

// Cache daftar Cobalt instances selama 10 menit
const cobaltInstanceCache = { instances: [], lastFetch: 0 };
const INSTANCE_CACHE_TTL = 10 * 60 * 1000; // 10 menit

/**
 * Ambil hasil dari cache jika masih valid (TTL belum expired)
 * @param {string} url
 * @returns {object|null}
 */
const getCachedResult = (url) => {
    const cached = urlCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.info(`[Downloader] ✅ Cache HIT untuk: ${url.substring(0, 60)}...`);
        return cached.data;
    }
    if (cached) urlCache.delete(url);
    return null;
};

/**
 * Simpan hasil ke cache dengan timestamp
 * @param {string} url
 * @param {object} data
 */
const setCachedResult = (url, data) => {
    urlCache.set(url, { data, timestamp: Date.now() });
    if (urlCache.size > MAX_CACHE_ENTRIES) {
        const oldest = urlCache.keys().next().value;
        urlCache.delete(oldest);
    }
};

// ==========================================
// 🔍 DETEKSI PLATFORM
// ==========================================

/**
 * Mendeteksi platform dari URL
 * @param {string} url
 * @returns {string}
 */
const detectPlatform = (url) => {
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest';
    if (url.includes('reddit.com') || url.includes('redd.it')) return 'reddit';
    if (url.includes('threads.net') || url.includes('threads.com')) return 'threads';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('vk.com') || url.includes('vk.ru') || url.includes('vkvideo.ru')) return 'vk';
    if (url.includes('douyin.com') || url.includes('iesdouyin.com')) return 'douyin';
    if (url.includes('bilibili.com') || url.includes('b23.tv')) return 'bilibili';
    return 'other';
};

// ==========================================
// 🔧 HELPER: MIME Type → Ekstensi File
// ==========================================

const mimeToExt = (mimeType = '') => {
    const map = {
        'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
        'video/x-msvideo': 'avi', 'video/x-matroska': 'mkv',
        'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
        'image/gif': 'gif', 'image/bmp': 'bmp', 'image/heic': 'heic',
    };
    const base = mimeType.split(';')[0].trim().toLowerCase();
    return map[base] || null;
};

// ==========================================
// 🧢 HELPER: Header Download per Platform
// ==========================================

const getMediaDownloadHeaders = (platform) => {
    const baseUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const refererMap = {
        tiktok: 'https://www.tiktok.com/',
        instagram: 'https://www.instagram.com/',
        twitter: 'https://twitter.com/',
        facebook: 'https://www.facebook.com/',
        pinterest: 'https://www.pinterest.com/',
        reddit: 'https://www.reddit.com/',
        threads: 'https://www.threads.net/',
        linkedin: 'https://www.linkedin.com/',
        vk: 'https://vk.com/',
        douyin: 'https://www.douyin.com/',
        bilibili: 'https://www.bilibili.com/',
    };
    const headers = { 'User-Agent': baseUA };
    if (refererMap[platform]) headers['Referer'] = refererMap[platform];
    return headers;
};

// ==========================================
// 🔗 UTILITAS: Resolve Short URL
// ==========================================

const resolveShortUrl = async (url) => {
    try {
        const res = await axios.get(url, {
            timeout: 8000,
            maxRedirects: 5,
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        return res.request?.res?.responseUrl || url;
    } catch (e) {
        logger.info(`[Downloader] Gagal resolve short URL, pakai URL asli: ${e.message}`);
        return url;
    }
};

// ==========================================
// 📸 PROVIDER: Instagram Resmi (downloaderInstagram.js)
// ==========================================
// Provider utama untuk Instagram: GraphQL publik → embed resmi → pengalih.
// Semua tautan hasilnya wajib berasal dari CDN Instagram/Facebook.

const tryInstagramNative = async (url) => resolveInstagram(url);

// ==========================================
// 🎵 PROVIDER: TikTok — Tikwm API
// ==========================================
// Tikwm adalah API gratis khusus TikTok yang sangat stabil.
// Mendukung video single dan slideshow (images) tanpa watermark.

const tryTikwm = async (url) => {
    if (!url.includes('tiktok.com') && !url.includes('douyin.com')) return null;
    try {
        logger.info('[Downloader] Mencoba Tikwm API...');
        const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
            timeout: 10000
        });
        if (response.data && response.data.code === 0 && response.data.data) {
            const d = response.data.data;
            if (d.play) {
                return { status: 'stream', url: d.play.startsWith('http') ? d.play : `https://www.tikwm.com${d.play}` };
            }
            if (d.images && d.images.length > 0) {
                return {
                    status: 'picker',
                    picker: d.images.map(img => ({ url: img, type: 'photo' }))
                };
            }
        }
    } catch (e) {
        logger.error(`[Downloader] Tikwm API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 📱 PROVIDER: SnapSave (KHUSUS TikTok)
// ==========================================
// PENTING: SnapSave TIDAK LAGI dipakai untuk Instagram.
// Scraper-nya memungut semua tautan gambar di halaman hasil — termasuk logo
// dan tombol milik situsnya sendiri — sehingga reel video dikirim sebagai
// dua gambar branding. Instagram sekarang ditangani downloaderInstagram.js.
// Untuk TikTok pun setiap tautan wajib lolos filter host & nama aset.

const trySnapSave = async (url) => {
    if (!url.includes('tiktok.com')) return null;

    try {
        logger.info('[Downloader] Mencoba SnapSave untuk TikTok...');

        // Ambil token CSRF dari halaman utama
        const mainPage = await axios.get('https://snapsave.app/', {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
        });

        const tokenMatch = mainPage.data.match(/name="token"\s+value="([^"]+)"/);
        const token = tokenMatch ? tokenMatch[1] : '';

        const formData = new URLSearchParams();
        formData.append('url', url);
        formData.append('token', token);

        const response = await axios.post('https://snapsave.app/action/', formData.toString(), {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://snapsave.app/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Origin': 'https://snapsave.app',
            }
        });

        const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        // Hanya terima tautan media TikTok yang sah (bukan aset situs SnapSave)
        const videoMatches = [...html.matchAll(/href="(https:\/\/[^"]+\.mp4[^"]*)"/g)]
            .map(m => m[1])
            .filter(link => isAcceptableMediaUrl(link, 'tiktok'));

        if (videoMatches.length > 0) {
            if (videoMatches.length === 1) return { status: 'stream', url: videoMatches[0] };
            return { status: 'picker', picker: videoMatches.map(u => ({ url: u, type: 'video' })) };
        }

        const imageMatches = [...html.matchAll(/href="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g)]
            .map(m => m[1])
            .filter(link => isAcceptableMediaUrl(link, 'tiktok'));

        if (imageMatches.length > 0) {
            if (imageMatches.length === 1) return { status: 'stream', url: imageMatches[0] };
            return { status: 'picker', picker: imageMatches.map(u => ({ url: u, type: 'photo' })) };
        }
    } catch (e) {
        logger.error(`[Downloader] SnapSave API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 🎵 PROVIDER: SSSTik (TikTok Fallback)
// ==========================================

const trySSSAPI = async (url) => {
    if (!url.includes('tiktok.com')) return null;
    try {
        logger.info('[Downloader] Mencoba SSSTik API...');

        // Dapatkan token dari halaman utama
        const homePage = await axios.get('https://ssstik.io/', {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
        });
        const ttMatch = homePage.data.match(/id="([a-zA-Z0-9_]+)"\s+value="([a-zA-Z0-9_]+)"/);
        const formData = new URLSearchParams();
        formData.append('id', url);
        formData.append('locale', 'id');
        formData.append('tt', ttMatch ? ttMatch[2] : 'a');

        const response = await axios.post('https://ssstik.io/abc?url=dl', formData.toString(), {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://ssstik.io/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'HX-Request': 'true',
                'HX-Current-URL': 'https://ssstik.io/',
            }
        });

        const html = response.data;
        // Cari link video no-watermark (biasanya berisi "Without watermark" atau "HD")
        const noWmMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*(?:Without watermark|HD)/i);
        if (noWmMatch && noWmMatch[1]) {
            return { status: 'stream', url: noWmMatch[1] };
        }

        // Fallback: ambil link mp4 pertama
        const anyMp4 = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
        if (anyMp4 && anyMp4[1]) {
            return { status: 'stream', url: anyMp4[1] };
        }
    } catch (e) {
        logger.error(`[Downloader] SSSTik API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 💾 PROVIDER: SaveFrom (Multi-Platform)
// ==========================================

const trySaveFrom = async (url) => {
    const supportedDomains = ['instagram.com', 'facebook.com', 'fb.watch', 'youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com'];
    if (!supportedDomains.some(d => url.includes(d))) return null;

    try {
        logger.info('[Downloader] Mencoba SaveFrom API...');

        const query = new URLSearchParams({
            app: 'sf',
            lang: 'id',
            opertype: 'user_collection',
            url: url
        });
        const apiUrl = `https://worker.sf-tools.com/savefrom?${query.toString()}`;

        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://en.savefrom.net/',
                'Origin': 'https://en.savefrom.net'
            }
        });

        const data = response.data;
        if (!data || data.error) return null;

        // Format respons: { url: [...] } dimana setiap item punya .url dan .quality
        const urlList = data.url;
        if (!Array.isArray(urlList) || urlList.length === 0) return null;

        // Pilih kualitas tertinggi (biasanya item pertama setelah sort)
        const sorted = urlList
            .filter(item => item.url && typeof item.url === 'string' && item.url.startsWith('http'))
            .sort((a, b) => {
                const qa = parseInt(a.quality) || 0;
                const qb = parseInt(b.quality) || 0;
                return qb - qa; // Tertinggi dulu
            });

        if (sorted.length === 0) return null;

        const best = sorted[0];
        return { status: 'stream', url: best.url };
    } catch (e) {
        logger.error(`[Downloader] SaveFrom API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 🐦 PROVIDER: FxTwitter (untuk X/Twitter)
// ==========================================

const tryFxTwitter = async (url) => {
    if (!url.includes('twitter.com') && !url.includes('x.com')) return null;
    try {
        const urlObj = new URL(url);
        const tweetPath = urlObj.pathname;
        if (!tweetPath || !tweetPath.includes('/status/')) return null;

        const apiUrl = `https://api.fxtwitter.com${tweetPath}`;
        logger.info('[Downloader] Mencoba FxTwitter API...');

        const response = await axios.get(apiUrl, {
            headers: { 'User-Agent': 'NauraBot/2.0' },
            timeout: 10000
        });

        if (response.data && response.data.code === 200 && response.data.tweet) {
            const tweet = response.data.tweet;
            const media = tweet.media;
            if (!media) return null;

            const allMedia = media.all || [];
            const videos = media.videos || [];
            const photos = media.photos || [];
            let mediaItems = allMedia;
            if (mediaItems.length === 0) mediaItems = [...videos, ...photos];
            if (mediaItems.length === 0) return null;

            if (mediaItems.length === 1) return { status: 'stream', url: mediaItems[0].url };
            return {
                status: 'picker',
                picker: mediaItems.map(item => ({ url: item.url, type: item.type === 'video' ? 'video' : 'photo' }))
            };
        }
    } catch (e) {
        logger.error(`[Downloader] FxTwitter API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 🐦 PROVIDER: VxTwitter (fallback FxTwitter)
// ==========================================

const tryVxTwitter = async (url) => {
    if (!url.includes('twitter.com') && !url.includes('x.com')) return null;
    try {
        const urlObj = new URL(url);
        const tweetPath = urlObj.pathname;
        if (!tweetPath || !tweetPath.includes('/status/')) return null;

        logger.info('[Downloader] Mencoba VxTwitter API...');
        const response = await axios.get(`https://api.vxtwitter.com${tweetPath}`, {
            headers: { 'User-Agent': 'NauraBot/2.0' },
            timeout: 10000
        });

        const mediaExtended = response.data?.media_extended;
        if (!mediaExtended || mediaExtended.length === 0) return null;

        if (mediaExtended.length === 1) return { status: 'stream', url: mediaExtended[0].url };
        return {
            status: 'picker',
            picker: mediaExtended.map(item => ({
                url: item.url,
                type: (item.type === 'video' || item.type === 'gif') ? 'video' : 'photo'
            }))
        };
    } catch (e) {
        logger.error(`[Downloader] VxTwitter API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 📌 PROVIDER: Pinterest Scrape
// ==========================================

const tryPinterestScrape = async (url) => {
    if (!url.includes('pinterest.com') && !url.includes('pin.it')) return null;
    try {
        logger.info('[Downloader] Mencoba Pinterest scrape...');
        let targetUrl = url;
        if (url.includes('pin.it')) targetUrl = await resolveShortUrl(url);

        const response = await axios.get(targetUrl, {
            timeout: 10000,
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const html = response.data;
        const videoMatch = html.match(/<meta property="og:video:secure_url" content="([^"]+)"/)
            || html.match(/"contentUrl":"([^"]+\.mp4[^"]*)"/);
        if (videoMatch && videoMatch[1]) {
            return { status: 'stream', url: videoMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/') };
        }

        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (imageMatch && imageMatch[1]) {
            return { status: 'stream', url: imageMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/') };
        }
    } catch (e) {
        logger.error(`[Downloader] Pinterest scrape gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 👽 PROVIDER: Reddit JSON API
// ==========================================

const tryRedditJSON = async (url) => {
    if (!url.includes('reddit.com') && !url.includes('redd.it')) return null;
    try {
        logger.info('[Downloader] Mencoba Reddit JSON API...');
        let targetUrl = url;
        if (url.includes('redd.it') && !url.includes('reddit.com')) {
            targetUrl = await resolveShortUrl(url);
        }

        const cleanUrl = targetUrl.split('?')[0].replace(/\/$/, '');
        const response = await axios.get(`${cleanUrl}.json`, {
            timeout: 10000,
            httpsAgent,
            headers: { 'User-Agent': 'NauraBot/2.0 (media downloader)' }
        });

        const postData = response.data?.[0]?.data?.children?.[0]?.data;
        if (!postData) return null;

        // Video reddit-hosted → serahkan ke yt-dlp (butuh mux DASH)
        if (postData.is_video) return null;

        if (postData.is_gallery && postData.media_metadata) {
            const images = Object.values(postData.media_metadata)
                .filter(m => m.s && (m.s.u || m.s.gif))
                .map(m => ({ url: (m.s.u || m.s.gif).replace(/&amp;/g, '&'), type: 'photo' }));
            if (images.length > 0) {
                return images.length === 1
                    ? { status: 'stream', url: images[0].url }
                    : { status: 'picker', picker: images };
            }
        }

        if (postData.post_hint === 'image' || /\.(jpg|jpeg|png|gif)$/i.test(postData.url || '')) {
            return { status: 'stream', url: postData.url };
        }
    } catch (e) {
        logger.error(`[Downloader] Reddit JSON API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 🧵 PROVIDER: Threads Embed Scrape
// ==========================================

const tryThreadsEmbed = async (url) => {
    if (!url.includes('threads.net') && !url.includes('threads.com')) return null;
    try {
        logger.info('[Downloader] Mencoba Threads embed scrape...');
        const urlObj = new URL(url);
        const cleanPath = urlObj.pathname.replace(/\/$/, '');
        const embedUrl = `https://www.threads.net${cleanPath}/embed`;

        const response = await axios.get(embedUrl, {
            timeout: 10000,
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const html = response.data;
        const videoMatches = [...html.matchAll(/<video[^>]*src="([^"]+)"/g)].map(m => m[1]);
        const imageMatches = [...html.matchAll(/<img[^>]*class="[^"]*BarcelonaImage[^"]*"[^>]*src="([^"]+)"/g)].map(m => m[1]);

        const items = [
            ...videoMatches.map(u => ({ url: u.replace(/&amp;/g, '&'), type: 'video' })),
            ...imageMatches.map(u => ({ url: u.replace(/&amp;/g, '&'), type: 'photo' }))
        ];

        if (items.length === 0) return null;
        return items.length === 1
            ? { status: 'stream', url: items[0].url }
            : { status: 'picker', picker: items };
    } catch (e) {
        logger.error(`[Downloader] Threads embed scrape gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 💼 PROVIDER: LinkedIn Embed Scrape
// ==========================================

const tryLinkedInEmbed = async (url) => {
    if (!url.includes('linkedin.com')) return null;
    try {
        logger.info('[Downloader] Mencoba LinkedIn embed scrape...');

        // Format URL embed LinkedIn untuk post/update
        let embedUrl = url;
        const activityMatch = url.match(/activity[:-](\d+)/i);
        if (activityMatch) {
            embedUrl = `https://www.linkedin.com/embed/feed/update/urn:li:activity:${activityMatch[1]}`;
        } else if (url.includes('/posts/') || url.includes('/feed/')) {
            // Coba OEmbed
            const oembedUrl = `https://www.linkedin.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const oembedRes = await axios.get(oembedUrl, {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (oembedRes.data && oembedRes.data.thumbnail_url) {
                return { status: 'stream', url: oembedRes.data.thumbnail_url };
            }
        }

        const response = await axios.get(embedUrl, {
            timeout: 10000,
            httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.linkedin.com/'
            }
        });

        const html = response.data;
        // Cari video atau gambar dari meta OG
        const videoMeta = html.match(/<meta property="og:video(?::secure_url|:url)?" content="([^"]+)"/);
        if (videoMeta) return { status: 'stream', url: videoMeta[1] };

        const imageMeta = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (imageMeta) return { status: 'stream', url: imageMeta[1] };
    } catch (e) {
        logger.error(`[Downloader] LinkedIn embed scrape gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 🇮🇩 PROVIDER: Agatz API (FB & Twitter)
// ==========================================
// Instagram sengaja tidak lagi melewati Agatz karena responsnya kadang hanya
// berisi thumbnail; Instagram kini ditangani downloaderInstagram.js.

const tryAgatz = async (url) => {
    try {
        let endpoint = '';
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            endpoint = `https://api.agatz.xyz/api/facebook?url=${encodeURIComponent(url)}`;
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
            endpoint = `https://api.agatz.xyz/api/twitter?url=${encodeURIComponent(url)}`;
        } else {
            return null;
        }

        logger.info('[Downloader] Mencoba Agatz API...');
        const res = await axios.get(endpoint, { timeout: 10000 });
        if (res.data && res.data.status === 200 && res.data.result) {
            const r = res.data.result;
            if (Array.isArray(r)) {
                return r.length === 1
                    ? { status: 'stream', url: r[0] }
                    : { status: 'picker', picker: r.map(link => ({ url: link })) };
            }
            if (typeof r === 'string') return { status: 'stream', url: r };
            if (typeof r === 'object') {
                const videoUrl = r.hd || r.sd || r.url || Object.values(r).find(v => typeof v === 'string' && v.startsWith('http'));
                if (videoUrl) return { status: 'stream', url: videoUrl };
            }
        }
    } catch (e) {
        logger.error(`[Downloader] Agatz API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 📸 PROVIDER: Publer (Generic)
// ==========================================

const tryPubler = async (url) => {
    try {
        logger.info('[Downloader] Mencoba Publer API...');
        const response = await axios.post('https://publer.io/api/v1/tools/media-downloader', { url }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        if (response.data && Array.isArray(response.data.payload) && response.data.payload.length > 0) {
            const payload = response.data.payload;
            if (payload.length === 1) return { status: 'stream', url: payload[0].path };
            return {
                status: 'picker',
                picker: payload.map(item => ({ url: item.path, type: item.type === 'video' ? 'video' : 'photo' }))
            };
        }
    } catch (e) {
        logger.error(`[Downloader] Publer API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 🌐 PROVIDER: Cobalt (Paralel Race)
// ==========================================

const fetchCobaltInstances = async () => {
    const now = Date.now();
    if (cobaltInstanceCache.instances.length > 0 && now - cobaltInstanceCache.lastFetch < INSTANCE_CACHE_TTL) {
        return cobaltInstanceCache.instances;
    }

    const staticInstances = [
        'https://api.cobalt.tools',
        'https://co.wuk.sh',
        'https://cobalt.q0.ro'
    ];

    try {
        logger.info('[Downloader] Mengambil daftar server Cobalt komunitas terbaru...');
        const dirRes = await axios.get('https://instances.cobalt.best/api/instances', { timeout: 6000 });

        if (dirRes.data && Array.isArray(dirRes.data)) {
            const dynamicServers = dirRes.data
                .filter(srv => srv.cors === 1 || srv.cors === 0)
                .filter(srv => (srv.trust || 0) > 0 || (srv.score || 0) > 0)
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map(srv => srv.api || srv.url)
                .filter(u => u && u.startsWith('http'));

            if (dynamicServers.length > 0) {
                logger.info(`[Downloader] Berhasil menemukan ${dynamicServers.length} server Cobalt dinamis!`);
                const combined = [...new Set([...dynamicServers.slice(0, 12), ...staticInstances])];
                cobaltInstanceCache.instances = combined;
                cobaltInstanceCache.lastFetch = now;
                return combined;
            }
        }
    } catch (e) {
        logger.info(`[Downloader] Gagal ambil instance list: ${e.message}, pakai fallback statis.`);
    }

    cobaltInstanceCache.instances = staticInstances;
    cobaltInstanceCache.lastFetch = now;
    return staticInstances;
};

/**
 * Coba satu Cobalt instance, throw jika gagal (agar bisa di-race)
 * @param {string} instance - URL instance Cobalt
 * @param {string} url - URL media
 * @returns {Promise<object>}
 */
const tryOneCobaltInstance = async (instance, url) => {
    const response = await axios.post(instance, {
        url,
        // Minta media utuh dengan kualitas terbaik, bukan hasil auto-picker
        downloadMode: 'auto',
        videoQuality: 'max',
        filenameStyle: 'basic'
    }, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        httpsAgent,
        timeout: 10000,
        validateStatus: () => true
    });

    const resData = response.data;
    if (
        response.status >= 200 && response.status < 300 &&
        resData && typeof resData.status === 'string' &&
        resData.status !== 'error'
    ) {
        logger.info(`[Downloader] ✅ Cobalt ${instance} berhasil!`);
        return resData;
    }

    const errCode = resData?.error?.code || resData?.text || `HTTP ${response.status}`;
    throw new Error(`Cobalt ${instance} menolak: ${errCode}`);
};

/**
 * Jalankan semua Cobalt instances secara PARALEL — ambil yang pertama berhasil.
 * @param {string} url
 * @returns {Promise<object|null>}
 */
const tryCobalt = async (url) => {
    const instances = await fetchCobaltInstances();
    logger.info(`[Downloader] 🚀 Menjalankan ${instances.length} Cobalt instances secara paralel...`);

    try {
        const result = await Promise.any(
            instances.map(instance => tryOneCobaltInstance(instance, url))
        );
        return result;
    } catch (e) {
        logger.error('[Downloader] ❌ Semua Cobalt instances gagal.');
        return null;
    }
};

// ==========================================
// 🎬 PROVIDER: yt-dlp (Kualitas Tertinggi)
// ==========================================

let ytDlpInstance = null;
let ytDlpReady = false;

const ensureYtDlp = async () => {
    if (ytDlpReady && ytDlpInstance) return ytDlpInstance;
    try {
        const binaryDir = path.join(__dirname, '..', '..', 'bin');
        if (!fs.existsSync(binaryDir)) fs.mkdirSync(binaryDir, { recursive: true });

        const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
        const binaryPath = path.join(binaryDir, binaryName);

        if (!fs.existsSync(binaryPath)) {
            logger.info('[Downloader] 📥 Mengunduh binary yt-dlp dari GitHub (pertama kali)...');
            await YTDlpWrap.downloadFromGithub(binaryPath);
            logger.info('[Downloader] ✅ Binary yt-dlp berhasil diunduh!');
        }

        ytDlpInstance = new YTDlpWrap(binaryPath);
        ytDlpReady = true;
        return ytDlpInstance;
    } catch (e) {
        logger.error(`[Downloader] ❌ Gagal inisialisasi yt-dlp: ${e.message}`);
        return null;
    }
};

/**
 * @param {string} url
 * @param {CleanupManager} cleanup
 * @returns {Promise<object|null>}
 */
const tryYtdlp = async (url, cleanup) => {
    try {
        const ytdlp = await ensureYtDlp();
        if (!ytdlp) return null;

        logger.info('[Downloader] 🎬 Mencoba yt-dlp untuk download kualitas tertinggi...');

        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const tempOutput = path.join(tempDir, `naura_ytdlp_${timestamp}.%(ext)s`);

        const execPromise = ytdlp.execPromise([
            url,
            '-f', 'b[ext=mp4]/best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
            '--merge-output-format', 'mp4',
            '-o', tempOutput,
            '--no-playlist',
            '--no-warnings',
            '--max-filesize', '500M',
            '--socket-timeout', '15'
        ]);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('yt-dlp execution timeout (60s)')), 60000)
        );

        await Promise.race([execPromise, timeoutPromise]);

        const possibleFiles = fs.readdirSync(tempDir)
            .filter(f => f.startsWith(`naura_ytdlp_${timestamp}`))
            .map(f => path.join(tempDir, f));

        if (possibleFiles.length > 0 && fs.existsSync(possibleFiles[0])) {
            if (cleanup) cleanup.track(possibleFiles[0]);
            logger.info(`[Downloader] ✅ yt-dlp berhasil: ${possibleFiles[0]}`);
            return { status: 'stream', url: possibleFiles[0], isLocalFile: true };
        }
    } catch (e) {
        logger.error(`[Downloader] ❌ yt-dlp gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// 📊 HELPER: Batas Upload Discord
// ==========================================

const getUploadLimitBytes = (interaction) => {
    const guildLimit = interaction?.guild?.attachmentSizeLimit;
    if (guildLimit && guildLimit > 0) return Math.floor(guildLimit * 0.95);
    return 24 * 1024 * 1024; // Default ~24 MB
};

const getUploadLimitMB = (interaction) => getUploadLimitBytes(interaction) / (1024 * 1024);

// ==========================================
// 🗜️ UTILITAS: Kompresi FFmpeg Two-Pass
// ==========================================

/**
 * Kompresi video menggunakan FFmpeg TWO-PASS encoding
 * @param {string} inputPath - Path file video input
 * @param {number} targetSizeMB - Ukuran target dalam MB
 * @param {number|null} forcedHeight - Paksa resolusi tertentu
 * @param {CleanupManager} cleanup - Manager untuk track passlog files
 * @returns {Promise<string>} Path file hasil kompresi
 */
const compressWithFFmpeg = (inputPath, targetSizeMB = 23, forcedHeight = null, cleanup = null) => {
    return new Promise((resolve, reject) => {
        const currentPath = resolveFfmpegPath();
        if (currentPath !== 'ffmpeg' && !fs.existsSync(currentPath)) {
            return reject(new Error(`Sistem FFmpeg tidak terdeteksi di server (${currentPath}). Silakan hubungi admin server.`));
        }

        const timestamp = Date.now();
        const outputPath = inputPath.replace(/\.[^.]+$/, `_compressed_${timestamp}.mp4`);
        const passlogPrefix = path.join(os.tmpdir(), `naura_pass_${timestamp}`);

        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(new Error(`FFprobe gagal: ${err.message}`));

            const duration = parseFloat(metadata.format.duration) || 60;
            // Hitung bitrate target: (targetMB * 8192 kbit) / durasi detik
            // Kurangi 3% untuk container overhead agar tidak overshoot
            const totalBitrate = Math.floor((targetSizeMB * 8192 * 0.97) / duration);
            const audioBitrate = duration > 300 ? 96 : 128; // kbps
            const videoBitrate = Math.max(totalBitrate - audioBitrate, 150); // minimum 150 kbps

            logger.info(`[Downloader] 🗜️ Two-pass encode: durasi=${duration.toFixed(1)}s, vBitrate=${videoBitrate}k, aBitrate=${audioBitrate}k${forcedHeight ? `, resolusi=${forcedHeight}p` : ''}`);

            // Bangun array vf (video filter) berdasarkan resolusi target
            const videoFilters = [];
            if (forcedHeight) {
                videoFilters.push(`scale=-2:min(${forcedHeight}\\,ih)`);
            } else if (videoBitrate < 400) {
                videoFilters.push('scale=-2:480');
            } else if (videoBitrate < 1000) {
                videoFilters.push('scale=-2:720');
            }

            const vfOptions = videoFilters.length > 0 ? ['-vf', videoFilters.join(',')] : [];

            // ────────────────────────────
            // PASS 1: Analisis saja (audio dinonaktifkan)
            // ────────────────────────────
            const pass1 = ffmpeg(inputPath)
                .videoCodec('libx264')
                .outputOptions([
                    `-b:v ${videoBitrate}k`,
                    '-pass 1',
                    `-passlogfile ${passlogPrefix}`,
                    '-preset fast',
                    '-an', // Nonaktifkan audio di pass 1
                    '-f mp4',
                    ...vfOptions
                ])
                .output(NULL_DEVICE)
                .on('end', () => {
                    logger.info('[Downloader] 🗜️ FFmpeg Pass 1 selesai, memulai Pass 2...');

                    // ────────────────────────────
                    // PASS 2: Encode sesungguhnya
                    // ────────────────────────────
                    ffmpeg(inputPath)
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .outputOptions([
                            `-b:v ${videoBitrate}k`,
                            `-b:a ${audioBitrate}k`,
                            '-pass 2',
                            `-passlogfile ${passlogPrefix}`,
                            '-preset fast',
                            '-movflags +faststart',
                            '-y',
                            ...vfOptions
                        ])
                        .output(outputPath)
                        .on('progress', (progress) => {
                            if (progress.percent) {
                                logger.info(`[Downloader] 🗜️ Kompresi Pass 2: ${progress.percent.toFixed(1)}%`);
                            }
                        })
                        .on('end', () => {
                            logger.info(`[Downloader] ✅ Two-pass encode selesai: ${outputPath}`);
                            // Bersihkan passlog files
                            if (cleanup) {
                                cleanup.cleanupPasslog(passlogPrefix);
                            } else {
                                ['.log', '.log.mbtree'].forEach(ext => {
                                    try { if (fs.existsSync(`${passlogPrefix}${ext}`)) fs.unlinkSync(`${passlogPrefix}${ext}`); } catch { }
                                });
                            }
                            resolve(outputPath);
                        })
                        .on('error', (ffmpegErr) => {
                            reject(new Error(`FFmpeg Pass 2 error: ${ffmpegErr.message}`));
                        })
                        .run();
                })
                .on('error', (ffmpegErr) => {
                    reject(new Error(`FFmpeg Pass 1 error: ${ffmpegErr.message}`));
                });

            pass1.run();
        });
    });
};

// ==========================================
// 🔁 UTILITAS: Kompresi Berulang Sampai Muat
// ==========================================

/**
 * @param {string} inputPath
 * @param {number} limitBytes
 * @param {number} limitMB
 * @param {number} [maxAttempts=3]
 * @param {number|null} [forcedHeight=null]
 * @param {CleanupManager} [cleanup=null]
 * @returns {Promise<{success: boolean, path: string, sizeBytes: number, generatedFiles: string[]}>}
 */
const compressUntilFits = async (inputPath, limitBytes, limitMB, maxAttempts = 3, forcedHeight = null, cleanup = null) => {
    let targetMB = Math.max(Math.floor(limitMB - 1), 10);
    const generatedFiles = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const outputPath = await compressWithFFmpeg(inputPath, targetMB, forcedHeight, cleanup);
        generatedFiles.push(outputPath);
        if (cleanup) cleanup.track(outputPath);

        const stats = fs.statSync(outputPath);

        if (stats.size <= limitBytes) {
            return { success: true, path: outputPath, sizeBytes: stats.size, generatedFiles };
        }

        logger.info(`[Downloader] 🗜️ Percobaan ${attempt}/${maxAttempts}: ${(stats.size / (1024 * 1024)).toFixed(1)}MB (limit ${limitMB.toFixed(1)}MB). Turunkan bitrate...`);

        const overshootRatio = limitBytes / stats.size;
        targetMB = Math.max(Math.floor(targetMB * overshootRatio * 0.9), 8);
    }

    const lastPath = generatedFiles[generatedFiles.length - 1];
    return { success: false, path: lastPath, sizeBytes: fs.statSync(lastPath).size, generatedFiles };
};

// ==========================================
// 🔗 PROVIDER CHAIN PER-PLATFORM
// ==========================================

/**
 * @param {string} url
 * @param {CleanupManager} cleanup
 * @returns {Array<{name: string, fn: Function}>}
 */
const getProviderChain = (url, cleanup) => {
    const platform = detectPlatform(url);

    // Wrapper yt-dlp agar bisa terima cleanup dari chain runner
    const ytdlpFn = (u) => tryYtdlp(u, cleanup);

    switch (platform) {
        case 'tiktok':
            return [
                { name: 'Tikwm', fn: tryTikwm },
                { name: 'SnapSave', fn: trySnapSave },
                { name: 'SSSTik', fn: trySSSAPI },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'instagram':
            // Resolver resmi Instagram (GraphQL/embed/pengalih) selalu pertama.
            // SnapSave DIHAPUS dari rantai ini: scraper-nya mengembalikan logo
            // situsnya sendiri, bukan video reel yang diminta.
            return [
                { name: 'Instagram Native', fn: tryInstagramNative },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'SaveFrom', fn: trySaveFrom },
                { name: 'Publer', fn: tryPubler }
            ];

        case 'twitter':
            return [
                { name: 'FxTwitter', fn: tryFxTwitter },
                { name: 'VxTwitter', fn: tryVxTwitter },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'SaveFrom', fn: trySaveFrom },
                { name: 'Agatz', fn: tryAgatz },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'facebook':
            return [
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'SaveFrom', fn: trySaveFrom },
                { name: 'Agatz', fn: tryAgatz },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'youtube':
            return [
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt }
            ];

        case 'pinterest':
            return [
                { name: 'Pinterest Scrape', fn: tryPinterestScrape },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'reddit':
            return [
                { name: 'Reddit JSON', fn: tryRedditJSON },
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt }
            ];

        case 'threads':
            return [
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'Threads Embed', fn: tryThreadsEmbed },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'linkedin':
            return [
                { name: 'LinkedIn Embed', fn: tryLinkedInEmbed },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'vk':
            return [
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt }
            ];

        case 'douyin':
            return [
                { name: 'Tikwm', fn: tryTikwm },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'bilibili':
            return [
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt }
            ];

        default:
            return [
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Publer', fn: tryPubler }
            ];
    }
};

// ==========================================
// 📥 COMMAND EXPORT
// ==========================================

module.exports = {
    data: new SlashCommandBuilder()
        .setName('downloader')
        .setDescription('📥 Unduh video & foto kualitas tertinggi (YT, IG, TikTok, X, Bilibili, VK, dll).')
        .addStringOption(opt =>
            opt.setName('url')
                .setDescription('Masukkan link postingan (Video/Foto)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('quality')
                .setDescription('Pilih kualitas / resolusi sebelum download (default: Otomatis)')
                .setRequired(false)
                .addChoices(...QUALITY_CHOICES)
        ),

    async execute(interaction) {
        // Rate limiter: maksimal 4 request per 60 detik per user
        const isRateLimited = await RateLimiter.isRateLimited(interaction.user.id, 'downloader', 4, 60);
        if (isRateLimited) {
            return ui.sendError(interaction, 'err_sys_30', true);
        }

        await interaction.deferReply();

        const rawUrl = interaction.options.getString('url');
        const url = rawUrl.replace(/[<>]/g, '').trim();
        const qualityChoice = interaction.options.getString('quality') || 'auto';

        if (!url.startsWith('http')) {
            return interaction.editReply(buildErrorContainerV2({
                title: 'URL Tidak Valid',
                description: `${ui.getEmoji('error') || '❌'} URL tidak valid! Harap masukkan link yang benar (http/https).`,
                footerText: ui.getFooter('utility')
            }));
        }

        const platform = detectPlatform(url);
        const expectVideo = isVideoExpected(url);
        logger.info(`[Downloader] Platform: ${platform} | Video diharapkan: ${expectVideo} | Kualitas: ${qualityChoice} | URL: ${url.substring(0, 80)}`);

        const cleanup = new CleanupManager();
        const limitBytes = getUploadLimitBytes(interaction);
        const limitMB = getUploadLimitMB(interaction);
        // Paksa resolusi dari pilihan user (null = otomatis)
        const preselectedHeight = qualityChoice !== 'auto' ? parseInt(qualityChoice, 10) : null;

        try {
            // ==========================================
            // 💾 CEK CACHE
            // ==========================================
            let data = getCachedResult(url);

            // ==========================================
            // 🔗 JALANKAN PROVIDER CHAIN
            // ==========================================
            if (!data) {
                const chain = getProviderChain(url, cleanup);
                logger.info(`[Downloader] Chain (${chain.length} provider): ${chain.map(p => p.name).join(' → ')}`);

                for (const provider of chain) {
                    try {
                        const rawResult = await provider.fn(url);

                        // 🛡️ Sanitasi: buang aset situs downloader & foto palsu
                        const cleanResult = sanitizeProviderResult(rawResult, platform, expectVideo, provider.name);

                        if (cleanResult) {
                            data = cleanResult;
                            logger.info(`[Downloader] ✅ ${provider.name} berhasil!`);
                            if (!data.isLocalFile) setCachedResult(url, data);
                            break;
                        }

                        if (rawResult) {
                            logger.info(`[Downloader] ⚠️ ${provider.name} memberi hasil tapi tidak lolos filter, lanjut provider berikutnya.`);
                        } else {
                            logger.info(`[Downloader] ⚠️ ${provider.name} tidak ada hasil.`);
                        }
                    } catch (providerErr) {
                        logger.error(`[Downloader] ❌ ${provider.name} error: ${providerErr.message}`);
                    }
                }
            }

            // ==========================================
            // ❌ SEMUA PROVIDER GAGAL
            // ==========================================
            if (!data) {
                const platformErrorMessages = {
                    instagram: `${ui.getEmoji('error') || '❌'} Media Instagram gagal diambil. Pastikan postingan bersifat **Public** dan coba lagi nanti.`,
                    twitter: `${ui.getEmoji('error') || '❌'} Media dari X/Twitter gagal diambil. Coba lagi dalam beberapa menit.`,
                    tiktok: `${ui.getEmoji('error') || '❌'} Unduhan TikTok gagal. Server sedang gangguan. Silakan coba lagi nanti.`,
                    youtube: `${ui.getEmoji('error') || '❌'} YouTube gagal diproses. Pastikan video bersifat **Public** dan tidak ada pembatasan usia.`,
                    facebook: `${ui.getEmoji('error') || '❌'} Media Facebook gagal diambil. Pastikan postingan bersifat **Public**.`,
                    pinterest: `${ui.getEmoji('error') || '❌'} Media Pinterest gagal diambil. Pastikan link mengarah langsung ke satu pin (bukan board).`,
                    reddit: `${ui.getEmoji('error') || '❌'} Media Reddit gagal diambil. Pastikan subreddit publik dan postingan tidak dihapus.`,
                    threads: `${ui.getEmoji('error') || '❌'} Media Threads gagal diambil. Pastikan akun/postingan bersifat **Public**.`,
                    linkedin: `${ui.getEmoji('error') || '❌'} Media LinkedIn gagal diambil. Pastikan postingan bersifat **Public** dan berisi video/gambar.`,
                    vk: `${ui.getEmoji('error') || '❌'} Media VK gagal diambil. Pastikan video bersifat **Publik** (tidak privat).`,
                    douyin: `${ui.getEmoji('error') || '❌'} Media Douyin gagal diambil. Konten mungkin dibatasi region atau memerlukan login.`,
                    bilibili: `${ui.getEmoji('error') || '❌'} Media Bilibili gagal diambil. Beberapa konten memerlukan akun premium atau hanya tersedia di China.`,
                };

                const errMsg = platformErrorMessages[platform]
                    || `${ui.getEmoji('error') || '❌'} Gagal memproses tautan. Semua server sedang sibuk atau menolak koneksi. *(Coba lagi dalam beberapa menit)*`;

                return interaction.editReply(buildErrorContainerV2({
                    title: 'Download Gagal',
                    description: errMsg,
                    footerText: ui.getFooter('utility')
                }));
            }

            // ==========================================
            // 📎 PROSES HASIL DOWNLOAD
            // ==========================================
            const attachments = [];
            const actionRow = new ActionRowBuilder();
            let linkManualText = '';
            let resolutionPickerSource = null;
            const mediaGalleryRefs = [];
            const otherFileRefs = [];
            let primaryAttachmentName = null;

            if (data.status === 'picker') {
                // Multiple media (carousel / gallery / slideshow)
                const pickerItems = data.picker.slice(0, MAX_ATTACHMENTS);
                for (const item of pickerItems) {
                    mediaGalleryRefs.push(item.url);
                }
                if (data.picker.length > MAX_ATTACHMENTS) {
                    linkManualText += `\n\n⚠️ **Hanya ${MAX_ATTACHMENTS} media pertama yang ditampilkan** (total: ${data.picker.length}).`;
                }

            } else if (data.url) {
                // Single media
                await interaction.editReply(buildLoadingContainerV2({
                    authorName: 'Naura Loading System...',
                    iconURL: interaction.client.user.displayAvatarURL(),
                    description: `${ui.getEmoji('loading') || '⏳'} Naura lagi mengecek medianya dulu nih, sebentar ya... 🧐`,
                    footerText: ui.getFooter('utility')
                }));

                const isLocalFile = data.isLocalFile === true;
                let localFilePath = isLocalFile ? data.url : null;
                let sizeMB = 0;
                let shouldBuffer = true;
                let detectedExt = 'mp4';

                if (isLocalFile && localFilePath && fs.existsSync(localFilePath)) {
                    // ─────────────────────────────────
                    // FILE LOKAL (hasil yt-dlp)
                    // ─────────────────────────────────
                    const stats = fs.statSync(localFilePath);
                    sizeMB = stats.size / (1024 * 1024);
                    detectedExt = path.extname(localFilePath).replace('.', '') || 'mp4';

                    if (stats.size > limitBytes) {
                        const isVideoExt = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(detectedExt);
                        if (isVideoExt) {
                            try {
                                const compressMsgSuffix = preselectedHeight
                                    ? `ke resolusi **${preselectedHeight}p**`
                                    : 'agar pas dikirim di Discord';
                                await interaction.editReply(buildLoadingContainerV2({
                                    authorName: 'Naura Compression Engine',
                                    iconURL: interaction.client.user.displayAvatarURL(),
                                    description: `${ui.getEmoji('loading') || '⏳'} Media terlalu besar (${sizeMB.toFixed(1)} MB > ${limitMB.toFixed(1)} MB)! Naura sedang mengkompresi video ${compressMsgSuffix}... 🗜️\n\n> Menggunakan **two-pass encoding** untuk akurasi maksimal.`,
                                    footerText: ui.getFooter('utility')
                                }));

                                const compressResult = await compressUntilFits(localFilePath, limitBytes, limitMB, 3, preselectedHeight, cleanup);
                                cleanup.track(localFilePath);

                                if (compressResult.success) {
                                    const fileAttachment = new AttachmentBuilder(compressResult.path, { name: 'naura_media_compressed.mp4' });
                                    attachments.push(fileAttachment);
                                    primaryAttachmentName = 'naura_media_compressed.mp4';
                                    linkManualText += `\n\n🗜️ *Video dikompresi (two-pass) dari ${sizeMB.toFixed(1)} MB → ${(compressResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB${preselectedHeight ? ` @ ${preselectedHeight}p` : ''}*`;
                                } else {
                                    shouldBuffer = false;
                                    resolutionPickerSource = localFilePath;
                                }
                            } catch (compressErr) {
                                logger.error(`[Downloader] ❌ Kompresi FFmpeg gagal: ${compressErr.message}`);
                                shouldBuffer = false;
                                resolutionPickerSource = localFilePath;
                            }
                        } else {
                            shouldBuffer = false;
                            cleanup.track(localFilePath);
                        }
                    } else {
                        const fileAttachment = new AttachmentBuilder(localFilePath, { name: `naura_media.${detectedExt}` });
                        attachments.push(fileAttachment);
                        cleanup.track(localFilePath);
                        primaryAttachmentName = `naura_media.${detectedExt}`;
                    }

                } else {
                    // ─────────────────────────────────
                    // FILE DARI URL (provider non-yt-dlp)
                    // ─────────────────────────────────

                    // Cek ukuran via HEAD request
                    try {
                        const headRes = await axios.head(data.url, {
                            timeout: 8000,
                            httpsAgent,
                            headers: getMediaDownloadHeaders(platform)
                        });
                        const contentLength = headRes.headers['content-length'];
                        const contentType = headRes.headers['content-type'] || '';
                        if (contentLength) sizeMB = parseInt(contentLength, 10) / (1024 * 1024);
                        const mimeExt = mimeToExt(contentType);
                        if (mimeExt) detectedExt = mimeExt;
                    } catch (headErr) {
                        logger.info(`[Downloader] HEAD gagal (${headErr.message}), coba Range request...`);
                        try {
                            const rangeRes = await axios.get(data.url, {
                                headers: { ...getMediaDownloadHeaders(platform), 'Range': 'bytes=0-0' },
                                timeout: 6000,
                                httpsAgent,
                                validateStatus: () => true
                            });
                            const contentRange = rangeRes.headers['content-range'];
                            const contentType = rangeRes.headers['content-type'] || '';
                            if (contentRange) {
                                const totalMatch = contentRange.match(/\/(\d+)/);
                                if (totalMatch) sizeMB = parseInt(totalMatch[1], 10) / (1024 * 1024);
                            }
                            const mimeExt = mimeToExt(contentType);
                            if (mimeExt) detectedExt = mimeExt;
                        } catch {
                            logger.info('[Downloader] Ukuran tidak dapat dideteksi, tetap mencoba buffer...');
                        }
                    }

                    // Deteksi ekstensi dari URL path
                    if (detectedExt === 'mp4') {
                        try {
                            const urlExt = path.extname(new URL(data.url).pathname).replace('.', '');
                            if (urlExt && ['mp4', 'webm', 'mov', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp3', 'wav'].includes(urlExt)) {
                                detectedExt = urlExt;
                            }
                        } catch { }
                    }

                    if (shouldBuffer) {
                        try {
                            const sizeStr = sizeMB > 0 ? `${sizeMB.toFixed(1)} MB` : 'Ukuran Unknown';
                            await interaction.editReply(buildLoadingContainerV2({
                                authorName: 'Naura Loading System...',
                                iconURL: interaction.client.user.displayAvatarURL(),
                                description: `${ui.getEmoji('loading') || '⏳'} Yeay! Naura sedang membawakan media (${sizeStr}) ini buat kamu. Tunggu sebentar ya! 🚀`,
                                footerText: ui.getFooter('utility')
                            }));

                            const tempDir = os.tmpdir();

                            const fileResponse = await axios.get(data.url, {
                                responseType: 'stream',
                                timeout: 45000,
                                httpsAgent,
                                headers: getMediaDownloadHeaders(platform)
                            });

                            const streamContentType = fileResponse.headers['content-type'] || '';
                            const streamMimeExt = mimeToExt(streamContentType);
                            const finalExt = streamMimeExt || detectedExt;

                            // 🛡️ Pengaman terakhir: tautan video tapi yang datang justru gambar
                            if (expectVideo && IMAGE_EXTENSIONS.includes(finalExt)) {
                                logger.info('[Downloader] 🛡️ Batal: server mengirim berkas gambar untuk tautan video.');
                                fileResponse.data.destroy();
                                return interaction.editReply(buildErrorContainerV2({
                                    title: 'Video Tidak Ditemukan',
                                    description: `${ui.getEmoji('error') || '❌'} Naura hanya menerima berkas gambar untuk tautan video ini, jadi hasilnya tidak dikirim. Pastikan postingan bersifat **Public**, lalu coba lagi beberapa saat.`,
                                    footerText: ui.getFooter('utility')
                                }));
                            }

                            const finalPath = path.join(tempDir, `naura_media_${Date.now()}.${finalExt}`);
                            const writer = fs.createWriteStream(finalPath);

                            fileResponse.data.pipe(writer);

                            await new Promise((resolve, reject) => {
                                const streamTimeout = setTimeout(() => {
                                    writer.destroy();
                                    reject(new Error('Download stream timeout (45s)'));
                                }, 45000);

                                writer.on('finish', () => { clearTimeout(streamTimeout); resolve(); });
                                writer.on('error', (err) => { clearTimeout(streamTimeout); reject(err); });
                                fileResponse.data.on('error', (err) => { clearTimeout(streamTimeout); writer.destroy(); reject(err); });
                            });

                            cleanup.track(finalPath);
                            const stats = fs.statSync(finalPath);
                            const actualSizeBytes = stats.size;

                            if (actualSizeBytes > limitBytes) {
                                const isVideoExt = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(finalExt);
                                if (isVideoExt) {
                                    try {
                                        const compressMsgSuffix = preselectedHeight
                                            ? `ke resolusi **${preselectedHeight}p**`
                                            : 'agar pas dikirim';
                                        await interaction.editReply(buildLoadingContainerV2({
                                            authorName: 'Naura Compression Engine',
                                            iconURL: interaction.client.user.displayAvatarURL(),
                                            description: `${ui.getEmoji('loading') || '⏳'} Media terlalu besar (${(actualSizeBytes / (1024 * 1024)).toFixed(1)} MB)! Naura sedang mengkompresi video ${compressMsgSuffix}... 🗜️\n\n> Menggunakan **two-pass encoding** untuk akurasi maksimal.`,
                                            footerText: ui.getFooter('utility')
                                        }));

                                        const compressResult = await compressUntilFits(finalPath, limitBytes, limitMB, 3, preselectedHeight, cleanup);

                                        if (compressResult.success) {
                                            const fileAttachment = new AttachmentBuilder(compressResult.path, { name: 'naura_media_compressed.mp4' });
                                            attachments.push(fileAttachment);
                                            primaryAttachmentName = 'naura_media_compressed.mp4';
                                            linkManualText += `\n\n🗜️ *Video dikompresi (two-pass) dari ${(actualSizeBytes / (1024 * 1024)).toFixed(1)} MB → ${(compressResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB${preselectedHeight ? ` @ ${preselectedHeight}p` : ''}*`;
                                        } else {
                                            shouldBuffer = false;
                                            resolutionPickerSource = finalPath;
                                        }
                                    } catch (compressErr) {
                                        logger.error(`[Downloader] ❌ Kompresi FFmpeg gagal: ${compressErr.message}`);
                                        shouldBuffer = false;
                                        resolutionPickerSource = finalPath;
                                    }
                                } else {
                                    shouldBuffer = false;
                                }
                            } else {
                                const fileAttachment = new AttachmentBuilder(finalPath, { name: `naura_media.${finalExt}` });
                                attachments.push(fileAttachment);
                                primaryAttachmentName = `naura_media.${finalExt}`;
                            }

                        } catch (downloadErr) {
                            logger.error('[Downloader] Gagal stream media:', downloadErr.message);
                            shouldBuffer = false;
                        }
                    }
                } // end URL-based

                if (!shouldBuffer) {
                    if (resolutionPickerSource) {
                        linkManualText += `\n\n${ui.getEmoji('warning') || '⚠️'} **Video terlalu besar untuk dikirim otomatis.** Pilih resolusi di menu bawah biar Naura kompres ulang & langsung kirim! 🎚️`;
                    } else {
                        linkManualText += `\n\n${ui.getEmoji('warning') || '⚠️'} **Media terlalu besar (>${limitMB.toFixed(0)}MB) atau gagal diunduh.** Silakan unduh manual via tombol di bawah.`;
                    }
                }

                // Tombol download manual (hanya jika URL bukan file lokal)
                if (!data.isLocalFile && data.url && data.url.startsWith('http') && data.url.length <= 512) {
                    const downloadEmoji = ui.parseEmoji(ui.getEmoji('download') || '📥');
                    const btn = new ButtonBuilder()
                        .setLabel('Download / Buka Manual')
                        .setURL(data.url)
                        .setStyle(ButtonStyle.Link);
                    if (downloadEmoji) btn.setEmoji(downloadEmoji);
                    actionRow.addComponents(btn);
                } else if (!data.isLocalFile && data.url && data.url.startsWith('http')) {
                    linkManualText += `\n\n🔗 **Link Alternatif:** [Klik di Sini](${data.url})`;
                }

            } else {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Platform Tidak Didukung',
                    description: `${ui.getEmoji('error') || '❌'} Platform tidak didukung atau postingan bersifat Private.`,
                    footerText: ui.getFooter('utility')
                }));
            }

            // Klasifikasikan attachment: visual → Media Gallery, selain itu → File
            if (primaryAttachmentName) {
                const primaryExt = path.extname(primaryAttachmentName).replace('.', '').toLowerCase();
                const visualExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'];
                if (visualExts.includes(primaryExt)) {
                    mediaGalleryRefs.push(primaryAttachmentName);
                } else {
                    otherFileRefs.push(primaryAttachmentName);
                }
            }

            // ==========================================
            // ✅ KIRIM HASIL KE USER
            // ==========================================

            const platformEmoji = {
                tiktok: ui.getEmoji('music_note') || '🎵',
                twitter: ui.getEmoji('bird') || '🐦',
                instagram: ui.getEmoji('camera_with_flash') || '📸',
                facebook: ui.getEmoji('blue_book') || '📘',
                youtube: ui.getEmoji('clapper') || '🎬',
                pinterest: ui.getEmoji('pushpin') || '📌',
                reddit: ui.getEmoji('robot') || '🤖',
                threads: ui.getEmoji('thread') || '🧵',
                linkedin: ui.getEmoji('briefcase') || '💼',
                vk: ui.getEmoji('globe_with_meridians') || '🌐',
                douyin: ui.getEmoji('music_note') || '🎵',
                bilibili: ui.getEmoji('tv') || '📺',
                other: ui.getEmoji('globe_with_meridians') || '🌐'
            };

            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

            // Select menu resolusi manual — muncul saat kompresi otomatis gagal muat
            let resolutionSelectRow = null;
            if (resolutionPickerSource) {
                const resMenu = new StringSelectMenuBuilder()
                    .setCustomId(`dl_res_${interaction.id}`)
                    .setPlaceholder('🎚️ Pilih resolusi video...')
                    .addOptions(RESOLUTION_OPTIONS);
                resolutionSelectRow = new ActionRowBuilder().addComponents(resMenu);
            }

            const combinedRows = [actionRow, resolutionSelectRow].filter(row => row && row.components.length > 0);

            // Keterangan kualitas yang dipilih user
            const qualityLabel = preselectedHeight ? ` | Dipilih: **${preselectedHeight}p**` : '';
            const resolusiText = primaryAttachmentName && primaryAttachmentName.includes('compressed')
                ? `Terkompresi (two-pass)${qualityLabel}`
                : `Original / Kualitas Tertinggi${qualityLabel}`;

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#2b2d31',
                authorName: 'Naura Media Downloader Engine',
                title: `${ui.getEmoji('download') || '📥'} Ekstraksi Media Selesai!`,
                iconURL: interaction.client.user.displayAvatarURL(),
                description:
                    `${platformEmoji[platform] || '🌐'} **Platform:** ${platformName}\n` +
                    `**Sumber Link:** [Klik untuk melihat tautan asli](${url})\n` +
                    `**Resolusi File:** ${resolusiText}${linkManualText}`,
                mediaAttachmentNames: mediaGalleryRefs,
                fileAttachmentNames: otherFileRefs,
                buttonsRow: combinedRows.length > 0 ? combinedRows : null,
                footerText: ui.getFooter('utility')
            });

            if (attachments.length > 0) payload.files = attachments;

            const sentMessage = await interaction.editReply(payload);

            // ==========================================
            // 🎚️ COLLECTOR: Pilihan Resolusi Manual
            // ==========================================
            if (resolutionPickerSource) {
                const sourcePath = resolutionPickerSource;
                const collector = sentMessage.createMessageComponentCollector({
                    componentType: ComponentType.StringSelect,
                    filter: (i) => i.customId === `dl_res_${interaction.id}` && i.user.id === interaction.user.id,
                    time: 5 * 60 * 1000,
                    max: 1
                });

                collector.on('collect', async (i) => {
                    const chosenHeight = parseInt(i.values[0], 10);
                    const manualCleanup = new CleanupManager();
                    try {
                        await i.deferUpdate();
                        await i.editReply(buildContainerV2({
                            accentColorHex: ui.getColor('primary') || '#FFB6C1',
                            authorName: 'Naura Compression Engine',
                            title: `${ui.getEmoji('loading') || '⏳'} Mengkompresi ke ${chosenHeight}p...`,
                            iconURL: interaction.client.user.displayAvatarURL(),
                            description: `Naura sedang mengkompresi ulang video ke resolusi **${chosenHeight}p** menggunakan **two-pass encoding** biar muat dikirim. Tunggu sebentar ya! 🗜️`,
                            footerText: ui.getFooter('utility')
                        }));

                        if (!fs.existsSync(sourcePath)) {
                            throw new Error('File sumber sudah tidak tersedia (mungkin server restart).');
                        }

                        const pickedResult = await compressUntilFits(sourcePath, limitBytes, limitMB, 3, chosenHeight, manualCleanup);

                        if (pickedResult.success) {
                            const finalName = `naura_media_${chosenHeight}p.mp4`;
                            const finalPayload = buildContainerV2({
                                accentColorHex: ui.getColor('primary') || '#2b2d31',
                                authorName: 'Naura Media Downloader Engine',
                                title: `${ui.getEmoji('download') || '📥'} Ekstraksi Media Selesai!`,
                                iconURL: interaction.client.user.displayAvatarURL(),
                                description:
                                    `${platformEmoji[platform] || '🌐'} **Platform:** ${platformName}\n` +
                                    `**Sumber Link:** [Klik untuk melihat tautan asli](${url})\n` +
                                    `**Resolusi File:** ${chosenHeight}p (two-pass, dipilih manual)\n\n` +
                                    `🗜️ *Ukuran akhir: ${(pickedResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB*`,
                                mediaAttachmentNames: [finalName],
                                footerText: ui.getFooter('utility')
                            });
                            finalPayload.files = [new AttachmentBuilder(pickedResult.path, { name: finalName })];
                            await i.editReply(finalPayload);
                        } else {
                            await i.editReply(buildContainerV2({
                                accentColorHex: ui.getColor('error') || '#FF0000',
                                authorName: 'Naura Media Downloader Engine',
                                title: `${ui.getEmoji('error') || '❌'} Masih Kelewat Limit`,
                                iconURL: interaction.client.user.displayAvatarURL(),
                                description: `Naura sudah coba kompres ke **${chosenHeight}p** tapi hasilnya (${(pickedResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB) masih di atas limit Discord (${limitMB.toFixed(0)} MB). Coba pilih resolusi yang lebih rendah, atau unduh manual via link sumber di atas.`,
                                footerText: ui.getFooter('utility')
                            }));
                        }
                    } catch (pickErr) {
                        logger.error('[Downloader] ❌ Gagal proses pilihan resolusi:', pickErr.message);
                        try {
                            const isFfmpegIssue = pickErr.message.includes('ENOENT') || pickErr.message.includes('FFmpeg') || pickErr.message.includes('tidak terdeteksi');
                            const errDesc = isFfmpegIssue
                                ? `${ui.getEmoji('error') || '❌'} **Gagal Kompresi FFmpeg:** Binary FFmpeg tidak terdeteksi atau tidak memiliki izin eksekusi di server host. Silakan hubungi pengelola server.`
                                : `Terjadi kesalahan saat mengkompresi video: ${pickErr.message}. Silakan unduh manual via link sumber di atas.`;

                            await i.editReply(buildContainerV2({
                                accentColorHex: ui.getColor('error') || '#FF0000',
                                authorName: 'Naura Compression Engine',
                                title: `${ui.getEmoji('error') || '❌'} Gagal Kompresi Media`,
                                iconURL: interaction.client.user.displayAvatarURL(),
                                description: errDesc,
                                footerText: ui.getFooter('utility')
                            }));
                        } catch { }
                    } finally {
                        // Bersihkan source + semua file kompresi percobaan
                        manualCleanup.track(sourcePath);
                        await manualCleanup.cleanup();
                    }
                });

                collector.on('end', (collected) => {
                    if (collected.size === 0) {
                        // Timeout tanpa pilihan
                        try { if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath); } catch { }
                        interaction.editReply(buildContainerV2({
                            accentColorHex: ui.getColor('primary') || '#2b2d31',
                            authorName: 'Naura Media Downloader Engine',
                            title: `${ui.getEmoji('download') || '📥'} Ekstraksi Media Selesai!`,
                            iconURL: interaction.client.user.displayAvatarURL(),
                            description:
                                `${platformEmoji[platform] || '🌐'} **Platform:** ${platformName}\n` +
                                `**Sumber Link:** [Klik untuk melihat tautan asli](${url})\n\n` +
                                `${ui.getEmoji('warning') || '⚠️'} *Waktu pemilihan resolusi habis. Jalankan ulang perintah download kalau masih perlu videonya.*`,
                            buttonsRow: actionRow.components.length > 0 ? actionRow : null,
                            footerText: ui.getFooter('utility')
                        })).catch(() => { });
                    }
                });
            }

            return;

        } catch (error) {
            logger.error('[Downloader Internal Error]', error);
            try {
                await interaction.editReply(buildErrorContainerV2({
                    title: 'Gagal Ekstrak Media',
                    description: `${ui.getEmoji('error') || '❌'} Gagal mengekstrak media karena kesalahan teknis yang tidak terduga.`,
                    footerText: ui.getFooter('utility')
                }));
            } catch { }
        } finally {
            // Bersihkan semua file sementara (termasuk passlog FFmpeg)
            await cleanup.cleanup();
        }
    }
};
