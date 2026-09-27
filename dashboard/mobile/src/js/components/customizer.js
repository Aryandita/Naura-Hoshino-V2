/**
 * customizer.js, Theme customizer bottom sheet.
 *
 * UX: IKEA Effect (DESIGN.md §4), user merasa memiliki dashboard
 * karena mereka yang memilih tampilan. Perubahan diterapkan live.
 *
 * Tampil sebagai bottom sheet dari bawah layar.
 * Tutup via: klik overlay, swipe down, atau tombol close.
 */

import { PRESETS, ACCENT_SWATCHES, loadTheme, saveTheme } from "../core/theme.js";

let _isOpen = false;
let _sheet  = null;
let _overlay= null;

/**
 * Inisialisasi customizer (panggil sekali di halaman profile).
 * Tombol trigger: elemen dengan id="nm-open-customizer"
 */
export function initCustomizer() {
  const trigger = document.getElementById("nm-open-customizer");
  if (trigger) trigger.addEventListener("click", openCustomizer);
}

/** Buka bottom sheet customizer. */
export function openCustomizer() {
  if (_isOpen) return;
  _isOpen = true;
  _buildSheet();
}

/** Tutup bottom sheet customizer. */
export function closeCustomizer() {
  if (!_isOpen) return;
  _isOpen = false;

  if (_sheet) {
    _sheet.style.animation = "sheet-down var(--dur-slow) var(--ease-smooth) both";
    _sheet.addEventListener("animationend", () => _sheet?.remove(), { once: true });
  }

  if (_overlay) {
    _overlay.style.animation = "overlay-in var(--dur-normal) reverse both";
    _overlay.addEventListener("animationend", () => _overlay?.remove(), { once: true });
  }
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _buildSheet() {
  const cfg = loadTheme();

  // Overlay
  _overlay = document.createElement("div");
  _overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 98;
    background: rgba(11,12,16,0.6);
    backdrop-filter: blur(4px);
    animation: overlay-in var(--dur-normal) var(--ease-smooth) both;
  `;
  _overlay.addEventListener("click", closeCustomizer);

  // Sheet
  _sheet = document.createElement("div");
  _sheet.setAttribute("role", "dialog");
  _sheet.setAttribute("aria-modal", "true");
  _sheet.setAttribute("aria-label", "Kustomisasi Dashboard");
  _sheet.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 99;
    background: var(--canvas);
    border-top: 1px solid var(--hairline);
    border-radius: var(--r-xxl) var(--r-xxl) 0 0;
    padding: var(--sp-md) var(--sp-lg) calc(var(--sp-xxl) + var(--nav-safe));
    max-height: 80dvh;
    overflow-y: auto;
    animation: sheet-up var(--dur-slow) var(--ease-spring) both;
  `;

  _sheet.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--sp-lg)">
      <h2 style="font-family:var(--font-display); font-size:0.8125rem; font-weight:700; letter-spacing:1px; color:var(--primary); text-transform:uppercase">
        Kustomisasi
      </h2>
      <button id="nm-close-customizer" aria-label="Tutup"
        style="width:32px;height:32px;border-radius:var(--r-full);background:var(--surface-glass);border:1px solid var(--hairline);color:var(--body);cursor:pointer;display:flex;align-items:center;justify-content:center">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Preset Tema -->
    <p class="nm-section-title" style="margin-bottom:var(--sp-xs)">Tema</p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--sp-xs);margin-bottom:var(--sp-lg)">
      ${PRESETS.map((p) => `
        <button class="nm-preset-btn ${cfg.preset === p.id ? "is-active" : ""}"
          data-preset="${p.id}"
          style="
            padding: var(--sp-sm) var(--sp-md);
            background: var(--surface-glass);
            border: 2px solid ${cfg.preset === p.id ? p.primary : "var(--hairline)"};
            border-radius: var(--r-xl);
            display: flex; align-items: center; gap: var(--sp-xs);
            cursor: pointer; color: var(--body-strong);
            font-family: var(--font-body); font-size: 0.875rem; font-weight:600;
            transition: border-color var(--dur-fast);
          "
        >
          <span style="width:14px;height:14px;border-radius:50%;background:${p.primary};flex-shrink:0"></span>
          ${p.label}
        </button>
      `).join("")}
    </div>

    <!-- Aksen Warna -->
    <p class="nm-section-title" style="margin-bottom:var(--sp-xs)">Aksen Warna</p>
    <div style="display:flex;flex-wrap:wrap;gap:var(--sp-xs);margin-bottom:var(--sp-lg)">
      ${ACCENT_SWATCHES.map((hex) => `
        <button class="nm-swatch-btn"
          data-accent="${hex}"
          aria-label="Aksen ${hex}"
          style="
            width:32px;height:32px;border-radius:50%;
            background:${hex};border:none;cursor:pointer;
            outline: ${cfg.accent === hex ? `3px solid ${hex}` : "none"};
            outline-offset: 3px;
            transition: outline var(--dur-fast), transform var(--dur-fast);
          "
        ></button>
      `).join("")}
      <button class="nm-swatch-btn" data-accent="reset"
        style="width:32px;height:32px;border-radius:50%;background:var(--surface-glass);border:1px solid var(--hairline);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.75rem">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Animasi -->
    <div class="nm-module-row">
      <div class="nm-module-row__info">
        <p class="nm-module-row__name">Animasi</p>
        <p class="nm-module-row__desc">Matikan jika kurang nyaman</p>
      </div>
      <label class="nm-toggle">
        <input type="checkbox" id="nm-toggle-anim" ${cfg.animation ? "checked" : ""}>
        <div class="nm-toggle__track"><div class="nm-toggle__thumb"></div></div>
      </label>
    </div>

    <!-- Ukuran Teks -->
    <div class="nm-module-row">
      <div class="nm-module-row__info">
        <p class="nm-module-row__name">Ukuran Teks</p>
      </div>
      <div style="display:flex;gap:var(--sp-xs)">
        ${["compact","normal","large"].map((s, i) => `
          <button class="nm-quick-chip nm-font-size-btn ${cfg.fontSize === s ? "is-active" : ""}"
            data-size="${s}"
            style="${cfg.fontSize === s ? "background:rgba(255,182,193,0.12);border-color:var(--primary);color:var(--primary);" : ""}">
            ${["S","M","L"][i]}
          </button>
        `).join("")}
      </div>
    </div>
  `;

  document.body.appendChild(_overlay);
  document.body.appendChild(_sheet);

  // Event listeners
  _sheet.querySelector("#nm-close-customizer").addEventListener("click", closeCustomizer);

  _sheet.querySelectorAll(".nm-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      saveTheme({ preset, accent: null });
      _sheet.querySelectorAll(".nm-preset-btn").forEach((b) => {
        const p = PRESETS.find((x) => x.id === b.dataset.preset);
        b.style.borderColor = b.dataset.preset === preset ? p.primary : "var(--hairline)";
        b.classList.toggle("is-active", b.dataset.preset === preset);
      });
    });
  });

  _sheet.querySelectorAll(".nm-swatch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const accent = btn.dataset.accent;
      if (accent === "reset") {
        saveTheme({ accent: null });
      } else {
        saveTheme({ accent });
      }
      // Update outline
      _sheet.querySelectorAll(".nm-swatch-btn").forEach((b) => {
        const isActive = b.dataset.accent === accent && accent !== "reset";
        b.style.outline = isActive ? `3px solid ${b.dataset.accent}` : "none";
      });
    });
  });

  const animToggle = _sheet.querySelector("#nm-toggle-anim");
  animToggle?.addEventListener("change", () => {
    saveTheme({ animation: animToggle.checked });
  });

  _sheet.querySelectorAll(".nm-font-size-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const size = btn.dataset.size;
      saveTheme({ fontSize: size });
      _sheet.querySelectorAll(".nm-font-size-btn").forEach((b) => {
        const isActive = b.dataset.size === size;
        b.style.background  = isActive ? "rgba(255,182,193,0.12)" : "";
        b.style.borderColor = isActive ? "var(--primary)" : "";
        b.style.color       = isActive ? "var(--primary)" : "";
      });
    });
  });
}
