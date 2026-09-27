/**
 * api.js, Fetch wrapper terpusat untuk Naura OS Mobile.
 *
 * Menyediakan loading states yang jujur, penanganan error
 * yang konsisten, dan cache sederhana untuk data yang jarang berubah.
 */

/** @type {Map<string, {data: any, ts: number}>} */
const _cache = new Map();

const CACHE_TTL = {
  "/api/health":           30_000,   // 30 detik
  "/api/user/me":          60_000,   // 1 menit
  "/api/survival/profile": 15_000,   // 15 detik
  "/api/leaderboard":      60_000,   // 1 menit
};

/**
 * Fetch data dari API dengan error handling dan optional caching.
 *
 * @param {string} path - Path API (misal: /api/health)
 * @param {RequestInit} [opts]
 * @returns {Promise<{data?: any, error?: string, status: number}>}
 */
export async function apiFetch(path, opts = {}) {
  // Cek cache
  const ttl = CACHE_TTL[path];
  if (ttl && !opts.method) {
    const cached = _cache.get(path);
    if (cached && Date.now() - cached.ts < ttl) {
      return { data: cached.data, status: 200 };
    }
  }

  try {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...opts.headers },
      ...opts,
    });

    if (res.status === 401) {
      return { error: "Perlu login", status: 401 };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.message || `HTTP ${res.status}`, status: res.status };
    }

    const data = await res.json();

    // Simpan ke cache
    if (ttl && !opts.method) {
      _cache.set(path, { data, ts: Date.now() });
    }

    return { data, status: res.status };
  } catch (err) {
    if (err.name === "AbortError") return { error: "Dibatalkan", status: 0 };
    return { error: err.message || "Gagal terhubung ke server", status: 0 };
  }
}

/**
 * POST ke API.
 * @param {string} path
 * @param {object} body
 */
export function apiPost(path, body) {
  return apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Invalidasi cache untuk path tertentu.
 * @param {string} path
 */
export function invalidateCache(path) {
  _cache.delete(path);
}

/**
 * Polling sederhana, panggil fn setiap intervalMs.
 * Berhenti saat AbortSignal dikirim.
 *
 * @param {Function} fn
 * @param {number} intervalMs
 * @param {AbortSignal} [signal]
 */
export function startPolling(fn, intervalMs, signal) {
  fn(); // Langsung panggil sekali dulu
  const id = setInterval(() => {
    if (signal?.aborted) { clearInterval(id); return; }
    fn();
  }, intervalMs);
  signal?.addEventListener("abort", () => clearInterval(id));
  return id;
}
