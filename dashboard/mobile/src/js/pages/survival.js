/**
 * survival.js, Logic halaman Survival RPG Hub.
 *
 * Job: "Pantau kondisi karakter, ambil aksi survival paling sering dipakai."
 * Palet: Naura Wilds (emerald/moss/amber/danger), tidak menimpa pink global.
 */

import { initBottomNav }    from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch }         from "../core/api.js";
import { initSocket, on }   from "../core/socket.js";
import { getUser }            from "../core/auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  initReveal();
  initSocket();

  const user = await getUser();
  if (!user) {
    _renderNotLoggedIn();
    return;
  }

  await _loadProfile();
  _subscribeSocket();
});

async function _loadProfile() {
  const { data, error } = await apiFetch("/api/survival/profile");

  if (error || !data) {
    _renderEmpty("Gagal memuat data survival", "Pastikan kamu sudah memulai petualangan di Discord.", "fa-circle-exclamation");
    return;
  }

  _renderVitals(data);
  _renderStats(data);
  _renderInventoryPreview(data.inventory ?? []);
  _renderQuest(data.activeQuest);
}

// ── Render ───────────────────────────────────────────────────────────────────

function _renderVitals(d) {
  _setVital("vital-hp",     d.health  ?? 0, 100);
  _setVital("vital-hunger", d.hunger  ?? 0, 100);
  _setVital("vital-energy", d.stamina ?? 0, 100);

  // Pesan cuaca jika ada
  const weatherEl = document.getElementById("survival-weather");
  if (weatherEl && d.weather) {
    const icons = { sakura_breeze: "🌸", cosmic_storm: "⚡", sunny: "☀", cloudy: "☁" };
    const labels = { sakura_breeze: "Sakura Breeze", cosmic_storm: "Cosmic Storm", sunny: "Cerah", cloudy: "Berawan" };
    weatherEl.textContent = `${icons[d.weather] || "🌿"} ${labels[d.weather] || d.weather}`;
  }
}

function _renderStats(d) {
  const el = (id, val) => {
    const node = document.getElementById(id);
    if (node) node.textContent = _fmt(val);
  };
  el("stat-nsf",    d.starFragments ?? 0);
  el("stat-nc",     d.wallet        ?? 0);
  el("stat-coupon", d.coupons       ?? 0);
}

function _renderInventoryPreview(items) {
  const el = document.getElementById("inventory-preview");
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<p style="font-size:0.75rem;color:var(--muted)">Inventori kosong</p>`;
    return;
  }

  el.innerHTML = items.slice(0, 6).map((item) => `
    <div class="nm-inv-item">
      <span class="nm-inv-item__icon">${item.emoji || "📦"}</span>
      <span class="nm-inv-item__name">${item.name || "Item"}</span>
    </div>
  `).join("");
}

function _renderQuest(quest) {
  const el = document.getElementById("active-quest");
  if (!el) return;

  if (!quest) {
    el.innerHTML = `
      <p style="font-size:0.8125rem;color:var(--muted)">
        Belum ada quest aktif. Mulai petualangan di Discord!
      </p>`;
    return;
  }

  const steps = quest.steps ?? [];
  const pct   = Math.round((quest.progress / quest.goal) * 100);

  el.innerHTML = `
    <p style="font-size:0.875rem;font-weight:600;color:var(--body-strong);margin-bottom:var(--sp-xs)">${quest.name}</p>
    <div class="nm-timeline" style="margin-bottom:var(--sp-sm)">
      ${steps.map((s, i) => {
        const state = i < quest.currentStep ? "done" : i === quest.currentStep ? "active" : "locked";
        return `
          ${i > 0 ? `<div class="nm-timeline__line${state !== "locked" ? " nm-timeline__line--done" : ""}"></div>` : ""}
          <div class="nm-timeline__step nm-timeline__step--${state}">
            <div class="nm-timeline__node">${i + 1}</div>
            <span class="nm-timeline__label">${s.label || `Langkah ${i+1}`}</span>
          </div>
        `;
      }).join("")}
    </div>
    <div class="nm-vital__track">
      <div class="nm-vital__fill" style="--fill-target:${pct}%;width:${pct}%;background:var(--wilds-emerald)"></div>
    </div>
    <p style="font-size:0.625rem;color:var(--muted);margin-top:4px;text-align:right">${pct}% selesai</p>
  `;
}

function _renderNotLoggedIn() {
  const page = document.querySelector(".nm-page");
  if (!page) return;
  page.innerHTML = `
    <div class="nm-empty">
      <img src="/assets/Naura_Expression/Akward.png" alt="Naura bingung"
           class="nm-expression__img" style="width:100px;height:100px">
      <h2 class="nm-empty__title">Petualangan menunggumu~</h2>
      <p class="nm-empty__desc">Login dulu untuk memantau kondisi karaktermu di Naura Wilds!</p>
      <button class="nm-btn nm-btn--discord" onclick="window.location.href='/auth/discord'">
        <i class="fa-brands fa-discord"></i> Login dengan Discord
      </button>
    </div>
    <nav id="nm-bottom-nav"></nav>
  `;
  initBottomNav();
}

function _renderEmpty(title, desc, icon = "fa-leaf") {
  const el = document.getElementById("survival-content");
  if (!el) return;
  el.innerHTML = `
    <div class="nm-empty">
      <i class="fa-solid ${icon}" style="font-size:2rem;color:var(--wilds-amber);margin-bottom:var(--sp-sm)"></i>
      <h2 class="nm-empty__title">${title}</h2>
      <p class="nm-empty__desc">${desc}</p>
    </div>`;
}

// ── Socket ───────────────────────────────────────────────────────────────────

function _subscribeSocket() {
  on("survival_update", (d) => {
    if (d.health  !== undefined) _setVital("vital-hp",     d.health,  100);
    if (d.hunger  !== undefined) _setVital("vital-hunger", d.hunger,  100);
    if (d.stamina !== undefined) _setVital("vital-energy", d.stamina, 100);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _setVital(id, value, max) {
  const pct  = Math.min(100, Math.round((value / max) * 100));
  const fill = document.getElementById(id);
  const pctEl= document.getElementById(`${id}-pct`);
  if (fill) {
    fill.style.setProperty("--fill-target", `${pct}%`);
    fill.style.width = `${pct}%`;
    fill.dataset.level = pct < 20 ? "danger" : pct < 50 ? "warn" : "ok";
  }
  if (pctEl) pctEl.textContent = `${pct}%`;
}

function _fmt(n) {
  if (typeof n !== "number") return String(n);
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
