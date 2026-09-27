/**
 * config.js, Logic halaman Config Bot.
 *
 * Job: "Konfigurasi plugin dan pengaturan bot untuk server ini."
 * Auth guard: hanya user yang punya Manage Server permission.
 */

import { initBottomNav }    from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch, apiPost } from "../core/api.js";
import { getUser, redirectToLogin } from "../core/auth.js";
import { toastError, toastSuccess, toastWarn } from "../components/toaster.js";

/** Guild yang sedang dipilih */
let _selectedGuild = null;
/** State modul server */
let _modules = {};

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  initReveal();

  const user = await getUser();
  if (!user) { redirectToLogin(); return; }

  await _loadGuilds(user);
});

// ── Guild Selector ────────────────────────────────────────────────────────────

async function _loadGuilds(user) {
  const { data, error } = await apiFetch("/api/guilds/managed");

  if (error || !data?.length) {
    _renderNoGuilds();
    return;
  }

  const select = document.getElementById("cfg-guild-select");
  if (!select) return;

  data.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    _selectedGuild = select.value;
    _loadGuildConfig(_selectedGuild);
  });

  // Load guild pertama secara default
  _selectedGuild = data[0].id;
  select.value   = _selectedGuild;
  _loadGuildConfig(_selectedGuild);
}

// ── Config Load ───────────────────────────────────────────────────────────────

async function _loadGuildConfig(guildId) {
  const moduleList = document.getElementById("cfg-modules");
  if (!moduleList) return;

  // Skeleton
  moduleList.innerHTML = Array.from({ length: 6 }, () => `
    <div class="nm-module-row">
      <div class="nm-skeleton" style="width:60%;height:16px;margin-bottom:4px"></div>
      <div class="nm-skeleton" style="width:44px;height:24px;border-radius:12px"></div>
    </div>
  `).join("");

  const { data, error } = await apiFetch(`/api/guild/${guildId}/settings`);

  if (error || !data) {
    moduleList.innerHTML = `
      <p style="font-size:0.8125rem;color:var(--muted)">
        Gagal memuat konfigurasi server.
      </p>`;
    return;
  }

  _modules = data.modules ?? {};
  _renderModules(data);
}

// ── Modules Render ────────────────────────────────────────────────────────────

const MODULE_DEFS = [
  { key: "economy",      label: "Economy System",    desc: "Dompet, bank, dan pasar NC" },
  { key: "survival",     label: "Survival RPG",      desc: "Naura Wilds, vitals dan petualangan" },
  { key: "music",        label: "Music (Lavalink)",  desc: "Putar musik dari YouTube, Spotify, dll." },
  { key: "automod",      label: "Auto Moderation",   desc: "Filter pesan otomatis dan anti-spam" },
  { key: "welcome",      label: "Welcome Message",   desc: "Pesan sambutan anggota baru" },
  { key: "leveling",     label: "Leveling System",   desc: "XP dan naik level dari aktivitas chat" },
  { key: "ticket",       label: "Ticket System",     desc: "Sistem tiket dukungan untuk member" },
  { key: "ai_chat",      label: "AI Chat Companion", desc: "Naura AI akan merespons mention" },
];

function _renderModules(data) {
  const el = document.getElementById("cfg-modules");
  if (!el) return;

  el.innerHTML = MODULE_DEFS.map((mod) => {
    const isOn = Boolean(_modules[mod.key]);
    return `
      <div class="nm-module-row">
        <div class="nm-module-row__info">
          <p class="nm-module-row__name">${mod.label}</p>
          <p class="nm-module-row__desc">${mod.desc}</p>
        </div>
        <label class="nm-toggle" title="Toggle ${mod.label}">
          <input type="checkbox" class="cfg-module-toggle" data-key="${mod.key}" ${isOn ? "checked" : ""}>
          <div class="nm-toggle__track"><div class="nm-toggle__thumb"></div></div>
        </label>
      </div>
    `;
  }).join("");

  // Event listeners untuk setiap toggle
  el.querySelectorAll(".cfg-module-toggle").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      _modules[toggle.dataset.key] = toggle.checked;
    });
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("cfg-save");
  saveBtn?.addEventListener("click", _saveConfig);
});

async function _saveConfig() {
  if (!_selectedGuild) { toastWarn("Pilih server dulu"); return; }

  const btn = document.getElementById("cfg-save");
  if (btn) { btn.disabled = true; btn.textContent = "Menyimpan..."; }

  const { error } = await apiPost(`/api/guild/${_selectedGuild}/settings`, {
    modules: _modules,
  });

  if (btn) { btn.disabled = false; btn.textContent = "Simpan Perubahan"; }

  if (error) { toastError(`Gagal menyimpan: ${error}`); return; }
  toastSuccess("Konfigurasi berhasil disimpan!");
}

// ── Empty States ──────────────────────────────────────────────────────────────

function _renderNoGuilds() {
  const page = document.querySelector(".nm-page");
  if (!page) return;
  page.innerHTML = `
    <div class="nm-empty">
      <i class="fa-solid fa-shield-halved" style="font-size:2rem;color:var(--accent-purple);margin-bottom:var(--sp-sm)"></i>
      <h2 class="nm-empty__title">Tidak ada server yang dikelola</h2>
      <p class="nm-empty__desc">Kamu perlu memiliki izin "Manage Server" di server tempat Naura berada.</p>
      <a href="/mobile/" class="nm-btn nm-btn--ghost">Kembali ke Beranda</a>
    </div>
    <nav id="nm-bottom-nav"></nav>
  `;
  initBottomNav();
}
