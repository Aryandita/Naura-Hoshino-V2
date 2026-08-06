'use strict';

// ==========================================
// PROVIDER: COBALT (BALAPAN PARALEL)
// ==========================================
// Semua instance dijalankan bersamaan lalu diambil yang pertama berhasil,
// sehingga waktu tunggu tidak menumpuk sebanyak jumlah server.

const axios = require('axios');
const { logger } = require('../../src/managers/logger');
const { UA, httpsAgent } = require('./downloaderCore');

const INSTANCE_CACHE_TTL = 10 * 60 * 1000;
const instanceCache = { instances: [], lastFetch: 0 };

const STATIC_INSTANCES = [
    'https://api.cobalt.tools',
    'https://co.wuk.sh',
    'https://cobalt.q0.ro'
];

/**
 * Ambil daftar server Cobalt komunitas, dengan cadangan daftar statis.
 * @returns {Promise<string[]>}
 */
const fetchCobaltInstances = async () => {
    const now = Date.now();
    if (instanceCache.instances.length > 0 && now - instanceCache.lastFetch < INSTANCE_CACHE_TTL) {
        return instanceCache.instances;
    }

    try {
        logger.info('[Downloader] Mengambil daftar server Cobalt komunitas...');
        const dirRes = await axios.get('https://instances.cobalt.best/api/instances', { timeout: 6000 });

        if (Array.isArray(dirRes.data)) {
            const dynamicServers = dirRes.data
                .filter(srv => srv && (srv.cors === 1 || srv.cors === 0))
                .filter(srv => (srv.trust || 0) > 0 || (srv.score || 0) > 0)
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map(srv => srv.api || srv.url)
                .filter(u => typeof u === 'string' && u.startsWith('http'));

            if (dynamicServers.length > 0) {
                logger.info(`[Downloader] Menemukan ${dynamicServers.length} server Cobalt dinamis.`);
                const combined = [...new Set([...dynamicServers.slice(0, 12), ...STATIC_INSTANCES])];
                instanceCache.instances = combined;
                instanceCache.lastFetch = now;
                return combined;
            }
        }
    } catch (e) {
        logger.info(`[Downloader] Gagal ambil daftar instance: ${e.message}, pakai daftar statis.`);
    }

    instanceCache.instances = STATIC_INSTANCES;
    instanceCache.lastFetch = now;
    return STATIC_INSTANCES;
};

/**
 * Coba satu instance. Sengaja melempar error agar bisa diadu dengan Promise.any.
 * @param {string} instance
 * @param {string} url
 * @returns {Promise<object>}
 */
const tryOneCobaltInstance = async (instance, url) => {
    const response = await axios.post(instance, { url }, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': UA
        },
        httpsAgent,
        timeout: 10000,
        validateStatus: () => true
    });

    const resData = response.data;
    const accepted = response.status >= 200 && response.status < 300
        && resData && typeof resData.status === 'string'
        && resData.status !== 'error';

    if (accepted) {
        logger.info(`[Downloader] Cobalt ${instance} berhasil.`);
        return resData;
    }

    const errCode = resData?.error?.code || resData?.text || `HTTP ${response.status}`;
    throw new Error(`Cobalt ${instance} menolak: ${errCode}`);
};

/**
 * @param {string} url
 * @returns {Promise<object|null>}
 */
const tryCobalt = async (url) => {
    const instances = await fetchCobaltInstances();
    logger.info(`[Downloader] Menjalankan ${instances.length} instance Cobalt secara paralel...`);

    try {
        return await Promise.any(instances.map(instance => tryOneCobaltInstance(instance, url)));
    } catch {
        logger.error('[Downloader] Semua instance Cobalt gagal.');
        return null;
    }
};

module.exports = { STATIC_INSTANCES, fetchCobaltInstances, tryOneCobaltInstance, tryCobalt };
