/**
 * sharedNav.js - Inisialisasi Navigasi Bersama & Tata Letak Dashboard.
 *
 * Mengelola interaksi menu navigasi (sidebar toggle, mobile drawer),
 * transisi halaman, dismiss layar loading, toast notifikasi,
 * serta pemuatan otomatis modul otentikasi dan telemetri realtime.
 */

(function () {
    'use strict';

    // ── 1. Pengendali Sidebar & Mobile Drawer ─────────────────────────
    const sidebarElement = document.querySelector('.sidebar');
    const overlayElement = document.querySelector('.sidebar-overlay');
    const hamburgerButton = document.querySelector('.hamburger-btn');
    const closeButton = document.querySelector('.sidebar-close-btn');

    function openSidebar() {
        if (!sidebarElement) return;
        sidebarElement.classList.add('open');
        if (overlayElement) {
            overlayElement.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        if (hamburgerButton) {
            hamburgerButton.setAttribute('aria-expanded', 'true');
        }
    }

    function closeSidebar() {
        if (!sidebarElement) return;
        sidebarElement.classList.remove('open');
        if (overlayElement) {
            overlayElement.classList.remove('active');
            document.body.style.overflow = '';
        }
        if (hamburgerButton) {
            hamburgerButton.setAttribute('aria-expanded', 'false');
        }
    }

    if (hamburgerButton) {
        hamburgerButton.addEventListener('click', (clickEvent) => {
            clickEvent.stopPropagation();
            if (sidebarElement && sidebarElement.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', (clickEvent) => {
            clickEvent.stopPropagation();
            closeSidebar();
        });
    }

    if (overlayElement) {
        overlayElement.addEventListener('click', closeSidebar);
    }

    // Tutup drawer di layar seluler saat salah satu tautan diklik
    if (sidebarElement) {
        sidebarElement.querySelectorAll('.nav-item').forEach((navItem) => {
            navItem.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    closeSidebar();
                }
            });
        });
    }

    // Tutup sidebar saat tombol Escape ditekan
    document.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key === 'Escape') {
            closeSidebar();
        }
    });

    // ── 2. Definisi 5 Grup Navigasi Kanonikal & Active Group State ────
    const ROUTE_GROUPS = {
        dashboard: {
            id: 'dashboard',
            label: 'Dashboard',
            icon: 'fa-solid fa-gauge-high',
            primaryRoute: '/',
            pages: [
                { path: '/', label: 'Overview Dashboard', icon: 'fa-solid fa-gauge-high', desc: 'Metrik server, CPU/RAM, dan status bot' },
                { path: '/status', label: 'Live Telemetri', icon: 'fa-solid fa-signal', desc: 'Kesehatan shard & status gateway Discord' },
                { path: '/feed', label: 'Activity Feed', icon: 'fa-solid fa-rss', desc: 'Log aktivitas realtime & interaksi pengguna' },
                { path: '/leaderboard', label: 'Leaderboard Global', icon: 'fa-solid fa-trophy', desc: 'Peringkat level EXP dan kekayaan server' },
                { path: '/activity', label: 'Activity Hub', icon: 'fa-solid fa-gamepad', desc: 'Quest, mini-games & tantangan berkala' }
            ]
        },
        map: {
            id: 'map',
            label: 'Map',
            icon: 'fa-solid fa-earth-asia',
            primaryRoute: '/world',
            pages: [
                { path: '/world', label: 'World Map Aetheria', icon: 'fa-solid fa-earth-asia', desc: 'Peta benua, 6 wilayah, POI & komoditas' },
                { path: '/survival-map', label: 'Radar Survival', icon: 'fa-solid fa-map', desc: 'Radar real-time fasilitas & blip sumber daya' },
                { path: '/war-room', label: 'War Room & Siege', icon: 'fa-solid fa-shield-halved', desc: 'Operasi klan, wilayah perang & strategi' }
            ]
        },
        config: {
            id: 'config',
            label: 'Config',
            icon: 'fa-solid fa-sliders',
            primaryRoute: '/automations',
            pages: [
                { path: '/automations', label: 'Automations Engine', icon: 'fa-solid fa-robot', desc: 'Trigger otomatis, auto-response & scheduler' },
                { path: '/welcomer', label: 'Welcomer Card', icon: 'fa-solid fa-palette', desc: 'Desain canvas kartu sambutan member baru' },
                { path: '/builder', label: 'Embed Builder', icon: 'fa-solid fa-wand-magic-sparkles', desc: 'Generator pesan interaktif Discord V2' },
                { path: '/tickets', label: 'Ticket System', icon: 'fa-solid fa-ticket', desc: 'Manajemen tiket bantuan & antrean support' }
            ]
        },
        system: {
            id: 'system',
            label: 'System',
            icon: 'fa-solid fa-microchip',
            primaryRoute: '/music',
            pages: [
                { path: '/music', label: 'Music Hub Player', icon: 'fa-solid fa-music', desc: 'Pemutar audio Poru v5 & cluster Lavalink' },
                { path: '/jam', label: 'DJ Jam Session', icon: 'fa-solid fa-guitar', desc: 'Studio turntable interaktif & dual crossfader' },
                { path: '/karaoke', label: 'Studio Karaoke', icon: 'fa-solid fa-microphone', desc: 'Sinkronisasi lirik real-time & vokal' },
                { path: '/soundboard', label: 'Soundboard Studio', icon: 'fa-solid fa-sliders', desc: 'Papan efek suara instant dengan SFX audio' },
                { path: '/lounge', label: 'Cyber Lounge', icon: 'fa-solid fa-couch', desc: 'Ruang interaksi komunitas & live companion' },
                { path: '/topology', label: 'Guild Topology', icon: 'fa-solid fa-network-wired', desc: 'Diagram cluster server & visualisasi node' },
                { path: '/portfolio', label: 'Creator Portfolio', icon: 'fa-solid fa-id-badge', desc: 'Showcase fitur & profil kreator bot' }
            ]
        },
        settings: {
            id: 'settings',
            label: 'Settings',
            icon: 'fa-solid fa-gears',
            primaryRoute: '/settings',
            pages: [
                { path: '/settings', label: 'Server Settings', icon: 'fa-solid fa-gears', desc: 'Konfigurasi bot, prefix, role & perizinan' },
                { path: '/economy', label: 'Bank & Pasar NC', icon: 'fa-solid fa-coins', desc: 'Dompet kas server, bursa valuta & pasar saham' }
            ]
        }
    };

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    // Cari grup navigasi yang memuat halaman saat ini
    let activeGroupId = null;
    for (const [groupId, group] of Object.entries(ROUTE_GROUPS)) {
        if (group.pages.some(p => p.path === currentPath || (p.path !== '/' && currentPath.startsWith(p.path)))) {
            activeGroupId = groupId;
            break;
        }
    }
    if (!activeGroupId) activeGroupId = 'dashboard';

    // Tandai tautan desktop sidebar
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

    // Tandai tautan mobile bottom navigation & pasang handler
    function initMobileNav() {
        document.querySelectorAll('.mobile-nav-item').forEach((linkElement) => {
            const group = linkElement.getAttribute('data-group');
            const isActive = group === activeGroupId;
            linkElement.classList.toggle('active', isActive);
            if (isActive) {
                linkElement.setAttribute('aria-current', 'page');
            } else {
                linkElement.removeAttribute('aria-current');
            }
        });

        document.querySelectorAll('.mobile-nav-item').forEach((item) => {
            item.addEventListener('click', (e) => {
                const group = item.getAttribute('data-group');
                if (group === activeGroupId) {
                    // Jika sudah berada di grup aktif, ketukan membuka Quick Switcher Sheet
                    e.preventDefault();
                    e.stopPropagation();
                    if (groupSheet && groupSheet.classList.contains('active')) {
                        closeGroupSheet();
                    } else {
                        openGroupSheet(group);
                    }
                }
            });
        });
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

    function openGroupSheet(groupId) {
        const group = ROUTE_GROUPS[groupId];
        if (!group) return;

        groupSheet.innerHTML = `
            <div class="group-sheet-header">
                <div class="group-sheet-title">
                    <i class="${group.icon}"></i>
                    <span>Menu ${group.label} (${group.pages.length} Halaman)</span>
                </div>
                <button class="group-sheet-close" id="btnCloseGroupSheet" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="group-sheet-list">
                ${group.pages.map(page => {
                    const isPageActive = (page.path === '/' && currentPath === '/') || (page.path !== '/' && (currentPath === page.path || currentPath.startsWith(page.path)));
                    return `
                        <a href="${page.path}" class="group-sheet-item ${isPageActive ? 'active' : ''}">
                            <div class="group-sheet-item-icon"><i class="${page.icon}"></i></div>
                            <div class="group-sheet-item-info">
                                <div class="group-sheet-item-name">${page.label}</div>
                                <div class="group-sheet-item-desc">${page.desc}</div>
                            </div>
                            ${isPageActive ? '<span style="font-size:11px;color:var(--primary);font-weight:700;"><i class="fa-solid fa-check"></i></span>' : '<i class="fa-solid fa-chevron-right" style="font-size:11px;color:var(--text-muted);"></i>'}
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

            navEvent.preventDefault();
            document.body.style.opacity = '0';
            setTimeout(() => {
                window.location.href = destinationUrl;
            }, 200);
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
    window.showToast = function (messageText, toastType = 'info', displayDuration = 3500) {
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
        { id: 'oled', label: 'OLED Black', icon: 'fa-solid fa-sun' }
    ];

    function applyTheme(themeId) {
        const validTheme = AVAILABLE_THEMES.some(t => t.id === themeId) ? themeId : 'midnight';
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
        }
    }

    const savedTheme = localStorage.getItem('naura_theme') || 'midnight';
    applyTheme(savedTheme);
    window.setDashboardTheme = applyTheme;

    function initHeaderQuickControls() {
        const headerRight = document.querySelector('.top-header .header-right');
        if (!headerRight) return;

        // Command Palette Spotlight Button
        if (!document.getElementById('paletteOpenBtn')) {
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.id = 'paletteOpenBtn';
            searchBtn.className = 'theme-switcher-pill';
            searchBtn.title = 'Buka Command Palette (Ctrl+K)';
            searchBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> <span>Search (Ctrl+K)</span>`;
            searchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openPalette();
            });
            headerRight.insertBefore(searchBtn, headerRight.firstChild);
        }

        // Theme Switcher Button
        if (!document.getElementById('themeSwitcherPill')) {
            const themePill = document.createElement('button');
            themePill.type = 'button';
            themePill.id = 'themeSwitcherPill';
            themePill.className = 'theme-switcher-pill';
            themePill.title = 'Ganti Tema Dashboard (Midnight / Sakura / OLED)';

            const curTheme = localStorage.getItem('naura_theme') || 'midnight';
            const curObj = AVAILABLE_THEMES.find(t => t.id === curTheme) || AVAILABLE_THEMES[0];
            themePill.innerHTML = `<i class="${curObj.icon}"></i> <span>${curObj.label}</span>`;

            themePill.addEventListener('click', (e) => {
                e.stopPropagation();
                const current = localStorage.getItem('naura_theme') || 'midnight';
                const curIdx = AVAILABLE_THEMES.findIndex(t => t.id === current);
                const nextIdx = (curIdx + 1) % AVAILABLE_THEMES.length;
                const nextTheme = AVAILABLE_THEMES[nextIdx];
                applyTheme(nextTheme.id);
                if (window.showToast) {
                    window.showToast({
                        type: 'info',
                        title: 'Tema Diperbarui',
                        message: `Beralih ke tema ${nextTheme.label}.`,
                        duration: 2500
                    });
                }
            });

            const searchBtn = document.getElementById('paletteOpenBtn');
            if (searchBtn && searchBtn.nextSibling) {
                headerRight.insertBefore(themePill, searchBtn.nextSibling);
            } else {
                headerRight.insertBefore(themePill, headerRight.firstChild);
            }
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

    // ── 8. Pemuatan Otomatis Modul Sesi & Otentikasi ───────────────────
    if (!document.getElementById('naura-auth-script')) {
        const authScript = document.createElement('script');
        authScript.id = 'naura-auth-script';
        authScript.src = '/src/js/authManager.js';
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

        // Pasang Audio Control Widget Pill di .top-header .header-right
        const headerRight = document.querySelector('.top-header .header-right');
        if (headerRight && !document.getElementById('audioControlPill')) {
            const pill = document.createElement('div');
            pill.className = 'audio-control-pill';
            pill.id = 'audioControlPill';
            pill.title = 'BGM & Sound Controls (Klik untuk putar/jeda)';
            pill.innerHTML = `
                <div class="audio-eq-bars" id="audioEqBars">
                    <span class="eq-b"></span><span class="eq-b"></span><span class="eq-b"></span>
                </div>
                <span class="audio-track-label" id="audioTrackLabel">BGM</span>
                <button type="button" class="audio-btn-mute" id="audioBtnMute" aria-label="Toggle Mute">
                    <i class="fa-solid fa-volume-high"></i>
                </button>
            `;
            headerRight.insertBefore(pill, headerRight.firstChild);

            pill.addEventListener('click', (clickEvent) => {
                clickEvent.stopPropagation();
                if (!window.soundManager.unlocked) {
                    window.soundManager.unlock();
                } else {
                    window.soundManager.setBgmEnabled(!window.soundManager.bgmEnabled);
                }
            });
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
})();
