'use strict';

// ==========================================
// RANTAI PROVIDER & VALIDASI HASIL
// ==========================================
// Dua perubahan penting dibanding versi lama:
// 1. Instagram dipegang resolver khusus lebih dulu, bukan SnapSave. SnapSave
//    dulu memungut logo situsnya sendiri dan mengirimnya sebagai "foto".
// 2. Setiap hasil diperiksa content-type-nya sebelum dipakai maupun disimpan
//    ke cache, sehingga hasil cacat tidak terulang selama lima menit.

const { logger } = require('../../src/managers/logger');
const core = require('./downloaderCore');
const { resolveInstagram } = require('./downloaderInstagram');
const tiktok = require('./downloaderProvidersTikTok');
const x = require('./downloaderProvidersX');
const web = require('./downloaderProvidersWeb');
const { tryCobalt } = require('./downloaderCobalt');
const { tryYtdlp } = require('./downloaderYtdlp');

/**
 * @param {string} url
 * @param {object} cleanup - CleanupManager
 * @returns {Array<{name: string, fn: Function}>}
 */
const getProviderChain = (url, cleanup) => {
    const platform = core.detectPlatform(url);
    const ytdlpFn = (u) => tryYtdlp(u, cleanup);

    switch (platform) {
        case 'tiktok':
            return [
                { name: 'Tikwm', fn: tiktok.tryTikwm },
                { name: 'SnapSave', fn: tiktok.trySnapSave },
                { name: 'SSSTik', fn: tiktok.trySSSAPI },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'instagram':
            return [
                { name: 'Instagram Resolver', fn: resolveInstagram },
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'SnapSave', fn: tiktok.trySnapSave },
                { name: 'SaveFrom', fn: tiktok.trySaveFrom },
                { name: 'Agatz', fn: x.tryAgatz },
                { name: 'Publer', fn: x.tryPubler }
            ];

        case 'twitter':
            return [
                { name: 'FxTwitter', fn: x.tryFxTwitter },
                { name: 'VxTwitter', fn: x.tryVxTwitter },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'SaveFrom', fn: tiktok.trySaveFrom },
                { name: 'Agatz', fn: x.tryAgatz },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'facebook':
            return [
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'SaveFrom', fn: tiktok.trySaveFrom },
                { name: 'Agatz', fn: x.tryAgatz },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'youtube':
            return [
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt }
            ];

        case 'pinterest':
            return [
                { name: 'Pinterest Scrape', fn: web.tryPinterestScrape },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'reddit':
            return [
                { name: 'Reddit JSON', fn: web.tryRedditJSON },
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt }
            ];

        case 'threads':
            return [
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'Threads Embed', fn: web.tryThreadsEmbed },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'linkedin':
            return [
                { name: 'LinkedIn Embed', fn: web.tryLinkedInEmbed },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        case 'vk':
        case 'bilibili':
            return [
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Cobalt', fn: tryCobalt }
            ];

        case 'douyin':
            return [
                { name: 'Tikwm', fn: tiktok.tryTikwm },
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn }
            ];

        default:
            return [
                { name: 'Cobalt', fn: tryCobalt },
                { name: 'yt-dlp', fn: ytdlpFn },
                { name: 'Publer', fn: x.tryPubler }
            ];
    }
};

/**
 * Periksa hasil satu provider. Berkas lokal dianggap sah karena sudah berupa
 * media nyata di disk.
 * @param {object} data
 * @param {string} platform
 * @returns {Promise<object|null>} hasil yang sudah bersih, atau null
 */
const validateResult = async (data, platform) => {
    if (!data) return null;
    if (data.isLocalFile) return data;

    if (data.status === 'picker' && Array.isArray(data.picker)) {
        const kept = [];
        for (const item of data.picker) {
            if (!item || typeof item.url !== 'string') continue;
            if (core.isBrandingHost(item.url)) {
                logger.info(`[Downloader] Menolak aset milik situs downloader: ${item.url.substring(0, 60)}`);
                continue;
            }
            const probe = await core.probeUrl(item.url, platform);
            if (probe.ok) kept.push(item);
            else logger.info(`[Downloader] Menolak item non-media (${probe.contentType || 'tanpa tipe'}).`);
        }

        if (kept.length === 0) return null;
        return kept.length === 1
            ? { status: 'stream', url: kept[0].url }
            : { status: 'picker', picker: kept };
    }

    if (typeof data.url === 'string' && data.url.startsWith('http')) {
        if (core.isBrandingHost(data.url)) return null;
        const probe = await core.probeUrl(data.url, platform);
        if (!probe.ok) {
            logger.info(`[Downloader] Menolak hasil non-media (${probe.contentType || 'tanpa tipe'}).`);
            return null;
        }
        return data;
    }

    return null;
};

/**
 * Jalankan rantai provider sampai ada hasil yang lolos validasi.
 * @returns {Promise<{data: object|null, providerName: string|null}>}
 */
const runChain = async (url, platform, cleanup) => {
    const chain = getProviderChain(url, cleanup);
    logger.info(`[Downloader] Rantai (${chain.length} provider): ${chain.map(p => p.name).join(' -> ')}`);

    for (const provider of chain) {
        try {
            const raw = await provider.fn(url);
            if (!raw) {
                logger.info(`[Downloader] ${provider.name} tidak memberi hasil.`);
                continue;
            }

            const clean = await validateResult(raw, platform);
            if (!clean) {
                logger.info(`[Downloader] ${provider.name} memberi hasil yang tidak lolos validasi.`);
                continue;
            }

            logger.info(`[Downloader] ${provider.name} berhasil.`);
            return { data: clean, providerName: provider.name };
        } catch (providerErr) {
            logger.error(`[Downloader] ${provider.name} error: ${providerErr.message}`);
        }
    }

    return { data: null, providerName: null };
};

module.exports = { getProviderChain, validateResult, runChain };
