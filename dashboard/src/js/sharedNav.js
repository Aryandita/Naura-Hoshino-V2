/**
 * sharedNav.js - Inisialisasi Navigasi Bersama & Tata Letak Dashboard.
 *
 * Mengelola interaksi menu navigasi (sidebar toggle, mobile drawer),
 * transisi halaman, dismiss layar loading, toast notifikasi,
 * serta pemuatan otomatis modul otentikasi dan telemetri realtime.
 */

(function () {
    'use strict';

    // ── 0. Sanitasi HTML Global (Cegah XSS pada template literal) ─────────────
    if (typeof window !== 'undefined' && !window.escapeHtml) {
        window.escapeHtml = function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
    }

    // ── 1. Pengendali Sidebar & Mobile Drawer ─────────────────────────
    const sidebarElement = document.querySelector('.sidebar');
    const overlayElement = document.querySelector('.sidebar-overlay');
    const hamburgerButton = document.querySelector('.hamburger-btn');

    function openSidebar() {
        const sidebar = sidebarElement || document.querySelector('.sidebar');
        const overlay = overlayElement || document.querySelector('.sidebar-overlay');
        const hamburger = hamburgerButton || document.querySelector('.hamburger-btn');
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        if (hamburger) {
            hamburger.setAttribute('aria-expanded', 'true');
        }
    }

    function closeSidebar() {
        const sidebar = sidebarElement || document.querySelector('.sidebar');
        const overlay = overlayElement || document.querySelector('.sidebar-overlay');
        const hamburger = hamburgerButton || document.querySelector('.hamburger-btn');
        if (!sidebar) return;
        sidebar.classList.remove('open');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        if (hamburger) {
            hamburger.setAttribute('aria-expanded', 'false');
        }
    }

    function updateCollapseBtnIcon(isCollapsed) {
        const btn = document.getElementById('sidebarCollapseBtn') || document.querySelector('.sidebar-collapse-btn');
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isCollapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left';
        }
        btn.setAttribute('title', isCollapsed ? 'Bentangkan Sidebar (Ctrl+B)' : 'Ciutkan Sidebar (Ctrl+B)');
    }

    function toggleSidebar() {
        const sidebar = sidebarElement || document.querySelector('.sidebar');
        if (!sidebar) return;
        if (window.innerWidth <= 1024) {
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        } else {
            const willCollapse = !sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed', willCollapse);
            updateCollapseBtnIcon(willCollapse);
            try {
                localStorage.setItem('naura_sidebar_collapsed', String(willCollapse));
            } catch (_) {}
        }
    }

    // Delegasi klik terpadu untuk semua pemicu navigasi
    document.addEventListener('click', (clickEvent) => {
        const collapseTrigger = clickEvent.target.closest('#sidebarCollapseBtn, .sidebar-collapse-btn');
        if (collapseTrigger) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            toggleSidebar();
            return;
        }

        const hamburgerTrigger = clickEvent.target.closest('#hamburgerBtn, .hamburger-btn');
        if (hamburgerTrigger) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            toggleSidebar();
            return;
        }

        const closeTrigger = clickEvent.target.closest('#sidebarCloseBtn, .sidebar-close-btn');
        if (closeTrigger) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            closeSidebar();
            return;
        }

        const overlay = overlayElement || document.querySelector('.sidebar-overlay');
        if (overlay && clickEvent.target === overlay) {
            closeSidebar();
            return;
        }

        // Tutup drawer di layar seluler saat tautan navigasi diklik
        const navItem = clickEvent.target.closest('.sidebar .nav-item, .mobile-nav-item');
        if (navItem && window.innerWidth <= 1024) {
            closeSidebar();
        }
    });

    // Pulihkan status compact tersimpan di desktop saat bootstrap
    try {
        const savedCollapsed = localStorage.getItem('naura_sidebar_collapsed') === 'true';
        if (savedCollapsed && window.innerWidth > 1024) {
            const sidebar = sidebarElement || document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
                updateCollapseBtnIcon(true);
            }
        }
    } catch (_) {}

    // Pintasan keyboard: Escape untuk menutup drawer, Ctrl+B untuk ciutkan/bentangkan
    document.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key === 'Escape') {
            closeSidebar();
        }
        if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.key.toLowerCase() === 'b') {
            const targetTag = keyEvent.target?.tagName;
            if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || keyEvent.target?.isContentEditable) return;
            keyEvent.preventDefault();
            toggleSidebar();
        }
    });

    // ── 2. Definisi 3 Pilar Ekosistem Kanonikal & Active Pillar State ────
    const PILLARS = {
        ekskul: {
            id: 'ekskul',
            name: 'Senja Ruang Ekskul',
            shortLabel: 'Ekskul',
            icon: '🌸',
            primaryRoute: '/profile',
            color: '#f472b6',
            pages: [
                { path: '/profile', label: 'Profil Petualang', icon: 'fa-solid fa-id-card', desc: 'Identitas Discord, statistik RPG & 34 trofi' },
                { path: '/achievements', label: 'Ruang Trofi', icon: 'fa-solid fa-trophy', desc: '34 pencapaian eksklusif & gelar petualang' },
                { path: '/feed', label: 'Mading Komunitas', icon: 'fa-solid fa-rss', desc: 'Log aktivitas realtime & interaksi pengguna' },
                { path: '/leaderboard', label: 'Peringkat Bintang Global', icon: 'fa-solid fa-ranking-star', desc: 'Peringkat level EXP dan kekayaan server' },
                { path: '/arcade', label: 'Retro Arcade', icon: 'fa-solid fa-gamepad', desc: 'Mini-games retro ritme & serpihan bintang' },
                { path: '/lounge', label: 'Cyber Lounge Naura', icon: 'fa-solid fa-wand-magic-sparkles', desc: 'Ruang interaksi komunitas 3D & AI companion' },
                { path: '/portfolio', label: 'Portofolio Kreator', icon: 'fa-solid fa-id-badge', desc: 'Showcase fitur & profil kreator bot' },
                { path: '/welcomer', label: 'Sambutan Anggota Baru', icon: 'fa-solid fa-palette', desc: 'Desain canvas kartu sambutan member baru' }
            ]
        },
        adisha: {
            id: 'adisha',
            name: 'Jurnal Ekspedisi Dunia Adisha',
            shortLabel: 'Adisha',
            icon: '🏕️',
            primaryRoute: '/world',
            color: '#34d399',
            pages: [
                { path: '/world', label: 'World Map Aetheria', icon: 'fa-solid fa-earth-asia', desc: 'Peta benua Adisha, 6 wilayah, POI & komoditas' },
                { path: '/adisha-map', label: 'Radar Interaktif Adisha', icon: 'fa-solid fa-compass', desc: 'Radar real-time fasilitas & blip sumber daya' },
                { path: '/survival-map', label: 'Radar Fasilitas Survival', icon: 'fa-solid fa-map-location-dot', desc: 'Radar real-time fasilitas & blip sumber daya' },
                { path: '/activity', label: 'Ekspedisi & Quest Harian', icon: 'fa-solid fa-person-hiking', desc: 'Quest harian, gathering & boss fight' },
                { path: '/inventory', label: 'Tas & Ransel Petualang', icon: 'fa-solid fa-backpack', desc: 'Isi ransel petualang, material crafting & loadout' },
                { path: '/clan', label: 'Sindikat & Markas Klan', icon: 'fa-solid fa-users-rays', desc: 'Markas aliansi klan, fasilitas pertahanan & diplomasi' },
                { path: '/war-room', label: 'War Room & Siege Wilayah', icon: 'fa-solid fa-shield-halved', desc: 'Operasi klan, wilayah perang & strategi' },
                { path: '/marketplace', label: 'Balai Lelang & Pasar Adisha', icon: 'fa-solid fa-shop', desc: 'Bursa lelang P2P, perdagangan komoditas & penawaran' }
            ]
        },
        kontrol: {
            id: 'kontrol',
            name: 'Studio Kontrol OSIS',
            shortLabel: 'Kontrol',
            icon: '🎛️',
            primaryRoute: '/',
            color: '#22d3ee',
            pages: [
                { path: '/', label: 'Overview Studio Kontrol', icon: 'fa-solid fa-gauge-high', desc: 'Metrik server, CPU/RAM, dan status bot' },
                { path: '/status', label: 'Live Telemetri Shard', icon: 'fa-solid fa-signal', desc: 'Kesehatan shard & status gateway Discord' },
                { path: '/topology', label: 'Topologi Node Jaringan', icon: 'fa-solid fa-network-wired', desc: 'Diagram cluster server & visualisasi node' },
                { path: '/music', label: 'Music Hub Player', icon: 'fa-solid fa-music', desc: 'Pemutar audio Poru v5 & cluster Lavalink' },
                { path: '/soundboard', label: 'Soundboard Studio', icon: 'fa-solid fa-sliders', desc: 'Papan efek suara instant dengan SFX audio' },
                { path: '/jam', label: 'DJ Jam Session', icon: 'fa-solid fa-guitar', desc: 'Studio turntable interaktif & dual crossfader' },
                { path: '/karaoke', label: 'Studio Karaoke', icon: 'fa-solid fa-microphone', desc: 'Sinkronisasi lirik real-time & vokal' },
                { path: '/player', label: 'Web Audio Player', icon: 'fa-solid fa-circle-play', desc: 'Mini pemutar audio web interaktif' },
                { path: '/settings', label: 'Konfigurasi Server OSIS', icon: 'fa-solid fa-gears', desc: 'Konfigurasi bot, prefix, role & perizinan' },
                { path: '/automations', label: 'Engine Automasi OSIS', icon: 'fa-solid fa-robot', desc: 'Trigger otomatis, auto-response & scheduler' },
                { path: '/automod', label: 'Visual Automod Studio', icon: 'fa-solid fa-shield-cat', desc: 'Filter konten otomatis & moderasi visual' },
                { path: '/builder', label: 'Embed Builder V2', icon: 'fa-solid fa-wand-magic-sparkles', desc: 'Generator pesan interaktif Discord V2' },
                { path: '/tickets', label: 'Meja Tiket & Bantuan', icon: 'fa-solid fa-ticket', desc: 'Manajemen tiket bantuan & antrean support' },
                { path: '/economy', label: 'Bank & Kas Server', icon: 'fa-solid fa-coins', desc: 'Dompet kas server, bursa valuta & pasar saham' },
                { path: '/treasury', label: 'Kas Server Treasury', icon: 'fa-solid fa-vault', desc: 'Treasury 4-pool & alokasi finansial server' },
                { path: '/admin', label: 'God Mode Admin', icon: 'fa-solid fa-screwdriver-wrench', desc: 'Pusat kendali arsitektur, bypass mutex & flush cache' }
            ]
        }
    };

    // Backward-compatibility alias map for legacy scripts
    const ROUTE_GROUPS = PILLARS;

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    function normalizePillarKey(rawKey) {
        if (!rawKey) return null;
        const k = String(rawKey).toLowerCase().trim();
        if (['ekskul', 'naura', 'theme_naura'].includes(k)) return 'ekskul';
        if (['adisha', 'survival', 'theme_survival', 'wilds'].includes(k)) return 'adisha';
        if (['kontrol', 'dashboard', 'theme_dashboard', 'osis'].includes(k)) return 'kontrol';
        return null;
    }

    function detectPillarFromPath(pathname) {
        if (!pathname) return 'kontrol';
        const normalized = pathname.toLowerCase().replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';

        for (const page of PILLARS.ekskul.pages) {
            const p = page.path.toLowerCase();
            if (normalized === p || normalized.startsWith(p + '/')) {
                return 'ekskul';
            }
        }
        for (const page of PILLARS.adisha.pages) {
            const p = page.path.toLowerCase();
            if (normalized === p || normalized.startsWith(p + '/')) {
                return 'adisha';
            }
        }
        for (const page of PILLARS.kontrol.pages) {
            const p = page.path.toLowerCase();
            if (normalized === p || normalized.startsWith(p + '/')) {
                return 'kontrol';
            }
        }
        return 'kontrol';
    }

    function resolveActivePillar() {
        // 1. URL Query Parameter Override (?pillar=)
        try {
            const params = new URLSearchParams(window.location.search);
            const urlPillar = normalizePillarKey(params.get('pillar'));
            if (urlPillar) return urlPillar;
        } catch (_) {}

        // 2. Route Auto-Detection
        const detected = detectPillarFromPath(currentPath);
        if (currentPath && currentPath !== '/' && currentPath !== '/index.html') {
            return detected;
        }

        // 3. LocalStorage (applies when on root '/' or fallback)
        try {
            const saved = normalizePillarKey(localStorage.getItem('naura_active_pillar'));
            if (saved) return saved;
        } catch (_) {}

        // 4. Default Fallback
        return detected || 'kontrol';
    }

    let activePillar = resolveActivePillar();
    let activeGroupId = activePillar;

    // Apply immediate data-pillar to root element
    document.documentElement.setAttribute('data-pillar', activePillar);

    function updateDockIndicator(pillarId) {
        const dock = document.getElementById('pillarDock');
        const indicator = document.getElementById('pillarDockIndicator');
        if (!dock || !indicator) return;

        const activeTab = dock.querySelector(`.pillar-tab[data-pillar="${pillarId}"]`);
        if (!activeTab) return;

        dock.querySelectorAll('.pillar-tab').forEach(t => {
            const isCurrent = (t === activeTab);
            t.classList.toggle('active', isCurrent);
            t.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
        });

        const isCollapsed = document.querySelector('.sidebar')?.classList.contains('collapsed');
        if (isCollapsed) {
            indicator.style.transform = `translateY(${activeTab.offsetTop}px)`;
            indicator.style.height = `${activeTab.offsetHeight}px`;
            indicator.style.width = 'calc(100% - 6px)';
        } else {
            indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
            indicator.style.width = `${activeTab.offsetWidth}px`;
            indicator.style.height = 'calc(100% - 6px)';
        }
    }

    function setActivePillar(newPillar) {
        const normalized = normalizePillarKey(newPillar) || 'kontrol';
        const prevPillar = activePillar;
        activePillar = normalized;
        activeGroupId = activePillar;

        document.documentElement.setAttribute('data-pillar', activePillar);
        try {
            localStorage.setItem('naura_active_pillar', activePillar);
        } catch (_) {}

        updateDockIndicator(activePillar);
        filterSidebarNavigation(activePillar);

        // Update mobile bottom nav items if present
        document.querySelectorAll('.mobile-nav-item[data-pillar]').forEach(item => {
            const p = item.getAttribute('data-pillar');
            const isAct = (p === activePillar);
            item.classList.toggle('active', isAct);
            if (isAct) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });

        const event = new CustomEvent('pillarchange', {
            detail: {
                pillar: activePillar,
                previousPillar: prevPillar,
                timestamp: Date.now()
            },
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
        window.dispatchEvent(event);
    }

    function mountPillarDock() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        if (sidebar.querySelector('#pillarDockContainer')) {
            updateDockIndicator(activePillar);
            return;
        }

        const dockContainer = document.createElement('div');
        dockContainer.className = 'pillar-dock-container';
        dockContainer.id = 'pillarDockContainer';
        dockContainer.setAttribute('role', 'region');
        dockContainer.setAttribute('aria-label', '3-Pillar Ecosystem Switcher');

        dockContainer.innerHTML = `
            <div class="pillar-dock" id="pillarDock" role="tablist" aria-label="Pilih Pilar Ekosistem">
                <div class="pillar-dock-indicator" id="pillarDockIndicator" aria-hidden="true"></div>
                <button type="button" class="pillar-tab ${activePillar === 'ekskul' ? 'active' : ''}" data-pillar="ekskul" role="tab" id="tabPillarEkskul" aria-selected="${activePillar === 'ekskul' ? 'true' : 'false'}" aria-controls="sidebarNav" title="Pilar 1: Senja Ruang Ekskul">
                    <span class="pillar-tab-icon">🌸</span>
                    <span class="pillar-tab-label">Ekskul</span>
                </button>
                <button type="button" class="pillar-tab ${activePillar === 'adisha' ? 'active' : ''}" data-pillar="adisha" role="tab" id="tabPillarAdisha" aria-selected="${activePillar === 'adisha' ? 'true' : 'false'}" aria-controls="sidebarNav" title="Pilar 2: Jurnal Ekspedisi Dunia Adisha">
                    <span class="pillar-tab-icon">🏕️</span>
                    <span class="pillar-tab-label">Adisha</span>
                </button>
                <button type="button" class="pillar-tab ${activePillar === 'kontrol' ? 'active' : ''}" data-pillar="kontrol" role="tab" id="tabPillarKontrol" aria-selected="${activePillar === 'kontrol' ? 'true' : 'false'}" aria-controls="sidebarNav" title="Pilar 3: Studio Kontrol OSIS">
                    <span class="pillar-tab-icon">🎛️</span>
                    <span class="pillar-tab-label">Kontrol</span>
                </button>
            </div>
        `;

        const brand = sidebar.querySelector('.sidebar-brand');
        if (brand && brand.nextSibling) {
            sidebar.insertBefore(dockContainer, brand.nextSibling);
        } else if (brand) {
            sidebar.appendChild(dockContainer);
        } else {
            sidebar.prepend(dockContainer);
        }

        dockContainer.querySelectorAll('.pillar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const chosenPillar = tab.getAttribute('data-pillar');
                if (chosenPillar) {
                    setActivePillar(chosenPillar);
                }
            });
        });

        requestAnimationFrame(() => {
            updateDockIndicator(activePillar);
        });

        window.addEventListener('resize', () => updateDockIndicator(activePillar), { passive: true });
    }

    function tagSidebarLinks() {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav) return;

        sidebarNav.querySelectorAll('a.nav-item[href]').forEach(item => {
            const href = item.getAttribute('href') || '';
            const normalized = href.toLowerCase().replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';
            const pillar = detectPillarFromPath(normalized);
            item.setAttribute('data-pillar', pillar);
        });
    }

    function filterSidebarNavigation(pillar) {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav) return;

        tagSidebarLinks();

        let visibleIndex = 0;
        const groups = sidebarNav.querySelectorAll('.nav-group');

        groups.forEach(group => {
            const items = group.querySelectorAll('.nav-item');
            let visibleInGroup = 0;

            items.forEach(item => {
                const itemPillar = item.getAttribute('data-pillar');
                const isMatch = itemPillar === pillar || itemPillar === 'all';

                if (isMatch) {
                    item.setAttribute('data-pillar-visible', 'true');
                    item.style.setProperty('--item-idx', visibleIndex);
                    visibleIndex++;
                    visibleInGroup++;
                } else {
                    item.setAttribute('data-pillar-visible', 'false');
                }
            });

            if (visibleInGroup > 0) {
                group.setAttribute('data-group-visible', 'true');
            } else {
                group.setAttribute('data-group-visible', 'false');
            }
        });
    }

    function reconcileSidebarLinks() {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav) return;

        // Ensure canonical links exist for all 3 pillars
        for (const [pillarKey, def] of Object.entries(PILLARS)) {
            for (const page of def.pages) {
                const existing = sidebarNav.querySelector(`a[href="${page.path}"], a[href="${page.path}.html"]`);
                if (!existing) {
                    let group = sidebarNav.querySelector(`.nav-group[data-pillar="${pillarKey}"]`);
                    if (!group) {
                        group = document.createElement('div');
                        group.className = 'nav-group';
                        group.setAttribute('data-pillar', pillarKey);
                        group.innerHTML = `<div class="nav-group-label">${def.name}</div>`;
                        sidebarNav.appendChild(group);
                    }
                    const a = document.createElement('a');
                    a.href = page.path;
                    a.className = 'nav-item';
                    a.setAttribute('data-pillar', pillarKey);
                    a.innerHTML = `<span class="nav-icon"><i class="${page.icon}"></i></span><span>${page.label}</span>`;
                    group.appendChild(a);
                }
            }
        }
    }

    // ── Inisialisasi Header Bersama & Reconciler Sidebar ──
    function mountSharedNav() {
        const sharedNavContainer = document.getElementById('shared-nav');
        if (sharedNavContainer && !sharedNavContainer.hasChildNodes()) {
            sharedNavContainer.innerHTML = `
                <header class="top-header shared-top-nav">
                    <div class="header-left">
                        <a href="/" class="shared-nav-brand" title="Ke Beranda Dashboard">
                            <img src="/assets/core/avatar.png" alt="Naura" class="shared-nav-logo" onerror="this.src='/assets/core/avatar.png'">
                            <div class="shared-nav-brand-text">
                                <div class="shared-brand-name">Naura Hoshino</div>
                                <div class="shared-brand-tag">v2.5.0 · Hub</div>
                            </div>
                        </a>
                        <nav class="shared-nav-links" aria-label="Navigasi Cepat">
                            <a href="/" class="shared-nav-link ${currentPath === '/' ? 'active' : ''}"><i class="fa-solid fa-gauge-high"></i> <span>Dashboard</span></a>
                            <a href="/profile" class="shared-nav-link ${currentPath === '/profile' ? 'active' : ''}"><i class="fa-solid fa-id-card"></i> <span>Profil</span></a>
                            <a href="/world" class="shared-nav-link ${currentPath === '/world' ? 'active' : ''}"><i class="fa-solid fa-earth-asia"></i> <span>Adisha</span></a>
                            <a href="/clan" class="shared-nav-link ${currentPath === '/clan' ? 'active' : ''}"><i class="fa-solid fa-users-rays"></i> <span>Klan</span></a>
                            <a href="/economy" class="shared-nav-link ${currentPath === '/economy' ? 'active' : ''}"><i class="fa-solid fa-coins"></i> <span>Ekonomi</span></a>
                            <a href="/leaderboard" class="shared-nav-link ${currentPath === '/leaderboard' ? 'active' : ''}"><i class="fa-solid fa-trophy"></i> <span>Peringkat</span></a>
                            <a href="/music" class="shared-nav-link ${currentPath === '/music' ? 'active' : ''}"><i class="fa-solid fa-music"></i> <span>Musik</span></a>
                            <a href="/settings" class="shared-nav-link ${currentPath === '/settings' ? 'active' : ''}"><i class="fa-solid fa-gears"></i> <span>Settings</span></a>
                        </nav>
                    </div>
                    <div class="header-right"></div>
                </header>
            `;
        }

        // Pastikan container navigasi mobile ada di halaman
        let mobileNav = document.querySelector('.mobile-nav');
        if (!mobileNav) {
            mobileNav = document.createElement('nav');
            mobileNav.className = 'mobile-nav';
            mobileNav.setAttribute('aria-label', 'Navigasi Utama Mobile');
            document.body.appendChild(mobileNav);
        }
        mobileNav.innerHTML = `
            <div class="mobile-nav-inner">
                <button type="button" class="mobile-nav-item ${activePillar === 'kontrol' ? 'active' : ''}" data-pillar="kontrol" data-primary-route="/">
                    <span class="mn-icon"><i class="fa-solid fa-gauge-high"></i></span>
                    <span class="mn-label">Kontrol</span>
                </button>
                <button type="button" class="mobile-nav-item ${activePillar === 'adisha' ? 'active' : ''}" data-pillar="adisha" data-primary-route="/world">
                    <span class="mn-icon"><i class="fa-solid fa-earth-asia"></i></span>
                    <span class="mn-label">Adisha</span>
                </button>
                <button type="button" class="mobile-nav-item ${activePillar === 'ekskul' ? 'active' : ''}" data-pillar="ekskul" data-primary-route="/profile">
                    <span class="mn-icon"><i class="fa-solid fa-id-card"></i></span>
                    <span class="mn-label">Ekskul</span>
                </button>
                <a href="/music" class="mobile-nav-item ${currentPath === '/music' ? 'active' : ''}" data-pillar="kontrol">
                    <span class="mn-icon"><i class="fa-solid fa-music"></i></span>
                    <span class="mn-label">Musik</span>
                </a>
                <button type="button" class="mobile-nav-item" id="btnMobileSidebar">
                    <span class="mn-icon"><i class="fa-solid fa-bars"></i></span>
                    <span class="mn-label">Menu</span>
                </button>
            </div>
        `;

        mountPillarDock();
        reconcileSidebarLinks();
        tagSidebarLinks();
        filterSidebarNavigation(activePillar);
        initSidebarEnhancements();

        // Initialize TactileTilt micro-tilt 3D perspective
        if (typeof window.TactileTilt !== 'undefined' && typeof window.TactileTilt.init === 'function') {
            window.TactileTilt.init();
        } else if (typeof document !== 'undefined' && !document.querySelector('script[src*="tactileTilt.js"]')) {
            const tiltScript = document.createElement('script');
            tiltScript.src = '/src/js/tactileTilt.js';
            tiltScript.onload = () => {
                if (typeof window.TactileTilt !== 'undefined' && typeof window.TactileTilt.init === 'function') {
                    window.TactileTilt.init();
                }
            };
            document.head.appendChild(tiltScript);
        }
    }

    function initSidebarEnhancements() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        mountPillarDock();

        // Buat tombol collapse jika belum ada di template HTML halaman
        const sidebarBrand = sidebar.querySelector('.sidebar-brand');
        let collapseBtn = sidebar.querySelector('.sidebar-collapse-btn');
        if (sidebarBrand && !collapseBtn) {
            collapseBtn = document.createElement('button');
            collapseBtn.type = 'button';
            collapseBtn.className = 'sidebar-collapse-btn';
            collapseBtn.id = 'sidebarCollapseBtn';
            collapseBtn.title = 'Ciutkan Sidebar (Ctrl+B)';
            collapseBtn.setAttribute('aria-label', 'Toggle Compact Sidebar');
            collapseBtn.innerHTML = '<i class="fa-solid fa-angles-left"></i>';
            sidebarBrand.appendChild(collapseBtn);
        }

        if (collapseBtn && !collapseBtn.dataset.boundPillarListener) {
            collapseBtn.dataset.boundPillarListener = 'true';
            collapseBtn.addEventListener('click', () => {
                setTimeout(() => updateDockIndicator(activePillar), 280);
            });
        }

        // Pasang trigger pencarian cepat di sidebar (.sidebar-cmd-trigger)
        const sidebarNav = sidebar.querySelector('.sidebar-nav');
        if (sidebarNav && !sidebar.querySelector('.sidebar-cmd-trigger')) {
            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'sidebar-cmd-trigger';
            trigger.id = 'sidebarCmdTrigger';
            trigger.title = 'Buka Command Palette (Ctrl+K)';
            trigger.innerHTML = `
                <i class="fa-solid fa-magnifying-glass"></i>
                <span>Cari modul...</span>
                <kbd>Ctrl+K</kbd>
            `;
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                openPalette();
            });
            sidebar.insertBefore(trigger, sidebarNav);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountSharedNav);
    } else {
        mountSharedNav();
    }

    // Tandai tautan desktop sidebar
    function markActiveNavLinks() {
        document.querySelectorAll('.nav-item[href]').forEach((linkElement) => {
            const targetPath = linkElement.getAttribute('href')?.replace(/\/$/, '') || '';
            const isHomePage = (targetPath === '' || targetPath === '/') && (currentPath === '' || currentPath === '/');
            const isSubPathMatch = targetPath !== '' && targetPath !== '/' && (currentPath === targetPath || currentPath.startsWith(targetPath + '/'));
            const isActive = isHomePage || isSubPathMatch;
            linkElement.classList.toggle('active', isActive);
            if (isActive) {
                linkElement.setAttribute('aria-current', 'page');
            } else {
                linkElement.removeAttribute('aria-current');
            }
        });
    }
    markActiveNavLinks();

    // Tandai tautan mobile bottom navigation & pasang handler
    function initMobileNav() {
        markActiveNavLinks();
        document.querySelectorAll('.mobile-nav-item[data-pillar]').forEach((linkElement) => {
            const pillar = linkElement.getAttribute('data-pillar');
            const isActive = pillar === activePillar;
            linkElement.classList.toggle('active', isActive);
            if (isActive) {
                linkElement.setAttribute('aria-current', 'page');
            } else {
                linkElement.removeAttribute('aria-current');
            }
        });

        document.querySelectorAll('.mobile-nav-item[data-pillar]').forEach((item) => {
            item.addEventListener('click', (e) => {
                const pillar = item.getAttribute('data-pillar');
                if (pillar === activePillar) {
                    // Ketukan pada pilar aktif membuka Quick Switcher Sheet
                    e.preventDefault();
                    e.stopPropagation();
                    if (groupSheet && groupSheet.classList.contains('active')) {
                        closeGroupSheet();
                    } else {
                        openGroupSheet(pillar);
                    }
                } else if (pillar) {
                    e.preventDefault();
                    setActivePillar(pillar);
                }
            });
        });

        const btnMobileSidebar = document.getElementById('btnMobileSidebar');
        if (btnMobileSidebar) {
            btnMobileSidebar.addEventListener('click', (e) => {
                e.preventDefault();
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('open');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if (overlay) overlay.classList.toggle('active', sidebar.classList.contains('open'));
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
        initMobileNav();
    }

    // ── Inisialisasi Mobile Group Quick Switcher Sheet ──
    let groupOverlay = document.querySelector('.mobile-group-overlay');
    let groupSheet = document.querySelector('.mobile-group-sheet');

    if (!groupOverlay) {
        groupOverlay = document.createElement('div');
        groupOverlay.className = 'mobile-group-overlay';
        document.body.appendChild(groupOverlay);
    }

    if (!groupSheet) {
        groupSheet = document.createElement('div');
        groupSheet.className = 'mobile-group-sheet';
        groupSheet.setAttribute('role', 'dialog');
        groupSheet.setAttribute('aria-label', 'Pilih Sub-Halaman');
        document.body.appendChild(groupSheet);
    }

    function closeGroupSheet() {
        if (groupOverlay) groupOverlay.classList.remove('active');
        if (groupSheet) groupSheet.classList.remove('active');
    }

    function openGroupSheet(pillarId) {
        const pillarDef = PILLARS[pillarId];
        if (!pillarDef) return;

        groupSheet.innerHTML = `
            <div class="group-sheet-header">
                <div class="group-sheet-title">
                    <span style="font-size:16px;">${pillarDef.icon}</span>
                    <span>Menu ${pillarDef.shortLabel} (${pillarDef.pages.length} Halaman)</span>
                </div>
                <button class="group-sheet-close" id="btnCloseGroupSheet" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="group-sheet-list">
                ${pillarDef.pages.map(page => {
                    const isPageActive = (page.path === '/' && currentPath === '/') || (page.path !== '/' && (currentPath === page.path || currentPath.startsWith(page.path)));
                    return `
                        <a href="${page.path}" class="group-sheet-item ${isPageActive ? 'active' : ''}">
                            <div class="group-sheet-item-icon" style="color:${pillarDef.color};"><i class="${page.icon}"></i></div>
                            <div class="group-sheet-item-info">
                                <div class="group-sheet-item-name">${page.label}</div>
                                <div class="group-sheet-item-desc">${page.desc}</div>
                            </div>
                            ${isPageActive ? `<span style="font-size:11px;color:${pillarDef.color};font-weight:700;"><i class="fa-solid fa-check"></i></span>` : '<i class="fa-solid fa-chevron-right" style="font-size:11px;color:var(--text-muted);"></i>'}
                        </a>
                    `;
                }).join('')}
            </div>
        `;

        groupOverlay.classList.add('active');
        groupSheet.classList.add('active');

        const btnClose = groupSheet.querySelector('#btnCloseGroupSheet');
        if (btnClose) btnClose.addEventListener('click', closeGroupSheet);

        groupSheet.querySelectorAll('.group-sheet-item').forEach(link => {
            link.addEventListener('click', (ev) => {
                const href = link.getAttribute('href');
                if (href) {
                    ev.preventDefault();
                    closeGroupSheet();
                    document.body.style.opacity = '0';
                    setTimeout(() => {
                        window.location.href = href;
                    }, 150);
                }
            });
        });
    }

    if (groupOverlay) groupOverlay.addEventListener('click', closeGroupSheet);

    // Export global helpers for integration
    window.NauraPillars = {
        PILLARS,
        getActivePillar: () => activePillar,
        setActivePillar,
        resolveActivePillar,
        detectPillarFromPath
    };

    // ── 3. Transisi Halaman Mulus (Fade-In & Fade-Out) ─────────────────
    document.body.style.transition = 'opacity 0.25s ease';
    document.body.style.opacity = '1';

    function revealPage() {
        requestAnimationFrame(() => {
            document.body.style.opacity = '1';
        });
    }

    window.addEventListener('pageshow', revealPage);
    window.addEventListener('DOMContentLoaded', revealPage);
    window.addEventListener('load', revealPage);

    // Navigasi internal bertransisi halus
    document.querySelectorAll('a[href^="/"], a[href^="./"]').forEach((anchorElement) => {
        anchorElement.addEventListener('click', (navEvent) => {
            if (navEvent.defaultPrevented) return;
            if (anchorElement.classList.contains('mobile-nav-item') && anchorElement.getAttribute('data-group') === activeGroupId) {
                return;
            }
            const destinationUrl = anchorElement.getAttribute('href');
            if (!destinationUrl || navEvent.ctrlKey || navEvent.metaKey || navEvent.shiftKey) return;
            if (destinationUrl.startsWith('#') || destinationUrl === 'javascript:void(0)') return;

            // Jangan fade-out / blank jika mengklik link halaman yang sedang aktif
            const cleanDest = destinationUrl.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
            const cleanCurr = window.location.pathname.replace(/\/$/, '') || '/';
            if (cleanDest === cleanCurr) {
                navEvent.preventDefault();
                if (window.innerWidth <= 1024 && typeof closeSidebar === 'function') {
                    closeSidebar();
                }
                return;
            }

            navEvent.preventDefault();
            document.body.style.opacity = '0';
            setTimeout(() => {
                window.location.href = destinationUrl;
            }, 180);
        });
    });

    // ── 4. Penutupan Layar Loading Awal ────────────────────────────────
    const loadingScreenElement = document.querySelector('.loading-screen');
    if (loadingScreenElement) {
        const dismissLoading = () => {
            setTimeout(() => {
                loadingScreenElement.classList.add('fade-out');
                setTimeout(() => loadingScreenElement.remove(), 500);
            }, 600);
        };
        if (document.readyState === 'complete') {
            dismissLoading();
        } else {
            window.addEventListener('load', dismissLoading);
            setTimeout(dismissLoading, 1000);
        }
    }

    // ── 5. Animasi Masuk Bertahap (Staggered Animation) ───────────────
    const applyStagger = () => {
        document.querySelectorAll('.animate-in, .animate-in-left, .animate-scale').forEach((animatedElement, index) => {
            if (!animatedElement.style.animationDelay) {
                animatedElement.style.animationDelay = `${index * 0.04}s`;
            }
        });
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        applyStagger();
    } else {
        window.addEventListener('DOMContentLoaded', applyStagger);
    }

    // ── 6. Helper Notifikasi Toast Global ──────────────────────────────
    window.showToast = function (firstArg, secondArg, thirdArg) {
        let toastType = 'info';
        let messageText = '';
        let displayDuration = 3500;

        if (typeof firstArg === 'object' && firstArg !== null) {
            toastType = firstArg.type || 'info';
            messageText = firstArg.message || firstArg.text || firstArg.title || '';
            displayDuration = firstArg.duration || 3500;
        } else if (thirdArg !== undefined) {
            messageText = String(secondArg);
            toastType = String(thirdArg);
        } else {
            messageText = String(firstArg);
            toastType = secondArg || 'info';
        }

        if (window.soundManager) {
            if (toastType === 'success') {
                if (typeof window.soundManager.playCoin === 'function') window.soundManager.playCoin();
                else if (typeof window.soundManager.playSuccess === 'function') window.soundManager.playSuccess();
            } else if (toastType === 'error' && typeof window.soundManager.playError === 'function') {
                window.soundManager.playError();
            }
        }

        let toastStack = document.querySelector('.toast-stack');
        if (!toastStack) {
            toastStack = document.createElement('div');
            toastStack.className = 'toast-stack';
            document.body.appendChild(toastStack);
        }

        const typeIcons = { info: '🌸', success: '✅', error: '❌', warning: '⚠️' };
        const toastElement = document.createElement('div');
        toastElement.className = `toast ${toastType}`;
        toastElement.innerHTML = `
            <span style="font-size:18px;flex-shrink:0;">${typeIcons[toastType] || '🌸'}</span>
            <div>
                <div style="font-size:13px;color:var(--text-primary);font-weight:600;">${messageText}</div>
            </div>
            <button type="button" onclick="this.closest('.toast').remove()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>
        `;
        toastStack.appendChild(toastElement);

        setTimeout(() => {
            toastElement.style.opacity = '0';
            toastElement.style.transform = 'translateX(20px)';
            toastElement.style.transition = 'all 0.3s ease';
            setTimeout(() => toastElement.remove(), 300);
        }, displayDuration);
    };

    // ── 7. Global Skeleton & UI State Helpers ─────────────────────────
    window.showSkeleton = function (target, options = {}) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element) return;

        const count = options.count || 3;
        const type = options.type || 'card';

        if (!element.dataset.originalHtml) {
            element.dataset.originalHtml = element.innerHTML;
        }

        let skeletonHtml = '';
        if (type === 'stat') {
            skeletonHtml = Array.from({ length: count }).map(() => `
                <div class="stat-card-stellar skeleton-card">
                    <div class="stat-card-top">
                        <div class="skeleton-box skeleton-circle" style="width:36px;height:36px;"></div>
                        <div class="skeleton-box" style="width:48px;height:18px;border-radius:999px;"></div>
                    </div>
                    <div class="skeleton-box skeleton-text--title" style="width:70%;height:28px;margin-top:8px;"></div>
                    <div class="skeleton-box skeleton-text--sm" style="width:40%;"></div>
                </div>
            `).join('');
        } else if (type === 'table') {
            skeletonHtml = Array.from({ length: count }).map(() => `
                <div class="skeleton-table-row">
                    <div class="skeleton-box skeleton-circle" style="width:32px;height:32px;"></div>
                    <div style="flex:1;">
                        <div class="skeleton-box skeleton-text" style="width:50%;"></div>
                        <div class="skeleton-box skeleton-text--sm" style="width:30%;"></div>
                    </div>
                    <div class="skeleton-box" style="width:60px;height:20px;border-radius:6px;"></div>
                </div>
            `).join('');
        } else if (type === 'feed') {
            skeletonHtml = Array.from({ length: count }).map(() => `
                <div class="skeleton-table-row" style="padding:14px 10px;">
                    <div class="skeleton-box skeleton-circle" style="width:36px;height:36px;"></div>
                    <div style="flex:1;">
                        <div class="skeleton-box skeleton-text" style="width:65%;"></div>
                        <div class="skeleton-box skeleton-text--sm" style="width:40%;"></div>
                    </div>
                    <div class="skeleton-box" style="width:50px;height:12px;"></div>
                </div>
            `).join('');
        } else if (type === 'text') {
            skeletonHtml = Array.from({ length: count }).map(() => `
                <div class="skeleton-box skeleton-text" style="width:80%;"></div>
            `).join('');
        } else {
            skeletonHtml = Array.from({ length: count }).map(() => `
                <div class="card-stellar skeleton-card">
                    <div class="skeleton-box skeleton-text--title"></div>
                    <div class="skeleton-box skeleton-text"></div>
                    <div class="skeleton-box skeleton-text" style="width:80%;"></div>
                    <div class="skeleton-box skeleton-text--sm"></div>
                </div>
            `).join('');
        }

        element.innerHTML = skeletonHtml;
    };

    window.hideSkeleton = function (target, fallbackHtml = null) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element) return;
        if (fallbackHtml !== null) {
            element.innerHTML = fallbackHtml;
        } else if (element.dataset.originalHtml) {
            element.innerHTML = element.dataset.originalHtml;
            delete element.dataset.originalHtml;
        }
    };

    window.renderErrorState = function (target, options = {}) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element) return;

        const title = options.title || 'Gagal Memuat Data';
        const message = options.message || 'Terjadi gangguan jaringan atau server tidak merespons. Silakan coba lagi.';
        const retryText = options.retryText || 'Coba Lagi';
        const onRetry = options.onRetry;

        element.innerHTML = `
            <div class="error-state-card">
                <div class="error-state-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div class="error-state-title">${title}</div>
                <div class="error-state-desc">${message}</div>
                ${typeof onRetry === 'function' ? `
                    <button type="button" class="error-state-btn" id="btnRetryError">
                        <i class="fa-solid fa-arrow-rotate-right"></i>
                        <span>${retryText}</span>
                    </button>
                ` : ''}
            </div>
        `;

        if (typeof onRetry === 'function') {
            const btn = element.querySelector('#btnRetryError');
            if (btn) {
                btn.addEventListener('click', () => {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Memuat...</span>';
                    try {
                        onRetry();
                    } catch (err) {
                        console.error('[ErrorState] Retry error:', err);
                    }
                });
            }
        }
    };

    window.renderEmptyState = function (target, options = {}) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element) return;

        const icon = options.icon || 'fa-solid fa-inbox';
        const title = options.title || 'Belum Ada Data';
        const message = options.message || 'Tidak ada riwayat atau aktivitas untuk ditampilkan.';

        element.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-state-icon"><i class="${icon}"></i></div>
                <div class="error-state-title">${title}</div>
                <div class="error-state-desc">${message}</div>
            </div>
        `;
    };

    window.renderBreadcrumbs = function (target, crumbs = []) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element || !Array.isArray(crumbs) || crumbs.length === 0) return;

        element.innerHTML = `
            <nav class="breadcrumbs-stellar" aria-label="Breadcrumb">
                ${crumbs.map((crumb, idx) => {
                    const isLast = idx === crumbs.length - 1;
                    return `
                        <a href="${crumb.href || '#'}" class="breadcrumb-item ${isLast ? 'active' : ''}" ${isLast ? 'aria-current="page"' : ''}>
                            ${crumb.icon ? `<i class="${crumb.icon}"></i>` : ''}
                            <span>${crumb.label}</span>
                        </a>
                        ${!isLast ? '<span class="breadcrumb-separator"><i class="fa-solid fa-chevron-right"></i></span>' : ''}
                    `;
                }).join('')}
            </nav>
        `;
    };

    // ── 7.5. Global Toast Notification System ─────────────────────────
    let toastContainer = document.getElementById('nauraToastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'nauraToastContainer';
        toastContainer.className = 'naura-toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastContainer);
    }

    window.showToast = function (opts = {}, legacyType = 'info') {
        if (!toastContainer) return;
        let type = 'info';
        let title = '';
        let message = '';
        let duration = 4000;

        if (typeof opts === 'string') {
            message = opts;
            type = legacyType || 'info';
            title = type === 'success' ? 'Sukses' : (type === 'error' ? 'Galat' : (type === 'warn' ? 'Peringatan' : 'Informasi'));
        } else if (typeof opts === 'object' && opts !== null) {
            type = opts.type || 'info';
            title = opts.title || '';
            message = opts.message || '';
            duration = opts.duration !== undefined ? opts.duration : 4000;
        }

        const toast = document.createElement('div');
        toast.className = `naura-toast naura-toast--${type}`;

        const iconMap = {
            info: 'fa-solid fa-circle-info',
            success: 'fa-solid fa-circle-check',
            warn: 'fa-solid fa-triangle-exclamation',
            error: 'fa-solid fa-circle-xmark'
        };
        const iconClass = iconMap[type] || iconMap.info;

        toast.innerHTML = `
            <div class="naura-toast-icon"><i class="${iconClass}"></i></div>
            <div class="naura-toast-content">
                ${title ? `<div class="naura-toast-title">${title}</div>` : ''}
                <div class="naura-toast-msg">${message}</div>
            </div>
            <button type="button" class="naura-toast-close" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>
        `;

        toastContainer.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        const closeToast = () => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        };

        const closeBtn = toast.querySelector('.naura-toast-close');
        if (closeBtn) closeBtn.addEventListener('click', closeToast);

        if (duration > 0) {
            setTimeout(closeToast, duration);
        }
    };

    // ── 7.6. Dashboard Multi-Theme Engine ─────────────────────────────
    const AVAILABLE_THEMES = [
        { id: 'midnight', label: 'Midnight', icon: 'fa-solid fa-moon' },
        { id: 'sakura', label: 'Sakura', icon: 'fa-solid fa-fan' },
        { id: 'cyber-neon', label: 'Cyber Neon', icon: 'fa-solid fa-bolt' },
        { id: 'emerald-nature', label: 'Emerald Wilds', icon: 'fa-solid fa-leaf' },
        { id: 'light-horizon', label: 'Light Horizon', icon: 'fa-solid fa-sun' },
        { id: 'oled', label: 'OLED Black', icon: 'fa-solid fa-circle-half-stroke' }
    ];

    function applyTheme(themeId) {
        let validTheme = themeId;
        if (themeId === 'light') validTheme = 'light-horizon';
        if (themeId === 'dark') validTheme = 'midnight';
        if (!AVAILABLE_THEMES.some(t => t.id === validTheme)) {
            validTheme = 'midnight';
        }

        if (validTheme === 'midnight') {
            document.documentElement.removeAttribute('data-theme');
            document.body.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', validTheme);
            document.body.setAttribute('data-theme', validTheme);
        }
        localStorage.setItem('naura_theme', validTheme);

        const pill = document.getElementById('themeSwitcherPill');
        if (pill) {
            const currentObj = AVAILABLE_THEMES.find(t => t.id === validTheme) || AVAILABLE_THEMES[0];
            pill.innerHTML = `<i class="${currentObj.icon}"></i> <span>${currentObj.label}</span>`;
            pill.setAttribute('aria-label', `Palet tema aktif: ${currentObj.label}. Klik untuk ganti palet.`);
        }

        const darkLightBtn = document.getElementById('themeDarkLightToggle');
        if (darkLightBtn) {
            const isLight = validTheme === 'light-horizon';
            darkLightBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
            darkLightBtn.setAttribute('title', isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang');
            darkLightBtn.setAttribute('aria-label', isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang');
            darkLightBtn.innerHTML = `<i class="fa-solid ${isLight ? 'fa-moon' : 'fa-sun'}"></i> <span>${isLight ? 'Dark' : 'Light'}</span>`;
        }

        // A11y Live Announcer untuk pembaca layar (Screen Readers)
        let announcer = document.getElementById('a11yLiveAnnouncer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'a11yLiveAnnouncer';
            announcer.className = 'sr-only';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(announcer);
        }
        announcer.textContent = `Tema dashboard diubah ke ${validTheme === 'light-horizon' ? 'Mode Terang' : 'Mode Gelap (' + validTheme + ')'}`;
    }

    const savedTheme = localStorage.getItem('naura_theme') || 'midnight';
    applyTheme(savedTheme);
    window.setDashboardTheme = applyTheme;

    function initHeaderQuickControls() {
        const headerRight = document.querySelector('.top-header .header-right');
        if (!headerRight) return;

        // ── Search / Command Palette Button (Ctrl+K) ──
        if (!document.getElementById('paletteOpenBtn')) {
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.id = 'paletteOpenBtn';
            searchBtn.className = 'theme-switcher-pill';
            searchBtn.title = 'Buka Command Palette (Ctrl+K)';
            searchBtn.setAttribute('aria-label', 'Buka Command Palette pencarian navigasi (Shortcut: Ctrl+K)');
            searchBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> <span>Search</span>`;
            searchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openPalette();
            });
            headerRight.insertBefore(searchBtn, headerRight.firstChild);
        }

        // ── Settings Dropdown (tema, SFX, BGM) ──
        if (!document.getElementById('headerSettingsBtn')) {
            const settingsWrapper = document.createElement('div');
            settingsWrapper.className = 'header-settings-wrapper';
            settingsWrapper.id = 'headerSettingsWrapper';

            const settingsBtn = document.createElement('button');
            settingsBtn.type = 'button';
            settingsBtn.id = 'headerSettingsBtn';
            settingsBtn.className = 'theme-switcher-pill header-icon-btn';
            settingsBtn.title = 'Pengaturan Cepat (Tema, SFX, BGM)';
            settingsBtn.setAttribute('aria-haspopup', 'true');
            settingsBtn.setAttribute('aria-expanded', 'false');
            settingsBtn.setAttribute('aria-label', 'Buka pengaturan cepat');
            settingsBtn.innerHTML = `<i class="fa-solid fa-sliders"></i>`;

            const dropdown = document.createElement('div');
            dropdown.className = 'header-settings-dropdown';
            dropdown.id = 'headerSettingsDropdown';
            dropdown.setAttribute('role', 'menu');

            function buildDropdown() {
                const curTheme = localStorage.getItem('naura_theme') || 'midnight';
                const isLight = curTheme === 'light-horizon';
                const isSfxMuted = localStorage.getItem('naura_sfx_enabled') === 'false';
                const isBgmOn = window.soundManager ? (window.soundManager.bgmEnabled && window.soundManager.unlocked) : false;
                const curThemeObj = AVAILABLE_THEMES.find(t => t.id === curTheme) || AVAILABLE_THEMES[0];

                dropdown.innerHTML = `
                    <div class="settings-dropdown-section">
                        <div class="settings-dropdown-label">Tampilan</div>
                        <button type="button" class="settings-dropdown-item" id="sdThemeDarkLight" aria-pressed="${isLight}">
                            <i class="fa-solid ${isLight ? 'fa-moon' : 'fa-sun'}"></i>
                            <span>${isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}</span>
                        </button>
                        <button type="button" class="settings-dropdown-item" id="sdThemeCycle">
                            <i class="${curThemeObj.icon}"></i>
                            <span>Tema: ${curThemeObj.label}</span>
                            <span class="settings-dropdown-badge">Klik untuk ganti</span>
                        </button>
                    </div>
                    <div class="settings-dropdown-divider"></div>
                    <div class="settings-dropdown-section">
                        <div class="settings-dropdown-label">Audio</div>
                        <button type="button" class="settings-dropdown-item" id="sdSfxToggle" aria-pressed="${!isSfxMuted}">
                            <i class="fa-solid ${isSfxMuted ? 'fa-bell-slash' : 'fa-bell'}"></i>
                            <span>Efek Suara (SFX)</span>
                            <span class="settings-dropdown-badge ${isSfxMuted ? '' : 'active'}">${isSfxMuted ? 'Off' : 'On'}</span>
                        </button>
                        <button type="button" class="settings-dropdown-item" id="sdBgmToggle" aria-pressed="${isBgmOn}">
                            <i class="fa-solid ${isBgmOn ? 'fa-pause' : 'fa-play'}"></i>
                            <span>Musik Latar (BGM)</span>
                            <span class="settings-dropdown-badge ${isBgmOn ? 'active' : ''}" id="sdBgmLabel">${isBgmOn ? 'Playing' : 'Paused'}</span>
                        </button>
                    </div>
                    <div class="settings-dropdown-divider"></div>
                    <a href="/settings" class="settings-dropdown-item settings-dropdown-link">
                        <i class="fa-solid fa-gears"></i>
                        <span>Semua Pengaturan</span>
                        <i class="fa-solid fa-arrow-right" style="margin-left:auto;font-size:10px;opacity:0.5;"></i>
                    </a>
                `;

                // Wire up dark/light toggle
                dropdown.querySelector('#sdThemeDarkLight').addEventListener('click', () => {
                    const current = localStorage.getItem('naura_theme') || 'midnight';
                    if (current === 'light-horizon') {
                        applyTheme(localStorage.getItem('naura_last_dark_theme') || 'midnight');
                    } else {
                        localStorage.setItem('naura_last_dark_theme', current);
                        applyTheme('light-horizon');
                    }
                    buildDropdown();
                });

                // Wire up theme cycle
                dropdown.querySelector('#sdThemeCycle').addEventListener('click', () => {
                    const current = localStorage.getItem('naura_theme') || 'midnight';
                    const curIdx = AVAILABLE_THEMES.findIndex(t => t.id === current);
                    const next = AVAILABLE_THEMES[(curIdx + 1) % AVAILABLE_THEMES.length];
                    applyTheme(next.id);
                    buildDropdown();
                });

                // Wire up SFX toggle
                dropdown.querySelector('#sdSfxToggle').addEventListener('click', () => {
                    if (!window.soundManager) return;
                    const next = !window.soundManager.sfxEnabled;
                    window.soundManager.setSfxEnabled(next);
                    buildDropdown();
                });

                // Wire up BGM toggle
                dropdown.querySelector('#sdBgmToggle').addEventListener('click', () => {
                    if (window.toggleBgm) window.toggleBgm();
                    setTimeout(buildDropdown, 100);
                });
            }

            buildDropdown();

            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('open');
                dropdown.classList.toggle('open', !isOpen);
                settingsBtn.setAttribute('aria-expanded', String(!isOpen));
                if (!isOpen) buildDropdown();
            });

            document.addEventListener('click', (e) => {
                if (!settingsWrapper.contains(e.target)) {
                    dropdown.classList.remove('open');
                    settingsBtn.setAttribute('aria-expanded', 'false');
                }
            });

            settingsWrapper.appendChild(settingsBtn);
            settingsWrapper.appendChild(dropdown);

            const searchBtn = document.getElementById('paletteOpenBtn');
            if (searchBtn && searchBtn.nextSibling) {
                headerRight.insertBefore(settingsWrapper, searchBtn.nextSibling);
            } else {
                headerRight.insertBefore(settingsWrapper, headerRight.firstChild);
            }
        }

        // User Identity Chip
        const existingAvatar = document.getElementById('headerAvatar');
        if (existingAvatar) {
            fetch('/api/me').then(r => r.json()).then(data => {
                if (data && data.loggedIn && data.user) {
                    if (existingAvatar && data.user.id && data.user.avatar) {
                        existingAvatar.src = `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png?size=64`;
                    }
                    const authBtn = document.getElementById('headerAuthBtn');
                    const authLabel = document.getElementById('headerAuthLabel');
                    if (authLabel) authLabel.textContent = data.user.global_name || data.user.username || 'Logged In';
                    if (authBtn) authBtn.href = '/profile';
                }
            }).catch(() => {});
        } else if (!document.getElementById('headerUserChip')) {
            const userChip = document.createElement('a');
            userChip.href = '/profile';
            userChip.id = 'headerUserChip';
            userChip.className = 'header-user-chip';
            userChip.title = 'Profil Petualang';
            userChip.innerHTML = `
                <img src="/assets/core/avatar.png" alt="User" class="header-user-avatar" id="headerNavAvatar" onerror="this.src='/assets/core/avatar.png'">
                <span id="headerNavUserName" style="font-size:12px;font-weight:600;color:var(--text-primary);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Guest</span>
            `;
            headerRight.appendChild(userChip);

            fetch('/api/me').then(r => r.json()).then(data => {
                if (data && data.loggedIn && data.user) {
                    const avatarEl = document.getElementById('headerNavAvatar');
                    const nameEl = document.getElementById('headerNavUserName');
                    if (nameEl) nameEl.textContent = data.user.global_name || data.user.username || 'Adventurer';
                    if (avatarEl && data.user.id && data.user.avatar) {
                        avatarEl.src = `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png?size=64`;
                    }
                }
            }).catch(() => {});
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderQuickControls);
    } else {
        initHeaderQuickControls();
    }

    // ── 7.7. Command Palette Modal (Ctrl+K) ───────────────────────────
    let paletteBackdrop = null;
    let paletteInput = null;
    let paletteBody = null;
    let selectedIndex = 0;
    let paletteItemsData = [];

    const QUICK_ACTIONS = [
        {
            type: 'action',
            title: 'Ganti Tema Dashboard',
            desc: 'Siklus tema Midnight -> Sakura -> OLED True Black',
            icon: 'fa-solid fa-palette',
            badge: 'TEMA',
            action: () => {
                const current = localStorage.getItem('naura_theme') || 'midnight';
                const curIdx = AVAILABLE_THEMES.findIndex(t => t.id === current);
                const nextIdx = (curIdx + 1) % AVAILABLE_THEMES.length;
                applyTheme(AVAILABLE_THEMES[nextIdx].id);
                if (window.showToast) window.showToast({ type: 'info', title: 'Tema Dashboard', message: `Tema aktif: ${AVAILABLE_THEMES[nextIdx].label}` });
            }
        },
        {
            type: 'action',
            title: 'Buka AI Companion Naura',
            desc: 'Percakapan cerdas dengan asisten virtual Naura',
            icon: 'fa-solid fa-comment-dots',
            badge: 'AI',
            action: () => {
                const compBtn = document.getElementById('companionToggleBtn') || document.querySelector('.companion-fab');
                if (compBtn) compBtn.click();
            }
        },
        {
            type: 'action',
            title: 'Toggle Audio BGM Latar',
            desc: 'Putar atau jeda musik latar adaptif',
            icon: 'fa-solid fa-music',
            badge: 'AUDIO',
            action: () => {
                if (window.soundManager) {
                    if (!window.soundManager.unlocked) window.soundManager.unlock();
                    else window.soundManager.setBgmEnabled(!window.soundManager.bgmEnabled);
                }
            }
        },
        {
            type: 'action',
            title: 'Periksa Status Kesehatan Bot',
            desc: 'Buka telemetri shard, memori, dan latency gateway',
            icon: 'fa-solid fa-signal',
            badge: 'STATUS',
            path: '/status'
        }
    ];

    function buildPaletteModal() {
        if (document.getElementById('paletteBackdrop')) {
            paletteBackdrop = document.getElementById('paletteBackdrop');
            paletteInput = paletteBackdrop.querySelector('#paletteInput');
            paletteBody = paletteBackdrop.querySelector('#paletteBody');
            return;
        }

        paletteBackdrop = document.createElement('div');
        paletteBackdrop.id = 'paletteBackdrop';
        paletteBackdrop.className = 'palette-backdrop';
        paletteBackdrop.innerHTML = `
            <div class="palette-modal" role="dialog" aria-label="Command Palette">
                <div class="palette-header">
                    <i class="fa-solid fa-magnifying-glass palette-icon"></i>
                    <input type="text" class="palette-input" id="paletteInput" placeholder="Cari halaman, fitur, atau aksi cepat... (Ctrl+K)" autocomplete="off">
                    <span class="palette-kbd">ESC</span>
                </div>
                <div class="palette-body" id="paletteBody"></div>
                <div class="palette-footer">
                    <div class="palette-footer-keys">
                        <span><span class="palette-kbd">&uarr;</span> <span class="palette-kbd">&darr;</span> Navigasi</span>
                        <span><span class="palette-kbd">&crarr;</span> Pilih</span>
                        <span><span class="palette-kbd">ESC</span> Tutup</span>
                    </div>
                    <span>Naura Spotlight OS</span>
                </div>
            </div>
        `;
        document.body.appendChild(paletteBackdrop);

        paletteInput = paletteBackdrop.querySelector('#paletteInput');
        paletteBody = paletteBackdrop.querySelector('#paletteBody');

        paletteBackdrop.addEventListener('click', (e) => {
            if (e.target === paletteBackdrop) closePalette();
        });

        paletteInput.addEventListener('input', () => {
            renderPaletteItems(paletteInput.value.trim().toLowerCase());
        });

        paletteInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigatePalette(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigatePalette(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executePaletteSelection();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closePalette();
            }
        });
    }

    function openPalette() {
        if (window.soundManager && typeof window.soundManager.playModal === 'function') {
            window.soundManager.playModal();
        }
        buildPaletteModal();
        paletteBackdrop.classList.add('active');
        paletteInput.value = '';
        selectedIndex = 0;
        renderPaletteItems('');
        setTimeout(() => paletteInput.focus(), 50);
    }

    function closePalette() {
        if (!paletteBackdrop) return;
        paletteBackdrop.classList.remove('active');
    }

    function getAllPaletteEntries() {
        const entries = [];
        for (const group of Object.values(ROUTE_GROUPS)) {
            for (const page of group.pages) {
                entries.push({
                    type: 'page',
                    title: page.label,
                    desc: page.desc || group.label,
                    icon: page.icon,
                    path: page.path,
                    badge: group.label.toUpperCase()
                });
            }
        }
        for (const action of QUICK_ACTIONS) {
            entries.push(action);
        }
        return entries;
    }

    function renderPaletteItems(filterText) {
        if (!paletteBody) return;
        const all = getAllPaletteEntries();
        paletteItemsData = all.filter(item => {
            if (!filterText) return true;
            return item.title.toLowerCase().includes(filterText) ||
                   (item.desc && item.desc.toLowerCase().includes(filterText)) ||
                   (item.path && item.path.toLowerCase().includes(filterText));
        });

        if (paletteItemsData.length === 0) {
            paletteBody.innerHTML = `
                <div style="padding: 24px 16px; text-align: center; color: var(--text-muted, #64748b); font-size: 13px;">
                    <i class="fa-solid fa-ghost" style="font-size: 20px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    Tidak ditemukan hasil untuk "${filterText}"
                </div>
            `;
            return;
        }

        if (selectedIndex >= paletteItemsData.length) selectedIndex = 0;

        let html = '';
        let currentCategory = '';
        paletteItemsData.forEach((item, idx) => {
            const category = item.type === 'action' ? 'Aksi Cepat' : 'Halaman & Navigasi';
            if (category !== currentCategory) {
                currentCategory = category;
                html += `<div class="palette-section-title">${category}</div>`;
            }
            const isSel = idx === selectedIndex;
            html += `
                <div class="palette-item ${isSel ? 'selected' : ''}" data-index="${idx}">
                    <div class="palette-item-icon"><i class="${item.icon}"></i></div>
                    <div class="palette-item-info">
                        <div class="palette-item-title">${item.title}</div>
                        <div class="palette-item-desc">${item.desc}</div>
                    </div>
                    ${item.badge ? `<span class="palette-item-badge">${item.badge}</span>` : ''}
                </div>
            `;
        });

        paletteBody.innerHTML = html;

        paletteBody.querySelectorAll('.palette-item').forEach(el => {
            el.addEventListener('mouseenter', () => {
                const idx = parseInt(el.getAttribute('data-index'), 10);
                selectedIndex = idx;
                updatePaletteSelection();
            });
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-index'), 10);
                selectedIndex = idx;
                executePaletteSelection();
            });
        });
    }

    function updatePaletteSelection() {
        if (!paletteBody) return;
        paletteBody.querySelectorAll('.palette-item').forEach((el, idx) => {
            el.classList.toggle('selected', idx === selectedIndex);
            if (idx === selectedIndex) {
                el.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    function navigatePalette(dir) {
        if (paletteItemsData.length === 0) return;
        selectedIndex = (selectedIndex + dir + paletteItemsData.length) % paletteItemsData.length;
        updatePaletteSelection();
    }

    function executePaletteSelection() {
        const item = paletteItemsData[selectedIndex];
        if (!item) return;
        closePalette();
        if (item.action) {
            item.action();
        } else if (item.path) {
            window.location.href = item.path;
        }
    }

    window.openCommandPalette = openPalette;
    window.closeCommandPalette = closePalette;

    // Global Keyboard Shortcut: Ctrl+K, Cmd+K, atau /
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (paletteBackdrop && paletteBackdrop.classList.contains('active')) {
                closePalette();
            } else {
                openPalette();
            }
        } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            openPalette();
        }
    });

    // ── 8. Pemuatan Otomatis Modul Telemetri Realtime ──────────────────
    if (!document.getElementById('supabase-realtime-script')) {
        const telemetryScript = document.createElement('script');
        telemetryScript.id = 'supabase-realtime-script';
        telemetryScript.src = '/src/js/supabaseRealtime.js';
        document.body.appendChild(telemetryScript);
    }

    // ── 8. Helper Logika Vital (dari src/utils bot, diuji terpisah) ──────
    // Dimuat di sini, bukan per halaman, karena authManager.js ikut
    // memakainya dan skrip itu disuntik tepat di bawah.
    if (!window.NauraVitalPercent && !document.getElementById('naura-vital-percent-script')) {
        const vitalScript = document.createElement('script');
        vitalScript.id = 'naura-vital-percent-script';
        vitalScript.src = '/shared/vitalPercent.js';
        document.head.appendChild(vitalScript);
    }

    // ── 8a. Pemuatan Session Presenter (UI layer, harus dimuat sebelum authManager) ──
    if (!document.getElementById('naura-session-presenter-script')) {
        const presenterScript = document.createElement('script');
        presenterScript.id = 'naura-session-presenter-script';
        presenterScript.src = '/src/js/sessionPresenter.js?v=2.4.0';
        presenterScript.async = false;
        document.body.appendChild(presenterScript);
    }

    // ── 8b. Pemuatan Otomatis Modul Sesi & Otentikasi ───────────────────
    if (!document.getElementById('naura-auth-script')) {
        const authScript = document.createElement('script');
        authScript.id = 'naura-auth-script';
        authScript.src = '/src/js/authManager.js?v=2.4.0';
        authScript.async = false;
        document.body.appendChild(authScript);
    }

    // ── 9. Pemuatan Otomatis Global Floating AI Companion Widget ──────
    if (!document.getElementById('naura-companion-script')) {
        const companionScript = document.createElement('script');
        companionScript.id = 'naura-companion-script';
        companionScript.src = '/src/js/companionWidget.js';
        document.body.appendChild(companionScript);
    }

    // ── 10. Pemuatan Otomatis Adaptive BGM & SFX Engine ───────────────
    function initAudioIntegration() {
        if (!window.soundManager && typeof window.SoundManager === 'function') {
            window.soundManager = new window.SoundManager();
        }
        if (!window.soundManager) return;

        // Inisialisasi tema BGM adaptif sesuai grup halaman saat ini
        window.soundManager.playAdaptiveTheme();

        const existingBgm = document.getElementById('bgmControl');

        function syncBgmUi() {
            if (!window.soundManager) return;
            const isPlaying = window.soundManager.bgmEnabled && window.soundManager.unlocked;
            const bgmIcon = document.getElementById('bgmIcon');
            if (bgmIcon) {
                bgmIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
            }
            const soundWave = document.querySelector('#bgmControl .sound-wave');
            if (soundWave) {
                soundWave.classList.toggle('playing', !!isPlaying);
            }
            const bgmTrack = document.getElementById('bgmTrackName');
            if (bgmTrack) {
                const theme = window.soundManager.getTheme ? window.soundManager.getTheme(window.soundManager.currentThemeId) : null;
                if (theme && theme.name) bgmTrack.textContent = theme.name;
            }
            const pillWave = document.querySelector('#audioControlPill .audio-eq-bars');
            if (pillWave) pillWave.classList.toggle('playing', !!isPlaying);
            const pillMute = document.querySelector('#audioControlPill .audio-btn-mute i');
            if (pillMute) {
                pillMute.className = isPlaying ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
            }
            const pillLabel = document.getElementById('audioTrackLabel');
            if (pillLabel) {
                const theme = window.soundManager.getTheme ? window.soundManager.getTheme(window.soundManager.currentThemeId) : null;
                pillLabel.textContent = theme && theme.name ? theme.name : (isPlaying ? 'Playing' : 'BGM');
            }
        }

        // Hubungkan sinkronisasi UI ke soundManager
        const originalUpdateUi = window.soundManager._updateUiWidget;
        window.soundManager._updateUiWidget = function () {
            if (typeof originalUpdateUi === 'function') {
                try { originalUpdateUi.call(window.soundManager); } catch (_) {}
            }
            syncBgmUi();
        };

        // Pasang kontrol global window.toggleBgm & window.nextBgm untuk interaksi tombol
        window.toggleBgm = function () {
            if (!window.soundManager) return;
            if (!window.soundManager.unlocked) {
                window.soundManager.unlock();
            } else {
                window.soundManager.setBgmEnabled(!window.soundManager.bgmEnabled);
            }
            syncBgmUi();
        };

        window.nextBgm = function () {
            if (!window.soundManager) return;
            if (typeof window.soundManager.nextTheme === 'function') {
                window.soundManager.nextTheme();
            }
            syncBgmUi();
        };

        if (existingBgm) {
            // Hindari duplikasi: Jika #bgmControl sudah ada di DOM (misal di index.html),
            // sisipkan indikator .sound-wave jika belum ada, dan jangan append #audioControlPill!
            if (!existingBgm.querySelector('.sound-wave')) {
                const wave = document.createElement('div');
                wave.className = 'sound-wave';
                wave.id = 'bgmSoundWave';
                wave.innerHTML = '<span class="eq-b"></span><span class="eq-b"></span><span class="eq-b"></span><span class="eq-b"></span>';
                const trackName = document.getElementById('bgmTrackName');
                if (trackName) {
                    existingBgm.insertBefore(wave, trackName);
                } else {
                    existingBgm.appendChild(wave);
                }
            }
            syncBgmUi();
        } else {
            // BGM dikelola via settings dropdown - tidak perlu pill terpisah di header
            syncBgmUi();
        }

        // Sinkronisasi dengan formulir pengaturan audio jika berada di /settings
        const toggleBgm = document.getElementById('toggleBgm');
        if (toggleBgm) {
            toggleBgm.checked = window.soundManager.bgmEnabled;
            toggleBgm.addEventListener('change', () => {
                window.soundManager.setBgmEnabled(toggleBgm.checked);
            });
        }
        const rangeBgmVol = document.getElementById('rangeBgmVol');
        if (rangeBgmVol) {
            rangeBgmVol.value = Math.round(window.soundManager.bgmVolume * 100);
            const label = document.getElementById('bgmVolLabel');
            if (label) label.textContent = rangeBgmVol.value + '%';
            rangeBgmVol.addEventListener('input', () => {
                window.soundManager.setBgmVolume(rangeBgmVol.value / 100);
                if (label) label.textContent = rangeBgmVol.value + '%';
            });
        }
        const selectBgmPlaylist = document.getElementById('selectBgmPlaylist');
        if (selectBgmPlaylist) {
            selectBgmPlaylist.value = window.soundManager.playlistMode;
            selectBgmPlaylist.addEventListener('change', () => {
                window.soundManager.setPlaylistMode(selectBgmPlaylist.value);
            });
        }
        const toggleSfx = document.getElementById('toggleSfx');
        if (toggleSfx) {
            toggleSfx.checked = window.soundManager.sfxEnabled;
            toggleSfx.addEventListener('change', () => {
                window.soundManager.setSfxEnabled(toggleSfx.checked);
            });
        }

        // Global Event Delegation untuk SFX interaktif
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button, .btn, .nav-item, .mobile-nav-item, .tab-btn, a[href]');
            if (!btn) return;
            if (btn.classList.contains('tab-btn') || btn.classList.contains('mobile-nav-item')) {
                window.soundManager.playTab();
            } else {
                window.soundManager.playClick();
            }
        }, true);

        document.addEventListener('change', (e) => {
            if (e.target.matches && e.target.matches('input[type="checkbox"]')) {
                window.soundManager.playToggle(e.target.checked);
            }
        }, true);

        document.addEventListener('pointerenter', (e) => {
            if (e.target && e.target.matches && e.target.matches('button, .btn, .tab-btn, .mobile-nav-item')) {
                window.soundManager.playHover();
            }
        }, true);

        // Global NauraSFX helper
        window.NauraSFX = {
            hover: () => window.soundManager?.playHover?.(),
            click: () => window.soundManager?.playClick?.(),
            tab: () => window.soundManager?.playTab?.(),
            toggle: (on) => window.soundManager?.playToggle?.(on),
            modal: () => window.soundManager?.playModal?.(),
            coin: () => window.soundManager?.playCoin?.(),
            success: () => window.soundManager?.playSuccess?.()
        };
    }

    if (!document.getElementById('naura-sound-script')) {
        const soundScript = document.createElement('script');
        soundScript.id = 'naura-sound-script';
        soundScript.src = '/src/js/soundManager.js';
        soundScript.onload = initAudioIntegration;
        document.body.appendChild(soundScript);
    } else if (window.SoundManager) {
        initAudioIntegration();
    }

    // ── PWA & Service Worker Registration ─────────────────────────────
    function initPwaServiceWorker() {
        if (typeof window === 'undefined') return;

        // Ensure PWA manifest link in head
        if (!document.querySelector('link[rel="manifest"]')) {
            const link = document.createElement('link');
            link.rel = 'manifest';
            link.href = '/manifest.json';
            document.head.appendChild(link);
        }

        // Ensure theme-color meta in head (#FFB6C1)
        let themeMeta = document.querySelector('meta[name="theme-color"]');
        if (!themeMeta) {
            themeMeta = document.createElement('meta');
            themeMeta.name = 'theme-color';
            themeMeta.content = '#FFB6C1';
            document.head.appendChild(themeMeta);
        }

        // Register Service Worker for offline capability & Push Notifications
        if ('serviceWorker' in navigator) {
            const registerSw = () => {
                navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
                    console.debug('[PWA] Service Worker registration info:', err.message || err);
                });
            };

            if (document.readyState === 'complete') {
                registerSw();
            } else {
                window.addEventListener('load', registerSw, { once: true });
            }
        }
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    window.subscribeWebPush = async function subscribeWebPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return { success: false, error: 'Push notifications tidak didukung browser ini.' };
        }
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return { success: false, error: 'Izin notifikasi ditolak oleh pengguna.' };
            }
            const reg = await navigator.serviceWorker.ready;
            const res = await fetch('/api/push/vapid-key');
            const keyData = await res.json();
            if (!keyData.success || !keyData.publicKey) {
                return { success: false, error: 'VAPID key belum tersedia dari server.' };
            }
            const convertedVapidKey = urlBase64ToUint8Array(keyData.publicKey);
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey,
            });
            const subRes = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription }),
            });
            const result = await subRes.json();
            if (result.success && typeof window.showNauraToast === 'function') {
                window.showNauraToast('Web Push aktif! Notifikasi World Boss & reset harian siap.', 'success');
            }
            return result;
        } catch (err) {
            console.error('[WebPush] Gagal mendaftar push notification:', err);
            return { success: false, error: err.message };
        }
    };

    window.getWebPushSubscription = async function getWebPushSubscription() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
        try {
            const reg = await navigator.serviceWorker.ready;
            return await reg.pushManager.getSubscription();
        } catch (_) {
            return null;
        }
    };

    initPwaServiceWorker();
})();
