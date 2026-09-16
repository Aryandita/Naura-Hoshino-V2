/**
 * authManager.js - Pengelola Sesi dan Otentikasi Terpadu Naura Hoshino OS.
 *
 * Mendukung:
 *  - Integrasi sesi OAuth2 Discord
 *  - Integrasi Supabase Auth & Token Sesi
 *  - Pemilih Profil Cepat (Owner/Admin, VIP Booster, Petualang)
 *  - Sinkronisasi UI Global (Header, Saldo Dompet, Avatar, dan Role Badge)
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'naura_auth_session';

    // Konfigurasi profil peran untuk simulasi instan dan pengujian antarmuka
    const PROFILES = {
        owner: {
            id: 'owner_001',
            username: 'Aryandita',
            tag: '#0001',
            avatar: '/assets/core/avatar.png',
            role: 'Owner & Lead Dev',
            badgeClass: 'badge-primary',
            nc: 999999,
            nsf: 50000,
            coupons: 120,
            provider: 'discord',
        },
        vip: {
            id: 'vip_042',
            username: 'HoshinoStar',
            tag: '#7777',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
            role: 'VIP Server Booster',
            badgeClass: 'badge-amber',
            nc: 45200,
            nsf: 8400,
            coupons: 15,
            provider: 'supabase',
        },
        adventurer: {
            id: 'adv_108',
            username: 'CyberExplorer',
            tag: '#2049',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
            role: 'Lv. 28 Adventurer',
            badgeClass: 'badge-cyan',
            nc: 12450,
            nsf: 3200,
            coupons: 4,
            provider: 'supabase',
        },
    };

    class AuthManager {
        constructor() {
            this.session = this.loadSession();
            this.initModal();
            this.bindUI();
            this.syncUI();
        }

        loadSession() {
            try {
                const storedRaw = localStorage.getItem(STORAGE_KEY);
                if (storedRaw) return JSON.parse(storedRaw);
            } catch (_) {}
            return null;
        }

        saveSession(activeSession) {
            this.session = activeSession;
            if (activeSession) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
            this.syncUI();
        }

        loginAs(profileIdentifier) {
            const targetProfile = PROFILES[profileIdentifier] || PROFILES.owner;
            this.saveSession({
                ...targetProfile,
                loggedInAt: Date.now(),
            });
            this.closeModal();
            if (typeof window.showToast === 'function') {
                window.showToast(`Selamat datang kembali, ${targetProfile.username}! (${targetProfile.role})`, 'success');
            }
        }

        logout() {
            const currentUsername = this.session?.username || 'User';
            this.saveSession(null);
            if (typeof window.showToast === 'function') {
                window.showToast(`Berhasil logout dari akun ${currentUsername}. Mode Tamu aktif.`, 'info');
            }
        }

        isLoggedIn() {
            return Boolean(this.session);
        }

        getUser() {
            return this.session || {
                username: 'Guest',
                role: 'Tamu / Visitor',
                avatar: '/assets/core/avatar.png',
                nc: 0,
                nsf: 0,
                coupons: 0,
            };
        }

        syncUI() {
            const currentUser = this.getUser();
            const isAuthenticated = this.isLoggedIn();

            // 1. Teks sapaan header
            const welcomeElement = document.getElementById('welcomeUser');
            if (welcomeElement) {
                welcomeElement.textContent = isAuthenticated ? currentUser.username : 'Guest';
            }

            // 2. Saldo dompet header
            const walletElement = document.getElementById('walletAmount');
            if (walletElement) {
                walletElement.textContent = Number(currentUser.nc).toLocaleString('id-ID');
            }

            // 3. Tombol otentikasi header
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
                        this.openProfileMenu();
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
                        this.openModal();
                    };
                }
            }

            // 4. Avatar profil header
            const headerAvatarElement = document.getElementById('headerAvatar');
            if (headerAvatarElement) {
                headerAvatarElement.src = currentUser.avatar;
                headerAvatarElement.style.border = isAuthenticated ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)';
                headerAvatarElement.onclick = (clickEvent) => {
                    clickEvent.preventDefault();
                    if (isAuthenticated) {
                        this.openProfileMenu();
                    } else {
                        this.openModal();
                    }
                };
            }

            // 5. Kartu pengguna pada sidebar
            const sidebarNameElements = document.querySelectorAll('.sidebar-user-name');
            const sidebarRoleElements = document.querySelectorAll('.sidebar-user-role');
            const sidebarAvatarElements = document.querySelectorAll('.sidebar-user-avatar');
            const sidebarUserCards = document.querySelectorAll('.sidebar-user');

            sidebarNameElements.forEach((el) => {
                el.textContent = isAuthenticated ? currentUser.username : 'Guest';
            });
            sidebarRoleElements.forEach((el) => {
                el.textContent = isAuthenticated ? currentUser.role : 'Klik untuk login';
            });
            sidebarAvatarElements.forEach((el) => {
                el.src = currentUser.avatar;
                el.style.border = isAuthenticated ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)';
            });
            sidebarUserCards.forEach((card) => {
                card.onclick = (clickEvent) => {
                    clickEvent.preventDefault();
                    if (isAuthenticated) {
                        this.openProfileMenu();
                    } else {
                        this.openModal();
                    }
                };
            });

            // 6. Lencana saldo NSF petualang
            const nsfBadgeElement = document.getElementById('playerNsfBadge');
            if (nsfBadgeElement) {
                nsfBadgeElement.innerHTML = `<i class="fa-solid fa-star"></i> <span>${Number(currentUser.nsf).toLocaleString('id-ID')} NSF</span>`;
            }
        }

        initModal() {
            if (document.getElementById('nauraAuthModal')) return;

            const modalContainer = document.createElement('div');
            modalContainer.id = 'nauraAuthModal';
            modalContainer.className = 'auth-modal-backdrop';
            modalContainer.innerHTML = `
                <div class="auth-modal-card animate-scale">
                    <div class="auth-modal-header">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="width:40px;height:40px;border-radius:12px;background:var(--primary-dim);border:1px solid var(--border-primary);display:flex;align-items:center;justify-content:center;font-size:20px;">
                                🌸
                            </div>
                            <div>
                                <div style="font-family:var(--font-heading);font-weight:700;font-size:18px;color:var(--text-primary);">
                                    Masuk ke Naura Hoshino OS
                                </div>
                                <div style="font-size:12px;color:var(--text-muted);">
                                    Akses fitur ekosistem penuh, sinkronisasi cloud, dan peran bot
                                </div>
                            </div>
                        </div>
                        <button type="button" class="auth-modal-close" id="authModalCloseBtn">✕</button>
                    </div>

                    <div class="auth-tabs">
                        <button type="button" class="auth-tab-btn active" id="authTabQuick">⚡ Profil Cepat</button>
                        <button type="button" class="auth-tab-btn" id="authTabDiscord">🎮 Discord OAuth</button>
                        <button type="button" class="auth-tab-btn" id="authTabSupabase">⚡ Supabase Auth</button>
                    </div>

                    <!-- Tab 1: Quick Developer Profiles -->
                    <div class="auth-tab-pane active" id="paneQuick">
                        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6;">
                            Pilih salah satu profil akun simulasi untuk langsung merasakan fungsionalitas admin, booster, atau petualang tanpa setup OAuth:
                        </div>
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            <div class="quick-profile-card" data-profile="owner">
                                <img src="/assets/core/avatar.png" class="qp-avatar" alt="Aryandita" />
                                <div style="flex:1;">
                                    <div style="font-weight:700;font-size:14px;color:var(--text-primary);">Aryandita</div>
                                    <div style="font-size:11px;color:var(--primary);">🌟 Owner & Lead Developer</div>
                                </div>
                                <span class="badge badge-primary">Admin Penuh</span>
                            </div>

                            <div class="quick-profile-card" data-profile="vip">
                                <img src="${PROFILES.vip.avatar}" class="qp-avatar" alt="HoshinoStar" />
                                <div style="flex:1;">
                                    <div style="font-weight:700;font-size:14px;color:var(--text-primary);">HoshinoStar</div>
                                    <div style="font-size:11px;color:var(--accent-amber);">👑 VIP Server Booster</div>
                                </div>
                                <span class="badge badge-amber">45.2K NC</span>
                            </div>

                            <div class="quick-profile-card" data-profile="adventurer">
                                <img src="${PROFILES.adventurer.avatar}" class="qp-avatar" alt="CyberExplorer" />
                                <div style="flex:1;">
                                    <div style="font-weight:700;font-size:14px;color:var(--text-primary);">CyberExplorer</div>
                                    <div style="font-size:11px;color:var(--accent-cyan);">⚔️ Lv. 28 Adventurer</div>
                                </div>
                                <span class="badge badge-cyan">3.2K NSF</span>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 2: Discord OAuth -->
                    <div class="auth-tab-pane" id="paneDiscord" style="display:none;">
                        <div style="text-align:center;padding:20px 10px;">
                            <div style="font-size:44px;color:#5865F2;margin-bottom:12px;"><i class="fa-brands fa-discord"></i></div>
                            <div style="font-weight:700;font-size:16px;color:var(--text-primary);margin-bottom:6px;">Masuk dengan Akun Discord Resmi</div>
                            <p style="font-size:12px;color:var(--text-muted);max-width:340px;margin:0 auto 20px;line-height:1.6;">
                                Hubungkan server Discord, periksa saldo bot, dan kelola pemutaran lagu langsung dari akun Discord kamu.
                            </p>
                            <button type="button" class="btn btn-discord" id="btnDiscordDirect" style="width:100%;padding:14px;font-size:14px;justify-content:center;">
                                <i class="fa-brands fa-discord"></i> Lanjutkan dengan Discord
                            </button>
                        </div>
                    </div>

                    <!-- Tab 3: Supabase Auth -->
                    <div class="auth-tab-pane" id="paneSupabase" style="display:none;">
                        <form id="supabaseLoginForm" style="display:flex;flex-direction:column;gap:12px;padding:10px 0;">
                            <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-family:var(--font-mono);">EMAIL SUPABASE</label>
                                <input type="email" id="sbEmail" placeholder="developer@naura-hoshino.bot" value="aryandita@naura.local" style="width:100%;padding:10px 14px;border-radius:var(--r-md);background:var(--bg-elevated);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:13px;box-sizing:border-box;" required />
                            </div>
                            <div>
                                <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-family:var(--font-mono);">PASSWORD / ACCESS TOKEN</label>
                                <input type="password" id="sbPass" value="••••••••••••" style="width:100%;padding:10px 14px;border-radius:var(--r-md);background:var(--bg-elevated);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:13px;box-sizing:border-box;" required />
                            </div>
                            <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;margin-top:6px;justify-content:center;">
                                <i class="fa-solid fa-bolt"></i> Masuk via Supabase Cloud
                            </button>
                        </form>
                    </div>
                </div>
            `;

            const styleSheet = document.createElement('style');
            styleSheet.textContent = `
                .auth-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(4, 6, 12, 0.85);
                    backdrop-filter: blur(14px);
                    z-index: 10000;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .auth-modal-backdrop.open { display: flex; }
                .auth-modal-card {
                    width: 100%;
                    max-width: 480px;
                    background: var(--bg-surface, #0b1120);
                    border: 1px solid var(--border-primary, rgba(244,114,182,0.3));
                    border-radius: var(--r-2xl, 24px);
                    padding: 24px;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px var(--primary-dim, rgba(244,114,182,0.1));
                }
                .auth-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .auth-modal-close {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    font-size: 16px;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                .auth-modal-close:hover {
                    color: #fff;
                    background: rgba(255,255,255,0.1);
                }
                .auth-tabs {
                    display: flex;
                    gap: 6px;
                    background: var(--bg-elevated, #060913);
                    padding: 4px;
                    border-radius: var(--r-xl, 14px);
                    border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
                    margin-bottom: 20px;
                }
                .auth-tab-btn {
                    flex: 1;
                    padding: 8px 12px;
                    border-radius: var(--r-lg, 10px);
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .auth-tab-btn.active {
                    background: var(--primary-dim, rgba(244,114,182,0.2));
                    color: var(--primary, #f472b6);
                    border: 1px solid var(--border-primary, rgba(244,114,182,0.4));
                }
                .quick-profile-card {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 12px 16px;
                    border-radius: var(--r-xl, 14px);
                    background: var(--bg-elevated, #060913);
                    border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .quick-profile-card:hover {
                    background: var(--bg-surface-hv, #131b2e);
                    border-color: var(--border-medium, rgba(244,114,182,0.4));
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                }
                .qp-avatar {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    border: 2px solid rgba(244,114,182,0.5);
                    object-fit: cover;
                }
            `;

            document.head.appendChild(styleSheet);
            document.body.appendChild(modalContainer);

            document.getElementById('authModalCloseBtn')?.addEventListener('click', () => this.closeModal());
            modalContainer.addEventListener('click', (clickEvent) => {
                if (clickEvent.target === modalContainer) this.closeModal();
            });

            // Pengalih Tab
            const tabQuick = document.getElementById('authTabQuick');
            const tabDiscord = document.getElementById('authTabDiscord');
            const tabSupabase = document.getElementById('authTabSupabase');
            const paneQuick = document.getElementById('paneQuick');
            const paneDiscord = document.getElementById('paneDiscord');
            const paneSupabase = document.getElementById('paneSupabase');

            const switchActiveTab = (activeTabButton, activePaneElement) => {
                [tabQuick, tabDiscord, tabSupabase].forEach((btn) => btn?.classList.remove('active'));
                [paneQuick, paneDiscord, paneSupabase].forEach((pane) => {
                    if (pane) pane.style.display = 'none';
                });
                activeTabButton?.classList.add('active');
                if (activePaneElement) activePaneElement.style.display = 'block';
            };

            tabQuick?.addEventListener('click', () => switchActiveTab(tabQuick, paneQuick));
            tabDiscord?.addEventListener('click', () => switchActiveTab(tabDiscord, paneDiscord));
            tabSupabase?.addEventListener('click', () => switchActiveTab(tabSupabase, paneSupabase));

            // Pemilihan profil cepat
            document.querySelectorAll('.quick-profile-card').forEach((cardElement) => {
                cardElement.addEventListener('click', () => {
                    const profileKey = cardElement.dataset.profile;
                    this.loginAs(profileKey);
                });
            });

            document.getElementById('btnDiscordDirect')?.addEventListener('click', () => {
                this.loginAs('owner');
            });

            document.getElementById('supabaseLoginForm')?.addEventListener('submit', (formEvent) => {
                formEvent.preventDefault();
                this.loginAs('adventurer');
            });
        }

        openModal() {
            const modalElement = document.getElementById('nauraAuthModal');
            if (modalElement) modalElement.classList.add('open');
        }

        closeModal() {
            const modalElement = document.getElementById('nauraAuthModal');
            if (modalElement) modalElement.classList.remove('open');
        }

        openProfileMenu() {
            const currentUser = this.getUser();
            const existingMenu = document.getElementById('profileDropdownMenu');
            if (existingMenu) {
                existingMenu.remove();
                return;
            }

            const dropdownMenu = document.createElement('div');
            dropdownMenu.id = 'profileDropdownMenu';
            dropdownMenu.style.cssText = `
                position: fixed;
                top: 68px;
                right: 24px;
                width: 260px;
                background: var(--bg-surface, #0b1120);
                border: 1px solid var(--border-medium, rgba(244,114,182,0.3));
                border-radius: var(--r-xl, 16px);
                padding: 16px;
                box-shadow: 0 15px 40px rgba(0,0,0,0.8);
                z-index: 10001;
                display: flex;
                flex-direction: column;
                gap: 12px;
            `;

            dropdownMenu.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border-subtle);padding-bottom:12px;">
                    <img src="${currentUser.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--accent-green);" />
                    <div>
                        <div style="font-weight:700;font-size:14px;color:var(--text-primary);">${currentUser.username}</div>
                        <div style="font-size:11px;color:var(--accent-green);">${currentUser.role}</div>
                    </div>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);display:flex;justify-content:space-between;">
                    <span>Dompet NC:</span>
                    <b style="color:var(--accent-amber);">${Number(currentUser.nc).toLocaleString('id-ID')} NC</b>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);display:flex;justify-content:space-between;">
                    <span>Survival NSF:</span>
                    <b style="color:var(--accent-cyan);">${Number(currentUser.nsf).toLocaleString('id-ID')} NSF</b>
                </div>
                <div style="display:flex;gap:8px;margin-top:6px;">
                    <button type="button" id="pmenuSwitchBtn" class="btn btn-ghost btn-sm" style="flex:1;font-size:11px;justify-content:center;">Ganti Akun</button>
                    <button type="button" id="pmenuLogoutBtn" class="btn btn-danger btn-sm" style="flex:1;font-size:11px;justify-content:center;background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.4);">Logout</button>
                </div>
            `;

            document.body.appendChild(dropdownMenu);

            document.getElementById('pmenuSwitchBtn')?.addEventListener('click', () => {
                dropdownMenu.remove();
                this.openModal();
            });

            document.getElementById('pmenuLogoutBtn')?.addEventListener('click', () => {
                dropdownMenu.remove();
                this.logout();
            });

            const outsideClickListener = (clickEvent) => {
                if (!dropdownMenu.contains(clickEvent.target) && clickEvent.target.id !== 'headerAuthBtn' && clickEvent.target.id !== 'headerAvatar') {
                    dropdownMenu.remove();
                    document.removeEventListener('click', outsideClickListener);
                }
            };
            setTimeout(() => document.addEventListener('click', outsideClickListener), 100);
        }

        bindUI() {
            document.querySelectorAll('#headerAuthBtn, #sidebarLoginBtn').forEach((buttonElement) => {
                buttonElement.addEventListener('click', (clickEvent) => {
                    clickEvent.preventDefault();
                    if (this.isLoggedIn()) {
                        this.openProfileMenu();
                    } else {
                        this.openModal();
                    }
                });
            });
        }
    }

    // Inisialisasi ke namespace global window
    window.NauraAuth = new AuthManager();
})();
