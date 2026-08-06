'use strict';

// ==========================================
// KLIEN GEMINI TUNGGAL
// ==========================================
// Sebelum berkas ini ada, repo memuat DUA SDK Gemini sekaligus:
//   - @google/generative-ai  dipakai plugin/ai/aiRouterManager.js
//   - @google/genai          dipakai src/utils/aiAutomodHelper.js
//
// Keduanya punya bentuk respons yang berbeda, dan perbedaan itu sempat
// menimbulkan bug diam: aiAutomodHelper.js memanggil `response.text?.()`
// padahal di @google/genai `text` adalah getter bernilai string.
//
// Mulai sekarang SDK Gemini hanya boleh disentuh dari berkas ini.

const env = require('../../src/config/env');
const { logger } = require('../../src/managers/logger');

const DEFAULT_MODEL = 'gemini-2.5-flash';

let cachedClient = null;
let clientResolved = false;

/**
 * Ambil instance GoogleGenAI.
 *
 * SDK sengaja di-require di dalam fungsi, bukan di puncak berkas. Proses yang
 * tidak pernah memakai AI (misalnya shard yang hanya melayani musik) jadi tidak
 * ikut menanggung biaya parsing modul saat boot.
 *
 * @returns {object|null} null bila GEMINI_API tidak dikonfigurasi.
 */
function getClient() {
    if (clientResolved) return cachedClient;
    clientResolved = true;

    if (!env.GEMINI_API) {
        logger.warn('[Gemini] GEMINI_API tidak dikonfigurasi. Seluruh jalur Gemini dinonaktifkan.');
        cachedClient = null;
        return null;
    }

    try {
        const { GoogleGenAI } = require('@google/genai');
        cachedClient = new GoogleGenAI({ apiKey: env.GEMINI_API });
        logger.info('[Gemini] SDK @google/genai dimuat.');
    } catch (e) {
        logger.error('[Gemini] Gagal memuat SDK @google/genai:', e.message);
        cachedClient = null;
    }

    return cachedClient;
}

/** Apakah jalur Gemini bisa dipakai sama sekali. */
function isAvailable() {
    return Boolean(getClient());
}

/**
 * Ambil teks dari respons SDK dengan aman.
 *
 * Bentuk respons berbeda antar versi SDK, jadi ketiga kemungkinan ditangani:
 * getter string (@google/genai), fungsi (SDK lama), dan pembacaan langsung
 * dari candidates sebagai jaring pengaman terakhir.
 *
 * @param {object} response
 * @returns {string}
 */
function extractText(response) {
    if (!response) return '';

    const value = response.text;
    if (typeof value === 'string') return value;
    if (typeof value === 'function') {
        try {
            return String(value.call(response) || '');
        } catch {
            /* jatuh ke pembacaan candidates di bawah */
        }
    }

    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
        return parts.map(p => (p && typeof p.text === 'string' ? p.text : '')).join('');
    }

    return '';
}

/**
 * Satu panggilan generateContent.
 *
 * Riwayat percakapan dikirim sebagai bagian dari `contents`, bukan lewat
 * objek chat tersendiri. Hasilnya setara dengan startChat() pada SDK lama,
 * tetapi tanpa menyimpan state di sisi klien.
 *
 * @param {object} opts
 * @param {Array<object>} opts.parts - Bagian isi pesan: { text } dan/atau { inlineData }.
 * @param {Array<object>} [opts.history] - Riwayat format { role: 'user'|'model', parts: [{ text }] }.
 * @param {string} [opts.model]
 * @param {object} [opts.config] - Diteruskan apa adanya ke SDK (maxOutputTokens, temperature, dsb).
 * @returns {Promise<string>} Teks jawaban yang sudah di-trim.
 * @throws {Error} Bila GEMINI_API kosong atau jawaban Gemini kosong.
 */
async function generate({ parts, history = [], model = DEFAULT_MODEL, config } = {}) {
    const client = getClient();
    if (!client) throw new Error('GEMINI_API tidak dikonfigurasi.');

    if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error('generate() membutuhkan minimal satu part.');
    }

    const safeHistory = Array.isArray(history) ? history.filter(h => h && h.role && h.parts) : [];
    const contents = [...safeHistory, { role: 'user', parts }];

    const response = await client.models.generateContent({
        model,
        contents,
        ...(config ? { config } : {})
    });

    const text = extractText(response).trim();
    if (!text) throw new Error('Respons Gemini kosong atau formatnya tidak dikenali.');

    return text;
}

module.exports = { getClient, isAvailable, extractText, generate, DEFAULT_MODEL };
