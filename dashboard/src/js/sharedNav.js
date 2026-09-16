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

    // ── 2. Penanda Menu Navigasi Aktif ────────────────────────────────
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    document.querySelectorAll('.nav-item[href], .mobile-nav-item[href]').forEach((linkElement) => {
        const targetPath = linkElement.getAttribute('href')?.replace(/\/$/, '') || '';
        const isHomePage = (targetPath === '' || targetPath === '/') && (currentPath === '' || currentPath === '/');
        const isSubPathMatch = targetPath !== '' && targetPath !== '/' && (currentPath === targetPath || currentPath.startsWith(targetPath + '/'));

        if (isHomePage || isSubPathMatch) {
            linkElement.classList.add('active');
        } else {
            linkElement.classList.remove('active');
        }
    });

    // ── 3. Transisi Halaman Mulus (Fade-In & Fade-Out) ─────────────────
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.25s ease';

    window.addEventListener('load', () => {
        requestAnimationFrame(() => {
            document.body.style.opacity = '1';
        });
    });

    // Navigasi internal bertransisi halus
    document.querySelectorAll('a[href^="/"], a[href^="./"]').forEach((anchorElement) => {
        anchorElement.addEventListener('click', (navEvent) => {
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
        window.addEventListener('load', () => {
            setTimeout(() => {
                loadingScreenElement.classList.add('fade-out');
                setTimeout(() => loadingScreenElement.remove(), 500);
            }, 600);
        });
    }

    // ── 5. Animasi Masuk Bertahap (Staggered Animation) ───────────────
    window.addEventListener('load', () => {
        document.querySelectorAll('.animate-in, .animate-in-left, .animate-scale').forEach((animatedElement, index) => {
            if (!animatedElement.style.animationDelay) {
                animatedElement.style.animationDelay = `${index * 0.04}s`;
            }
        });
    });

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
})();
