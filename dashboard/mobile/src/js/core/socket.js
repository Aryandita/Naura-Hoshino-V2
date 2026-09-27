/**
 * socket.js, Socket.IO connection manager untuk Naura OS Mobile.
 *
 * Mengelola koneksi tunggal ke Socket.IO server, distribusi event
 * ke subscriber per-halaman, dan reconnect otomatis.
 */

/** @type {import('socket.io-client').Socket | null} */
let _socket = null;

/** @type {Map<string, Set<Function>>} */
const _listeners = new Map();

/**
 * Inisialisasi koneksi Socket.IO (idempotent).
 * @returns {import('socket.io-client').Socket}
 */
export function initSocket() {
  if (_socket && _socket.connected) return _socket;

  // io() tersedia secara global dari /socket.io/socket.io.js
  _socket = window.io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  _socket.on("connect", () => {
    console.debug("[Socket] Terhubung:", _socket.id);
    _dispatch("connect", { id: _socket.id });
  });

  _socket.on("disconnect", (reason) => {
    console.debug("[Socket] Putus:", reason);
    _dispatch("disconnect", { reason });
  });

  _socket.on("stats_update",     (d) => _dispatch("stats_update", d));
  _socket.on("music_state",      (d) => _dispatch("music_state", d));
  _socket.on("survival_update",  (d) => _dispatch("survival_update", d));
  _socket.on("guild_settings",   (d) => _dispatch("guild_settings", d));

  return _socket;
}

/**
 * Daftarkan listener untuk event tertentu.
 * @param {string} event
 * @param {Function} fn
 * @returns {Function} fungsi unsubscribe
 */
export function on(event, fn) {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event).add(fn);

  return () => {
    _listeners.get(event)?.delete(fn);
  };
}

/**
 * Kirim event ke server (fire-and-forget).
 * @param {string} event
 * @param {*} data
 */
export function emit(event, data) {
  if (!_socket) { console.warn("[Socket] Belum terhubung"); return; }
  _socket.emit(event, data);
}

function _dispatch(event, data) {
  _listeners.get(event)?.forEach((fn) => {
    try { fn(data); } catch (e) { console.error("[Socket] Error listener:", event, e); }
  });
}

/** Kembalikan status koneksi saat ini. */
export function isConnected() {
  return Boolean(_socket?.connected);
}
