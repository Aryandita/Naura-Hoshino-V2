/* =====================================================================
 * naura-ui.js - Lapisan bersama untuk seluruh halaman dashboard.
 *
 *   <script src="/js/naura-ui.js"></script>
 *
 * Menangani tiga hal:
 *   1. Bahasa, diambil dari /api/me/language - sumber yang sama dengan bot,
 *      jadi pilihan di /help langsung berlaku di web.
 *   2. State kosong/galat/memuat memakai PNG transparan Naura.
 *   3. Latar & efek suara, yang tadinya disalin dua kali.
 * ===================================================================== */

var NauraUI = (function () {
  "use strict";

  var SUPPORTED = ["id", "en"];
  var FALLBACK = "id";
  var BASE = "/assets/Naura_Expression/";

  /* Disamakan persis dengan src/utils/nauraExpression.js. */
  var EXPRESSION = {
    success: "Cheers",
    loading: "Thinking",
    error: "Cry",
    empty: "Akward",
    denied: "Hmph",
    welcome: "Happy",
    levelup: "Impressed",
    music: "Chirping",
    info: "Read",
    shy: "Shy",
    surprised: "Shocked",
  };

  var DICT = {
    id: {
      "state.loading.title": "Sebentar ya...",
      "state.loading.body": "Naura lagi ambilkan datanya buat kamu.",
      "state.error.title": "Aduh, gagal nih",
      "state.error.body":
        "Maaf ya, Naura belum berhasil memuat bagian ini. Coba muat ulang sebentar lagi.",
      "state.empty.title": "Masih kosong",
      "state.empty.body":
        "Belum ada apa-apa di sini. Yuk mulai dulu, nanti Naura catat semuanya!",
      "state.denied.title": "Belum boleh masuk",
      "state.denied.body":
        "Kamu perlu izin Kelola Server untuk membuka halaman ini ya.",
      "nav.home": "Beranda",
      "lb.title": "Papan Peringkat",
      "lb.wealth": "Terkaya",
      "lb.chat_level": "Level Obrolan",
      "lb.rpg_level": "Level Survival",
      "lb.trivia": "Trivia",
      "lb.music": "Musik",
      "lb.rank": "Peringkat",
      "lb.player": "Pemain",
      "lb.score": "Nilai",
      "common.retry": "Coba lagi",
    },
    en: {
      "state.loading.title": "Just a moment...",
      "state.loading.body": "Naura's fetching your data right now.",
      "state.error.title": "Oh no, that failed",
      "state.error.body":
        "Sorry! Naura couldn't load this part. Try refreshing in a moment.",
      "state.empty.title": "Nothing here yet",
      "state.empty.body":
        "It's empty for now. Get started and Naura will keep track of everything!",
      "state.denied.title": "Not just yet",
      "state.denied.body":
        "You need the Manage Server permission to open this page.",
      "nav.home": "Home",
      "lb.title": "Leaderboard",
      "lb.wealth": "Richest",
      "lb.chat_level": "Chat Level",
      "lb.rpg_level": "Survival Level",
      "lb.trivia": "Trivia",
      "lb.music": "Music",
      "lb.rank": "Rank",
      "lb.player": "Player",
      "lb.score": "Score",
      "common.retry": "Try again",
    },
  };

  var api = { lang: FALLBACK };

  function normalize(lang) {
    var v = String(lang || "")
      .toLowerCase()
      .slice(0, 2);
    return SUPPORTED.indexOf(v) !== -1 ? v : FALLBACK;
  }

  api.expressionUrl = function (mood) {
    return (
      BASE + encodeURIComponent(EXPRESSION[mood] || EXPRESSION.empty) + ".png"
    );
  };

  api.t = function (key, vars) {
    var text = (DICT[api.lang] || {})[key];
    if (text === undefined) text = (DICT[FALLBACK] || {})[key];
    if (text === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (n) {
        text = text.split("{" + n + "}").join(String(vars[n]));
      });
    }
    return text;
  };

  /* <h1 data-i18n="lb.title">...</h1>
   * <input data-i18n="lb.player" data-i18n-attr="placeholder"> */
  api.apply = function (root) {
    (root || document).querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var attr = el.getAttribute("data-i18n-attr");
      if (attr) el.setAttribute(attr, api.t(key));
      else el.textContent = api.t(key);
    });
    document.documentElement.setAttribute("lang", api.lang);
  };

  api.loadLanguage = function () {
    var cached = localStorage.getItem("nauraLang");
    if (cached) api.lang = normalize(cached);

    return fetch("/api/me/language", { credentials: "same-origin" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (data && data.language) {
          api.lang = normalize(data.language);
          localStorage.setItem("nauraLang", api.lang);
        }
      })
      .catch(function () {
        /* Belum masuk atau server sibuk: pakai cache/bawaan saja. */
      })
      .then(function () {
        api.apply();
        return api.lang;
      });
  };

  api.setLanguage = function (lang) {
    api.lang = normalize(lang);
    localStorage.setItem("nauraLang", api.lang);
    api.apply();

    return fetch("/api/me/language", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: api.lang }),
    })
      .catch(function () {
        /* Gagal simpan ke server tidak boleh membatalkan perubahan di layar. */
      })
      .then(function () {
        return api.lang;
      });
  };

  /* State visual: Naura bereaksi, bukan pesan error teknis. */
  api.stateHtml = function (kind, options) {
    var opts = options || {};
    var title = opts.title || api.t("state." + kind + ".title");
    var bodyText = opts.body || api.t("state." + kind + ".body");
    var modifier =
      kind === "error"
        ? " naura-state--error"
        : kind === "loading"
          ? " naura-state--loading"
          : "";

    return (
      '<div class="naura-state' +
      modifier +
      '">' +
      '<img class="naura-state__figure" alt="" src="' +
      api.expressionUrl(kind) +
      '">' +
      '<p class="naura-state__title">' +
      title +
      "</p>" +
      '<p class="naura-state__body">' +
      bodyText +
      "</p>" +
      "</div>"
    );
  };

  api.showState = function (target, kind, options) {
    var el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (el) el.innerHTML = api.stateHtml(kind, options);
  };

  /* Latar adaptif: berkas berbeda untuk ponsel dan layar lebar. */
  api.resolveBgUrl = function (url) {
    if (url && url.indexOf("adaptive-") === 0) {
      var suffix = url.substring("adaptive-".length);
      var size = window.innerWidth < 768 ? "bg_mobile_" : "bg_pc_";
      return "/assets/dashboard/" + size + suffix + ".png";
    }
    return url;
  };

  var sfxPlayer = null;
  api.playClickSfx = function () {
    if (localStorage.getItem("sfxEnabled") === "false") return;
    if (!sfxPlayer) sfxPlayer = new Audio("/assets/dashboard/click.mp3");
    sfxPlayer.currentTime = 0;
    sfxPlayer.play().catch(function () {});
  };

  return api;
})();
