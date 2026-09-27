/**
 * music.js, Logic halaman Music Control.
 *
 * Job: "Kontrol queue musik bot Discord dari HP tanpa buka Discord."
 * State diambil dari Socket.IO music_state, kontrol via POST /api/music/*.
 */

import { initBottomNav }    from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiPost }          from "../core/api.js";
import { initSocket, on }   from "../core/socket.js";
import { toastError } from "../components/toaster.js";

/** @type {MusicState | null} */
let _state = null;
let _progressInterval = null;
let _progressStart = null;

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(loadTheme());
  initBottomNav();
  initReveal();
  initSocket();
  _setupControls();
  _subscribeSocket();
});

// ── Socket ───────────────────────────────────────────────────────────────────

function _subscribeSocket() {
  on("music_state", (d) => {
    _state = d;
    _renderPlayer(d);
    _renderQueue(d.queue ?? []);
    _updateFilters(d.filter ?? "normal");
  });
}

// ── Player Render ─────────────────────────────────────────────────────────────

function _renderPlayer(d) {
  const cover     = document.getElementById("mp-cover");
  const title     = document.getElementById("mp-title");
  const artist    = document.getElementById("mp-artist");
  const progressFill = document.getElementById("mp-progress");
  const btnPlay   = document.getElementById("mp-play");
  const volSlider = document.getElementById("mp-volume");
  const empty     = document.getElementById("mp-empty");
  const playerSection = document.getElementById("mp-player-section");

  if (!d.track) {
    if (empty) empty.style.display = "";
    if (playerSection) playerSection.style.display = "none";
    clearInterval(_progressInterval);
    return;
  }

  if (empty) empty.style.display = "none";
  if (playerSection) playerSection.style.display = "";

  if (cover)  cover.src   = d.track.thumbnail || "/assets/core/avatar.png";
  if (cover)  cover.alt   = `Cover ${d.track.title}`;
  if (title)  title.textContent  = d.track.title  || "Unknown";
  if (artist) artist.textContent = d.track.author || "Unknown";
  if (btnPlay) {
    const icon = btnPlay.querySelector("i");
    if (icon) icon.className = `fa-solid ${d.paused ? "fa-play" : "fa-pause"}`;
  }
  if (volSlider && d.volume !== undefined) volSlider.value = d.volume;

  // Progress bar
  clearInterval(_progressInterval);
  if (d.position !== undefined && d.track.duration) {
    _progressStart = { ts: Date.now(), position: d.position, duration: d.track.duration };
    if (!d.paused) {
      _progressInterval = setInterval(() => {
        const elapsed = Date.now() - _progressStart.ts;
        const pos = Math.min(_progressStart.position + elapsed, _progressStart.duration);
        const pct = (pos / _progressStart.duration) * 100;
        if (progressFill) progressFill.style.width = `${pct}%`;
      }, 500);
    }
    const pct = (d.position / d.track.duration) * 100;
    if (progressFill) progressFill.style.width = `${pct}%`;
  }
}

// ── Queue Render ──────────────────────────────────────────────────────────────

function _renderQueue(queue) {
  const el = document.getElementById("mp-queue");
  if (!el) return;

  if (!queue.length) {
    el.innerHTML = `<p style="font-size:0.8125rem;color:var(--muted);padding:var(--sp-sm) 0">Antrian kosong</p>`;
    return;
  }

  el.innerHTML = queue.slice(0, 20).map((t, i) => `
    <div class="nm-queue-item ${i === 0 ? "nm-queue-item--playing" : ""}">
      <span class="nm-queue-item__num">${i === 0 ? "▶" : i + 1}</span>
      <div class="nm-queue-item__info">
        <p class="nm-queue-item__title">${_esc(t.title || "Unknown")}</p>
        <p class="nm-queue-item__dur">${t.author || ""} · ${_fmtDuration(t.duration)}</p>
      </div>
    </div>
  `).join("");
}

// ── Controls ──────────────────────────────────────────────────────────────────

function _setupControls() {
  _on("mp-prev",    () => _ctrl("previous"));
  _on("mp-play",    () => _ctrl(_state?.paused ? "resume" : "pause"));
  _on("mp-next",    () => _ctrl("skip"));
  _on("mp-shuffle", () => _ctrl("shuffle"));
  _on("mp-loop",    () => _ctrl("loop"));

  const vol = document.getElementById("mp-volume");
  let _volTimer = null;
  vol?.addEventListener("input", () => {
    clearTimeout(_volTimer);
    _volTimer = setTimeout(() => {
      apiPost("/api/music/volume", { volume: Number(vol.value) });
    }, 300);
  });

  // Audio filter chips
  document.querySelectorAll(".nm-filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.dataset.filter;
      apiPost("/api/music/filter", { filter }).then(({ error }) => {
        if (error) { toastError("Gagal ganti filter"); return; }
        document.querySelectorAll(".nm-filter-chip").forEach((c) => {
          c.classList.toggle("nm-filter-chip--active", c.dataset.filter === filter);
          c.setAttribute("aria-pressed", c.dataset.filter === filter ? "true" : "false");
        });
      });
    });
  });
}

function _updateFilters(active) {
  document.querySelectorAll(".nm-filter-chip").forEach((c) => {
    c.classList.toggle("nm-filter-chip--active", c.dataset.filter === active);
    c.setAttribute("aria-pressed", c.dataset.filter === active ? "true" : "false");
  });
}

async function _ctrl(action) {
  const { error } = await apiPost(`/api/music/${action}`, {});
  if (error) toastError(`Gagal: ${action}`);
}

function _on(id, fn) {
  document.getElementById(id)?.addEventListener("click", fn);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _fmtDuration(ms) {
  if (!ms) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function _esc(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/**
 * @typedef {Object} MusicState
 * @property {object|null} track
 * @property {boolean} paused
 * @property {number} volume
 * @property {number} position
 * @property {string} filter
 * @property {object[]} queue
 */
