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
    pillar: "kontrol",
    href: "/mobile/",
  },
  {
    id: "survival",
    title: "Naura Wilds",
    desc: "Status vital, stamina & radar survival",
    icon: "fa-shield-halved",
    color: "#86efac",
    pillar: "adisha",
    href: "/mobile/survival",
  },
  {
    id: "inventory",
    title: "Ransel & Tas",
    desc: "Kelola item, material & fusi alat",
    icon: "fa-box-open",
    color: "#fbbf24",
    pillar: "adisha",
    href: "/mobile/inventory",
  },
  {
    id: "clan",
    title: "Klan & Sindikat",
    desc: "Aliansi teritori & perang distrik",
    icon: "fa-chess-rook",
    color: "#c084fc",
    pillar: "adisha",
    href: "/mobile/clan",
  },
  {
    id: "marketplace",
    title: "Pasar Galaksi",
    desc: "Bursa lelang & transaksi komoditas",
    icon: "fa-shop",
    color: "#38bdf8",
    pillar: "adisha",
    href: "/mobile/marketplace",
  },
  {
    id: "arcade",
    title: "Retro Arcade",
    desc: "Mini-game santai berhadiah NSF",
    icon: "fa-gamepad",
    color: "#f43f5e",
    pillar: "ekskul",
    href: "/mobile/arcade",
  },
  {
    id: "music",
    title: "Audio & DJ",
    desc: "Player musik, antrean & live voice",
    icon: "fa-music",
    color: "#93c5fd",
    pillar: "kontrol",
    href: "/mobile/music",
  },
  {
    id: "economy",
    title: "Ekonomi Server",
    desc: "Dompet, bank & peredaran koin",
    icon: "fa-coins",
    color: "#ffd700",
    pillar: "kontrol",
    href: "/mobile/economy",
  },
  {
    id: "leaderboard",
    title: "Papan Peringkat",
    desc: "Ranking petualang teratas",
    icon: "fa-ranking-star",
    color: "#a78bfa",
    pillar: "ekskul",
    href: "/mobile/leaderboard",
  },
  {
    id: "profile",
    title: "Profil & Kartu",
    desc: "Kartu identitas & koleksi kartu",
    icon: "fa-user",
    color: "#f472b6",
    pillar: "ekskul",
    href: "/mobile/profile",
  },
  {
    id: "config",
    title: "Pengaturan Server",
    desc: "Konfigurasi bot, prefix & automod",
    icon: "fa-sliders",
    color: "#6ee7b7",
    pillar: "kontrol",
    href: "/mobile/config",
  },
  {
    id: "soundboard",
    title: "Soundboard Studio",
    desc: "Papan efek suara audio interaktif",
    icon: "fa-bullhorn",
    color: "#e879f9",
    pillar: "kontrol",
    href: "/soundboard",
  },
  {
    id: "tickets",
    title: "Tiket Bantuan",
    desc: "Pusat bantuan & pengaduan",
    icon: "fa-ticket",
    color: "#facc15",
    pillar: "kontrol",
    href: "/tickets",
  },
  {
    id: "portfolio",
    title: "Showcase Portofolio",
    desc: "Halaman pameran karya member",
    icon: "fa-id-badge",
    color: "#60a5fa",
    pillar: "ekskul",
    href: "/portfolio",
  },
  {
    id: "welcomer",
    title: "Studio Welcomer",
    desc: "Desain kartu sambutan member baru",
    icon: "fa-wand-magic-sparkles",
    color: "#fb7185",
    pillar: "ekskul",
    href: "/welcomer",
  },
  {
    id: "automations",
    title: "Automasi Server",
    desc: "Pemicu dan aksi terjadwal",
    icon: "fa-bolt",
    color: "#34d399",
    pillar: "kontrol",
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

        <div class="nm-drawer-tabs" role="tablist" style="display:flex;gap:6px;padding:8px 16px;overflow-x:auto;">
          <button type="button" class="nm-tab-btn active" data-filter="all" style="padding:4px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:11px;cursor:pointer;">Semua (16)</button>
          <button type="button" class="nm-tab-btn" data-filter="ekskul" style="padding:4px 10px;border-radius:12px;border:1px solid rgba(244,114,182,0.3);background:transparent;color:#f472b6;font-size:11px;cursor:pointer;">🌸 Ekskul (5)</button>
          <button type="button" class="nm-tab-btn" data-filter="adisha" style="padding:4px 10px;border-radius:12px;border:1px solid rgba(52,211,153,0.3);background:transparent;color:#34d399;font-size:11px;cursor:pointer;">🏕️ Adisha (4)</button>
          <button type="button" class="nm-tab-btn" data-filter="kontrol" style="padding:4px 10px;border-radius:12px;border:1px solid rgba(34,211,238,0.3);background:transparent;color:#22d3ee;font-size:11px;cursor:pointer;">🎛️ Kontrol (7)</button>
        </div>

        <div class="nm-drawer-grid">
          ${ALL_APPS.map((app) => {
            const isActive = currentPath === app.href.replace(/\/$/, "");
            return `
              <a href="${app.href}" class="nm-drawer-card ${isActive ? "is-active" : ""}" data-pillar="${app.pillar}">
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

  // Filter tab buttons
  overlay.querySelectorAll(".nm-tab-btn").forEach((tab) => {
    tab.addEventListener("click", () => {
      overlay.querySelectorAll(".nm-tab-btn").forEach((t) => {
        t.classList.remove("active");
        t.style.background = "transparent";
      });
      tab.classList.add("active");
      tab.style.background = "rgba(255, 255, 255, 0.12)";
      const filter = tab.getAttribute("data-filter");
      overlay.querySelectorAll(".nm-drawer-card").forEach((card) => {
        const pillar = card.getAttribute("data-pillar");
        if (filter === "all" || pillar === filter) {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  });

  // Hubungkan ke semua tombol pemicu apps drawer di halaman
  document.querySelectorAll("[data-action='open-apps-drawer'], #nm-open-apps").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openDrawer();
    });
  });
}
