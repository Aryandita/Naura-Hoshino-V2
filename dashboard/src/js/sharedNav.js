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
        linkElement.classList.toggle('active', isHomePage || isSubPathMatch);
    });

    // Tandai tautan mobile bottom navigation & pasang handler
    function initMobileNav() {
        document.querySelectorAll('.mobile-nav-item').forEach((linkElement) => {
            const group = linkElement.getAttribute('data-group');
            linkElement.classList.toggle('active', group === activeGroupId);
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

    // ── 7. Pemuatan Otomatis Modul Telemetri Realtime ──────────────────
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
