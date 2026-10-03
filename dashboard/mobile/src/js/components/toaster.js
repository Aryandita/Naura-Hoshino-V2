/**
 * toaster.js, Toast notification system untuk Naura OS Mobile.
 *
 * Tujuan UX: Memberikan umpan balik instan untuk aksi pengguna
 * (berhasil transfer, gagal simpan, dsb.) tanpa mengganggu layout.
 * Toast otomatis hilang setelah 3 detik.
 */

/** @type {HTMLElement | null} */
let _container = null;

/** Tipe toast dan ikonnya */
const ICONS = {
  success: "fa-circle-check",
  error:   "fa-circle-xmark",
  warn:    "fa-triangle-exclamation",
  info:    "fa-circle-info",
};

/**
 * Tampilkan toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warn'|'info'} [type='info']
 * @param {number} [duration=3000]
 */
export function showToast(message, type = "info", duration = 3000) {
  _ensureContainer();

  const toast = document.createElement("div");
  toast.className = `nm-toast nm-toast--${type}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");

  toast.innerHTML = `
    <i class="fa-solid ${ICONS[type] || ICONS.info}" aria-hidden="true"
       style="color: ${_colorFor(type)}; flex-shrink:0; font-size:0.9rem"></i>
    <span style="flex:1; font-size:0.8125rem">${_escHtml(message)}</span>
  `;

  _container.appendChild(toast);

  // Hapus setelah duration
  setTimeout(() => _dismiss(toast), duration);
}

// ── Shorthand helpers ────────────────────────────────────────────────────────

/** @param {string} msg */
export const toastSuccess = (msg) => showToast(msg, "success");
/** @param {string} msg */
export const toastError   = (msg) => showToast(msg, "error");
/** @param {string} msg */
export const toastWarn    = (msg) => showToast(msg, "warn");
/** @param {string} msg */
export const toastInfo    = (msg) => showToast(msg, "info");

/**
 * Toast helper yang menerima opsi object { title, body, variant, duration }
 */
export function toast({ title, body, variant = "info", duration = 3000 } = {}) {
  const msg = title ? (body ? `${title} - ${body}` : title) : (body || "");
  const type = variant === "danger" ? "error" : variant;
  return showToast(msg, type, duration);
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _ensureContainer() {
  if (_container && document.body.contains(_container)) return;
  _container = document.getElementById("nm-toast-container");
  if (!_container) {
    _container = document.createElement("div");
    _container.id = "nm-toast-container";
    document.body.appendChild(_container);
  }
}

function _dismiss(el) {
  el.classList.add("is-leaving");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  // Fallback jika animasi tidak jalan (prefers-reduced-motion)
  setTimeout(() => el.remove(), 500);
}

function _colorFor(type) {
  return {
    success: "var(--status-online)",
    error:   "var(--status-offline)",
    warn:    "var(--status-warn)",
    info:    "var(--accent-blue)",
  }[type] || "var(--accent-blue)";
}

function _escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
