/**
 * clan.js - Logic Halaman Klan & Sindikat Aliansi Naura OS Mobile.
 *
 * Mengambil data klan, status benteng teritori yang dikuasai,
 * serta menangani kontribusi energi secara interaktif.
 */

import { initBottomNav } from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch, apiPost } from "../core/api.js";
import { toast } from "../components/toaster.js";

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  await loadClanData();
  _setupContributeAction();
});

async function loadClanData() {
  const { data } = await apiFetch("/api/clan/info");

  if (data && data.clan) {
    const c = data.clan;
    const nameEl = document.getElementById("clan-name");
    const tagEl = document.getElementById("clan-tag");
    const descEl = document.getElementById("clan-desc");
    const lvlEl = document.getElementById("clan-level");
    const memEl = document.getElementById("clan-members-count");
    const treEl = document.getElementById("clan-treasury");

    if (nameEl) nameEl.textContent = c.name || "Sensei Brigade";
    if (tagEl) tagEl.textContent = `[${c.tag || "VIP"}]`;
    if (descEl) descEl.textContent = c.description || "Sindikat petualang tangguh Naura Wilds.";
    if (lvlEl) lvlEl.textContent = `Lv. ${c.level || 1}`;
    if (memEl) memEl.textContent = `${c.memberCount || 1} Org`;
    if (treEl) treEl.textContent = `${(c.treasury || 0).toLocaleString("id-ID")}`;

    // Render Members
    const membersList = document.getElementById("clan-members-list");
    if (membersList && Array.isArray(c.members)) {
      membersList.innerHTML = c.members.map((m) => `
        <div class="nm-card" style="display:flex; align-items:center; justify-content:space-between; padding:var(--sp-xs) var(--sp-sm); background:rgba(255,255,255,0.02)">
          <div style="display:flex; align-items:center; gap:var(--sp-xs)">
            <img src="${m.avatar || "/assets/core/avatar.png"}" alt="${m.name}" style="width:32px; height:32px; border-radius:50%; object-fit:cover">
            <div>
              <div style="font-size:0.8125rem; font-weight:600">${m.name}</div>
              <div style="font-size:0.7rem; color:var(--muted)">${m.role || "Anggota"}</div>
            </div>
          </div>
          <span class="nm-badge ${m.role === "Ketua" ? "nm-badge--gold" : "nm-badge--purple"}" style="font-size:0.65rem">
            ${m.role === "Ketua" ? "Pemimpin" : "Petualang"}
          </span>
        </div>
      `).join("");
    }
  } else {
    // Mode demo / belum bergabung klan
    const membersList = document.getElementById("clan-members-list");
    if (membersList) {
      membersList.innerHTML = `
        <div class="nm-card" style="display:flex; align-items:center; justify-content:space-between; padding:var(--sp-xs) var(--sp-sm); background:rgba(255,255,255,0.02)">
          <div style="display:flex; align-items:center; gap:var(--sp-xs)">
            <img src="/assets/core/avatar.png" alt="Sensei" style="width:32px; height:32px; border-radius:50%">
            <div>
              <div style="font-size:0.8125rem; font-weight:600">Commander Sensei</div>
              <div style="font-size:0.7rem; color:var(--muted)">Ketua Sindikat</div>
            </div>
          </div>
          <span class="nm-badge nm-badge--gold" style="font-size:0.65rem">Pemimpin</span>
        </div>
      `;
    }
  }
}

function _setupContributeAction() {
  const btn = document.getElementById("btn-contribute-energy");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mendonasikan...';

    const { data, error } = await apiPost("/api/territory/contribute", {
      territoryId: "tower_1",
      energyAmount: 100,
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Donasi 50 NSF';

    if (error) {
      toast({
        title: "Donasi Gagal",
        body: error,
        variant: "danger",
      });
      return;
    }

    toast({
      title: "Kontribusi Sukses! ⚡",
      body: data.message || "Pertahanan teritori klan bertambah kokoh!",
      variant: "success",
    });

    if (data.currentPoints) {
      const tpEl = document.getElementById("territory-points");
      const progEl = document.getElementById("territory-progress");
      if (tpEl) tpEl.textContent = `${data.currentPoints}/1000 CP`;
      if (progEl) progEl.style.width = `${Math.min(100, Math.round((data.currentPoints / 1000) * 100))}%`;
    }
  });
}
