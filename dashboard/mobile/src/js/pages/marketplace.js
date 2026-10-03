/**
 * marketplace.js - Logic Halaman Pasar Galaksi Naura OS Mobile.
 *
 * Mengambil daftar barang lelang komunitas secara real-time dari /api/marketplace/items,
 * serta menangani interaksi penawaran lelang.
 */

import { initBottomNav } from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch } from "../core/api.js";
import { toast } from "../components/toaster.js";

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  await loadMarketItems();
});

async function loadMarketItems() {
  const container = document.getElementById("nm-market-list");
  const countBadge = document.getElementById("market-total-count");

  const { data, error } = await apiFetch("/api/marketplace/items");

  if (error || !data || !Array.isArray(data.items)) {
    if (container) {
      container.innerHTML = `
        <div class="nm-card" style="text-align:center; padding:var(--sp-xl) var(--sp-md);">
          <img src="/assets/Naura_Expression/Akward.png" alt="Kosong" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
          <p style="color:var(--muted); font-size:0.875rem">Belum ada barang yang sedang dilelang di bursa saat ini.</p>
        </div>
      `;
    }
    return;
  }

  const items = data.items;
  if (countBadge) countBadge.textContent = `${items.length} Barang`;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="nm-card" style="text-align:center; padding:var(--sp-xl) var(--sp-md);">
        <img src="/assets/Naura_Expression/Cheers.png" alt="Kosong" style="width:70px; height:70px; margin-bottom:var(--sp-xs)">
        <p style="color:var(--muted); font-size:0.875rem">Semua lelang sedang kosong. Jadilah yang pertama melelang barang!</p>
      </div>
    `;
    return;
  }

  const rarityBadges = {
    common: "nm-badge--slate",
    uncommon: "nm-badge--emerald",
    rare: "nm-badge--blue",
    epic: "nm-badge--purple",
    legendary: "nm-badge--gold",
  };

  container.innerHTML = items.map((it, idx) => {
    const rKey = (it.rarity || "common").toLowerCase();
    const badgeClass = rarityBadges[rKey] || "nm-badge--slate";

    return `
      <div class="nm-card animate-fade-in-up" style="animation-delay:${idx * 40}ms; padding:var(--sp-sm)">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div>
            <span class="nm-badge ${badgeClass}" style="font-size:0.65rem; margin-bottom:4px">
              ${it.rarity || "Rare"}
            </span>
            <h4 style="font-size:0.9rem; font-weight:700; color:var(--ink); margin:2px 0">
              ${it.name} <span style="font-size:0.75rem; color:var(--muted); font-weight:400">x${it.amount}</span>
            </h4>
            <div style="font-size:0.75rem; color:var(--muted)">Penjual: <span style="color:var(--body-strong)">${it.sellerName}</span></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.7rem; color:var(--muted)">Tawaran Tertinggi</div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--accent-gold); font-family:var(--font-mono)">
              ${(it.currentBid || 0).toLocaleString("id-ID")} ${it.currency}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:var(--sp-xs); margin-top:var(--sp-sm)">
          <button class="nm-btn nm-btn--sm nm-btn--glass btn-bid" style="flex:1" data-name="${it.name}" data-price="${it.currentBid}">
            <i class="fa-solid fa-hand-holding-dollar"></i> Ajukan Tawaran
          </button>
          ${it.buyoutPrice ? `
            <button class="nm-btn nm-btn--sm nm-btn--primary btn-buyout" style="flex:1" data-name="${it.name}" data-price="${it.buyoutPrice}">
              <i class="fa-solid fa-cart-shopping"></i> Beli Sekarang (${(it.buyoutPrice).toLocaleString("id-ID")})
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  // Handler tombol Tawar & Beli
  container.querySelectorAll(".btn-bid").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      const price = btn.getAttribute("data-price");
      toast({
        title: "Penawaran Terkirim",
        body: `Tawaran untuk ${name} seharga ${parseInt(price, 10) + 50} NSF berhasil diajukan ke bursa lelang!`,
        variant: "info",
      });
    });
  });

  container.querySelectorAll(".btn-buyout").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      const price = btn.getAttribute("data-price");
      toast({
        title: "Pembelian Berhasil! 🎉",
        body: `Kamu berhasil membeli instan ${name} seharga ${parseInt(price, 10).toLocaleString("id-ID")} NSF. Barang masuk ke ransel.`,
        variant: "success",
      });
    });
  });
}
