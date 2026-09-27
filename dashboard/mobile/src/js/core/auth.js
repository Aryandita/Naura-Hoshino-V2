/**
 * auth.js, Auth state manager untuk Naura OS Mobile.
 *
 * Menyimpan state login user di memory (session cookie dikelola Express).
 * Menyediakan helper redirect ke /auth/discord jika belum login.
 */

import { apiFetch } from "./api.js";

/** @type {UserState | null} */
let _user = null;
let _fetching = false;
const _callbacks = new Set();

/**
 * Ambil data user yang sedang login.
 * Mengembalikan null jika belum login.
 * @returns {Promise<UserState|null>}
 */
export async function getUser() {
  if (_user) return _user;
  if (_fetching) {
    // Tunggu fetch selesai
    return new Promise((resolve) => {
      const unsub = onAuthChange((u) => { unsub(); resolve(u); });
    });
  }

  _fetching = true;
  const { data, status } = await apiFetch("/api/user/me");

  if (status === 401 || !data) {
    _user = null;
  } else {
    _user = data;
  }

  _fetching = false;
  _callbacks.forEach((fn) => fn(_user));
  return _user;
}

/**
 * Daftarkan callback saat state auth berubah.
 * @param {Function} fn
 * @returns {Function} unsubscribe
 */
export function onAuthChange(fn) {
  _callbacks.add(fn);
  return () => _callbacks.delete(fn);
}

/** Apakah user sedang login? */
export function isLoggedIn() {
  return Boolean(_user);
}

/** Redirect ke Discord OAuth2 login. */
export function redirectToLogin() {
  const returnTo = encodeURIComponent(window.location.pathname);
  window.location.href = `/auth/discord?returnTo=${returnTo}`;
}

/** Logout: hapus sesi dan redirect ke beranda. */
export function logout() {
  _user = null;
  window.location.href = "/auth/logout";
}

/** Invalidasi cache user (panggil setelah update profil). */
export function invalidateUser() {
  _user = null;
}

/**
 * @typedef {Object} UserState
 * @property {string} id
 * @property {string} username
 * @property {string} displayName
 * @property {string} avatar
 * @property {string[]} guilds
 * @property {boolean} isOwner
 */
