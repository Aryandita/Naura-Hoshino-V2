/* =====================================================================
 * naura-ui.js - Lapisan bersama untuk seluruh halaman dashboard.
 *
 * Muat setelah tokens.css dan sebelum skrip halaman:
 *   <script src="/js/naura-ui.js"></script>
 *
 * Tiga hal yang ditangani di sini:
 *   1. Bahasa. Diambil dari /api/me/language, yaitu sumber yang sama dengan
 *      yang dipakai bot lewat languageManager. Jadi kalau kamu memilih
 *      Inggris di /help, dashboard ikut berbahasa Inggris tanpa disetel lagi.
 *   2. State kosong / galat / memuat memakai PNG transparan Naura.
 *   3. Latar dan efek suara, yang sebelumnya disalin dua kali antara
 *      app.js dan skrip inline di leaderboard.html.
 * ===================================================================== */

(function (global) {
    'use strict';

    var SUPPORTED = ['id', 'en'];
    var FALLBACK = 'id';
    var EXPRESSION_BASE = '/assets/Naura_Expression/';

    /* -----------------------------------------------------------------
     * Pemetaan ekspresi. Sengaja disamakan persis dengan
     * src/utils/nauraExpression.js supaya Naura di web dan di Discord
     * bereaksi dengan wajah yang sama pada situasi yang sama.
     * ----------------------------------------------------------------- */
    var EXPRESSION = {
        success: 'Cheers',
        loading: 'Thinking',
        error: 'Cry',
        empty: 'Akward',
        denied: 'Hmph',
        welcome: 'Happy',
        levelup: 'Impressed',
        reward: 'Impressed',
        music: 'Chirping',
        info: 'Read',
        shy: 'Shy',
        surprised: 'Shocked'
    };

    function expressionUrl(mood) {
        var name = EXPRESSION[mood] || EXPRESSION.empty;
        return EXPRESSION_BASE + encodeURIComponent(name) + '.png';
    }

    /* -----------------------------------------------------------------
     * Kamus. Nada bicaranya sengaja hangat dan personal - Naura berbicara
     * langsung ke pengguna, bukan sistem yang melapor.
     * ----------------------------------------------------------------- */
    var DICT = {
        id: {
            'state.loading.title': 'Sebentar ya...',
            'state.loading.body': 'Naura lagi ambilkan datanya buat kamu.',
            'state.error.title': 'Aduh, gagal nih',
            'state.error.body': 'Maaf ya, Naura belum berhasil memuat bagian ini. Coba muat ulang sebentar lagi.',
            'state.empty.title': 'Masih kosong',
            'state.empty.body': 'Belum ada apa-apa di sini. Yuk mulai dulu, nanti Naura catat semuanya!',
            'state.denied.title': 'Belum boleh masuk',
            'state.denied.body': 'Kamu perlu izin Kelola Server untuk membuka halaman ini ya.',
            'state.offline.title': 'Kamu belum masuk',
            'state.offline.body': 'Masuk dengan Discord dulu yuk, biar Naura kenal kamu.',

            'nav.home': 'Beranda',
            'nav.leaderboard': 'Peringkat',
            'nav.settings': 'Pengaturan',
            'nav.profile': 'Profil',
            'nav.music': 'Musik',
            'nav.chat': 'Ngobrol',

            'lb.title': 'Papan Peringkat',
            'lb.wealth': 'Terkaya',
            'lb.chat_level': 'Level Obrolan',
            'lb.rpg_level': 'Level Survival',
            'lb.trivia': 'Trivia',
            'lb.music': 'Musik',
            'lb.rank': 'Peringkat',
            'lb.player': 'Pemain',
            'lb.score': 'Nilai',

            'common.retry': 'Coba lagi',
            'common.save': 'Simpan',
            'common.saved': 'Tersimpan!',
            'common.cancel': 'Batal',
            'common.login': 'Masuk dengan Discord',
            'common.logout': 'Keluar',
            'common.language': 'Bahasa'
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
            'state.offline.title': "You're not signed in",
            'state.offline.body': 'Sign in with Discord first so Naura knows who you are!',

            'nav.home': 'Home',
            'nav.leaderboard': 'Leaderboard',
            'nav.settings': 'Settings',
            'nav.profile': 'Profile',
            'nav.music': 'Music',
            'nav.chat': 'Chat',

            'lb.title': 'Leaderboard',
            'lb.wealth': 'Richest',
            'lb.chat_level': 'Chat Level',
            'lb.rpg_level': 'Survival Level',
            'lb.trivia': 'Trivia',
            'lb.music': 'Music',
            'lb.rank': 'Rank',
            'lb.player': 'Player',
            'lb.score': 'Score',

            'common.retry': 'Try again',
            'common.save': 'Save',
            'common.saved': 'Saved!',
            'common.cancel': 'Cancel',
            'common.login': 'Sign in with Discord',
            'common.logout': 'Sign out',
            'common.language': 'Language'
        }
    };

    var currentLang = FALLBACK;

    function normalize(lang) {
        var value = String(lang || '').toLowerCase().slice(0, 2);
        return SUPPORTED.indexOf(value) !== -1 ? value : FALLBACK;
    }

    /** Terjemahkan satu kunci, dengan penggantian {placeholder}. */
    function t(key, vars) {
        var table = DICT[currentLang] || DICT[FALLBACK];
        var text = table[key];
        if (text === undefined) text = (DICT[FALLBACK] || {})[key];
        if (text === undefined) return key;

        if (vars) {
            Object.keys(vars).forEach(function (name) {
                text = text.split('{' + name + '}').join(String(vars[name]));
            });
        }
        return text;
    }

    /**
     * Terapkan terjemahan ke seluruh elemen ber-atribut data-i18n.
     * Contoh: <h1 data-i18n="lb.title">Papan Peringkat</h1>
     * Untuk atribut: data-i18n-attr="placeholder" data-i18n="..."
     */
    function apply(root) {
        var scope = root || document;
        scope.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            var attr = el.getAttribute('data-i18n-attr');
            if (attr) el.setAttribute(attr, t(key));
            else el.textContent = t(key);
        });
        document.documentElement.setAttribute('lang', currentLang);
    }

    /** Ambil bahasa dari sumber yang sama dengan bot. */
    async function loadLanguage() {
        // Tampilkan pilihan tersimpan lebih dulu agar tidak ada kedipan teks.
        var cached = null;
        try {
            cached = localStorage.getItem('nauraLang');
        } catch (e) {
            /* localStorage bisa diblokir; abaikan saja. */
        }
        if (cached) currentLang = normalize(cached);

        try {
            var res = await fetch('/api/me/language', { credentials: 'same-origin' });
            if (res.ok) {
                var data = await res.json();
                currentLang = normalize(data.language);
                try {
                    localStorage.setItem('nauraLang', currentLang);
                } catch (e) {
                    /* abaikan */
                }
            }
        } catch (e) {
            /* Belum masuk atau jaringan bermasalah: pakai bawaan. */
        }

        apply();
        return currentLang;
    }

    /** Simpan pilihan bahasa; bot ikut berubah karena sumbernya satu. */
    async function setLanguage(lang) {
        var next = normalize(lang);
        currentLang = next;
        try {
            localStorage.setItem('nauraLang', next);
        } catch (e) {
            /* abaikan */
        }

        apply();

        try {
            await fetch('/api/me/language', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: next })
            });
        } catch (e) {
            /* Perubahan tetap terasa di layar meski gagal disimpan. */
        }
        return next;
    }

    /* -----------------------------------------------------------------
     * State visual
     * ----------------------------------------------------------------- */

    /**
     * Bangun potongan HTML state Naura.
     * @param {'loading'|'error'|'empty'|'denied'|'offline'} kind
     */
    function stateHtml(kind, options) {
        var opts = options || {};
        var moodByKind = {
            loading: 'loading',
            error: 'error',
            empty: 'empty',
            denied: 'denied',
            offline: 'shy'
        };
        var mood = opts.mood || moodByKind[kind] || 'empty';
        var title = opts.title || t('state.' + kind + '.title');
        var body = opts.body || t('state.' + kind + '.body');
        var small = opts.small ? ' naura-state__figure--sm' : '';

        return (
            '<div class="naura-state naura-state--' +
            kind +
            '">' +
            '<img class="naura-state__figure' +
            small +
            '" src="' +
            expressionUrl(mood) +
            '" alt="" aria-hidden="true" loading="lazy">' +
            '<p class="naura-state__title">' +
            title +
            '</p>' +
            '<p class="naura-state__body">' +
            body +
            '</p>' +
            '</div>'
        );
    }

    /** Pasang state ke sebuah wadah. */
    function showState(target, kind, options) {
        var el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return null;
        el.innerHTML = stateHtml(kind, options);
        return el;
    }

    /* -----------------------------------------------------------------
     * Latar & suara - dulu disalin di app.js dan leaderboard.html
     * ----------------------------------------------------------------- */

    /** Terjemahkan nilai tema jadi URL gambar latar yang sesuai perangkat. */
    function resolveBgUrl(value) {
        if (!value) return '';
        if (value.indexOf('adaptive-') !== 0) return value;

        var suffix = value.slice('adaptive-'.length);
        var isMobile = window.matchMedia('(max-width: 768px)').matches;
        return '/assets/dashboard/' + (isMobile ? 'bg_mobile_' : 'bg_pc_') + suffix + '.png';
    }

    /** Bunyikan efek klik bila pengguna mengaktifkannya. */
    function playClickSfx() {
        if (typeof global.playClickSfx === 'function' && global.playClickSfx !== playClickSfx) {
            return global.playClickSfx();
        }
        try {
            if (localStorage.getItem('sfxEnabled') === 'false') return;
            var audio = new Audio('/assets/dashboard/click.mp3');
            audio.volume = parseFloat(localStorage.getItem('masterVolume') || '0.5');
            audio.play().catch(function () {});
        } catch (e) {
            /* Peramban bisa memblokir audio sebelum ada interaksi. */
        }
    }

    global.NauraUI = {
        SUPPORTED: SUPPORTED,
        EXPRESSION: EXPRESSION,
        expressionUrl: expressionUrl,
        get lang() {
            return currentLang;
        },
        t: t,
        apply: apply,
        loadLanguage: loadLanguage,
        setLanguage: setLanguage,
        stateHtml: stateHtml,
        showState: showState,
        resolveBgUrl: resolveBgUrl,
        playClickSfx: playClickSfx
    };

    // Bahasa dimuat sedini mungkin agar teks tidak sempat berkedip.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadLanguage);
    } else {
        loadLanguage();
    }
})(window);
