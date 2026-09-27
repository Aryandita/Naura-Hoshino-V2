/**
 * theme.js, Theme customization engine untuk Naura OS Mobile.
 *
 * Menyimpan preferensi ke localStorage, menerapkan ke CSS variables
 * secara langsung tanpa reload halaman.
 * UX: IKEA Effect (DESIGN.md §4), pengguna merasa memiliki dashboard.
 */

const STORAGE_KEY  = "naura-mobile-theme";
const WIDGET_KEY   = "naura-mobile-widgets";

/** Preset tema resmi dari DESIGN.md */
export const PRESETS = [
  { id: "midnight", label: "Midnight",   primary: "#FFB6C1", canvas: "#0b0c10" },
  { id: "sakura",   label: "Sakura",     primary: "#ff9ebb", canvas: "#160f18" },
  { id: "oled",     label: "OLED",       primary: "#ff5c8a", canvas: "#000000" },
  { id: "wilds",    label: "Naura Wilds",primary: "#86EFAC", canvas: "#0a1a0f" },
];

/** 12 swatch aksen warna yang bisa dipilih */
export const ACCENT_SWATCHES = [
  "#FFB6C1", "#f9a8d4", "#ff9ebb", "#ff5c8a",
  "#c084fc", "#93c5fd", "#7dd3fc", "#86efac",
  "#34d399", "#fbbf24", "#ffd700", "#f87171",
];

/** @returns {ThemeConfig} */
export function loadTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : _defaults();
  } catch {
    return _defaults();
  }
}

/**
 * Terapkan konfigurasi tema ke dokumen.
 * @param {ThemeConfig} cfg
 */
export function applyTheme(cfg) {
  const root = document.documentElement;

  // Terapkan preset data-theme
  root.dataset.theme = cfg.preset || "midnight";

  // Override primary jika ada custom accent
  if (cfg.accent) {
    root.style.setProperty("--primary", cfg.accent);
    root.style.setProperty(
      "--primary-glow",
      _hexToRgba(cfg.accent, 0.55),
    );
  }

  // Font size
  root.dataset.fontSize = cfg.fontSize || "normal";

  // Animasi toggle
  if (!cfg.animation) {
    root.classList.add("motion-reduce");
  } else {
    root.classList.remove("motion-reduce");
  }
}

/**
 * Simpan dan terapkan tema baru.
 * @param {Partial<ThemeConfig>} updates
 */
export function saveTheme(updates) {
  const current = loadTheme();
  const next = { ...current, ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyTheme(next);
  return next;
}

/** Reset ke default Midnight. */
export function resetTheme() {
  localStorage.removeItem(STORAGE_KEY);
  applyTheme(_defaults());
}

// ── Widget order ────────────────────────────────────────────────────────────

/**
 * @returns {string[]} urutan widget ID
 */
export function loadWidgetOrder() {
  try {
    const raw = localStorage.getItem(WIDGET_KEY);
    return raw ? JSON.parse(raw) : _defaultWidgets();
  } catch {
    return _defaultWidgets();
  }
}

/** @param {string[]} order */
export function saveWidgetOrder(order) {
  localStorage.setItem(WIDGET_KEY, JSON.stringify(order));
}

// ── Internal ────────────────────────────────────────────────────────────────

function _defaults() {
  return {
    preset:    "midnight",
    accent:    null,
    animation: true,
    fontSize:  "normal",
  };
}

function _defaultWidgets() {
  return ["bot-status", "now-playing", "survival-vitals", "services"];
}

function _hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * @typedef {Object} ThemeConfig
 * @property {string} preset
 * @property {string|null} accent
 * @property {boolean} animation
 * @property {'compact'|'normal'|'large'} fontSize
 */
