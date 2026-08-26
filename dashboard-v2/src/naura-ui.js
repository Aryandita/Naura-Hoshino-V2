/* =====================================================================
 * naura-ui.js - Lapisan bersama untuk seluruh halaman dashboard (V2 ES Module Port).
 *
 * Menangani tiga hal:
 *   1. Bahasa, diambil dari /api/me/language
 *   2. State kosong/galat/memuat memakai PNG transparan Naura.
 *   3. Latar & efek suara
 * ===================================================================== */

const SUPPORTED = ['id', 'en'];
const FALLBACK = 'id';
const BASE = '/assets/Naura_Expression/';

const EXPRESSION = {
    success: 'Cheers', loading: 'Thinking', error: 'Cry', empty: 'Akward',
    denied: 'Hmph', welcome: 'Happy', levelup: 'Impressed', music: 'Chirping',
    info: 'Read', shy: 'Shy', surprised: 'Shocked'
};

const DICT = {
    id: {
        'state.loading.title': 'Sebentar ya...',
        'state.loading.body': 'Naura lagi ambilkan datanya buat kamu.',
        'state.error.title': 'Aduh, gagal nih',
        'state.error.body': 'Maaf ya, Naura belum berhasil memuat bagian ini. Coba muat ulang sebentar lagi.',
        'state.empty.title': 'Masih kosong',
        'state.empty.body': 'Belum ada apa-apa di sini. Yuk mulai dulu, nanti Naura catat semuanya!',
        'state.denied.title': 'Belum boleh masuk',
        'state.denied.body': 'Kamu perlu izin Kelola Server untuk membuka halaman ini ya.',
        'nav.home': 'Beranda',
        'lb.title': 'Papan Peringkat',
        'lb.wealth': 'Terkaya',
        'lb.chat_level': 'Level Obrolan',
        'lb.rpg_level': 'Level Survival',
        'lb.trivia': 'Trivia',
        'lb.music': 'Musik',
        'lb.rank': 'Peringkat',
        'lb.player': 'Pemain',
        'lb.score': 'Nilai',
        'common.retry': 'Coba lagi'
    },
    en: {
        'state.loading.title': 'Just a moment...',
        'state.loading.body': "Naura's fetching your data right now.",
        'state.error.title': 'Oh no, that failed',
        'state.error.body': "Sorry! Naura couldn't load this part. Try refreshing in a moment.",
        'state.empty.title': 'Nothing here yet',
        'state.empty.body': "It's empty for now. Get started and Naura will keep track of everything!",
        'state.denied.title': 'Not just yet',
        'state.denied.body': 'You need the Manage Server permission to open this page.',
        'nav.home': 'Home',
        'lb.title': 'Leaderboard',
        'lb.wealth': 'Richest',
        'lb.chat_level': 'Chat Level',
        'lb.rpg_level': 'Survival Level',
        'lb.trivia': 'Trivia',
        'lb.music': 'Music',
        'lb.rank': 'Rank',
        'lb.player': 'Player',
        'lb.score': 'Score',
        'common.retry': 'Try again'
    }
};

class NauraUIClass {
    constructor() {
        this.lang = FALLBACK;
        this.sfxPlayer = null;
    }

    normalize(lang) {
        const v = String(lang || '').toLowerCase().slice(0, 2);
        return SUPPORTED.indexOf(v) !== -1 ? v : FALLBACK;
    }

    expressionUrl(mood) {
        return BASE + encodeURIComponent(EXPRESSION[mood] || EXPRESSION.empty) + '.png';
    }

    t(key, vars) {
        let text = (DICT[this.lang] || {})[key];
        if (text === undefined) text = (DICT[FALLBACK] || {})[key];
        if (text === undefined) return key;
        if (vars) {
            Object.keys(vars).forEach(n => {
                text = text.split('{' + n + '}').join(String(vars[n]));
            });
        }
        return text;
    }

    apply(root) {
        (root || document).querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const attr = el.getAttribute('data-i18n-attr');
            if (attr) el.setAttribute(attr, this.t(key));
            else el.textContent = this.t(key);
        });
        document.documentElement.setAttribute('lang', this.lang);
    }

    async loadLanguage() {
        const cached = localStorage.getItem('nauraLang');
        if (cached) this.lang = this.normalize(cached);

        try {
            const res = await fetch('/api/me/language', { credentials: 'same-origin' });
            if (res.ok) {
                const data = await res.json();
                if (data && data.language) {
                    this.lang = this.normalize(data.language);
                    localStorage.setItem('nauraLang', this.lang);
                }
            }
        } catch (err) {
            /* Belum masuk atau server sibuk: pakai cache/bawaan saja. */
        }
        
        this.apply();
        return this.lang;
    }

    async setLanguage(lang) {
        this.lang = this.normalize(lang);
        localStorage.setItem('nauraLang', this.lang);
        this.apply();

        try {
            await fetch('/api/me/language', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: this.lang })
            });
        } catch (err) {
            /* Gagal simpan ke server tidak boleh membatalkan perubahan di layar. */
        }
        return this.lang;
    }

    stateHtml(kind, options) {
        const opts = options || {};
        const title = opts.title || this.t('state.' + kind + '.title');
        const bodyText = opts.body || this.t('state.' + kind + '.body');
        const modifier = kind === 'error' ? ' naura-state--error' : kind === 'loading' ? ' naura-state--loading' : '';

        return (
            '<div class="naura-state' + modifier + '">' +
            '<img class="naura-state__figure" alt="" src="' + this.expressionUrl(kind) + '">' +
            '<p class="naura-state__title">' + title + '</p>' +
            '<p class="naura-state__body">' + bodyText + '</p>' +
            '</div>'
        );
    }

    showState(target, kind, options) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (el) el.innerHTML = this.stateHtml(kind, options);
    }

    resolveBgUrl(url) {
        if (url && url.indexOf('adaptive-') === 0) {
            const suffix = url.substring('adaptive-'.length);
            const size = window.innerWidth < 768 ? 'bg_mobile_' : 'bg_pc_';
            return '/assets/dashboard/' + size + suffix + '.png';
        }
        return url;
    }

    playClickSfx() {
        if (localStorage.getItem('sfxEnabled') === 'false') return;
        if (!this.sfxPlayer) this.sfxPlayer = new Audio('/assets/dashboard/click.mp3');
        this.sfxPlayer.currentTime = 0;
        this.sfxPlayer.play().catch(() => {});
    }
}

export const NauraUI = new NauraUIClass();
// Biarkan global untuk script lama yang belum pakai modul
window.NauraUI = NauraUI;
