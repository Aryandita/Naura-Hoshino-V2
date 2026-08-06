'use strict';

/**
 * Registry komponen interaksi.
 *
 * Sebelumnya seluruh tombol, select menu, dan modal ditangani oleh satu rantai
 * `if` di dalam src/events/interactionCreate.js. Rantai itu punya tiga masalah:
 *
 *   1. Tidak ada `return` di antara blok tipe interaksi. Setiap tombol yang
 *      sudah selesai ditangani tetap diuji terhadap cabang select menu, modal,
 *      channel select, dan role select di bawahnya.
 *
 *   2. Sebagian besar cabang tidak punya try/catch sendiri. Satu galat di dalam
 *      satu tombol membuat interaksi mati tanpa balasan apa pun, dan pengguna
 *      hanya melihat "This interaction failed".
 *
 *   3. Menambah satu tombol berarti menyunting berkas yang sama dengan seluruh
 *      fitur lain.
 *
 * Sekarang setiap fitur mendaftarkan penanganannya di berkas terpisah di dalam
 * buttons/, selects/, atau modals/. Berkas ini hanya memetakan customId ke
 * penangan yang tepat.
 *
 * Bentuk pendaftaran (satu berkas boleh mengekspor satu objek atau sebuah array):
 *
 *   module.exports = [{
 *       id: 'ticket_open',        // cocok persis, ATAU
 *       prefix: 'tvc_',           // cocok berdasarkan awalan
 *       label: 'tiket-buka',      // dipakai untuk log & kunci rate limit
 *       defer: 'reply' | 'update' | false,   // opsional, default tidak defer
 *       ephemeral: true,          // hanya berlaku bila defer === 'reply'
 *       cooldown: { max, seconds },          // opsional, menimpa default
 *       onError: 'pesan ramah',   // opsional, ditampilkan bila handler melempar
 *       async handler(interaction, client) { ... }
 *   }];
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../managers/logger');

const KINDS = ['buttons', 'selects', 'modals'];

const store = {};
for (const kind of KINDS) {
    store[kind] = { exact: new Map(), prefixes: [] };
}

let loaded = false;

function registerEntry(kind, entry, sourceFile) {
    if (!entry || typeof entry.handler !== 'function') {
        logger.warn(`[INTERAKSI] ${sourceFile} melewatkan entri tanpa handler.`);
        return;
    }

    entry.label = entry.label || entry.id || entry.prefix || path.basename(sourceFile, '.js');
    entry.source = sourceFile;

    if (entry.id) {
        if (store[kind].exact.has(entry.id)) {
            logger.warn(`[INTERAKSI] customId "${entry.id}" terdaftar lebih dari sekali.`);
        }
        store[kind].exact.set(entry.id, entry);
        return;
    }

    if (entry.prefix) {
        store[kind].prefixes.push(entry);
        return;
    }

    logger.warn(`[INTERAKSI] ${sourceFile} punya entri tanpa id maupun prefix.`);
}

function load() {
    if (loaded) return;
    loaded = true;

    for (const kind of KINDS) {
        const dir = path.join(__dirname, kind);
        if (!fs.existsSync(dir)) continue;

        for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
            const full = path.join(dir, file);
            try {
                const mod = require(full);
                const entries = Array.isArray(mod) ? mod : [mod];
                for (const entry of entries) registerEntry(kind, entry, `${kind}/${file}`);
            } catch (error) {
                logger.error(`[INTERAKSI] Gagal memuat ${kind}/${file}:`, error);
            }
        }

        // Awalan terpanjang diuji lebih dulu supaya "modal_tvc_" menang atas "modal_".
        store[kind].prefixes.sort((a, b) => b.prefix.length - a.prefix.length);
    }

    const total = KINDS.reduce((sum, k) => sum + store[k].exact.size + store[k].prefixes.length, 0);
    logger.info(`[INTERAKSI] ${total} penangan komponen dimuat.`);
}

/**
 * @param {'buttons'|'selects'|'modals'} kind
 * @param {string} customId
 * @returns {Object|null}
 */
function resolve(kind, customId) {
    load();
    if (!customId || !store[kind]) return null;

    const exact = store[kind].exact.get(customId);
    if (exact) return exact;

    return store[kind].prefixes.find((entry) => customId.startsWith(entry.prefix)) || null;
}

/** Dipakai skrip pemeliharaan untuk melihat isi registry tanpa menjalankan bot. */
function list() {
    load();
    const result = {};
    for (const kind of KINDS) {
        result[kind] = [
            ...[...store[kind].exact.keys()].map((id) => ({ match: id, type: 'exact' })),
            ...store[kind].prefixes.map((e) => ({ match: e.prefix, type: 'prefix' }))
        ];
    }
    return result;
}

module.exports = { load, resolve, list };
