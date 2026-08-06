'use strict';

/**
 * Perkakas pengamanan bersama untuk seluruh permukaan HTTP dashboard.
 *
 * Tiga hal yang disediakan:
 *
 *   verifyToken()       - pencocokan token konstan-waktu, dengan pembedaan tegas
 *                         antara "token salah" dan "token belum dikonfigurasi"
 *   createRateLimiter() - pembatas laju per IP tanpa dependensi baru
 *   claimOnce()         - penanda sekali-pakai agar kiriman ulang webhook tidak
 *                         diproses dua kali
 *
 * Sengaja tanpa paket tambahan (helmet, express-rate-limit) supaya perbaikan ini
 * bisa langsung dipasang tanpa menunggu npm install di server produksi.
 */

const crypto = require('crypto');
const redisManager = require('../../managers/redisManager');
const { logger } = require('../../managers/logger');

// ==========================================
// Perbandingan token
// ==========================================

/**
 * Membandingkan dua rahasia tanpa membocorkan panjang atau isinya lewat waktu
 * eksekusi.
 *
 * `a === b` pada string berhenti di karakter pertama yang berbeda. Selisih
 * waktunya sangat kecil, tetapi cukup untuk menebak token karakter demi karakter
 * bila penyerang bisa mengirim banyak percobaan. Kedua nilai di-hash lebih dulu
 * supaya panjangnya selalu sama, karena timingSafeEqual menolak buffer yang
 * panjangnya berbeda.
 */
function safeCompare(a, b) {
    if (a == null || b == null) return false;
    const hashA = crypto.createHash('sha256').update(String(a), 'utf8').digest();
    const hashB = crypto.createHash('sha256').update(String(b), 'utf8').digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

/** Ambil token dari header pertama yang terisi, sekaligus buang awalan "Bearer". */
function readToken(req, headerNames) {
    for (const name of headerNames) {
        const raw = req.headers[name];
        if (!raw) continue;
        return String(Array.isArray(raw) ? raw[0] : raw).replace(/^Bearer\s+/i, '').trim();
    }
    return null;
}

/**
 * @returns {'ok'|'mismatch'|'not_configured'}
 *
 * Pemanggil WAJIB memperlakukan 'not_configured' sebagai penolakan. Versi
 * sebelumnya membiarkannya lolos, sehingga endpoint donasi terbuka lebar selama
 * variabel env-nya belum diisi.
 */
function verifyToken(req, envKey, headerNames) {
    const expected = process.env[envKey];
    if (!expected) return 'not_configured';
    const received = readToken(req, headerNames);
    if (!received) return 'mismatch';
    return safeCompare(received, expected) ? 'ok' : 'mismatch';
}

// ==========================================
// Pembatas laju
// ==========================================

/**
 * Pembatas laju jendela-tetap per IP.
 *
 * Disimpan di memori proses. Untuk server webhook yang hanya menerima trafik
 * dari beberapa penyedia, ini sudah memadai dan tidak menambah ketergantungan
 * pada Redis di jalur yang harus selalu hidup.
 */
function createRateLimiter({ windowMs = 60_000, max = 60, name = 'default' } = {}) {
    const hits = new Map();

    const sweeper = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs);
    if (sweeper.unref) sweeper.unref();

    return function rateLimit(req, res, next) {
        const key = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        entry.count += 1;
        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            logger.warn(`[GUARD ${name}] Laju permintaan dari ${key} dibatasi.`);
            return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });
        }

        return next();
    };
}

// ==========================================
// Penanda sekali-pakai (idempotensi)
// ==========================================

// Cadangan bila Redis tidak tersedia. Sengaja dibatasi supaya tidak tumbuh terus.
const localClaims = new Map();
const LOCAL_CLAIM_MAX = 5000;

function localClaim(key, ttlSeconds) {
    const now = Date.now();
    for (const [k, expiry] of localClaims) {
        if (expiry <= now) localClaims.delete(k);
    }
    if (localClaims.has(key)) return false;
    if (localClaims.size >= LOCAL_CLAIM_MAX) {
        localClaims.delete(localClaims.keys().next().value);
    }
    localClaims.set(key, now + ttlSeconds * 1000);
    return true;
}

/**
 * Menandai sebuah kejadian sebagai sudah diproses.
 *
 * @returns {Promise<boolean>} true bila ini yang PERTAMA, false bila duplikat.
 *
 * Memakai INCR, bukan GET lalu SET. Dua kiriman yang tiba bersamaan sama-sama
 * akan melihat cache kosong pada pola GET-lalu-SET, sehingga keduanya lolos.
 * INCR bersifat atomik, jadi hanya satu yang menerima nilai 1.
 */
async function claimOnce(key, ttlSeconds) {
    const value = await redisManager.increment(key, ttlSeconds);
    if (value === null) return localClaim(key, ttlSeconds);
    return value === 1;
}

/** Sidik jari isi permintaan, untuk penyedia yang tidak mengirim ID transaksi. */
function fingerprint(parts) {
    return crypto.createHash('sha256').update(parts.filter(Boolean).join('|'), 'utf8').digest('hex').slice(0, 32);
}

module.exports = {
    safeCompare,
    readToken,
    verifyToken,
    createRateLimiter,
    claimOnce,
    fingerprint
};
