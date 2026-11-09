/**
 * Portfolio Page - Creator Portfolio
 * Showcase karya seni, musik, writing, coding, dan proyek interaktif
 */

class PortfolioPage {
  constructor() {
    this.currentCategory = "all";
    this.sortBy = "newest";
    this.viewMode = "grid";
    this.init();
  }

  init() {
    this.loadPortfolio();
    this.setupEventListeners();
    this.initCharts();
  }

  loadPortfolio() {
    fetch("/api/portfolio/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) this.updateProfileHeader(data.profile);
        if (data.works) this.updateWorks(data.works);
        if (data.pinned) this.updatePinned(data.pinned);
        if (data.analytics) this.updateAnalytics(data.analytics);
        if (data.social) this.updateSocial(data.social);
      })
      .catch((err) => console.warn("[Portfolio] Failed to load:", err));
  }

  updateProfileHeader(profile) {
    document.getElementById("portfolioName").textContent =
      profile.displayName || profile.username || "Kreator";
    document.getElementById("portfolioTagline").textContent =
      profile.tagline || "Maker · Builder · Dreamer";
    document.getElementById("portfolioAvatar").src =
      profile.avatar || "/assets/core/avatar.png";
    document.getElementById("portfolioBio").textContent =
      profile.bio || "Belum ada bio.";
    document.getElementById("portfolioTotalWorks").textContent =
      profile.totalWorks || 0;
    document.getElementById("portfolioTotalViews").textContent = (
      profile.totalViews || 0
    ).toLocaleString();
    document.getElementById("portfolioTotalLikes").textContent = (
      profile.totalLikes || 0
    ).toLocaleString();
    document.getElementById("portfolioFollowers").textContent = (
      profile.followers || 0
    ).toLocaleString();

    const tags = document.getElementById("portfolioTags");
    if (tags && profile.tags) {
      tags.innerHTML = profile.tags
        .map((t, i) => {
          const classes = [
            "badge-success",
            "badge-info",
            "badge-warning",
            "badge-primary",
          ];
          return `<span class="badge ${classes[i % classes.length]}" style="font-size:var(--text-xs);">${this.escapeHtml(t)}</span>`;
        })
        .join("");
    }

    const skills = document.getElementById("portfolioSkills");
    if (skills && profile.skills) {
      skills.innerHTML = profile.skills
        .map(
          (s) =>
            `<span class="badge badge-success" style="font-size:var(--text-xs);">${this.escapeHtml(s)}</span>`,
        )
        .join("");
    }
  }

  updateWorks(works) {
    const grid = document.getElementById("portfolioGrid");
    const countEl = document.getElementById("portfolioCount");
    const emptyEl = document.getElementById("portfolioEmpty");
    if (!grid) return;

    const search =
      document.getElementById("portfolioSearch")?.value?.toLowerCase() || "";

    let filtered = works || [];
    if (this.currentCategory !== "all") {
      filtered = filtered.filter((w) => w.category === this.currentCategory);
    }
    if (search) {
      filtered = filtered.filter(
        (w) =>
          w.title?.toLowerCase().includes(search) ||
          w.description?.toLowerCase().includes(search),
      );
    }

    // Sort
    switch (this.sortBy) {
      case "oldest":
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case "popular":
        filtered.sort((a, b) => b.likes - a.likes);
        break;
      case "views":
        filtered.sort((a, b) => b.views - a.views);
        break;
      case "title":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (countEl) countEl.textContent = `${filtered.length} karya`;

    if (!filtered.length) {
      emptyEl.style.display = "flex";
      grid.innerHTML = "";
      return;
    }

    emptyEl.style.display = "none";

    grid.innerHTML = filtered
      .map(
        (work) => `
      <article class="card" style="padding:0; overflow:hidden; cursor:pointer; transition:all var(--spring-standard);" data-work-id="${work.id}">
        <div style="aspect-ratio:16/9; background:linear-gradient(135deg, ${work.gradientFrom || "#f472b6"}20 0%, ${work.gradientTo || "#22d3ee"}20 100%); border-bottom:1px solid var(--hairline); display:flex; align-items:center; justify-content:center; font-size:3rem; color:${work.gradientFrom || "var(--ui-primary)"}; position:relative; overflow:hidden;">
          ${work.thumbnail ? `<img src="${work.thumbnail}" alt="" style="width:100%; height:100%; object-fit:cover;">` : `<i class="${work.icon || "fa-solid fa-image"}" aria-hidden="true"></i>`}
          <div style="position:absolute; top:var(--space-2); left:var(--space-2); display:flex; gap:var(--space-1);">
            <span class="badge badge-${this.getCategoryBadgeClass(work.category)}" style="font-size:var(--text-xs);">${work.category}</span>
            ${work.featured ? '<span class="badge badge-warning" style="font-size:var(--text-xs);">Featured</span>' : ""}
            ${work.pinned ? '<span class="badge badge-primary" style="font-size:var(--text-xs);">Pinned</span>' : ""}
          </div>
          <div style="position:absolute; top:var(--space-2); right:var(--space-2);">
            <button type="button" class="btn btn-icon-only btn-ghost btn-sm" data-action="pin" data-work-id="${work.id}" title="${work.pinned ? "Unpin" : "Pin"}" aria-label="${work.pinned ? "Unpin" : "Pin"} karya">
              <i class="fa-solid fa-thumbtack" aria-hidden="true" style="color:${work.pinned ? "var(--color-warning)" : "var(--text-muted)"};"></i>
            </button>
          </div>
        </div>
        <div class="card-body" style="padding:var(--space-4);">
          <h3 style="font-family:var(--font-heading); font-size:var(--text-sm); font-weight:600; color:var(--ink); margin-bottom:var(--space-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(work.title)}</h3>
          <p style="font-size:var(--text-xs); color:var(--text-muted); margin-bottom:var(--space-3); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${this.escapeHtml(work.description)}</p>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-2);">
            <div style="display:flex; align-items:center; gap:var(--space-2); font-size:var(--text-xs); color:var(--text-muted); font-family:var(--font-mono);">
              <span><i class="fa-solid fa-eye" style="color:var(--accent-cyan);" aria-hidden="true"></i> ${(work.views || 0).toLocaleString()}</span>
              <span><i class="fa-solid fa-heart" style="color:var(--color-error);" aria-hidden="true"></i> ${(work.likes || 0).toLocaleString()}</span>
              <span><i class="fa-solid fa-comment" style="color:var(--color-info);" aria-hidden="true"></i> ${(work.comments || 0).toLocaleString()}</span>
            </div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">${new Date(work.createdAt).toLocaleDateString("id-ID")}</div>
          </div>
          <div style="display:flex; gap:var(--space-2); margin-top:var(--space-3);">
            <button type="button" class="btn btn-primary btn-sm" style="flex:1;" data-action="view" data-work-id="${work.id}">Lihat</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-work-id="${work.id}">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-work-id="${work.id}" style="color:var(--color-error);"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>
        </div>
      </article>
    `,
      )
      .join("");

    // Add event listeners
    grid.querySelectorAll("article").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        this.viewWork(card.dataset.workId);
      });
    });

    grid.querySelectorAll('[data-action="view"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.viewWork(btn.dataset.workId);
      });
    });

    grid.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.editWork(btn.dataset.workId);
      });
    });

    grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteWork(btn.dataset.workId);
      });
    });

    grid.querySelectorAll('[data-action="pin"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePin(btn.dataset.workId);
      });
    });
  }

  getCategoryBadgeClass(category) {
    const classes = {
      art: "primary",
      music: "warning",
      writing: "info",
      code: "success",
      "3d": "warning",
      other: "neutral",
    };
    return classes[category] || "neutral";
  }

  updatePinned(pinned) {
    const container = document.getElementById("portfolioPinned");
    if (!container) return;

    if (!pinned?.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1; padding:var(--space-8); border:none; background:transparent;">
          <div class="empty-state-icon" style="background:var(--amber-dim); border-color:rgba(245,158,11,0.3); color:var(--color-warning);">
            <i class="fa-solid fa-thumbtack" style="font-size:2.5rem;"></i>
          </div>
          <h3 class="empty-state-title">Belum Ada Karya Dipin</h3>
          <p class="empty-state-body">Pin hingga 6 karya terbaik Anda untuk ditampilkan di sini.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = pinned
      .map(
        (work) => `
      <article class="card" style="padding:var(--space-4); border-color:rgba(245,158,11,0.3);">
        <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-2);">
          <div style="width:48px; height:48px; border-radius:var(--radius-lg); background:var(--amber-dim); border:1px solid rgba(245,158,11,0.3); display:flex; align-items:center; justify-content:center; font-size:1.25rem; color:var(--color-warning); flex-shrink:0;">
            <i class="${work.icon || "fa-solid fa-thumbtack"}" aria-hidden="true"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; color:var(--ink); font-size:var(--text-sm); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(work.title)}</div>
            <div style="font-size:var(--text-xs); color:var(--text-muted);">${work.category} · ${work.views?.toLocaleString() || 0} views</div>
          </div>
          <button type="button" class="btn btn-icon-only btn-ghost btn-sm" data-action="unpin" data-work-id="${work.id}" aria-label="Unpin">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <p style="font-size:var(--text-xs); color:var(--text-muted); line-height:1.4;">${this.escapeHtml(work.description)}</p>
      </article>
    `,
      )
      .join("");

    container.querySelectorAll('[data-action="unpin"]').forEach((btn) => {
      btn.addEventListener("click", () => this.togglePin(btn.dataset.workId));
    });
  }

  viewWork(workId) {
    window.location.href = `/portfolio/work/${workId}`;
  }

  editWork(workId) {
    NauraOS.showToast({
      title: "Edit Karya",
      message: "Form edit - Coming soon",
      type: "info",
    });
  }

  deleteWork(workId) {
    if (confirm("Hapus karya ini? Tindakan ini tidak dapat dibatalkan.")) {
      fetch(`/api/portfolio/work/${workId}`, { method: "DELETE" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            NauraOS.showToast({
              title: "Berhasil",
              message: "Karya dihapus",
              type: "success",
            });
            this.loadPortfolio();
          } else {
            NauraOS.showToast({
              title: "Gagal",
              message: data.error,
              type: "error",
            });
          }
        })
        .catch((err) => {
          NauraOS.showToast({
            title: "Error",
            message: "Gagal menghapus karya",
            type: "error",
          });
        });
    }
  }

  togglePin(workId) {
    fetch(`/api/portfolio/work/${workId}/pin`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Berhasil",
            message: data.pinned ? "Karya dipin" : "Pin dihapus",
            type: "success",
          });
          this.loadPortfolio();
        } else {
          NauraOS.showToast({
            title: "Gagal",
            message: data.error,
            type: "error",
          });
        }
      })
      .catch((err) => {
        NauraOS.showToast({
          title: "Error",
          message: "Gagal pin karya",
          type: "error",
        });
      });
  }

  updateAnalytics(analytics) {
    if (this.viewsChart) {
      this.viewsChart.data.datasets[0].data = analytics.views || [];
      this.viewsChart.update("none");
    }
    if (this.engagementChart) {
      this.engagementChart.data.datasets[0].data = analytics.likes || [];
      this.engagementChart.data.datasets[1].data = analytics.comments || [];
      this.engagementChart.update("none");
    }
    if (this.categoryChart) {
      this.categoryChart.data.datasets[0].data =
        analytics.categoryBreakdown || [];
      this.categoryChart.update("none");
    }
  }

  updateSocial(social) {
    document.getElementById("socialWebsite").value = social.website || "";
    document.getElementById("socialGitHub").value = social.github || "";
    document.getElementById("socialTwitter").value = social.twitter || "";
    document.getElementById("socialDiscord").value = social.discord || "";
    document.getElementById("socialYouTube").value = social.youtube || "";
    document.getElementById("socialSoundCloud").value = social.soundcloud || "";
    document.getElementById("socialArtStation").value = social.artstation || "";
    document.getElementById("socialBehance").value = social.behance || "";
  }

  initCharts() {
    if (typeof Chart === "undefined") return;
    const viewsCtx = document.getElementById("portfolioViewsChart");
    if (viewsCtx) {
      this.viewsChart = new Chart(viewsCtx, {
        type: "bar",
        data: {
          labels: Array(30).fill(""),
          datasets: [
            {
              label: "Views",
              data: Array(30).fill(0),
              backgroundColor: "rgba(34,211,238,0.6)",
              borderColor: "#22d3ee",
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "#94a3b8" },
            },
          },
        },
      });
    }

    const engagementCtx = document.getElementById("portfolioEngagementChart");
    if (engagementCtx) {
      this.engagementChart = new Chart(engagementCtx, {
        type: "line",
        data: {
          labels: Array(30).fill(""),
          datasets: [
            {
              label: "Likes",
              data: Array(30).fill(0),
              borderColor: "#f472b6",
              backgroundColor: "rgba(244,114,182,0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 0,
            },
            {
              label: "Comments",
              data: Array(30).fill(0),
              borderColor: "#34d399",
              backgroundColor: "rgba(52,211,153,0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: {
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "#94a3b8" },
            },
          },
        },
      });
    }

    const categoryCtx = document.getElementById("portfolioCategoryChart");
    if (categoryCtx) {
      this.categoryChart = new Chart(categoryCtx, {
        type: "doughnut",
        data: {
          labels: [
            "Seni Digital",
            "Musik",
            "Writing",
            "Coding",
            "3D & Game",
            "Lainnya",
          ],
          datasets: [
            {
              data: [0, 0, 0, 0, 0, 0],
              backgroundColor: [
                "#f472b6",
                "#f59e0b",
                "#38bdf8",
                "#22c55e",
                "#a78bfa",
                "#9ca3af",
              ],
              borderWidth: 0,
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: { legend: { display: false } },
        },
      });
    }
  }

  setupEventListeners() {
    // Category filter
    document.querySelectorAll(".portfolio-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentCategory = btn.dataset.cat;
        document.querySelectorAll(".portfolio-cat-btn").forEach((b) => {
          b.className =
            b === btn
              ? "btn btn-primary btn-sm portfolio-cat-btn"
              : "btn btn-ghost btn-sm portfolio-cat-btn";
        });
        this.loadPortfolio();
      });
    });

    // Search & sort
    document
      .getElementById("portfolioSearch")
      ?.addEventListener("input", () => this.loadPortfolio());
    document
      .getElementById("portfolioSort")
      ?.addEventListener("change", (e) => {
        this.sortBy = e.target.value;
        this.loadPortfolio();
      });

    // Grid/List view toggle
    document
      .getElementById("portfolioBtnGridView")
      ?.addEventListener("click", () => this.setViewMode("grid"));
    document
      .getElementById("portfolioBtnListView")
      ?.addEventListener("click", () => this.setViewMode("list"));

    // Add work
    document
      .getElementById("portfolioBtnAddWork")
      ?.addEventListener("click", () => this.openAddWorkModal());
    document
      .getElementById("portfolioEmptyBtnAdd")
      ?.addEventListener("click", () => this.openAddWorkModal());

    // Header actions
    document
      .getElementById("portfolioBtnRefresh")
      ?.addEventListener("click", () => this.loadPortfolio());
    document
      .getElementById("portfolioBtnEditProfile")
      ?.addEventListener("click", () =>
        NauraOS.showToast({
          title: "Edit Profil",
          message: "Coming soon",
          type: "info",
        }),
      );
    document
      .getElementById("portfolioBtnSettings")
      ?.addEventListener("click", () => (window.location.href = "/settings"));
    document
      .getElementById("portfolioBtnManagePinned")
      ?.addEventListener("click", () =>
        NauraOS.showToast({
          title: "Kelola Pin",
          message: "Coming soon",
          type: "info",
        }),
      );

    // Social save
    document
      .getElementById("portfolioBtnSaveSocial")
      ?.addEventListener("click", () => this.saveSocial());
    document
      .getElementById("portfolioBtnResetSocial")
      ?.addEventListener("click", () => this.loadPortfolio());
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const grid = document.getElementById("portfolioGrid");
    if (grid) {
      grid.style.gridTemplateColumns =
        mode === "grid" ? "repeat(auto-fill, minmax(320px, 1fr))" : "1fr";
    }
    document.getElementById("portfolioBtnGridView").className =
      mode === "grid" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm";
    document.getElementById("portfolioBtnListView").className =
      mode === "list" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm";
  }

  openAddWorkModal() {
    NauraOS.showModal({
      title: "Tambah Karya Baru",
      content: `
        <div style="display:flex; flex-direction:column; gap:var(--space-4);">
          <div class="form-group">
            <label class="form-label">Judul</label>
            <input type="text" id="modalWorkTitle" class="form-input" placeholder="Judul karya" aria-label="Judul">
          </div>
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select id="modalWorkCategory" class="form-select" aria-label="Kategori">
              <option value="art">Seni Digital</option>
              <option value="music">Musik</option>
              <option value="writing">Writing</option>
              <option value="code">Coding</option>
              <option value="3d">3D & Game</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <textarea id="modalWorkDesc" class="form-textarea" rows="4" placeholder="Deskripsikan karya Anda..." aria-label="Deskripsi"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Thumbnail URL (opsional)</label>
            <input type="url" id="modalWorkThumbnail" class="form-input" placeholder="https://..." aria-label="Thumbnail">
          </div>
        </div>
      `,
      actions: [
        { label: "Batal", variant: "btn-ghost", onClick: () => {} },
        {
          label: "Tambah Karya",
          variant: "btn-primary",
          onClick: () => this.createWork(),
        },
      ],
    });
  }

  createWork() {
    const title = document.getElementById("modalWorkTitle")?.value?.trim();
    const category = document.getElementById("modalWorkCategory")?.value;
    const description = document.getElementById("modalWorkDesc")?.value?.trim();
    const thumbnail = document
      .getElementById("modalWorkThumbnail")
      ?.value?.trim();

    if (!title) {
      NauraOS.showToast({
        title: "Error",
        message: "Judul tidak boleh kosong",
        type: "error",
      });
      return;
    }

    fetch("/api/portfolio/work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, description, thumbnail }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Berhasil",
            message: "Karya ditambahkan",
            type: "success",
          });
          this.loadPortfolio();
        } else {
          NauraOS.showToast({
            title: "Gagal",
            message: data.error,
            type: "error",
          });
        }
      })
      .catch((err) => {
        NauraOS.showToast({
          title: "Error",
          message: "Gagal menambahkan karya",
          type: "error",
        });
      });
  }

  saveSocial() {
    const social = {
      website: document.getElementById("socialWebsite").value,
      github: document.getElementById("socialGitHub").value,
      twitter: document.getElementById("socialTwitter").value,
      discord: document.getElementById("socialDiscord").value,
      youtube: document.getElementById("socialYouTube").value,
      soundcloud: document.getElementById("socialSoundCloud").value,
      artstation: document.getElementById("socialArtStation").value,
      behance: document.getElementById("socialBehance").value,
    };

    fetch("/api/portfolio/social", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(social),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          NauraOS.showToast({
            title: "Berhasil",
            message: "Tautan sosial disimpan",
            type: "success",
          });
        } else {
          NauraOS.showToast({
            title: "Gagal",
            message: data.error,
            type: "error",
          });
        }
      })
      .catch((err) => {
        NauraOS.showToast({
          title: "Error",
          message: "Gagal menyimpan tautan",
          type: "error",
        });
      });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.portfolioPage = new PortfolioPage();
});
