/**
 * leaderboard.js, Logic halaman Leaderboard.
 *
 * Job: "Lihat posisi rankingku dan perbandingan dengan top server."
 * UX: Posisi user sendiri selalu "terlihat" di antara list.
 */

import { initBottomNav }    from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch }         from "../core/api.js";
import { getUser }          from "../core/auth.js";

/** Filter aktif saat ini */
let _activeFilter = "nc";
let _activeRange  = "all";

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  initReveal();

  _setupFilters();
  await _loadLeaderboard();
});

// ── Filter Setup ──────────────────────────────────────────────────────────────

function _setupFilters() {
  document.querySelectorAll(".nm-lb-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.filter;
      const range = btn.dataset.range;
      if (type)  { _activeFilter = type; }
      if (range) { _activeRange  = range; }
      document.querySelectorAll("[data-filter]").forEach((b) => {
        b.classList.toggle("nm-filter-chip--active", b.dataset.filter === _activeFilter);
        b.setAttribute("aria-pressed", b.dataset.filter === _activeFilter ? "true" : "false");
      });
      document.querySelectorAll("[data-range]").forEach((b) => {
        b.classList.toggle("nm-filter-chip--active", b.dataset.range === _activeRange);
        b.setAttribute("aria-pressed", b.dataset.range === _activeRange ? "true" : "false");
      });
      _loadLeaderboard();
    });
  });
}

// ── Leaderboard Load ──────────────────────────────────────────────────────────

async function _loadLeaderboard() {
  const user = await getUser();
  const el   = document.getElementById("lb-list");
  if (!el) return;

  // Skeleton loading
  el.innerHTML = Array.from({ length: 8 }, () => `
    <div class="nm-lb-row">
      <div class="nm-skeleton" style="width:24px;height:16px"></div>
      <div class="nm-skeleton" style="width:32px;height:32px;border-radius:50%"></div>
      <div class="nm-skeleton" style="flex:1;height:16px"></div>
      <div class="nm-skeleton" style="width:60px;height:16px"></div>
    </div>
  `).join("");

  const { data, error } = await apiFetch(
    `/api/leaderboard?type=${_activeFilter}&range=${_activeRange}`,
  );

  if (error || !data?.entries?.length) {
    el.innerHTML = `
      <div class="nm-empty" style="min-height:120px">
        <p class="nm-empty__title">Data belum tersedia</p>
        <p class="nm-empty__desc">Mulai aktif di server untuk masuk leaderboard!</p>
      </div>`;
    return;
  }

  const myRank  = data.selfRank ?? null;
  const entries = data.entries;

  // Top 3 kartu highlight
  const top3El = document.getElementById("lb-top3");
  if (top3El) {
    const medals = ["🥇", "🥈", "🥉"];
    top3El.innerHTML = entries.slice(0, 3).map((e, i) => `
      <div class="nm-card" style="display:flex;align-items:center;gap:var(--sp-sm);padding:var(--sp-sm) var(--sp-md)">
        <span style="font-size:1.25rem;flex-shrink:0">${medals[i]}</span>
        <img src="${e.avatar || _defaultAvatar(e.userId)}" alt="${e.username}"
             class="nm-lb-row__avatar" loading="lazy">
        <div style="flex:1;overflow:hidden">
          <p style="font-size:0.875rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(e.displayName || e.username)}</p>
          <p style="font-size:0.6875rem;color:var(--muted)">Lv ${e.level ?? "?"}</p>
        </div>
        <span class="nm-lb-row__value">${_fmtVal(e.value, _activeFilter)}</span>
      </div>
    `).join("");
  }

  // Render list #4 dst.
  let html = "";
  let selfInserted = false;

  entries.slice(3).forEach((e) => {
    // Sisipkan posisi user sendiri sebelum entri yang ranknya lebih tinggi dari user
    if (myRank && !selfInserted && e.rank > myRank && myRank > 3) {
      html += _renderSelfRow(data.selfEntry, myRank, true);
      selfInserted = true;
    }
    html += _renderRow(e, e.userId === user?.id);
  });

  // Jika user tidak muncul di list (di luar 50 besar)
  if (myRank && !selfInserted && myRank > 3 && data.selfEntry) {
    html += `<div class="nm-lb-row" style="opacity:0.5;font-size:0.6875rem;color:var(--muted);padding:var(--sp-xs) 0;text-align:center">···</div>`;
    html += _renderSelfRow(data.selfEntry, myRank, true);
  }

  el.innerHTML = html || `<p style="font-size:0.8125rem;color:var(--muted);padding:var(--sp-sm)">Tidak ada data</p>`;
}

// ── Row Templates ─────────────────────────────────────────────────────────────

function _renderRow(e, isSelf) {
  return `
    <div class="nm-lb-row ${isSelf ? "nm-lb-row--self" : ""}">
      <span class="nm-lb-row__rank">#${e.rank}</span>
      <img src="${e.avatar || _defaultAvatar(e.userId)}" alt="${e.username}"
           class="nm-lb-row__avatar" loading="lazy">
      <span class="nm-lb-row__name">${_esc(e.displayName || e.username)}</span>
      <span class="nm-lb-row__value">${_fmtVal(e.value, _activeFilter)}</span>
    </div>`;
}

function _renderSelfRow(e, rank, sticky) {
  return `
    <div class="nm-lb-row nm-lb-row--self" ${sticky ? 'style="position:sticky;bottom:calc(var(--nav-height) + 20px)"' : ""}>
      <span class="nm-lb-row__rank" style="color:var(--primary)">#${rank}</span>
      <img src="${e?.avatar || _defaultAvatar(e?.userId)}" alt="Kamu" class="nm-lb-row__avatar" loading="lazy">
      <span class="nm-lb-row__name" style="color:var(--primary)">Kamu</span>
      <span class="nm-lb-row__value">${_fmtVal(e?.value, _activeFilter)}</span>
    </div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _fmtVal(v, type) {
  if (v === undefined || v === null) return "-";
  const n = Number(v);
  if (type === "nc" || type === "nsf") {
    return n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);
  }
  return String(n);
}

function _esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function _defaultAvatar(id) {
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(id || 0) >> 22n) % 6n}.png`;
}
