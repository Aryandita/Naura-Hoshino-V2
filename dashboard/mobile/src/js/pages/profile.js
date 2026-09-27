/**
 * profile.js, Logic halaman Profil & Kustomisasi.
 *
 * Job: "Lihat kartu petualang, sesuaikan tampilan dashboard mobile."
 */

import { initBottomNav }    from "../components/bottomNav.js";
import { applyTheme, loadTheme, loadWidgetOrder, saveWidgetOrder, PRESETS, ACCENT_SWATCHES, saveTheme } from "../core/theme.js";
import { apiFetch }         from "../core/api.js";
import { getUser, logout, redirectToLogin } from "../core/auth.js";
import { toastSuccess }     from "../components/toaster.js";

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  initReveal();

  const user = await getUser();
  if (!user) { redirectToLogin(); return; }

  _renderProfile(user);
  _renderCustomizer();
  _renderWidgetOrder();
  _setupActions(user);
});

// ── Profile Hero ──────────────────────────────────────────────────────────────

function _renderProfile(user) {
  const avatar = document.getElementById("profile-avatar");
  const name   = document.getElementById("profile-name");
  const level  = document.getElementById("profile-level");

  if (avatar) {
    avatar.src = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(user.id) % 6}.png`;
    avatar.alt = user.displayName;
  }
  if (name)  name.textContent  = user.displayName || user.username;
  if (level) level.textContent = "Memuat level...";

  // Ambil level dari survival
  apiFetch("/api/survival/profile").then(({ data }) => {
    if (data && level) {
      level.textContent = `Level ${data.level ?? "?"} Petualang`;
    }
  });
}

// ── Customizer Section ────────────────────────────────────────────────────────

function _renderCustomizer() {
  const cfg = loadTheme();

  // Preset buttons
  const presetContainer = document.getElementById("profile-presets");
  if (presetContainer) {
    presetContainer.innerHTML = PRESETS.map((p) => `
      <button class="nm-preset-mini ${cfg.preset === p.id ? "is-active" : ""}"
        data-preset="${p.id}"
        aria-pressed="${cfg.preset === p.id}"
        style="
          padding: 8px 14px;
          background: var(--surface-glass);
          border: 2px solid ${cfg.preset === p.id ? p.primary : "var(--hairline)"};
          border-radius: var(--r-full);
          display: flex; align-items: center; gap: 6px;
          cursor: pointer; color: var(--body-strong);
          font-family: var(--font-body); font-size: 0.75rem; font-weight:600;
          transition: border-color var(--dur-fast);
          min-height: 36px;
        "
      >
        <span style="width:12px;height:12px;border-radius:50%;background:${p.primary};flex-shrink:0"></span>
        ${p.label}
      </button>
    `).join("");

    presetContainer.querySelectorAll(".nm-preset-mini").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        const p = PRESETS.find((x) => x.id === preset);
        saveTheme({ preset, accent: null });
        presetContainer.querySelectorAll(".nm-preset-mini").forEach((b) => {
          const bp = PRESETS.find((x) => x.id === b.dataset.preset);
          b.style.borderColor = b.dataset.preset === preset ? bp.primary : "var(--hairline)";
          b.setAttribute("aria-pressed", b.dataset.preset === preset);
        });
        toastSuccess(`Tema ${p.label} diaktifkan`);
      });
    });
  }

  // Accent swatches
  const swatchContainer = document.getElementById("profile-swatches");
  if (swatchContainer) {
    swatchContainer.innerHTML = ACCENT_SWATCHES.map((hex) => `
      <button class="nm-swatch" data-hex="${hex}" aria-label="Aksen ${hex}"
        style="
          width:28px;height:28px;border-radius:50%;background:${hex};border:none;cursor:pointer;
          outline: ${cfg.accent === hex ? `3px solid ${hex}` : "none"};
          outline-offset:2px; transition:transform var(--dur-fast);
          min-width:28px;
        "
      ></button>
    `).join(`
      <button class="nm-swatch" data-hex="reset"
        aria-label="Reset aksen"
        style="width:28px;height:28px;border-radius:50%;background:var(--surface-glass);border:1px solid var(--hairline);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.6875rem;min-width:28px">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
    `);

    swatchContainer.querySelectorAll(".nm-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hex = btn.dataset.hex;
        saveTheme({ accent: hex === "reset" ? null : hex });
        swatchContainer.querySelectorAll(".nm-swatch").forEach((b) => {
          b.style.outline = b.dataset.hex === hex && hex !== "reset"
            ? `3px solid ${b.dataset.hex}` : "none";
        });
        if (hex !== "reset") toastSuccess("Warna aksen diubah");
      });
    });
  }

  // Animation toggle
  const animToggle = document.getElementById("profile-anim-toggle");
  if (animToggle) {
    animToggle.checked = cfg.animation !== false;
    animToggle.addEventListener("change", () => {
      saveTheme({ animation: animToggle.checked });
    });
  }

  // Font size
  document.querySelectorAll(".profile-font-btn").forEach((btn) => {
    btn.classList.toggle("nm-filter-chip--active", btn.dataset.size === cfg.fontSize);
    btn.addEventListener("click", () => {
      saveTheme({ fontSize: btn.dataset.size });
      document.querySelectorAll(".profile-font-btn").forEach((b) => {
        b.classList.toggle("nm-filter-chip--active", b.dataset.size === btn.dataset.size);
      });
    });
  });
}

// ── Widget Order ──────────────────────────────────────────────────────────────

function _renderWidgetOrder() {
  const el = document.getElementById("profile-widget-order");
  if (!el) return;

  const order = loadWidgetOrder();
  const LABELS = {
    "bot-status":       "Status Bot",
    "now-playing":      "Sedang Diputar",
    "survival-vitals":  "Kondisi Karakter",
    "services":         "Status Layanan",
  };

  el.innerHTML = order.map((id) => `
    <div class="nm-module-row nm-draggable" data-id="${id}" draggable="true"
      style="cursor:grab;user-select:none">
      <i class="fa-solid fa-grip-vertical" style="color:var(--muted);margin-right:var(--sp-xs);cursor:grab" aria-hidden="true"></i>
      <div class="nm-module-row__info">
        <p class="nm-module-row__name">${LABELS[id] || id}</p>
      </div>
    </div>
  `).join("");

  _initDragOrder(el);
}

function _initDragOrder(container) {
  let _dragged = null;

  container.addEventListener("dragstart", (e) => {
    _dragged = e.target.closest(".nm-draggable");
    if (_dragged) _dragged.style.opacity = "0.5";
  });

  container.addEventListener("dragend", () => {
    if (_dragged) _dragged.style.opacity = "1";
    _dragged = null;
    // Simpan urutan baru
    const order = [...container.querySelectorAll(".nm-draggable")].map((el) => el.dataset.id);
    saveWidgetOrder(order);
    toastSuccess("Urutan widget disimpan");
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    const target = e.target.closest(".nm-draggable");
    if (target && target !== _dragged) {
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      container.insertBefore(_dragged, after ? target.nextSibling : target);
    }
  });
}

// ── Actions ───────────────────────────────────────────────────────────────────

function _setupActions(user) {
  document.getElementById("profile-logout")?.addEventListener("click", () => {
    if (confirm("Yakin mau logout?")) logout();
  });
}
