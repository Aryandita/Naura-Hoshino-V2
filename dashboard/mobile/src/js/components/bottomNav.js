/**
 * bottomNav.js, 7-tab Floating Glass Bottom Navigation.
 *
 * UX basis: DESIGN.md Pilar 4, Thumb Zone Ergonomics.
 * - Touch target min 48×48px per tab.
 * - Spring animation saat perpindahan tab (tab-pop keyframe).
 * - State ditentukan dari window.location.pathname agar deep link bisa.
 * - Tiap tab punya accent warna sesuai kategori (DESIGN.md Categorical Color).
 */

import { initAppsDrawer } from "./appsDrawer.js";

/** Definisi 7 tab navigasi utama */
const NAV_TABS = [
  {
    id: "home",
    icon: "fa-house",
    label: "Beranda",
    href: "/mobile/",
    accent: "var(--primary)",
    match: ["/mobile/", "/mobile/index.html"],
  },
  {
    id: "survival",
    icon: "fa-shield-halved",
    label: "Wilds",
    href: "/mobile/survival",
    accent: "var(--wilds-emerald)",
    match: ["/mobile/survival"],
  },
  {
    id: "music",
    icon: "fa-music",
    label: "Musik",
    href: "/mobile/music",
    accent: "var(--accent-blue)",
    match: ["/mobile/music"],
  },
  {
    id: "economy",
    icon: "fa-coins",
    label: "Ekonomi",
    href: "/mobile/economy",
    accent: "var(--accent-gold)",
    match: ["/mobile/economy"],
  },
  {
    id: "leaderboard",
    icon: "fa-ranking-star",
    label: "Ranking",
    href: "/mobile/leaderboard",
    accent: "var(--accent-purple)",
    match: ["/mobile/leaderboard"],
  },
  {
    id: "config",
    icon: "fa-sliders",
    label: "Config",
    href: "/mobile/config",
    accent: "var(--accent-purple)",
    match: ["/mobile/config"],
  },
  {
    id: "profile",
    icon: "fa-user",
    label: "Profil",
    href: "/mobile/profile",
    accent: "var(--primary)",
    match: ["/mobile/profile"],
  },
];

/**
 * Render dan inisialisasi bottom navigation.
 * Dipanggil dari setiap halaman saat DOM ready.
 */
export function initBottomNav() {
  initAppsDrawer();

  // Pastikan tombol Pusat Fitur (Apps Drawer) hadir di header jika header ada
  const headerActions = document.querySelector(".nm-header__actions");
  if (headerActions && !document.getElementById("nm-open-apps")) {
    const appsBtn = document.createElement("button");
    appsBtn.id = "nm-open-apps";
    appsBtn.className = "nm-header__btn";
    appsBtn.setAttribute("aria-label", "Pusat Fitur");
    appsBtn.setAttribute("title", "Semua Fitur Naura OS");
    appsBtn.innerHTML = '<i class="fa-solid fa-cubes" aria-hidden="true"></i>';
    headerActions.prepend(appsBtn);
    appsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const overlay = document.getElementById("nm-apps-drawer-overlay");
      if (overlay) {
        overlay.classList.add("is-open");
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }
    });
  }

  const nav = document.getElementById("nm-bottom-nav");
  if (!nav) return;

  const currentPath = _normalizePath(window.location.pathname);

  nav.innerHTML = NAV_TABS.map((tab) => {
    const isActive = tab.match.some((m) => currentPath === m || currentPath.startsWith(m + "/"));
    return `
      <a
        href="${tab.href}"
        class="nm-nav-tab ${isActive ? "is-active" : ""}"
        aria-label="${tab.label}"
        aria-current="${isActive ? "page" : "false"}"
        style="--tab-accent: ${tab.accent}"
        id="nav-tab-${tab.id}"
      >
        <i class="fa-solid ${tab.icon}" aria-hidden="true"></i>
        <span class="nm-nav-tab__label">${tab.label}</span>
      </a>
    `;
  }).join("");

  // Intercept klik, SPA-style navigation jika halaman ada
  nav.addEventListener("click", (e) => {
    const anchor = e.target.closest(".nm-nav-tab");
    if (!anchor) return;

    // Aktifkan tab secara visual segera (tanpa nunggu load)
    nav.querySelectorAll(".nm-nav-tab").forEach((t) => t.classList.remove("is-active"));
    anchor.classList.add("is-active");
  });
}

/**
 * Normalisasi path, hapus trailing slash kecuali root.
 * @param {string} path
 * @returns {string}
 */
function _normalizePath(path) {
  if (path === "/mobile/" || path === "/mobile") return "/mobile/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}
