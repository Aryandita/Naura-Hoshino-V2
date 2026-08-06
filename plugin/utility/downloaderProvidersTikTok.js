'use strict';

// ==========================================
// PROVIDER TIKTOK & SCRAPER MULTI-PLATFORM
// ==========================================
// Semua tautan hasil scrape wajib melewati isBrandingHost(). Dulu penyaring
// ini tidak ada, sehingga logo dan banner milik situs downloader ikut
// terkirim sebagai "hasil unduhan".

const axios = require('axios');
const { logger } = require('../../src/managers/logger');
const { UA, isBrandingHost } = require('./downloaderCore');
const { isInstagramCdn } = require('./downloaderInstagram');

/**
 * Saring daftar tautan hasil scrape.
 * @param {string[]} links
 * @param {string} sourceUrl - tautan asli milik pengguna
 * @returns {string[]}
 */
const keepRealMedia = (links, sourceUrl) => {
    const isInstagram = String(sourceUrl).includes('instagram.com');
    return links.filter(link => {
        if (typeof link !== 'string' || !link.startsWith('http')) return false;
        if (isBrandingHost(link)) return false;
        // Media Instagram hanya sah bila berasal dari CDN Instagram/Facebook.
        if (isInstagram && !isInstagramCdn(link)) return false;
        return true;
    });
};

// ==========================================
// PROVIDER: Tikwm (TikTok tanpa watermark)
// ==========================================

const tryTikwm = async (url) => {
    if (!url.includes('tiktok.com') && !url.includes('douyin.com')) return null;
    try {
        logger.info('[Downloader] Mencoba Tikwm API...');
        const endpoint = 'https://www.tikwm.com/api/?url=' + encodeURIComponent(url);
        const response = await axios.get(endpoint, { timeout: 10000 });

        const d = response.data && response.data.code === 0 ? response.data.data : null;
        if (!d) return null;

        if (Array.isArray(d.images) && d.images.length > 0) {
            return { status: 'picker', picker: d.images.map(img => ({ url: img, type: 'photo' })) };
        }
        if (d.play) return { status: 'stream', url: d.play };
    } catch (e) {
        logger.error(`[Downloader] Tikwm API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// PROVIDER: SnapSave (TikTok & Instagram)
// ==========================================

const trySnapSave = async (url) => {
    const isTikTok = url.includes('tiktok.com');
    const isInstagram = url.includes('instagram.com');
    if (!isTikTok && !isInstagram) return null;

    try {
        logger.info(`[Downloader] Mencoba SnapSave untuk ${isTikTok ? 'TikTok' : 'Instagram'}...`);

        const mainPage = await axios.get('https://snapsave.app/', {
            timeout: 10000,
            headers: { 'User-Agent': UA }
        });

        const tokenMatch = String(mainPage.data).match(/name="token"\s+value="([^"]+)"/);
        const formData = new URLSearchParams();
        formData.append('url', url);
        formData.append('token', tokenMatch ? tokenMatch[1] : '');

        const response = await axios.post('https://snapsave.app/action/', formData.toString(), {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://snapsave.app/',
                'User-Agent': UA,
                'Origin': 'https://snapsave.app'
            }
        });

        const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        const videos = keepRealMedia(
            [...html.matchAll(/href="(https:\/\/[^"]+\.mp4[^"]*)"/g)].map(m => m[1]),
            url
        );
        const images = keepRealMedia(
            [...html.matchAll(/href="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g)].map(m => m[1]),
            url
        );

        if (videos.length > 0) {
            return videos.length === 1
                ? { status: 'stream', url: videos[0] }
                : { status: 'picker', picker: videos.map(u => ({ url: u, type: 'video' })) };
        }

        // Postingan video tidak boleh turun ke gambar; itulah asal bug banner.
        if (isInstagram && images.length === 0) {
            logger.info('[Downloader] SnapSave tidak memulangkan media Instagram yang sah.');
            return null;
        }

        if (images.length > 0) {
            return images.length === 1
                ? { status: 'stream', url: images[0] }
                : { status: 'picker', picker: images.map(u => ({ url: u, type: 'photo' })) };
        }
    } catch (e) {
        logger.error(`[Downloader] SnapSave gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// PROVIDER: SSSTik (cadangan TikTok)
// ==========================================

const trySSSAPI = async (url) => {
    if (!url.includes('tiktok.com')) return null;
    try {
        logger.info('[Downloader] Mencoba SSSTik API...');

        const homePage = await axios.get('https://ssstik.io/', {
            timeout: 8000,
            headers: { 'User-Agent': UA }
        });
        const ttMatch = String(homePage.data).match(/id="([a-zA-Z0-9_]+)"\s+value="([a-zA-Z0-9_]+)"/);

        const formData = new URLSearchParams();
        formData.append('id', url);
        formData.append('locale', 'id');
        formData.append('tt', ttMatch ? ttMatch[2] : 'a');

        const response = await axios.post('https://ssstik.io/abc?url=dl', formData.toString(), {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://ssstik.io/',
                'User-Agent': UA,
                'HX-Request': 'true',
                'HX-Current-URL': 'https://ssstik.io/'
            }
        });

        const html = String(response.data);
        const noWmMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>\s*(?:Without watermark|HD)/i);
        if (noWmMatch && !isBrandingHost(noWmMatch[1])) {
            return { status: 'stream', url: noWmMatch[1] };
        }

        const anyMp4 = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
        if (anyMp4 && !isBrandingHost(anyMp4[1])) {
            return { status: 'stream', url: anyMp4[1] };
        }
    } catch (e) {
        logger.error(`[Downloader] SSSTik API gagal: ${e.message}`);
    }
    return null;
};

// ==========================================
// PROVIDER: SaveFrom (multi platform)
// ==========================================

const trySaveFrom = async (url) => {
    const supported = ['instagram.com', 'facebook.com', 'fb.watch', 'youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com'];
    if (!supported.some(d => url.includes(d))) return null;

    try {
        logger.info('[Downloader] Mencoba SaveFrom API...');

        const query = new URLSearchParams({
            app: 'sf',
            lang: 'id',
            opertype: 'user_collection',
            url
        });
        const apiUrl = 'https://worker.sf-tools.com/savefrom?' + query.toString();

        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': UA,
                'Referer': 'https://en.savefrom.net/',
                'Origin': 'https://en.savefrom.net'
            }
        });

        const data = response.data;
        if (!data || data.error || !Array.isArray(data.url)) return null;

        const sorted = data.url
            .filter(item => item && typeof item.url === 'string' && item.url.startsWith('http'))
            .filter(item => keepRealMedia([item.url], url).length > 0)
            .sort((a, b) => (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0));

        if (sorted.length === 0) return null;
        return { status: 'stream', url: sorted[0].url };
    } catch (e) {
        logger.error(`[Downloader] SaveFrom API gagal: ${e.message}`);
    }
    return null;
};

module.exports = { keepRealMedia, tryTikwm, trySnapSave, trySSSAPI, trySaveFrom };
