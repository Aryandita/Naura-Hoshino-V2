/**
 * authManager.js - Pengelola Sesi dan Otentikasi Terpadu Naura Hoshino OS.
 *
 * Mendukung:
 *  - Integrasi sesi OAuth2 Discord
 *  - Integrasi Supabase Auth & Token Sesi
 *  - Pemilih Profil Cepat (Owner/Admin, VIP Booster, Petualang)
 *  - Sinkronisasi UI Global (Header, Saldo Dompet, Avatar, dan Role Badge)
 *
 * UI logic didelegasikan ke sessionPresenter.js untuk menghilangkan circular dependency.
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'naura_auth_session';
    function getPresenter() {
        return window.NauraSessionPresenter || null;
    }

    class AuthManager {
        constructor() {
            this.session = this.loadSession();
            this.setupFetchInterceptor();
            this.setupAutoReconnect();
            this._initPresenterModal();
            this.bindUI();
            this.syncUI();
            this.initServerSync();
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.syncUI());
            }
        }

        _getCallbacks() {
            return {
                onOpenProfileMenu: () => this.openProfileMenu(),
                onOpenModal: () => this.openModal(),
                onCloseModal: () => this.closeModal(),
                onLogout: () => this.logout(),
                onLoginAs: (profileKey) => this.loginAs(profileKey),
            };
        }

        setupFetchInterceptor() {
            if (window._nauraFetchInterceptorInstalled) return;
            window._nauraFetchInterceptorInstalled = true;

            const originalFetch = window.fetch.bind(window);
            let isRefreshing = false;
            let pendingRequests = [];

            const processQueue = (error, success = false) => {
                pendingRequests.forEach((prom) => {
                    if (error) prom.reject(error);
                    else prom.resolve();
                });
                pendingRequests = [];
            };

            window.fetch = async (...args) => {
                const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                try {
                    let response = await originalFetch(...args);
                    if (response.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/logout')) {
                        if (isRefreshing) {
                            await new Promise((resolve, reject) => { pendingRequests.push({ resolve, reject }); });
                            return originalFetch(...args);
                        }
                        isRefreshing = true;
                        try {
                            const refreshRes = await originalFetch('/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
                            if (refreshRes.ok) {
                                const refreshData = await refreshRes.json();
                                if (refreshData.success) {
                                    if (refreshData.user) this.saveSession({ ...this.getUser(), ...refreshData.user });
                                    processQueue(null, true);
                                    response = await originalFetch(...args);
                                    return response;
                                }
                            }
                            throw new Error('Refresh failed');
                        } catch (refreshErr) {
                            processQueue(refreshErr, false);
                            if (typeof window.showToast === 'function') window.showToast('Sesi login telah kedaluwarsa. Silakan simpan formulir atau login kembali.', 'warning');
                        } finally { isRefreshing = false; }
                    }
                    return response;
                } catch (err) { throw err; }
            };
        }

        setupAutoReconnect() {
            window.addEventListener('online', async () => {
                try {
                    const res = await fetch('/auth/reconnect', { method: 'POST', credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.authenticated && data.user) this.saveSession({ ...this.getUser(), ...data.user });
                        if (typeof window.showToast === 'function') window.showToast('Koneksi berhasil dipulihkan secara otomatis.', 'success');
                    }
                } catch (_) {}
            });

            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState === 'visible' && this.isLoggedIn()) {
                    try {
                        const res = await fetch('/auth/refresh', { method: 'POST', credentials: 'include' });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.success && data.user) this.saveSession({ ...this.getUser(), ...data.user });
                        }
                    } catch (_) {}
                }
            });
        }

        loadSession() {
            try {
                localStorage.removeItem(STORAGE_KEY);
                const storedRaw = sessionStorage.getItem(STORAGE_KEY);
                if (storedRaw) return JSON.parse(storedRaw);
            } catch (_) {}
            return null;
        }

        saveSession(activeSession) {
            this.session = activeSession;
            if (activeSession) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
            else sessionStorage.removeItem(STORAGE_KEY);
            this.syncUI();
        }

        loginAs(profileIdentifier) {
            const profiles = presenter.PROFILES;
            const targetProfile = profiles[profileIdentifier] || profiles.owner;
            this.saveSession({ ...targetProfile, loggedInAt: Date.now() });
            this.closeModal();
            if (typeof window.showToast === 'function') window.showToast(`Selamat datang kembali, ${targetProfile.username}! (${targetProfile.role})`, 'success');
        }

        async initServerSync() {
            try {
                const res = await fetch('/api/me', { credentials: 'include' });
                if (!res.ok) return;
                const data = await res.json();
                if (data && data.loggedIn && data.user) {
                    const u = data.user;
                    const db = data.db || {};
                    const survival = data.survival || {};

                    let avatarUrl = '/assets/core/avatar.png';
                    if (u.avatar) {
                        const isGif = typeof u.avatar === 'string' && u.avatar.startsWith('a_');
                        const ext = isGif ? 'gif' : 'png';
                        avatarUrl = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${ext}?size=128`;
                    } else if (u.id) {
                        try {
                            const defaultIdx = Number((BigInt(u.id) >> 22n) % 6n);
                            avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIdx}.png`;
                        } catch (_) { avatarUrl = '/assets/core/avatar.png'; }
                    }

                    const roleTitle = data.isOwner ? 'Server Owner / Administrator' : (db.isPremium ? 'VIP Member Booster' : 'Member Terverifikasi');
                    const totalNc = (Number(db.economy_wallet) || 0) + (Number(db.economy_bank) || 0);
                    const totalNsf = Number(survival.starFragments) || 0;
                    const totalCoupons = Number(survival.coupons) || 0;

                    this.saveSession({
                        id: u.id,
                        username: u.global_name || u.username || 'Pengguna Discord',
                        tag: u.discriminator && u.discriminator !== '0' ? `#${u.discriminator}` : '',
                        avatar: avatarUrl,
                        role: roleTitle,
                        badgeClass: data.isOwner ? 'badge-primary' : (db.isPremium ? 'badge-amber' : 'badge-cyan'),
                        nc: totalNc, nsf: totalNsf, coupons: totalCoupons,
                        vitals: { hp: survival.hp, hydration: survival.thirst, satiation: survival.hunger, energy: survival.stamina },
                        provider: 'discord', isServerAuth: true, isOwner: Boolean(data.isOwner),
                    });

                    if (data.dataError) {
                        console.warn('[NauraAuth] ' + data.dataError);
                        if (typeof window.showToast === 'function') window.showToast('Profil belum termuat penuh. Coba muat ulang halaman; kalau tetap sama, daftar ulang Discord.', 'warn', 6000);
                    }
                } else if (this.session && this.session.isServerAuth) {
                    this.saveSession(null);
                }
            } catch (err) { console.warn('[NauraAuth] Sesi server belum tersinkron:', err); }
        }

        async logout() {
            const isServer = Boolean(this.session?.isServerAuth);
            const currentUsername = this.session?.username || 'User';
            this.saveSession(null);
            if (isServer) {
                try { await fetch('/auth/logout', { credentials: 'include' }); } catch (_) {}
                window.location.href = '/auth/logout';
                return;
            }
            if (typeof window.showToast === 'function') window.showToast(`Berhasil logout dari akun ${currentUsername}. Mode Tamu aktif.`, 'info');
        }

        isLoggedIn() { return Boolean(this.session); }

        getUser() {
            return this.session || { username: 'Guest', role: 'Tamu / Visitor', avatar: '/assets/core/avatar.png', nc: 0, nsf: 0, coupons: 0, vitals: { hp: 100, hydration: 100, satiation: 100, energy: 100 } };
        }

        syncUI() {
            const p = getPresenter();
            if (p && typeof p.syncUI === 'function') p.syncUI(this.getUser(), this.isLoggedIn(), this._getCallbacks());
        }

        _initPresenterModal() {
            const p = getPresenter();
            if (p && typeof p.initModal === 'function') p.initModal(this._getCallbacks());
        }

        openModal() {
            const p = getPresenter();
            if (p && typeof p.openModal === 'function') p.openModal();
        }

        closeModal() {
            const p = getPresenter();
            if (p && typeof p.closeModal === 'function') p.closeModal();
        }

        openProfileMenu() {
            const p = getPresenter();
            if (p && typeof p.openProfileMenu === 'function') p.openProfileMenu(this.getUser(), this._getCallbacks());
        }

        bindUI() {
            document.querySelectorAll('#headerAuthBtn, #sidebarLoginBtn').forEach((buttonElement) => {
                buttonElement.addEventListener('click', (clickEvent) => {
                    clickEvent.preventDefault();
                    if (this.isLoggedIn()) this.openProfileMenu();
                    else this.openModal();
                });
            });
        }
    }

    window.NauraAuth = new AuthManager();
})();