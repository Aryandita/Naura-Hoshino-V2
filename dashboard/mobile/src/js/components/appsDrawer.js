/**
 * appsDrawer.js - Pusat Fitur Lengkap Naura OS Mobile.
 *
 * Memberikan akses satu-sentuhan ke seluruh modul dan halaman dashboard,
 * menghadirkan kekayaan fitur yang setara dengan dashboard desktop utama.
 * Mematuhi DESIGN.md Pilar 4: Thumb Zone Ergonomics & Bottom Sheet.
 */

const ALL_APPS = [
  {
    id: "home",
    title: "Beranda",
    desc: "Ringkasan sistem & telemetri bot",
    icon: "fa-house",
    color: "#f9a8d4",
    href: "/mobile/",
  },
  {
    id: "survival",
    title: "Naura Wilds",
    desc: "Status vital, stamina & radar survival",
    icon: "fa-shield-halved",
    color: "#86efac",
    href: "/mobile/survival",
  },
  {
    id: "inventory",
    title: "Ransel & Tas",
    desc: "Kelola item, material & fusi alat",
    icon: "fa-box-open",
    color: "#fbbf24",
    href: "/mobile/inventory",
  },
  {
    id: "clan",
    title: "Klan & Sindikat",
    desc: "Aliansi teritori & perang distrik",
    icon: "fa-chess-rook",
    color: "#c084fc",
    href: "/mobile/clan",
  },
  {
    id: "marketplace",
    title: "Pasar Galaksi",
    desc: "Bursa lelang & transaksi komoditas",
    icon: "fa-shop",
    color: "#38bdf8",
    href: "/mobile/marketplace",
  },
  {
    id: "arcade",
    title: "Retro Arcade",
    desc: "Mini-game santai berhadiah NSF",
    icon: "fa-gamepad",
    color: "#f43f5e",
    href: "/mobile/arcade",
  },
  {
    id: "music",
    title: "Audio & DJ",
    desc: "Player musik, antrean & live voice",
    icon: "fa-music",
    color: "#93c5fd",
    href: "/mobile/music",
  },
  {
    id: "economy",
    title: "Ekonomi Server",
    desc: "Dompet, bank & peredaran koin",
    icon: "fa-coins",
    color: "#ffd700",
    href: "/mobile/economy",
  },
  {
    id: "leaderboard",
    title: "Papan Peringkat",
    desc: "Ranking petualang teratas",
    icon: "fa-ranking-star",
    color: "#a78bfa",
    href: "/mobile/leaderboard",
  },
  {
    id: "profile",
    title: "Profil & Kartu",
    desc: "Kartu identitas & koleksi kartu",
    icon: "fa-user",
    color: "#f472b6",
    href: "/mobile/profile",
  },
  {
    id: "config",
    title: "Pengaturan Server",
    desc: "Konfigurasi bot, prefix & automod",
    icon: "fa-sliders",
    color: "#6ee7b7",
    href: "/mobile/config",
  },
  {
    id: "soundboard",
    title: "Soundboard Studio",
    desc: "Papan efek suara audio interaktif",
    icon: "fa-bullhorn",
    color: "#e879f9",
    href: "/soundboard",
  },
  {
    id: "tickets",
    title: "Tiket Bantuan",
    desc: "Pusat bantuan & pengaduan",
    icon: "fa-ticket",
    color: "#facc15",
    href: "/tickets",
  },
  {
    id: "portfolio",
    title: "Showcase Portofolio",
    desc: "Halaman pameran karya member",
    icon: "fa-id-badge",
    color: "#60a5fa",
    href: "/portfolio",
  },
  {
    id: "welcomer",
    title: "Studio Welcomer",
    desc: "Desain kartu sambutan member baru",
    icon: "fa-wand-magic-sparkles",
    color: "#fb7185",
    href: "/welcomer",
  },
  {
    id: "automations",
    title: "Automasi Server",
    desc: "Pemicu dan aksi terjadwal",
    icon: "fa-bolt",
    color: "#34d399",
    href: "/automations",
  },
];

/**
 * Inisialisasi Apps Drawer di halaman mobile.
 */
export function initAppsDrawer() {
  if (document.getElementById("nm-apps-drawer-overlay")) return;

  const currentPath = window.location.pathname.replace(/\/$/, "");

  // Buat DOM Drawer Modal
  const drawerHtml = `
    <div id="nm-apps-drawer-overlay" class="nm-drawer-overlay" aria-hidden="true">
      <div class="nm-drawer-sheet" role="dialog" aria-modal="true" aria-label="Semua Fitur Naura OS">
        <div class="nm-drawer-handle"></div>
        <div class="nm-drawer-header">
          <div class="nm-drawer-title-group">
            <span class="nm-badge nm-badge--pink">Pusat Fitur</span>
            <h2 class="nm-drawer-title">Jelajahi Fitur Naura OS</h2>
          </div>
          <button id="nm-close-apps-drawer" class="nm-header__btn" aria-label="Tutup menu">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="nm-drawer-grid">
          ${ALL_APPS.map((app) => {
            const isActive = currentPath === app.href.replace(/\/$/, "");
            return `
              <a href="${app.href}" class="nm-drawer-card ${isActive ? "is-active" : ""}">
                <div class="nm-drawer-card__icon" style="background:${app.color}22; color:${app.color}; border-color:${app.color}44;">
                  <i class="fa-solid ${app.icon}"></i>
                </div>
                <div class="nm-drawer-card__info">
                  <div class="nm-drawer-card__title">${app.title}</div>
                  <div class="nm-drawer-card__desc">${app.desc}</div>
                </div>
              </a>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", drawerHtml);

  // Pasang event listener buka/tutup
  const overlay = document.getElementById("nm-apps-drawer-overlay");
  const closeBtn = document.getElementById("nm-close-apps-drawer");

  const openDrawer = () => {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDrawer();
  });

  // Hubungkan ke semua tombol pemicu apps drawer di halaman
  document.querySelectorAll("[data-action='open-apps-drawer'], #nm-open-apps").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openDrawer();
    });
  });
}
