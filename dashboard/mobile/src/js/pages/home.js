/**
 * home.js, Logic halaman Beranda Naura OS Mobile.
 *
 * Job halaman: "Lihat kondisi bot & server sekarang, ambil satu aksi cepat."
 * Data real dari /api/health (polling 30s) + Socket.IO stats_update (3s).
 */

import { initBottomNav }     from "../components/bottomNav.js";
import { applyTheme, loadTheme, loadWidgetOrder } from "../core/theme.js";
import { apiFetch, startPolling } from "../core/api.js";
import { initSocket, on }    from "../core/socket.js";
import { getUser } from "../core/auth.js";
import { initReveal } from "../core/reveal.js";

// ── Init ─────────────────────────────────────────────────────────────────────

const _ac = new AbortController();

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  initSocket();
  initReveal();

  _setupHeader();
  await _fetchHealth();
  startPolling(_fetchHealth, 30_000, _ac.signal);
  await _initWidgets();
  _subscribeSocket();
});

window.addEventListener("pagehide", () => _ac.abort());

// ── Header ───────────────────────────────────────────────────────────────────

async function _setupHeader() {
  const user = await getUser();

  const headerName = document.getElementById("nm-header-name");
  const greetTitle = document.getElementById("nm-greeting-title");
  const greetExpr  = document.getElementById("nm-greeting-expr");

  if (user) {
    const hour = new Date().getHours();
    const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Halo" : hour < 19 ? "Selamat sore" : "Selamat malam";

    if (headerName) headerName.textContent = "Naura Hoshino";
    if (greetTitle) greetTitle.textContent = `${greet}, Kak ${user.displayName}~`;

    // Ekspresi ceria saat pagi/siang, santai saat malam
    if (greetExpr) {
      greetExpr.src = hour < 17
        ? "/assets/Naura_Expression/Cheers.png"
        : "/assets/Naura_Expression/Happy.png";
      greetExpr.alt = "Naura menyapa";
    }
  } else {
    // Tidak login, tampilkan empty state dengan CTA login
    _renderNotLoggedIn();
  }
}

function _renderNotLoggedIn() {
  const grid = document.getElementById("nm-widget-grid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="nm-empty">
      <img src="/assets/Naura_Expression/Akward.png"
           alt="Naura bingung" class="nm-expression__img" style="width:100px;height:100px">
      <h2 class="nm-empty__title">Belum masuk, nih~</h2>
      <p class="nm-empty__desc">Login dulu biar Naura bisa kenalan dan tampilkan datamu.</p>
      <button class="nm-btn nm-btn--discord" onclick="window.location.href='/auth/discord'">
        <i class="fa-brands fa-discord" aria-hidden="true"></i>
        Login dengan Discord
      </button>
    </div>
  `;
}

// ── Widgets ──────────────────────────────────────────────────────────────────

async function _initWidgets() {
  const user = await getUser();
  if (!user) return;

  const order = loadWidgetOrder();
  const grid  = document.getElementById("nm-widget-grid");
  if (!grid) return;

  // Render widget dengan stagger animation
  order.forEach((id, idx) => {
    const widget = _createWidget(id);
    if (!widget) return;
    widget.style.animationDelay = `${idx * 60}ms`;
    widget.classList.add("animate-card-mount");
    grid.appendChild(widget);
  });

  // Ambil vitals jika user sudah login
  _fetchVitals();
}

function _createWidget(id) {
  const el = document.createElement("div");
  el.id = `widget-${id}`;
  el.className = "nm-card";

  switch (id) {
    case "bot-status":
      el.innerHTML = _tmplBotStatus();
      break;
    case "now-playing":
      el.style.display = "none"; // Tampil hanya jika ada lagu
      el.innerHTML = _tmplNowPlaying();
      break;
    case "survival-vitals":
      el.style.display = "none"; // Tampil hanya jika login + ada data
      el.innerHTML = _tmplVitals();
      break;
    case "services":
      el.innerHTML = _tmplServices();
      break;
    default:
      return null;
  }
  return el;
}

// ── API Fetchers ──────────────────────────────────────────────────────────────

async function _fetchHealth() {
  const { data, error } = await apiFetch("/api/health");
  if (error || !data) return;

  // Telemetry strip
  _updateChip("chip-ping",    data.bot?.ping >= 0 ? `${data.bot.ping}ms` : "---",     data.bot?.ping > 200 ? "warn" : "ok");
  _updateChip("chip-memory",  data.bot?.memoryUsageMB ? `${Math.round(data.bot.memoryUsageMB)}MB` : "---");
  _updateChip("chip-guilds",  data.bot?.guilds ?? "---");
  _updateChip("chip-uptime",  data.bot?.uptimeSeconds ? _fmtUptime(data.bot.uptimeSeconds) : "---");

  // Bot status card
  const dotEl = document.getElementById("widget-bot-status-dot");
  if (dotEl) {
    dotEl.className = `nm-dot nm-dot--${data.status === "ok" ? "online" : "offline"}`;
  }
  const statusText = document.getElementById("widget-bot-status-text");
  if (statusText) {
    statusText.textContent = data.status === "ok" ? "Online" : "Offline";
  }

  // Services
  _updateService("svc-db",       data.services?.database?.connected ?? false);
  _updateService("svc-redis",    data.services?.redis?.connected ?? false);
  _updateService("svc-mongo",    data.services?.mongodb?.state === "connected");
  _updateService("svc-lavalink", data.services?.lavalink?.connected > 0);
}

async function _fetchVitals() {
  const { data } = await apiFetch("/api/survival/profile");
  if (!data) return;

  const widget = document.getElementById("widget-survival-vitals");
  if (!widget) return;

  widget.style.display = "";
  _updateVitalBar("vital-hp",     data.health   ?? 0, 100);
  _updateVitalBar("vital-hunger", data.hunger   ?? 0, 100);
  _updateVitalBar("vital-energy", data.stamina  ?? 0, 100);
}

// ── Socket Subscriptions ──────────────────────────────────────────────────────

function _subscribeSocket() {
  on("stats_update", (d) => {
    if (d.ping !== undefined) _updateChip("chip-ping", `${d.ping}ms`);
  });

  on("music_state", (d) => {
    const widget = document.getElementById("widget-now-playing");
    if (!widget) return;

    if (d.track) {
      widget.style.display = "";
      const title  = widget.querySelector("#np-title");
      const artist = widget.querySelector("#np-artist");
      const cover  = widget.querySelector("#np-cover");
      if (title)  title.textContent  = d.track.title  || "Unknown";
      if (artist) artist.textContent = d.track.author || "Unknown";
      if (cover && d.track.thumbnail) cover.src = d.track.thumbnail;
    } else {
      widget.style.display = "none";
    }
  });

  on("survival_update", (d) => {
    if (d.health !== undefined)  _updateVitalBar("vital-hp",     d.health,  100);
    if (d.hunger !== undefined)  _updateVitalBar("vital-hunger", d.hunger,  100);
    if (d.stamina !== undefined) _updateVitalBar("vital-energy", d.stamina, 100);
  });
}

// ── HTML Templates ───────────────────────────────────────────────────────────

function _tmplBotStatus() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-sm)">
      <p class="nm-section-title" style="margin:0">Status Bot</p>
      <div style="display:flex;align-items:center;gap:6px">
        <div id="widget-bot-status-dot" class="nm-dot"></div>
        <span id="widget-bot-status-text" style="font-size:0.75rem;color:var(--body)">Memuat...</span>
      </div>
    </div>
    <div class="nm-service-grid" id="widget-services-grid">
      ${_tmplServices()}
    </div>
  `;
}

function _tmplServices() {
  const svcs = [
    { id: "svc-db",       label: "Database" },
    { id: "svc-redis",    label: "Redis" },
    { id: "svc-mongo",    label: "MongoDB" },
    { id: "svc-lavalink", label: "Lavalink" },
  ];
  return `
    <p class="nm-section-title" style="margin-bottom:var(--sp-xs)">Layanan</p>
    <div class="nm-service-grid">
      ${svcs.map((s) => `
        <div class="nm-service-item" id="${s.id}">
          <div class="nm-dot"></div>
          <span>${s.label}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function _tmplNowPlaying() {
  return `
    <p class="nm-section-title" style="margin-bottom:var(--sp-sm)">Sedang Diputar</p>
    <div style="display:flex;align-items:center;gap:var(--sp-md)">
      <img id="np-cover" class="nm-player-cover" style="width:56px;height:56px"
           src="/assets/core/avatar.png" alt="Album art">
      <div style="flex:1;overflow:hidden">
        <p id="np-title"  style="font-size:0.875rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">-</p>
        <p id="np-artist" style="font-size:0.75rem;color:var(--body);margin-top:2px">-</p>
      </div>
      <a href="/mobile/music" class="nm-btn nm-btn--ghost" style="padding:8px 12px;min-height:40px;font-size:0.75rem">
        <i class="fa-solid fa-music" aria-hidden="true"></i>
      </a>
    </div>
  `;
}

function _tmplVitals() {
  return `
    <p class="nm-section-title" style="margin-bottom:var(--sp-sm)">Kondisi Karakter</p>
    <div class="nm-vital">
      <div class="nm-vital__row">
        <span class="nm-vital__icon">❤</span>
        <div class="nm-vital__track"><div id="vital-hp" class="nm-vital__fill" style="--fill-target:0%;width:0%"></div></div>
        <span class="nm-vital__pct" id="vital-hp-pct">0%</span>
      </div>
      <div class="nm-vital__row">
        <span class="nm-vital__icon">🍖</span>
        <div class="nm-vital__track"><div id="vital-hunger" class="nm-vital__fill" style="--fill-target:0%;width:0%"></div></div>
        <span class="nm-vital__pct" id="vital-hunger-pct">0%</span>
      </div>
      <div class="nm-vital__row">
        <span class="nm-vital__icon">⚡</span>
        <div class="nm-vital__track"><div id="vital-energy" class="nm-vital__fill" style="--fill-target:0%;width:0%"></div></div>
        <span class="nm-vital__pct" id="vital-energy-pct">0%</span>
      </div>
    </div>
  `;
}

// ── DOM Helpers ──────────────────────────────────────────────────────────────

function _updateChip(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function _updateService(id, isOk) {
  const el = document.getElementById(id);
  if (!el) return;
  const dot = el.querySelector(".nm-dot");
  if (dot) dot.className = `nm-dot nm-dot--${isOk ? "online" : "offline"}`;
  el.className = `nm-service-item nm-service-item--${isOk ? "ok" : "err"}`;
}

function _updateVitalBar(id, value, max) {
  const pct  = Math.round((value / max) * 100);
  const fill = document.getElementById(id);
  const pctEl= document.getElementById(`${id}-pct`);

  if (fill) {
    fill.style.setProperty("--fill-target", `${pct}%`);
    fill.style.width = `${pct}%`;
    fill.dataset.level = pct < 20 ? "danger" : pct < 50 ? "warn" : "ok";
  }
  if (pctEl) pctEl.textContent = `${pct}%`;
}

function _fmtUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}
