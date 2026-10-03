/**
 * inventory.js - Logic Halaman Ransel & Tas Naura OS Mobile.
 *
 * Mengambil data inventaris real-time dari /api/inventory,
 * menampilkan status durability peralatan survival, dan filter kategori item.
 */

import { initBottomNav } from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch } from "../core/api.js";
import { toast } from "../components/toaster.js";

let allItems = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  _setupTabs();
  await loadInventory();
});

function _setupTabs() {
  const tabs = document.querySelectorAll(".nm-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      currentFilter = tab.getAttribute("data-filter") || "all";
      renderItems();
    });
  });
}

async function loadInventory() {
  const grid = document.getElementById("nm-inventory-grid");
  const { data, error } = await apiFetch("/api/inventory");

  if (error || !data) {
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: var(--sp-xl) var(--sp-md);">
          <img src="/assets/Naura_Expression/Sad.png" alt="Sedih" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
          <p style="color:var(--muted); font-size:0.875rem">Gagal memuat ransel petualang.</p>
        </div>
      `;
    }
    return;
  }

  // Update Kapasitas Tas
  const capacity = data.capacity || { used: 0, max: 30 };
  const slotEl = document.getElementById("nm-inv-slots");
  const progEl = document.getElementById("nm-inv-progress");
  const descEl = document.getElementById("nm-inv-weight-desc");

  const pct = Math.min(100, Math.round((capacity.used / (capacity.max || 30)) * 100));
  if (slotEl) slotEl.textContent = `${capacity.used}/${capacity.max} Slot`;
  if (progEl) {
    progEl.style.width = `${pct}%`;
    progEl.className = pct > 85 ? "nm-progress__bar nm-progress__bar--danger" : "nm-progress__bar nm-progress__bar--emerald";
  }
  if (descEl) {
    descEl.textContent = data.isGuest
      ? "Mode pratinjau tamu. Masuk lewat Discord untuk membawa ransel aslimu."
      : `Beban tas terpakai ${pct}%. Ruang penyimpanan masih tersedia.`;
  }

  // Update Peralatan Survival
  const tools = data.tools || {};
  if (tools.pickaxe) {
    const el = document.getElementById("tool-pickaxe-dura");
    if (el) el.textContent = `${tools.pickaxe.durability || 100}%`;
  }
  if (tools.axe) {
    const el = document.getElementById("tool-axe-dura");
    if (el) el.textContent = `${tools.axe.durability || 100}%`;
  }
  if (tools.rod) {
    const el = document.getElementById("tool-rod-dura");
    if (el) el.textContent = `${tools.rod.durability || 100}%`;
  }

  allItems = Array.isArray(data.items) ? data.items : [];
  renderItems();
}

function renderItems() {
  const grid = document.getElementById("nm-inventory-grid");
  if (!grid) return;

  const filtered = allItems.filter((item) => {
    if (currentFilter === "all") return true;
    return (item.category || "").toLowerCase() === currentFilter.toLowerCase();
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: var(--sp-xl) var(--sp-md);">
        <img src="/assets/Naura_Expression/Cheers.png" alt="Kosong" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
        <p style="color:var(--muted); font-size:0.875rem">Tidak ada item di kategori ini.</p>
      </div>
    `;
    return;
  }

  const rarityColors = {
    common: "#9ca3af",
    uncommon: "#34d399",
    rare: "#38bdf8",
    epic: "#c084fc",
    legendary: "#fbbf24",
  };

  grid.innerHTML = filtered.map((item, idx) => {
    const rKey = (item.rarity || "common").toLowerCase();
    const borderCol = rarityColors[rKey] || rarityColors.common;
    const icon = item.icon || "fa-box";

    return `
      <div class="nm-card animate-fade-in-up"
           style="animation-delay:${idx * 40}ms; padding:var(--sp-xs); text-align:center; border-color:${borderCol}33; cursor:pointer;"
           data-item-name="${item.name || item.id}"
           data-item-desc="${item.description || "Material petualangan Naura Wilds."}">
        <div style="font-size:1.5rem; margin-bottom:4px; color:${borderCol}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div style="font-size:0.75rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
          ${item.name || item.id}
        </div>
        <div style="font-size:0.7rem; color:var(--muted); font-family:var(--font-mono)">
          x${item.count || item.amount || 1}
        </div>
      </div>
    `;
  }).join("");

  // Tambahkan event klik untuk inspect item
  grid.querySelectorAll(".nm-card").forEach((card) => {
    card.addEventListener("click", () => {
      const name = card.getAttribute("data-item-name");
      const desc = card.getAttribute("data-item-desc");
      toast({
        title: name,
        body: desc,
        variant: "info",
      });
    });
  });
}
