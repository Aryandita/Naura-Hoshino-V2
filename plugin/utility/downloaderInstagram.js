'use strict';

// ==========================================
// PROVIDER KHUSUS INSTAGRAM
// ==========================================
// Modul ini menggantikan ketergantungan pada SnapSave untuk Instagram.
// Masalah lama: scraper SnapSave memungut SEMUA tautan gambar di halaman
// hasil, termasuk logo situsnya sendiri, sehingga reel video dikirim
// sebagai dua gambar branding. Di sini setiap tautan wajib lolos filter
// host CDN Instagram/Facebook sebelum boleh dipakai.

const axios = require('axios');
const https = require('https');
const { logger } = require('../../src/managers/logger');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// App ID publik yang dipakai web Instagram untuk memanggil GraphQL.
const IG_APP_ID = '936619743392459';

// Hanya host inilah yang sah menjadi sumber media Instagram.
const CDN_HOST_PATTERN = /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i;

/**
 * Pastikan sebuah tautan benar-benar berasal dari CDN Instagram/Facebook.
 * Inilah penjaga utama supaya aset milik situs downloader pihak ketiga
 * (logo, ikon, banner) tidak pernah lolos sebagai hasil unduhan.
 * @param {string} link
 * @returns {boolean}
 */
const isInstagramCdn = (link) => {
    if (typeof link !== 'string' || !link.startsWith('http')) return false;
    try {
        return CDN_HOST_PATTERN.test(new URL(link).hostname);
    } catch {
        return false;
    }
};

/**
 * Bersihkan escape JSON pada URL hasil scrape.
 * @param {string} raw
 * @returns {string}
 */
const unescapeUrl = (raw = '') => raw
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

/**
 * Ambil shortcode dari berbagai bentuk tautan Instagram
 * (/p/, /reel/, /reels/, /tv/, termasuk yang memakai query string).
 * @param {string} url
 * @returns {string|null}
 */
const extractShortcode = (url) => {
    const match = String(url).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
};

/**
 * Ubah satu node media GraphQL menjadi item hasil.
 * @param {object} node
 * @returns {{url: string, type: string}|null}
 */
const mapNode = (node) => {
    if (!node) return null;
    if (node.is_video && node.video_url && isInstagramCdn(node.video_url)) {
        return { url: node.video_url, type: 'video' };
    }
    const image = node.display_url || node.thumbnail_src;
    if (!node.is_video && image && isInstagramCdn(image)) {
        return { url: image, type: 'photo' };
    }
    return null;
};

/**
 * Jalur utama: GraphQL publik web Instagram.
 * Mengembalikan video_url asli untuk reel dan seluruh anak carousel.
 * @param {string} shortcode
 * @returns {Promise<object|null>}
 */
const tryGraphQL = async (shortcode) => {
    try {
        logger.info('[Downloader][IG] Mencoba GraphQL publik Instagram...');
        const body = new URLSearchParams({
            variables: JSON.stringify({ shortcode }),
            doc_id: '8845758582119845'
        });

        const res = await axios.post('https://www.instagram.com/api/graphql', body.toString(), {
            timeout: 12000,
            httpsAgent,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UA,
                'X-IG-App-ID': IG_APP_ID,
                'Origin': 'https://www.instagram.com',
                'Referer': 'https://www.instagram.com/'
            }
        });

        const media = res.data?.data?.xdt_shortcode_media;
        if (!media) return null;

        const children = media.edge_sidecar_to_children?.edges;
        if (Array.isArray(children) && children.length > 0) {
            const items = children.map(edge => mapNode(edge.node)).filter(Boolean);
            if (items.length === 0) return null;
            return items.length === 1
                ? { status: 'stream', url: items[0].url }
                : { status: 'picker', picker: items };
        }

        const single = mapNode(media);
        if (single) return { status: 'stream', url: single.url };
    } catch (e) {
        logger.error(`[Downloader][IG] GraphQL gagal: ${e.message}`);
    }
    return null;
};

/**
 * Jalur cadangan: halaman embed resmi.
 * Sengaja memulangkan null bila postingan adalah video tetapi URL video
 * tidak ditemukan, supaya thumbnail tidak pernah dikirim sebagai hasil.
 * @param {string} shortcode
 * @returns {Promise<object|null>}
 */
const tryEmbed = async (shortcode) => {
    try {
        logger.info('[Downloader][IG] Mencoba halaman embed resmi...');
        const embedUrl = 'https://www.instagram.com/p/' + shortcode + '/embed/captioned/';
        const res = await axios.get(embedUrl, {
            timeout: 12000,
            httpsAgent,
            headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }
        });

        const html = typeof res.data === 'string' ? res.data : '';
        if (!html) return null;

        const isVideoPost = /<video[\s>]/i.test(html) || html.includes('"is_video":true');

        const videoCandidates = [
            ...[...html.matchAll(/"video_url":"([^"]+)"/g)].map(m => m[1]),
            ...[...html.matchAll(/<video[^>]*\bsrc="([^"]+)"/gi)].map(m => m[1])
        ].map(unescapeUrl).filter(isInstagramCdn);

        if (videoCandidates.length > 0) {
            return { status: 'stream', url: videoCandidates[0] };
        }

        // Postingan video tanpa video_url: jangan turun ke gambar.
        if (isVideoPost) {
            logger.info('[Downloader][IG] Embed mendeteksi video tapi tanpa URL video, lanjut ke provider lain.');
            return null;
        }

        const imageCandidates = [...html.matchAll(/<img[^>]*class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/gi)]
            .map(m => unescapeUrl(m[1]))
            .filter(isInstagramCdn);

        if (imageCandidates.length > 0) {
            return { status: 'stream', url: imageCandidates[0] };
        }
    } catch (e) {
        logger.error(`[Downloader][IG] Embed gagal: ${e.message}`);
    }
    return null;
};

/**
 * Jalur cadangan terakhir: layanan pengalih ddinstagram yang me-redirect
 * langsung ke berkas mp4 di CDN Instagram.
 * @param {string} shortcode
 * @returns {Promise<object|null>}
 */
const tryRedirectService = async (shortcode) => {
    try {
        logger.info('[Downloader][IG] Mencoba layanan pengalih ddinstagram...');
        const redirectUrl = 'https://ddinstagram.com/videos/' + shortcode + '/1';
        const res = await axios.get(redirectUrl, {
            timeout: 12000,
            httpsAgent,
            maxRedirects: 5,
            headers: { 'User-Agent': UA },
            validateStatus: () => true
        });

        const finalUrl = res.request?.res?.responseUrl;
        if (isInstagramCdn(finalUrl)) {
            return { status: 'stream', url: finalUrl };
        }
    } catch (e) {
        logger.error(`[Downloader][IG] Layanan pengalih gagal: ${e.message}`);
    }
    return null;
};

/**
 * Resolver Instagram berurutan: GraphQL -> embed -> pengalih.
 * @param {string} url
 * @returns {Promise<object|null>}
 */
const resolveInstagram = async (url) => {
    if (!String(url).includes('instagram.com')) return null;

    const shortcode = extractShortcode(url);
    if (!shortcode) {
        logger.info('[Downloader][IG] Shortcode tidak ditemukan pada tautan.');
        return null;
    }

    for (const step of [tryGraphQL, tryEmbed, tryRedirectService]) {
        const result = await step(shortcode);
        if (result) return result;
    }
    return null;
};

module.exports = {
    isInstagramCdn,
    extractShortcode,
    resolveInstagram,
    IG_CDN_PATTERN: CDN_HOST_PATTERN
};
