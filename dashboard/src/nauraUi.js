/* =====================================================================
 * naura-ui.js - Lapisan bersama untuk seluruh halaman dashboard (V2 ES Module Port).
 *
 * Menangani:
 *   1. Bahasa, diambil dari /api/me/language
 *   2. State interaktif (kosong, galat, memuat, offline, maintenance) dengan Naura Avatar & Action CTA
 *   3. Latar adaptif, tema (Midnight, Sakura, OLED), notifikasi toast, & efek suara
 * ===================================================================== */

const SUPPORTED = ["id", "en"];
const FALLBACK = "id";
const BASE = "/assets/Naura_Expression/";

const EXPRESSION = {
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
  offline: "Cry",
  maintenance: "Hmph",
  search: "Thinking",
};

const DICT = {
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
    "state.offline.title": "Koneksi Terputus",
    "state.offline.body":
      "Koneksi ke gateway Naura terputus. Sistem mencoba menyambung kembali.",
    "state.maintenance.title": "Sedang Pemeliharaan",
    "state.maintenance.body":
      "Modul ini sedang ditingkatkan untuk stabilitas yang lebih optimal.",
    "state.search.title": "Tidak Ada Hasil",
    "state.search.body":
      "Tidak ada data yang cocok dengan pencarianmu saat ini.",
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
    "common.close": "Tutup",
  },
  en: {
    "state.loading.title": "Just a moment...",
    "state.loading.body": "Naura is fetching your data right now.",
    "state.error.title": "Oh no, that failed",
    "state.error.body":
      "Sorry! Naura could not load this part. Try refreshing in a moment.",
    "state.empty.title": "Nothing here yet",
    "state.empty.body":
      "It is empty for now. Get started and Naura will keep track of everything!",
    "state.denied.title": "Not just yet",
    "state.denied.body":
      "You need the Manage Server permission to open this page.",
    "state.offline.title": "Connection Lost",
    "state.offline.body":
      "Connection to Naura gateway lost. Reconnecting automatically.",
    "state.maintenance.title": "Under Maintenance",
    "state.maintenance.body":
      "This module is undergoing maintenance for optimal performance.",
    "state.search.title": "No Results Found",
    "state.search.body":
      "No data matched your search query at the moment.",
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
    "common.close": "Close",
  },
};

class NauraUIClass {
  constructor() {
    this.lang = FALLBACK;
    this.sfxPlayer = null;
    if (typeof window !== "undefined") {
      this.initTheme();
    }
  }

  normalize(lang) {
    const v = String(lang || "")
      .toLowerCase()
      .slice(0, 2);
    return SUPPORTED.indexOf(v) !== -1 ? v : FALLBACK;
  }

  expressionUrl(mood) {
    return (
      BASE + encodeURIComponent(EXPRESSION[mood] || EXPRESSION.empty) + ".png"
    );
  }

  t(key, vars) {
    let text = (DICT[this.lang] || {})[key];
    if (text === undefined) text = (DICT[FALLBACK] || {})[key];
    if (text === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach((n) => {
        text = text.split("{" + n + "}").join(String(vars[n]));
      });
    }
    return text;
  }

  apply(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const attr = el.getAttribute("data-i18n-attr");
      if (attr) el.setAttribute(attr, this.t(key));
      else el.textContent = this.t(key);
    });
    document.documentElement.setAttribute("lang", this.lang);
  }

  async loadLanguage() {
    const cached = localStorage.getItem("nauraLang");
    if (cached) this.lang = this.normalize(cached);

    try {
      const res = await fetch("/api/me/language", {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.language) {
          this.lang = this.normalize(data.language);
          localStorage.setItem("nauraLang", this.lang);
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
    localStorage.setItem("nauraLang", this.lang);
    this.apply();

    try {
      await fetch("/api/me/language", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: this.lang }),
      });
    } catch (err) {
      /* Gagal simpan ke server tidak boleh membatalkan perubahan di layar. */
    }
    return this.lang;
  }

  getTheme() {
    if (typeof window === "undefined") return "default";
    return (
      localStorage.getItem("nauraTheme") ||
      document.documentElement.getAttribute("data-theme") ||
      "default"
    );
  }

  setTheme(themeName) {
    if (typeof window === "undefined") return "default";
    const clean = String(themeName || "default").toLowerCase();
    if (clean === "default" || clean === "midnight") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("nauraTheme", "default");
    } else {
      document.documentElement.setAttribute("data-theme", clean);
      localStorage.setItem("nauraTheme", clean);
    }
    return clean;
  }

  initTheme() {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("nauraTheme");
    if (saved && saved !== "default" && saved !== "midnight") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  stateHtml(kind, options) {
    const opts = options || {};
    const rawTitle = opts.title || this.t("state." + kind + ".title");
    const rawBody = opts.body || this.t("state." + kind + ".body");
    const title = this.escapeHtml(rawTitle);
    const bodyText = this.escapeHtml(rawBody);
    const modifier =
      kind === "error"
        ? " naura-state--error"
        : kind === "loading"
          ? " naura-state--loading"
          : kind === "success"
            ? " naura-state--success"
            : "";

    let actionsHtml = "";
    if (opts.actionsHtml) {
      actionsHtml = `<div class="naura-state__actions">${opts.actionsHtml}</div>`;
    } else if (opts.retry || kind === "error") {
      const retryLabel = this.escapeHtml(opts.retryLabel || this.t("common.retry"));
      const retryHandler =
        typeof opts.retry === "string"
          ? this.escapeHtml(opts.retry)
          : opts.onRetry
            ? `${opts.onRetry}`
            : "window.location.reload()";
      actionsHtml = `
        <div class="naura-state__actions">
          <button type="button" class="naura-state__btn naura-state__btn--primary" onclick="${retryHandler}">
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
            <span>${retryLabel}</span>
          </button>
        </div>`;
    } else if (opts.action) {
      const act = opts.action;
      const btnClass = act.primary
        ? "naura-state__btn--primary"
        : "naura-state__btn--ghost";
      const tag = act.href ? "a" : "button";
      const hrefAttr = act.href ? ` href="${this.escapeHtml(act.href)}"` : ' type="button"';
      const clickAttr = act.onclick ? ` onclick="${act.onclick}"` : "";
      const text = this.escapeHtml(act.text);
      actionsHtml = `
        <div class="naura-state__actions">
          <${tag}${hrefAttr}${clickAttr} class="naura-state__btn ${btnClass}">
            ${act.icon ? `<i class="${this.escapeHtml(act.icon)}" aria-hidden="true"></i> ` : ""}
            <span>${text}</span>
          </${tag}>
        </div>`;
    }

    const figureAlt = `Naura - ${title}`;

    return (
      `<div class="naura-state${modifier}" role="status" aria-live="polite">` +
      `<img class="naura-state__figure" alt="${figureAlt}" src="${this.expressionUrl(kind)}">` +
      `<p class="naura-state__title">${title}</p>` +
      `<p class="naura-state__body">${bodyText}</p>` +
      actionsHtml +
      `</div>`
    );
  }

  showState(target, kind, options) {
    const el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (el) el.innerHTML = this.stateHtml(kind, options);
  }

  toast(type = "info", title = "", message = "", duration = 3500) {
    if (typeof window === "undefined") return;
    if (typeof window.showToast === "function") {
      return window.showToast(message, type, duration, title);
    }
    let container = document.getElementById("nauraToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "nauraToastContainer";
      container.className = "naura-toast-container";
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `naura-toast naura-toast--${type}`;
    const iconMap = {
      info: "fa-solid fa-circle-info",
      success: "fa-solid fa-circle-check",
      warn: "fa-solid fa-triangle-exclamation",
      error: "fa-solid fa-circle-xmark",
    };
    const iconClass = iconMap[type] || "fa-solid fa-bell";
    const safeTitle = this.escapeHtml(title);
    const safeMsg = this.escapeHtml(message);
    toast.innerHTML = `
      <div class="naura-toast-icon"><i class="${iconClass}" aria-hidden="true"></i></div>
      <div class="naura-toast-content">
        ${safeTitle ? `<div class="naura-toast-title">${safeTitle}</div>` : ""}
        <div class="naura-toast-msg">${safeMsg}</div>
      </div>
      <button type="button" class="naura-toast-close" aria-label="${this.t("common.close")}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    `;
    const closeBtn = toast.querySelector(".naura-toast-close");
    if (closeBtn) closeBtn.onclick = () => toast.remove();
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }

  resolveBgUrl(url) {
    if (url && url.indexOf("adaptive-") === 0) {
      const suffix = url.substring("adaptive-".length);
      const size = window.innerWidth < 768 ? "bg_mobile_" : "bg_pc_";
      return "/assets/dashboard/" + size + suffix + ".png";
    }
    return url;
  }

  playClickSfx() {
    if (localStorage.getItem("sfxEnabled") === "false") return;
    if (!this.sfxPlayer)
      this.sfxPlayer = new Audio("/assets/dashboard/click.mp3");
    this.sfxPlayer.currentTime = 0;
    this.sfxPlayer.play().catch(() => {});
  }
}

export const NauraUI = new NauraUIClass();
// Biarkan global untuk script lama yang belum pakai modul
if (typeof window !== "undefined") {
  window.NauraUI = NauraUI;
}
