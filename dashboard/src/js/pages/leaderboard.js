/**
 * Leaderboard Page - Global Leaderboard
 * NC, Level, Survival, Arcade, Clan, VP, BP, Weekly
 */

class LeaderboardPage {
  constructor() {
    this.socket = null;
    this.currentCategory = "nc";
    this.currentGuild = null;
    this.currentPage = 1;
    this.pageSize = 25;
    this.init();
  }

  init() {
    this.connectSocket();
    this.loadGuilds();
    this.loadLeaderboard();
    this.setupEventListeners();
  }

  connectSocket() {
    this.socket = io("/dashboard", {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    this.socket.on("connect", () => {
      this.socket.emit("subscribe", { rooms: ["leaderboard"] });
    });

    this.socket.on("leaderboard:update", (data) => {
      if (data.category === this.currentCategory) {
        this.renderLeaderboard(data.entries || []);
      }
    });
  }

  loadGuilds() {
    fetch("/api/guilds/manageable")
      .then((r) => r.json())
      .then((data) => {
        const select = document.getElementById("lbGuildSelect");
        if (!select) return;
        select.innerHTML =
          '<option value="">Semua Server</option>' +
          (data.guilds || [])
            .map(
              (g) =>
                `<option value="${g.id}">${this.escapeHtml(g.name)}</option>`,
            )
            .join("");
      })
      .catch((err) =>
        console.warn("[Leaderboard] Failed to load guilds:", err),
      );
  }

  loadLeaderboard() {
    const categoryType = {
      nc: "nc",
      level: "xp",
      survival: "nsf",
      arcade: "trivia",
      clan: "quest",
      vp: "wealth",
      bp: "wealth",
      weekly: "wealth",
    };
    const params = new URLSearchParams({
      type: categoryType[this.currentCategory] || "nc",
      guildId: this.currentGuild || "",
      limit: 100,
    });

    fetch(`/api/leaderboard?${params}`)
      .then((r) => r.json())
      .then((data) => {
        this.allEntries = data.entries || [];
        this.currentPage = 1;
        this.renderPage();
      })
      .catch((err) => console.warn("[Leaderboard] Failed to load:", err));
  }

  renderPage() {
    const all = this.allEntries || [];
    const search = (document.getElementById("lbSearch")?.value || "").toLowerCase();
    const filtered = search
      ? all.filter((e) => (e.username || "").toLowerCase().includes(search))
      : all;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const start = (this.currentPage - 1) * this.pageSize;
    this.renderLeaderboard(filtered.slice(start, start + this.pageSize), filtered);
    this.updatePagination({ total, totalPages });
  }

  renderLeaderboard(entries, globalEntries) {
    const tbody = document.getElementById("lbTableBody");
    if (!tbody) return;

    // Podium top 3 (global, bukan halaman aktif)
    const top3 = (globalEntries || entries).slice(0, 3);
    if (top3[0])
      document.getElementById("lbPos1Name").textContent = top3[0].username;
    if (top3[0])
      document.getElementById("lbPos1Value").textContent = this.formatValue(
        top3[0].value,
      );
    if (top3[1])
      document.getElementById("lbPos2Name").textContent = top3[1].username;
    if (top3[1])
      document.getElementById("lbPos2Value").textContent = this.formatValue(
        top3[1].value,
      );
    if (top3[2])
      document.getElementById("lbPos3Name").textContent = top3[2].username;
    if (top3[2])
      document.getElementById("lbPos3Value").textContent = this.formatValue(
        top3[2].value,
      );

    if (!entries.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center; padding:var(--space-6); color:var(--text-muted);">Belum ada data</td></tr>';
      return;
    }

    const startRank = (this.currentPage - 1) * this.pageSize;

    tbody.innerHTML = entries
      .map((entry, i) => {
        const rank = startRank + i + 1;
        const change = entry.change || 0;
        const winrate = entry.totalGames
          ? ((entry.wins / entry.totalGames) * 100).toFixed(1)
          : 0;

        return `
        <tr style="transition:background var(--duration-fast) var(--ease-out); ${rank <= 3 ? "background:var(--ui-primary-glow);" : ""}">
          <td style="font-family:var(--font-mono); font-size:var(--text-xs); font-weight:700; color:${rank === 1 ? "#ffd700" : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : "var(--text-primary)"};">${rank}</td>
          <td style="font-weight:600; color:var(--ink);">${this.escapeHtml(entry.username)}</td>
          <td style="font-size:var(--text-xs); color:var(--text-muted); max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(entry.guildName || "-")}</td>
          <td style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-warning); font-weight:700;">${this.formatValue(entry.value)}</td>
          <td>
            ${
              change > 0
                ? `<span class="badge badge-success" style="font-size:var(--text-xs);">▲ ${change}</span>`
                : change < 0
                  ? `<span class="badge badge-error" style="font-size:var(--text-xs);">▼ ${Math.abs(change)}</span>`
                  : '<span class="badge badge-neutral" style="font-size:var(--text-xs);">-</span>'
            }
          </td>
          <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${entry.level || "-"}</td>
          <td style="font-family:var(--font-mono); font-size:var(--text-xs);">${winrate}%</td>
          <td>
            <button type="button" class="btn btn-ghost btn-sm" style="padding:var(--space-1) var(--space-2);" data-action="view" data-user-id="${entry.userId}" aria-label="Lihat profil">
              <i class="fa-solid fa-eye" aria-hidden="true"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    // Add view handlers
    tbody.querySelectorAll('[data-action="view"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.href = `/profile/${btn.dataset.userId}`;
      });
    });
  }

  formatValue(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(2) + "M";
    if (val >= 1000) return (val / 1000).toFixed(1) + "K";
    return val?.toLocaleString() || "0";
  }

  updatePagination(pagination) {
    if (!pagination) return;
    const info = document.getElementById("lbPaginationInfo");
    if (info) {
      info.textContent = `Menampilkan ${(this.currentPage - 1) * this.pageSize + 1}-${Math.min(this.currentPage * this.pageSize, pagination.total)} dari ${pagination.total}`;
    }

    const prevBtn = document.querySelector("#lbPagination .btn:first-child");
    const nextBtn = document.querySelector("#lbPagination .btn:last-child");
    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= pagination.totalPages;
  }

  setupEventListeners() {
    const catSelect = document.getElementById("lbCategorySelect");
    const guildSelect = document.getElementById("lbGuildSelect");
    const search = document.getElementById("lbSearch");
    const pageSize = document.getElementById("lbPageSize");

    catSelect?.addEventListener("change", (e) => {
      this.currentCategory = e.target.value;
      this.currentPage = 1;
      this.loadLeaderboard();
    });

    guildSelect?.addEventListener("change", (e) => {
      this.currentGuild = e.target.value || null;
      this.currentPage = 1;
      this.loadLeaderboard();
    });

    search?.addEventListener("input", () => {
      clearTimeout(search._timer);
      search._timer = setTimeout(() => {
        this.currentPage = 1;
        this.renderPage();
      }, 300);
    });

    pageSize?.addEventListener("change", (e) => {
      this.pageSize = parseInt(e.target.value);
      this.currentPage = 1;
      this.renderPage();
    });

    document.getElementById("lbPagination")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn || btn.disabled) return;
      if (btn.getAttribute("aria-label") === "Halaman sebelumnya") {
        this.currentPage--;
      } else if (btn.getAttribute("aria-label") === "Halaman berikutnya") {
        this.currentPage++;
      }
      this.renderPage();
    });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.leaderboardPage = new LeaderboardPage();
});
