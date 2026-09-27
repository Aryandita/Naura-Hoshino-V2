/**
 * bottomNav.js, 7-tab Floating Glass Bottom Navigation.
 *
 * UX basis: DESIGN.md Pilar 4, Thumb Zone Ergonomics.
 * - Touch target min 48×48px per tab.
 * - Spring animation saat perpindahan tab (tab-pop keyframe).
 * - State ditentukan dari window.location.pathname agar deep link bisa.
 * - Tiap tab punya accent warna sesuai kategori (DESIGN.md Categorical Color).
 */

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
