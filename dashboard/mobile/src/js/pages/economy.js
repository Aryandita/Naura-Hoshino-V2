/**
 * economy.js, Logic halaman Economy.
 *
 * Job: "Lihat saldo, transfer koin, pantau kondisi ekonomi server."
 */

import { initBottomNav }    from "../components/bottomNav.js";
import { applyTheme, loadTheme } from "../core/theme.js";
import { apiFetch, apiPost, invalidateCache } from "../core/api.js";
import { getUser, redirectToLogin } from "../core/auth.js";
import { toastError, toastSuccess, toastWarn } from "../components/toaster.js";

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(loadTheme());
  initBottomNav();
  initReveal();

  const user = await getUser();
  if (!user) { redirectToLogin(); return; }

  await _loadEconomy();
  _setupActions();
});

// ── API ──────────────────────────────────────────────────────────────────────

async function _loadEconomy() {
  const { data, error } = await apiFetch("/api/user/economy");
  if (error || !data) {
    toastError("Gagal memuat data ekonomi");
    return;
  }

  // Saldo
  _setText("eco-wallet", _fmt(data.wallet ?? 0));
  _setText("eco-bank",   _fmt(data.bank ?? 0));

  // Quick chips mengisi input transfer
  _setupQuickChips(data.wallet ?? 0);
}

// ── Transfer Modal ────────────────────────────────────────────────────────────

function _setupActions() {
  _on("eco-btn-transfer", () => _showTransferSheet("transfer"));
  _on("eco-btn-deposit",  () => _showTransferSheet("deposit"));
  _on("eco-btn-withdraw", () => _showTransferSheet("withdraw"));
}

function _showTransferSheet(type) {
  const labels = {
    transfer: { title: "Transfer NC", endpoint: "/api/economy/transfer",    needsTarget: true },
    deposit:  { title: "Setor ke Bank", endpoint: "/api/economy/deposit",   needsTarget: false },
    withdraw: { title: "Tarik dari Bank", endpoint: "/api/economy/withdraw",needsTarget: false },
  };

  const cfg = labels[type];

  const sheet = document.createElement("div");
  sheet.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;z-index:99;
    background:var(--canvas);border-top:1px solid var(--hairline);
    border-radius:var(--r-xxl) var(--r-xxl) 0 0;
    padding:var(--sp-lg) var(--sp-lg) calc(var(--sp-xxl) + var(--nav-safe));
    animation: sheet-up var(--dur-slow) var(--ease-spring) both;
  `;

  sheet.innerHTML = `
    <h3 style="font-family:var(--font-display);font-size:0.8rem;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--sp-lg)">${cfg.title}</h3>
    ${cfg.needsTarget ? `
      <label style="display:block;font-size:0.75rem;color:var(--body);margin-bottom:var(--sp-xs)">Username tujuan</label>
      <input id="eco-target" type="text" placeholder="@username"
        style="width:100%;padding:12px;background:var(--surface-glass);border:1px solid var(--hairline);border-radius:var(--r-lg);color:var(--ink);font-family:var(--font-body);font-size:0.875rem;margin-bottom:var(--sp-sm);outline:none">
    ` : ""}
    <label style="display:block;font-size:0.75rem;color:var(--body);margin-bottom:var(--sp-xs)">Jumlah NC</label>
    <input id="eco-amount" type="number" placeholder="0" min="1"
      style="width:100%;padding:12px;background:var(--surface-glass);border:1px solid var(--hairline);border-radius:var(--r-lg);color:var(--ink);font-family:var(--font-display);font-size:1rem;margin-bottom:var(--sp-sm);outline:none">
    <div class="nm-quick-chips" id="eco-quick-chips" style="margin-bottom:var(--sp-lg)"></div>
    <div style="display:flex;gap:var(--sp-xs)">
      <button class="nm-btn nm-btn--ghost nm-btn--full" id="eco-sheet-cancel">Batal</button>
      <button class="nm-btn nm-btn--primary nm-btn--full" id="eco-sheet-confirm">Konfirmasi</button>
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.style.cssText = `position:fixed;inset:0;z-index:98;background:rgba(11,12,16,0.6);backdrop-filter:blur(4px);animation:overlay-in var(--dur-normal) var(--ease-smooth) both`;

  const close = () => { sheet.remove(); overlay.remove(); };
  overlay.addEventListener("click", close);
  sheet.querySelector("#eco-sheet-cancel").addEventListener("click", close);

  // Quick preset chips di sheet
  const chips = sheet.querySelector("#eco-quick-chips");
  if (chips) {
    [10, 100, 1000, 5000].forEach((v) => {
      const c = document.createElement("button");
      c.className = "nm-quick-chip";
      c.textContent = `+${_fmt(v)}`;
      c.addEventListener("click", () => {
        const input = sheet.querySelector("#eco-amount");
        if (input) input.value = String((Number(input.value) || 0) + v);
      });
      chips.appendChild(c);
    });
  }

  sheet.querySelector("#eco-sheet-confirm").addEventListener("click", async () => {
    const amount = Number(sheet.querySelector("#eco-amount")?.value);
    const target = sheet.querySelector("#eco-target")?.value?.trim();

    if (!amount || amount <= 0) { toastWarn("Masukkan jumlah yang valid"); return; }
    if (cfg.needsTarget && !target) { toastWarn("Masukkan username tujuan"); return; }

    const payload = { amount };
    if (cfg.needsTarget) payload.target = target;

    const { error } = await apiPost(cfg.endpoint, payload);
    if (error) { toastError(`Gagal: ${error}`); return; }

    toastSuccess(cfg.title + " berhasil!");
    close();
    invalidateCache("/api/user/economy");
    _loadEconomy();
  });

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
}

// ── Quick chips di halaman utama ──────────────────────────────────────────────

function _setupQuickChips(wallet) {
  const el = document.getElementById("eco-main-chips");
  if (!el) return;
  const amounts = [
    Math.round(wallet * 0.1),
    Math.round(wallet * 0.25),
    Math.round(wallet * 0.5),
    wallet,
  ];
  const labels = ["10%", "25%", "50%", "MAX"];
  el.innerHTML = amounts.map((a, i) => `
    <button class="nm-quick-chip" data-amount="${a}">${labels[i]} (${_fmt(a)})</button>
  `).join("");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _on(id, fn) {
  document.getElementById(id)?.addEventListener("click", fn);
}

function _fmt(n) {
  if (typeof n !== "number") return "0";
  return n.toLocaleString("id-ID");
}
