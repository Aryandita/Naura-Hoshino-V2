/**
 * sessionPresenter.js - Presenter Layer untuk UI Sesi Naura Hoshino OS.
 *
 * Module ini TIDAK memiliki dependency ke authManager.
 * Semua data user diteruskan via parameter, bukan import langsung.
 * Menghilangkan circular dependency: saveSession <-> logout <-> syncUI <-> openProfileMenu.
 */

(function () {
    'use strict';

    const ROLE_AVATARS = {
        admin: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%236366f1'/%3E%3Cstop offset='100%25' stop-color='%23a855f7'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='80' height='80' rx='40' fill='url(%23g1)'/%3E%3Cpath d='M40 18 L60 26 V44 C60 56 40 64 40 64 C40 64 20 56 20 44 V26 Z' fill='%23ffffff' fill-opacity='0.25' stroke='%23ffffff' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M34 40 L38 44 L47 34' fill='none' stroke='%23ffffff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E",
        vip: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23f59e0b'/%3E%3Cstop offset='100%25' stop-color='%23d97706'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='80' height='80' rx='40' fill='url(%23g2)'/%3E%3Cpolygon points='40,20 45,33 59,34 48,43 52,57 40,49 28,57 32,43 21,34 35,33' fill='%23ffffff'/%3E%3C/svg%3E",
        adventurer: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cdefs%3E%3ClinearGradient id='g3' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2306b6d4'/%3E%3Cstop offset='100%25' stop-color='%230891b2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='80' height='80' rx='40' fill='url(%23g3)'/%3E%3Ccircle cx='40' cy='40' r='22' fill='none' stroke='%23ffffff' stroke-width='3'/%3E%3Cpolygon points='40,24 46,38 40,35 34,38' fill='%23ef4444'/%3E%3Cpolygon points='40,56 46,42 40,45 34,42' fill='%23ffffff'/%3E%3Ccircle cx='40' cy='40' r='3' fill='%23ffffff'/%3E%3C/svg%3E",
    };

    const PROFILES = {
        owner: { id: 'admin_001', username: 'Admin', tag: '#0001', avatar: ROLE_AVATARS.admin, role: 'Administrator Sistem', badgeClass: 'badge-primary', nc: 999999, nsf: 50000, coupons: 120, vitals: { hp: 100, hydration: 100, satiation: 100, energy: 100 }, provider: 'discord' },
        vip: { id: 'vip_042', username: 'VIP Member', tag: '#7777', avatar: ROLE_AVATARS.vip, role: 'VIP Server Booster', badgeClass: 'badge-amber', nc: 45200, nsf: 8400, coupons: 15, vitals: { hp: 85, hydration: 75, satiation: 60, energy: 80 }, provider: 'supabase' },
        adventurer: { id: 'adv_108', username: 'Petualang', tag: '#2049', avatar: ROLE_AVATARS.adventurer, role: 'Petualang Naura Wilds', badgeClass: 'badge-cyan', nc: 12450, nsf: 3200, coupons: 4, vitals: { hp: 90, hydration: 65, satiation: 50, energy: 75 }, provider: 'supabase' },
    };

    function syncUI(currentUser, isAuthenticated, callbacks) {
        const welcomeElement = document.getElementById('welcomeUser');
        if (welcomeElement) {
            welcomeElement.textContent = isAuthenticated ? currentUser.username : 'Guest';
        }

        const walletElement = document.getElementById('walletAmount');
        if (walletElement) {
            walletElement.textContent = Number(currentUser.nc).toLocaleString('id-ID');
        }

        const headerAuthButton = document.getElementById('headerAuthBtn');
        if (headerAuthButton) {
            if (isAuthenticated) {
                headerAuthButton.className = 'btn btn-ghost btn-sm';
                headerAuthButton.style.color = 'var(--accent-green)';
                headerAuthButton.style.borderColor = 'rgba(52,211,153,0.3)';
                headerAuthButton.href = '#';
                headerAuthButton.title = `Akun: ${currentUser.username} (${currentUser.role}), Klik untuk opsi`;
                headerAuthButton.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${currentUser.username}</span>`;
                headerAuthButton.onclick = (clickEvent) => {
                    clickEvent.preventDefault();
                    if (callbacks && callbacks.onOpenProfileMenu) callbacks.onOpenProfileMenu();
                };
            } else {
                headerAuthButton.className = 'btn btn-discord btn-sm';
                headerAuthButton.style.color = '';
                headerAuthButton.style.borderColor = '';
                headerAuthButton.href = '#';
                headerAuthButton.title = 'Login ke Naura OS';
                headerAuthButton.innerHTML = `<i class="fa-brands fa-discord"></i> <span id="headerAuthLabel">Login</span>`;
                headerAuthButton.onclick = (clickEvent) => {
                    clickEvent.preventDefault();
                    if (callbacks && callbacks.onOpenModal) callbacks.onOpenModal();
                };
            }
        }

        const headerAvatarElement = document.getElementById('headerAvatar');
        if (headerAvatarElement) {
            headerAvatarElement.src = currentUser.avatar;
            headerAvatarElement.style.border = isAuthenticated ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)';
            headerAvatarElement.onclick = (clickEvent) => {
                clickEvent.preventDefault();
                if (isAuthenticated) {
                    if (callbacks && callbacks.onOpenProfileMenu) callbacks.onOpenProfileMenu();
                } else {
                    if (callbacks && callbacks.onOpenModal) callbacks.onOpenModal();
                }
            };
        }

        const sidebarNameElements = document.querySelectorAll('.sidebar-user-name');
        const sidebarRoleElements = document.querySelectorAll('.sidebar-user-role');
        const sidebarAvatarElements = document.querySelectorAll('.sidebar-user-avatar');
        const sidebarUserCards = document.querySelectorAll('.sidebar-user');

        sidebarNameElements.forEach((el) => { el.textContent = isAuthenticated ? currentUser.username : 'Guest'; });
        sidebarRoleElements.forEach((el) => { el.textContent = isAuthenticated ? currentUser.role : 'Klik untuk login'; });
        sidebarAvatarElements.forEach((el) => {
            el.src = currentUser.avatar;
            el.onerror = () => { el.src = '/assets/core/avatar.png'; };
            el.style.border = isAuthenticated ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)';
        });
        sidebarUserCards.forEach((card) => {
            card.removeAttribute('onclick');
            card.onclick = (clickEvent) => {
                clickEvent.preventDefault();
                clickEvent.stopPropagation();
                window.location.href = isAuthenticated ? '/profile' : '/login?redirect=/profile';
            };
        });

        const nsfBadgeElement = document.getElementById('playerNsfBadge');
        if (nsfBadgeElement) {
            nsfBadgeElement.innerHTML = `<i class="fa-solid fa-star"></i> <span>${Number(currentUser.nsf).toLocaleString('id-ID')} NSF</span>`;
        }

        const vitals = currentUser.vitals || { hp: 100, hydration: 100, satiation: 100, energy: 100 };
        const updateVital = (barId, valId, value) => {
            const bar = document.getElementById(barId);
            const val = document.getElementById(valId);
            const pct = window.NauraVitalPercent ? window.NauraVitalPercent.clampVitalPercent(value) : 100;
            if (val) val.textContent = `${pct}%`;
            if (bar) {
                bar.style.width = `${pct}%`;
                if (pct < 30) bar.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
                else if (pct < 60) bar.style.background = 'linear-gradient(90deg, var(--accent-amber), #fcd34d)';
            }
        };
        updateVital('vitalHp', 'vitalHpVal', vitals.hp);
        updateVital('vitalHydration', 'vitalHydrationVal', vitals.hydration);
        updateVital('vitalSatiation', 'vitalSatiationVal', vitals.satiation);
        updateVital('vitalEnergy', 'vitalEnergyVal', vitals.energy);

        applyAuthGuards(isAuthenticated);
        renderUserDataTrustBanner(isAuthenticated, callbacks);
    }

    function renderUserDataTrustBanner(isAuthenticated, callbacks) {
        const currentPath = (window.location.pathname || '').toLowerCase();
        const userDataRoutes = ['/profile','/inventory','/settings','/automations','/tickets','/welcomer','/portfolio/me','/admin','/music'];
        const isUserDataPage = userDataRoutes.some((route) => currentPath.startsWith(route)) || document.querySelector('[data-user-data-page="true"]') !== null || document.querySelector('[data-auth-required="true"]') !== null;
        const existingBanner = document.getElementById('nauraAuthTrustBanner');
        if (isAuthenticated || !isUserDataPage) { if (existingBanner) existingBanner.remove(); return; }
        if (existingBanner) return;

        const targetContainer = document.querySelector('.profile-page-container') || document.querySelector('.inv-container') || document.querySelector('.settings-container') || document.querySelector('.admin-container') || document.querySelector('#musicTabPlayer') || document.querySelector('#musicMainGrid') || document.querySelector('.automations-grid') || document.querySelector('.ticket-workspace') || document.querySelector('.studio-layout') || document.querySelector('.portfolio-hero') || document.querySelector('.main-content') || document.querySelector('main') || document.body;

        const banner = document.createElement('div');
        banner.id = 'nauraAuthTrustBanner';
        banner.className = 'naura-auth-trust-banner';
        banner.innerHTML = `<div class="auth-trust-badge-row"><span class="auth-badge-official"><i class="fa-solid fa-shield-halved"></i> Dashboard Resmi Naura</span><span class="auth-badge-oauth"><i class="fa-brands fa-discord"></i> Discord OAuth2 Official</span><span class="auth-badge-mode"><i class="fa-solid fa-eye"></i> Mode Pratinjau Terbuka</span></div><div class="auth-trust-content"><h2 class="auth-trust-title"><i class="fa-solid fa-user-shield" style="color:var(--login-accent, #f472b6);margin-right:8px;"></i>Autentikasi Diperlukan untuk Mengakses Data Akun</h2><p class="auth-trust-desc">Halaman ini terhubung dengan konfigurasi server dan data pengguna bot. Anda saat ini sedang mengakses dashboard dalam <strong>Mode Pratinjau Tamu (Aman & Transparan)</strong> tanpa pengalihan paksa. Untuk menyinkronkan profil petualang, inventaris ransel, saldo mata uang, dan kontrol bot secara real-time, silakan masuk dengan akun Discord resmi Anda.</p><div class="auth-trust-points"><div class="auth-trust-point"><i class="fa-solid fa-lock"></i><span>Aman & Terenkripsi: Kami tidak pernah meminta kata sandi akun Discord Anda.</span></div><div class="auth-trust-point"><i class="fa-solid fa-shield-check"></i><span>Izin Terbatas: Hanya membaca identitas publik dan server yang Anda kelola.</span></div><div class="auth-trust-point"><i class="fa-solid fa-circle-check"></i><span>Bebas Phising: Otentikasi langsung divalidasi melalui domain resmi discord.com.</span></div></div><div class="auth-trust-actions"><a href="/auth/discord" class="btn btn-discord btn-auth-trust-primary" id="btnTrustDiscordLogin"><i class="fa-brands fa-discord"></i> Masuk dengan Akun Discord Resmi</a><button type="button" class="btn btn-ghost btn-auth-trust-sandbox" id="btnTrustSandboxModal"><i class="fa-solid fa-flask"></i> Uji Coba Cepat (Mode Sandbox)</button><a href="/" class="btn btn-ghost btn-auth-trust-back"><i class="fa-solid fa-arrow-left"></i> Kembali ke Beranda</a></div></div>`;

        if (targetContainer === document.body) { document.body.insertBefore(banner, document.body.firstChild); }
        else if (targetContainer.parentElement && (targetContainer.classList.contains('automations-grid') || targetContainer.classList.contains('studio-layout') || targetContainer.classList.contains('ticket-workspace') || targetContainer.classList.contains('portfolio-hero') || targetContainer.id === 'musicTabPlayer' || targetContainer.id === 'musicMainGrid')) { targetContainer.parentElement.insertBefore(banner, targetContainer); }
        else { targetContainer.insertBefore(banner, targetContainer.firstChild); }

        const sandboxBtn = banner.querySelector('#btnTrustSandboxModal');
        if (sandboxBtn) { sandboxBtn.addEventListener('click', (e) => { e.preventDefault(); if (callbacks && callbacks.onOpenModal) callbacks.onOpenModal(); }); }
    }

    function applyAuthGuards(isAuthenticated) {
        const lockedElements = document.querySelectorAll('[data-auth-required="true"], .auth-locked-zone');
        lockedElements.forEach((el) => {
            let overlay = el.querySelector('.naura-auth-lock-overlay');
            if (!isAuthenticated) {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'naura-auth-lock-overlay';
                    const title = el.getAttribute('data-auth-title') || 'Akses Akun Naura';
                    const desc = el.getAttribute('data-auth-message') || 'Masuk dengan Discord dulu ya. Bagian ini terhubung langsung dengan profil dan data karaktermu.';
                    overlay.innerHTML = `<div class="naura-auth-lock-card"><div class="lock-icon-box"><i class="fa-solid fa-lock"></i></div><div class="lock-title">${title}</div><div class="lock-desc">${desc}</div><a href="/auth/discord" class="btn btn-discord btn-sm lock-btn"><i class="fa-brands fa-discord"></i> Masuk dengan Discord</a></div>`;
                    el.style.position = 'relative';
                    el.appendChild(overlay);
                }
                overlay.style.display = 'flex';
            } else { if (overlay) overlay.style.display = 'none'; }
        });
    }

    function openProfileMenu(currentUser, callbacks) {
        const existingMenu = document.getElementById('profileDropdownMenu');
        if (existingMenu) { existingMenu.remove(); return; }

        const dropdownMenu = document.createElement('div');
        dropdownMenu.id = 'profileDropdownMenu';
        dropdownMenu.style.cssText = 'position:fixed;top:68px;right:24px;width:260px;background:var(--bg-surface,#0b1120);border:1px solid var(--border-medium,rgba(244,114,182,0.3));border-radius:var(--r-xl,16px);padding:16px;box-shadow:0 15px 40px rgba(0,0,0,0.8);z-index:10001;display:flex;flex-direction:column;gap:12px;';
        dropdownMenu.innerHTML = `<div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px;"><img src="${currentUser.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--accent-green);" /><div><div style="font-weight:700;font-size:14px;color:var(--text-primary);">${currentUser.username}</div><div style="font-size:11px;color:var(--accent-green);">${currentUser.role}</div></div></div><div style="font-size:12px;color:var(--text-secondary);display:flex;justify-content:space-between;"><span>Dompet NC:</span><b style="color:var(--accent-amber);">${Number(currentUser.nc).toLocaleString('id-ID')} NC</b></div><div style="font-size:12px;color:var(--text-secondary);display:flex;justify-content:space-between;"><span>Survival NSF:</span><b style="color:var(--accent-cyan);">${Number(currentUser.nsf).toLocaleString('id-ID')} NSF</b></div><a href="/profile" class="btn btn-primary btn-sm" style="width:100%;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;font-size:11.5px;font-weight:600;"><i class="fa-solid fa-id-card"></i> Lihat Profil Lengkap</a><div style="display:flex;gap:8px;margin-top:4px;"><button type="button" id="pmenuSwitchBtn" class="btn btn-ghost btn-sm" style="flex:1;font-size:11px;justify-content:center;">Ganti Akun</button><button type="button" id="pmenuLogoutBtn" class="btn btn-danger btn-sm" style="flex:1;font-size:11px;justify-content:center;background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.4);">Logout</button></div>`;

        document.body.appendChild(dropdownMenu);

        document.getElementById('pmenuSwitchBtn')?.addEventListener('click', () => {
            dropdownMenu.remove();
            if (callbacks && callbacks.onOpenModal) callbacks.onOpenModal();
        });

        document.getElementById('pmenuLogoutBtn')?.addEventListener('click', () => {
            dropdownMenu.remove();
            if (callbacks && callbacks.onLogout) callbacks.onLogout();
        });

        const outsideClickListener = (clickEvent) => {
            if (!dropdownMenu.contains(clickEvent.target) && clickEvent.target.id !== 'headerAuthBtn' && clickEvent.target.id !== 'headerAvatar') {
                dropdownMenu.remove();
                document.removeEventListener('click', outsideClickListener);
            }
        };
        setTimeout(() => document.addEventListener('click', outsideClickListener), 100);
    }

    function initModal(callbacks) {
        if (document.getElementById('nauraAuthModal')) return;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'nauraAuthModal';
        modalContainer.className = 'auth-modal-backdrop';
        modalContainer.innerHTML = `<div class="auth-modal-card animate-scale"><div class="auth-modal-header"><div style="display:flex;align-items:center;gap:12px;"><div style="width:40px;height:40px;border-radius:12px;background:var(--primary-dim);border:1px solid var(--border-primary);display:flex;align-items:center;justify-content:center;font-size:20px;">🌸</div><div><div style="display:flex;align-items:center;gap:8px;"><span style="font-family:var(--font-heading);font-weight:700;font-size:18px;color:var(--text-primary);">Masuk ke Naura Hoshino OS</span><span class="badge" style="background:rgba(245,158,11,0.15);color:var(--accent-amber);border:1px solid rgba(245,158,11,0.3);font-size:9.5px;font-family:var(--font-mono);font-weight:700;">SANDBOX</span></div><div style="font-size:12px;color:var(--text-muted);">Simulasi akses peran & otentikasi (Sesi transien, tidak tersimpan ke database)</div></div></div><button type="button" class="auth-modal-close" id="authModalCloseBtn">✕</button></div><div class="auth-tabs"><button type="button" class="auth-tab-btn active" id="authTabQuick">⚡ Profil Cepat</button><button type="button" class="auth-tab-btn" id="authTabDiscord">🎮 Discord OAuth</button><button type="button" class="auth-tab-btn" id="authTabSupabase">⚡ Supabase Auth</button></div><div class="auth-tab-pane active" id="paneQuick"><div style="font-size:11px;color:var(--accent-amber);background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:var(--r-md);padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-flask"></i> <span>Mode Sandbox: Seluruh konfigurasi profil bersifat sementara di tab ini dan tidak tersimpan ke database.</span></div><div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">Pilih salah satu profil akun simulasi untuk langsung merasakan fungsionalitas admin, booster, atau petualang tanpa setup OAuth:</div><div style="display:flex;flex-direction:column;gap:10px;"><div class="quick-profile-card" data-profile="owner"><img src="${PROFILES.owner.avatar}" class="qp-avatar" alt="Admin" /><div style="flex:1;"><div style="font-weight:700;font-size:14px;color:var(--text-primary);">Admin</div><div style="font-size:11px;color:var(--primary);">🛡️ Administrator Utama</div></div><span class="badge badge-primary">Akses Penuh</span></div><div class="quick-profile-card" data-profile="vip"><img src="${PROFILES.vip.avatar}" class="qp-avatar" alt="VIP Member" /><div style="flex:1;"><div style="font-weight:700;font-size:14px;color:var(--text-primary);">VIP Member</div><div style="font-size:11px;color:var(--accent-amber);">👑 VIP Server Booster</div></div><span class="badge badge-amber">45.2K NC</span></div><div class="quick-profile-card" data-profile="adventurer"><img src="${PROFILES.adventurer.avatar}" class="qp-avatar" alt="Petualang" /><div style="flex:1;"><div style="font-weight:700;font-size:14px;color:var(--text-primary);">Petualang</div><div style="font-size:11px;color:var(--accent-cyan);">⚔️ Petualang Naura Wilds</div></div><span class="badge badge-cyan">3.2K NSF</span></div></div></div><div class="auth-tab-pane" id="paneDiscord" style="display:none;"><div style="text-align:center;padding:20px 10px;"><div style="font-size:44px;color:#5865F2;margin-bottom:12px;"><i class="fa-brands fa-discord"></i></div><div style="font-weight:700;font-size:16px;color:var(--text-primary);margin-bottom:6px;">Masuk dengan Akun Discord Resmi</div><p style="font-size:12px;color:var(--text-muted);max-width:340px;margin:0 auto 20px;line-height:1.6;">Hubungkan server Discord, periksa saldo bot, dan kelola pemutaran lagu langsung dari akun Discord kamu.</p><button type="button" class="btn btn-discord" id="btnDiscordDirect" style="width:100%;padding:14px;font-size:14px;justify-content:center;"><i class="fa-brands fa-discord"></i> Lanjutkan dengan Discord</button></div></div><div class="auth-tab-pane" id="paneSupabase" style="display:none;"><form id="supabaseLoginForm" style="display:flex;flex-direction:column;gap:12px;padding:10px 0;"><div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-family:var(--font-mono);">EMAIL SUPABASE</label><input type="email" id="sbEmail" placeholder="developer@naura-hoshino.bot" value="admin@naura.local" style="width:100%;padding:10px 14px;border-radius:var(--r-md);background:var(--bg-elevated);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:13px;box-sizing:border-box;" required /></div><div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-family:var(--font-mono);">PASSWORD / ACCESS TOKEN</label><input type="password" id="sbPass" value="••••••••••••" style="width:100%;padding:10px 14px;border-radius:var(--r-md);background:var(--bg-elevated);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:13px;box-sizing:border-box;" required /></div><button type="submit" class="btn btn-primary" style="width:100%;padding:12px;margin-top:6px;justify-content:center;"><i class="fa-solid fa-bolt"></i> Masuk via Supabase Cloud</button></form></div></div>`;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = `.auth-modal-backdrop{position:fixed;inset:0;background:rgba(4,6,12,0.85);backdrop-filter:blur(14px);z-index:10000;display:none;align-items:center;justify-content:center;padding:20px}.auth-modal-backdrop.open{display:flex}.auth-modal-card{width:100%;max-width:480px;background:var(--bg-surface,#0b1120);border:1px solid var(--border-primary,rgba(244,114,182,0.3));border-radius:var(--r-2xl,24px);padding:24px;box-shadow:0 25px 60px rgba(0,0,0,0.8),0 0 40px var(--primary-dim,rgba(244,114,182,0.1))}.auth-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.auth-modal-close{background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;padding:6px;border-radius:8px;transition:all 0.2s}.auth-modal-close:hover{color:#fff;background:rgba(255,255,255,0.1)}.auth-tabs{display:flex;gap:6px;background:var(--bg-elevated,#060913);padding:4px;border-radius:var(--r-xl,14px);border:1px solid var(--border-subtle,rgba(255,255,255,0.06));margin-bottom:20px}.auth-tab-btn{flex:1;padding:8px 12px;border-radius:var(--r-lg,10px);background:none;border:none;color:var(--text-muted);font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s}.auth-tab-btn.active{background:var(--primary-dim,rgba(244,114,182,0.2));color:var(--primary,#f472b6);border:1px solid var(--border-primary,rgba(244,114,182,0.4))}.quick-profile-card{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:var(--r-xl,14px);background:var(--bg-elevated,#060913);border:1px solid var(--border-subtle,rgba(255,255,255,0.08));cursor:pointer;transition:all 0.2s ease}.quick-profile-card:hover{background:var(--bg-surface-hv,#131b2e);border-color:var(--border-medium,rgba(244,114,182,0.4));transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.4)}.qp-avatar{width:42px;height:42px;border-radius:50%;border:2px solid rgba(244,114,182,0.5);object-fit:cover}.naura-auth-trust-banner{background:linear-gradient(135deg,rgba(88,101,242,0.12) 0%,rgba(244,114,182,0.08) 50%,rgba(18,24,38,0.9) 100%);border:1px solid rgba(88,101,242,0.35);border-radius:var(--r-xl,16px);padding:22px 24px;margin-bottom:24px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 12px 32px -8px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.08);position:relative;z-index:10;display:flex;flex-direction:column;gap:14px;animation:fadeInTrustBanner 0.3s cubic-bezier(0.16,1,0.3,1)}@keyframes fadeInTrustBanner{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}.auth-trust-badge-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.auth-badge-official{display:inline-flex;align-items:center;gap:6px;background:rgba(88,101,242,0.15);border:1px solid rgba(88,101,242,0.4);color:#7289da;font-family:var(--font-mono,monospace);font-size:11px;font-weight:700;padding:3px 10px;border-radius:9999px;text-transform:uppercase}.auth-badge-oauth{display:inline-flex;align-items:center;gap:6px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.35);color:#34d399;font-family:var(--font-mono,monospace);font-size:11px;font-weight:700;padding:3px 10px;border-radius:9999px;text-transform:uppercase}.auth-badge-mode{display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);color:#fbbf24;font-family:var(--font-mono,monospace);font-size:11px;font-weight:700;padding:3px 10px;border-radius:9999px;text-transform:uppercase}.auth-trust-title{margin:0 0 8px;font-family:var(--font-heading,'Orbitron',sans-serif);font-size:clamp(16px,2.5vw,19px);font-weight:700;color:#ffffff;letter-spacing:0.3px}.auth-trust-desc{margin:0 0 12px;font-size:13.5px;line-height:1.6;color:var(--text-secondary,#d1d5db)}.auth-trust-points{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;padding:12px 14px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.05);border-radius:var(--r-md,8px)}.auth-trust-point{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted,#9ca3af)}.auth-trust-point i{color:var(--accent-green,#34d399);flex-shrink:0}.auth-trust-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}.btn-auth-trust-primary{padding:10px 20px;font-size:13.5px;font-weight:600;border-radius:var(--r-md,10px);text-decoration:none;background:#5865F2;color:#fff;display:inline-flex;align-items:center;gap:8px;border:none;box-shadow:0 4px 14px rgba(88,101,242,0.35);transition:all 0.2s ease}.btn-auth-trust-primary:hover{background:#4752c4;transform:translateY(-1px);box-shadow:0 6px 20px rgba(88,101,242,0.45)}.btn-auth-trust-sandbox,.btn-auth-trust-back{padding:10px 16px;font-size:12.5px;border-radius:var(--r-md,10px);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px}`;

        document.head.appendChild(styleSheet);
        document.body.appendChild(modalContainer);

        document.getElementById('authModalCloseBtn')?.addEventListener('click', () => { if (callbacks && callbacks.onCloseModal) callbacks.onCloseModal(); });
        modalContainer.addEventListener('click', (clickEvent) => { if (clickEvent.target === modalContainer && callbacks && callbacks.onCloseModal) callbacks.onCloseModal(); });

        const tabQuick = document.getElementById('authTabQuick');
        const tabDiscord = document.getElementById('authTabDiscord');
        const tabSupabase = document.getElementById('authTabSupabase');
        const paneQuick = document.getElementById('paneQuick');
        const paneDiscord = document.getElementById('paneDiscord');
        const paneSupabase = document.getElementById('paneSupabase');

        const switchActiveTab = (activeTabButton, activePaneElement) => {
            [tabQuick, tabDiscord, tabSupabase].forEach((btn) => btn?.classList.remove('active'));
            [paneQuick, paneDiscord, paneSupabase].forEach((pane) => { if (pane) pane.style.display = 'none'; });
            activeTabButton?.classList.add('active');
            if (activePaneElement) activePaneElement.style.display = 'block';
        };

        tabQuick?.addEventListener('click', () => switchActiveTab(tabQuick, paneQuick));
        tabDiscord?.addEventListener('click', () => switchActiveTab(tabDiscord, paneDiscord));
        tabSupabase?.addEventListener('click', () => switchActiveTab(tabSupabase, paneSupabase));

        document.querySelectorAll('.quick-profile-card').forEach((cardElement) => {
            cardElement.addEventListener('click', () => { if (callbacks && callbacks.onLoginAs) callbacks.onLoginAs(cardElement.dataset.profile); });
        });

        document.getElementById('btnDiscordDirect')?.addEventListener('click', () => { window.location.href = '/auth/discord'; });
        document.getElementById('supabaseLoginForm')?.addEventListener('submit', (formEvent) => { formEvent.preventDefault(); if (callbacks && callbacks.onLoginAs) callbacks.onLoginAs('adventurer'); });
    }

    function openModal() { const m = document.getElementById('nauraAuthModal'); if (m) m.classList.add('open'); }
    function closeModal() { const m = document.getElementById('nauraAuthModal'); if (m) m.classList.remove('open'); }

    window.NauraSessionPresenter = { syncUI, renderUserDataTrustBanner, applyAuthGuards, openProfileMenu, initModal, openModal, closeModal, PROFILES, ROLE_AVATARS };
    if (window.NauraAuth && typeof window.NauraAuth._initPresenterModal === 'function') {
        window.NauraAuth._initPresenterModal();
        window.NauraAuth.syncUI();
    }
})();