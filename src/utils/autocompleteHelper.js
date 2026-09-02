'use strict';

/**
 * Lokasi: src/utils/autocompleteHelper.js
 *
 * Helper terpusat untuk seluruh handler autocomplete Discord di Naura.
 * Menyediakan:
 *   - Cache ringan (TTL 10 detik) untuk menghindari request berulang ke Lavalink/DB
 *     saat user mengetik cepat (debounce sisi server).
 *   - Fuzzy matching sederhana untuk meningkatkan relevansi hasil pencarian.
 *   - Helper format choice agar label terpotong dengan benar (<= 100 char).
 *   - Smart empty-state: tampilkan hasil bermanfaat saat query kosong.
 *
 * Batas Discord: maksimum 25 pilihan per respond().
 */

const MAX_CHOICES = 25;
const CACHE_TTL_MS = 10_000;

const _cache = new Map();

function getCached(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key, data, ttlMs = CACHE_TTL_MS) {
    if (_cache.size > 200) {
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function invalidateCache(prefix) {
    for (const key of _cache.keys()) {
        if (key.startsWith(prefix)) _cache.delete(key);
    }
}

function fuzzyScore(text, query) {
    if (!query) return 0;
    if (text === query) return 500;
    if (text.startsWith(query)) return 300;
    if (text.includes(query)) return 100;
    let score = 0;
    let qi = 0;
    for (let ti = 0; ti < text.length && qi < query.length; ti++) {
        if (text[ti] === query[qi]) {
            score += 10;
            qi++;
        }
    }
    return qi >= Math.ceil(query.length / 2) ? score : 0;
}

function fuzzyFilter(choices, query, limit = MAX_CHOICES) {
    if (!query || query.trim().length === 0) {
        return choices.slice(0, limit);
    }
    const q = query.toLowerCase().trim();
    return choices
        .map((c) => ({ choice: c, score: fuzzyScore(c.name.toLowerCase(), q) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.choice);
}

function truncateLabel(label, max = 100) {
    if (!label) return 'Tanpa nama';
    return label.length > max ? label.substring(0, max - 3) + '...' : label;
}

function choice(name, value) {
    return {
        name: truncateLabel(String(name || 'Unknown'), 100),
        value: String(value || '').substring(0, 100),
    };
}

async function safeRespond(interaction, choices) {
    if (interaction.responded) return;
    const safe = Array.isArray(choices) ? choices.slice(0, MAX_CHOICES) : [];
    await interaction.respond(safe).catch(() => {});
}

async function respondWithFallback(interaction, query) {
    const icon = '\uD83D\uDD0E';
    const label = query
        ? `${icon} Tekan Enter untuk mencari: ${query}`
        : `${icon} Mulai ketik judul atau nama artis...`;
    await safeRespond(interaction, [choice(label, query || ' ')]);
}

module.exports = {
    MAX_CHOICES,
    getCached,
    setCache,
    invalidateCache,
    fuzzyScore,
    fuzzyFilter,
    truncateLabel,
    choice,
    safeRespond,
    respondWithFallback,
};
